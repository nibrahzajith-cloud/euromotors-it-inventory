const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const records = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            assets: true
          }
        },
        employees: {
          take: 5,
          select: {
            id: true,
            fullName: true,
            designation: true,
            status: true
          }
        },
        assets: {
          take: 5,
          select: {
            id: true,
            assetCode: true,
            deviceType: true,
            model: true,
            status: true
          }
        }
      }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize(['ADMIN']), async (req, res) => {
  try {
    const record = await prisma.department.create({ data: req.body });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    const record = await prisma.department.update({ where: { id: req.params.id }, data: req.body });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
