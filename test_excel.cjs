const fs = require('fs');
const ExcelJS = require('exceljs');

async function testDownloadAll() {
  const API_URL = 'https://euromotors-it-inventory.onrender.com/api';
  console.log("=== CHECKING DOWNLOAD ALL DATA ===");
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nibrahz@euromotors.lk', password: 'Admin@123' })
    });
    
    if (loginRes.status !== 200) {
      console.log("Login failed", loginRes.status, await loginRes.text());
      return;
    }
    const token = (await loginRes.json()).token;

    const downloadRes = await fetch(`${API_URL}/reports/download-all`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (downloadRes.status !== 200) {
      console.log("Download failed", downloadRes.status, await downloadRes.text());
      return;
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('Asset Inventory');
    
    if (!worksheet) {
      console.log("Worksheet not found!");
      return;
    }

    console.log("Total rows:", worksheet.rowCount);
    let anjaleeFound = false;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const empCode = row.getCell(4).value;
      const empName = row.getCell(5).value;
      if (empCode === 'EMP-000000059' || (empName && empName.includes('Anjalee'))) {
        console.log(`Row ${rowNumber}: Code=${empCode}, Name=${empName}, Loc=${row.getCell(2).value}, Dept=${row.getCell(3).value}`);
        anjaleeFound = true;
      }
    });

    if (!anjaleeFound) console.log("Anjalee not found in the excel sheet.");

  } catch(e) {
    console.error(e);
  }
}

testDownloadAll();
