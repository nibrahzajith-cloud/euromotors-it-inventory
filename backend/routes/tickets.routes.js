const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize, requireModule } = require('../middleware/auth.middleware');
const { isHelpDeskManager } = require('../utils/rbac');

router.use(authenticate);
router.use(requireModule('IT_HELP_DESK'));

// Generate unique ticket code
const generateTicketCode = async () => {
  const year = new Date().getFullYear();
  const count = await prisma.supportTicket.count();
  return `HD-${year}-${(count + 1).toString().padStart(6, '0')}`;
};

// Create a new support ticket (scoped to requester unless IT Manager/Admin)
router.post('/', async (req, res) => {
  try {
    const ticketCode = await generateTicketCode();
    let employeeId = req.user.employeeId || null;
    if (isHelpDeskManager(req.user.role) && req.body.employeeId) {
      employeeId = req.body.employeeId;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketCode,
        subject: req.body.subject,
        description: req.body.description,
        priority: req.body.priority || 'MEDIUM',
        requesterUserId: req.user.id,
        requesterName: req.user.fullName,
        requesterEmail: req.user.email,
        employeeId,
        assetId: req.body.assetId || null,
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Scoped ticket listing (employees only see their own tickets)
router.get('/', async (req, res) => {
  try {
    const where = isHelpDeskManager(req.user.role)
      ? {}
      : req.user.role === 'IT_OFFICER'
      ? { OR: [{ assignedToId: req.user.id }, { requesterUserId: req.user.id }] }
      : req.user.employeeId
      ? { OR: [{ requesterUserId: req.user.id }, { employeeId: req.user.employeeId }] }
      : { requesterUserId: req.user.id };

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        employee: { select: { fullName: true, department: true } },
        asset: { select: { assetCode: true, model: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ticket status
router.patch('/:id/status', authorize(['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']), async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };

    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete ticket (Admin / Head of IT only)
router.delete('/:id', authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    await prisma.supportTicket.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
