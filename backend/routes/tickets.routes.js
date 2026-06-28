const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Generate unique ticket code
const generateTicketCode = async () => {
  const prefix = 'TKT';
  const count = await prisma.supportTicket.count();
  return `${prefix}-${(count + 1).toString().padStart(5, '0')}`;
};

// Create a new support ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const ticketCode = await generateTicketCode();
    // In a full implementation, the employee ID would come from the logged-in user if they are an employee.
    // For now, IT_OFFICER or ADMIN creates it on behalf of the employee.
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketCode,
        subject: req.body.subject,
        description: req.body.description,
        priority: req.body.priority || 'MEDIUM',
        employeeId: req.body.employeeId,
        assetId: req.body.assetId || null
      }
    });

    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all tickets
router.get('/debug', async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        employee: { select: { fullName: true, department: true } },
        asset: { select: { assetCode: true, model: true } }
      }
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        employee: { select: { fullName: true, department: true } },
        asset: { select: { assetCode: true, model: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ticket status
router.patch('/:id/status', authenticate, authorize('ADMIN', 'IT_OFFICER'), async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    res.json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete ticket
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.supportTicket.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
