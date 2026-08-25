const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ExcelJS = require('exceljs');

// Helper to check for ADMIN role strictly for Reports
const requireAdmin = authorize(['ADMIN']);

// 1. Fetch Assets for Reports
router.get('/assets', authenticate, requireAdmin, async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            include: {
                location: true,
                department: true,
                assignedEmployee: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(assets);
    } catch (error) {
        console.error('Reports Assets Error:', error);
        res.status(500).json({ error: 'Failed to retrieve assets for reports' });
    }
});

// 2. Fetch Assignments for Reports
router.get('/assignments', authenticate, requireAdmin, async (req, res) => {
    try {
        const assignments = await prisma.assetAssignment.findMany({
            include: {
                asset: true,
                employee: true
            },
            orderBy: { assignedDate: 'desc' }
        });
        res.json(assignments);
    } catch (error) {
        console.error('Reports Assignments Error:', error);
        res.status(500).json({ error: 'Failed to retrieve assignments for reports' });
    }
});

// 3. Fetch Maintenance for Reports
router.get('/maintenance', authenticate, requireAdmin, async (req, res) => {
    try {
        const maintenance = await prisma.maintenanceLog.findMany({
            include: {
                asset: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(maintenance);
    } catch (error) {
        console.error('Reports Maintenance Error:', error);
        res.status(500).json({ error: 'Failed to retrieve maintenance logs for reports' });
    }
});

// 4. Download All Data (Consolidated Excel Export)
router.get('/download-all', authenticate, requireAdmin, async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            include: {
                location: true,
                department: true,
                assignedEmployee: {
                    include: {
                        department: true,
                        location: true
                    }
                }
            }
        });

        // Sort order for assignmentType
        const sortOrder = {
            'EMPLOYEE': 1,
            'LOCATION': 2,
            'DEPARTMENT': 3,
            'SHARED': 4,
            'STORE': 5,
            'INSTORE': 5
        };

        // Sort assets by custom assignmentType order, then assetCode asc
        assets.sort((a, b) => {
            const typeA = a.assignmentType || '';
            const typeB = b.assignmentType || '';
            
            const orderA = sortOrder[typeA] || 99;
            const orderB = sortOrder[typeB] || 99;
            
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            
            return (a.assetCode || '').localeCompare(b.assetCode || '');
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Asset Inventory');

        worksheet.columns = [
            { header: 'assignmentType', key: 'assignmentType', width: 20 },
            { header: 'locationName', key: 'locationName', width: 25 },
            { header: 'departmentName', key: 'departmentName', width: 25 },
            { header: 'employeeCode', key: 'employeeCode', width: 20 },
            { header: 'employeeName', key: 'employeeName', width: 30 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'Phone', key: 'Phone', width: 20 },
            { header: 'designation', key: 'designation', width: 25 },
            { header: 'employeeStatus', key: 'employeeStatus', width: 20 },
            { header: 'deviceType', key: 'deviceType', width: 20 },
            { header: 'model', key: 'model', width: 25 },
            { header: 'serialNumber', key: 'serialNumber', width: 25 },
            { header: 'assetCode', key: 'assetCode', width: 25 },
            { header: 'processor', key: 'processor', width: 20 },
            { header: 'ram', key: 'ram', width: 15 },
            { header: 'storage', key: 'storage', width: 15 },
            { header: 'operatingSystem', key: 'operatingSystem', width: 20 },
            { header: 'vendor', key: 'vendor', width: 20 },
            { header: 'purchaseDate', key: 'purchaseDate', width: 20 },
            { header: 'warrantyExpiryDate', key: 'warrantyExpiryDate', width: 20 },
            { header: 'status', key: 'status', width: 20 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'condition', key: 'condition', width: 20 },
            { header: 'remarks', key: 'remarks', width: 40 }
        ];

        worksheet.getRow(1).font = { bold: true };

        assets.forEach(asset => {
            let locName = asset.location?.name || '';
            let deptName = asset.department?.name || '';

            if (asset.assignmentType === 'EMPLOYEE' && asset.assignedEmployee) {
                locName = asset.assignedEmployee.location?.name || '';
                deptName = asset.assignedEmployee.department?.name || '';
            } else if (asset.assignmentType === 'LOCATION') {
                locName = asset.location?.name || '';
                deptName = '';
            } else if (asset.assignmentType === 'DEPARTMENT') {
                locName = '';
                deptName = asset.department?.name || '';
            }

            const rowData = {
                assignmentType: asset.assignmentType || '',
                locationName: locName,
                departmentName: deptName,
                employeeCode: asset.assignedEmployee?.employeeCode || '',
                employeeName: asset.assignedEmployee?.fullName || '',
                email: asset.assignedEmployee?.email || '',
                Phone: asset.assignedEmployee?.phone || '',
                designation: asset.assignedEmployee?.designation || '',
                employeeStatus: asset.assignedEmployee?.status || '',
                deviceType: asset.deviceType || '',
                model: asset.model || '',
                serialNumber: asset.serialNumber || '',
                assetCode: asset.assetCode || '',
                processor: asset.processor || '',
                ram: asset.ram || '',
                storage: asset.storage || '',
                operatingSystem: asset.operatingSystem || '',
                vendor: asset.vendor || '',
                purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : '',
                warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.toISOString().split('T')[0] : '',
                status: asset.status || '',
                brand: asset.brand || '',
                condition: asset.condition || '',
                remarks: asset.remarks || ''
            };
            worksheet.addRow(rowData);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Euro_Motors_IT_Asset_Inventory_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Reports Download All Error:', error);
        res.status(500).json({ error: 'Failed to generate consolidated dataset' });
    }
});

module.exports = router;
