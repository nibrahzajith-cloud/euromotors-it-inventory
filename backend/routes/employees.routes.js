const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// Everyone can view employees
router.get('/', async (req, res) => {
  try {
    const records = await prisma.employee.findMany({ 
      include: { 
        department: true, 
        location: true,
        assignedAssets: true,
        assignments: { where: { status: 'ACTIVE' } }
      } 
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin and IT Officer can modify
router.post('/', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const record = await prisma.employee.create({ data: req.body });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const record = await prisma.employee.update({ where: { id: req.params.id }, data: req.body });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Only Admin can delete
router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
