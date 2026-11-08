import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Resilient autoTable runner across all ESM/CJS bundlers
function runAutoTable(pdf, options) {
  if (typeof pdf.autoTable === 'function') {
    return pdf.autoTable(options);
  }
  if (typeof autoTable === 'function') {
    return autoTable(pdf, options);
  }
  if (autoTable?.default && typeof autoTable.default === 'function') {
    return autoTable.default(pdf, options);
  }
  throw new Error('PDF Table engine (jspdf-autotable) is not available.');
}

/**
 * Generates and downloads a clean, professional vector A4 PDF for Employee IT Asset Handover
 * with accurate Sri Lankan Rupee (LKR) valuation.
 *
 * @param {Object} handoverData - Data object containing employee, assignedAssets, valuationSummary, handoverReference, generatedAt
 * @param {string} [filename] - Optional custom filename
 */
export function downloadEmployeeHandoverPdf(handoverData, filename) {
  if (!handoverData) throw new Error('Handover data is required to generate PDF.');

  const emp = handoverData.employee || {};
  const assets = Array.isArray(handoverData.assignedAssets) ? handoverData.assignedAssets : [];
  const valSummary = handoverData.valuationSummary || {
    totalValueLKR: 0,
    formattedTotalLKR: 'LKR 0',
    pendingCount: 0,
    valuedCount: 0,
    isCompleteValuation: true,
    totalLabel: 'TOTAL IT ASSET VALUE'
  };

  const handoverRef = handoverData.handoverReference || `EM-HO-${emp.employeeCode || 'EMP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const generatedDate = handoverData.generatedAt 
    ? new Date(handoverData.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Sanitize filename for operating system safety
  const rawName = filename || `EuroMotors_Handover_${emp.employeeCode || 'Employee'}_${emp.fullName || 'Staff'}`;
  const cleanFilename = `${rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.pdf$/i, '')}.pdf`;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight; // 182mm

  // Top accent bar
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 4, 'F');

  // ==========================================
  // HEADER ROW 1: Branding (Left) & Ref Box (Right)
  // ==========================================
  // Left: Corporate Identity
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(15, 23, 42);
  pdf.text('EURO MOTORS', marginLeft, 15);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('PRIVATE LIMITED', marginLeft, 19.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Information Technology Department  •  Asset Custody Division', marginLeft, 23.5);

  // Right: Document Metadata Box (Strictly bounded so it never overlaps title)
  const refBoxWidth = 66;
  const refBoxX = pageWidth - marginRight - refBoxWidth; // 130mm
  const refBoxY = 8;
  const refBoxHeight = 18;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(refBoxX, refBoxY, refBoxWidth, refBoxHeight, 1.5, 1.5, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`REF: ${handoverRef}`, refBoxX + 3.5, refBoxY + 5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Issue Date: ${generatedDate}`, refBoxX + 3.5, refBoxY + 10);
  pdf.text(`Assigned Assets: ${assets.length} Hardware Item${assets.length === 1 ? '' : 's'}`, refBoxX + 3.5, refBoxY + 14.5);

  // Top dividing rule
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.4);
  pdf.line(marginLeft, 28, pageWidth - marginRight, 28);

  // ==========================================
  // HEADER ROW 2: Full-Width Document Title
  // (Placed BELOW the top row — ZERO overlap!)
  // ==========================================
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(marginLeft, 31, contentWidth, 12, 1.5, 1.5, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('EMPLOYEE IT ASSET HANDOVER & ACKNOWLEDGMENT FORM', marginLeft + 4, 37);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(100, 116, 139);
  pdf.text('Official Hardware Custody Issuance, Valuation (LKR) & Responsibility Agreement', marginLeft + 4, 41);

  let currentY = 47;

  // ==========================================
  // SECTION 1: Recipient Employee Information
  // ==========================================
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. RECIPIENT EMPLOYEE INFORMATION', marginLeft, currentY);
  currentY += 2.5;

  const empBoxY = currentY;
  const empBoxHeight = 21;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(marginLeft, empBoxY, contentWidth, empBoxHeight, 1.5, 1.5, 'FD');

  const col1X = marginLeft + 3.5;
  const col2X = marginLeft + 64;
  const col3X = marginLeft + 124;

  const row1Y = empBoxY + 5;
  const row2Y = empBoxY + 10.5;
  const row3Y = empBoxY + 16;

  pdf.setFontSize(6.8);

  // Col 1
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Employee Name:', col1X, row1Y);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(emp.fullName || 'N/A'), col1X + 22, row1Y);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Employee ID:', col1X, row2Y);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(emp.employeeCode || 'N/A'), col1X + 22, row2Y);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Designation:', col1X, row3Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(String(emp.designation || 'Staff Member'), col1X + 22, row3Y);

  // Col 2
  pdf.setTextColor(100, 116, 139);
  pdf.text('Department:', col2X, row1Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(String(emp.department?.name || 'General Operations'), col2X + 18, row1Y);

  pdf.setTextColor(100, 116, 139);
  pdf.text('Base Location:', col2X, row2Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(String(emp.location?.name || 'Head Office'), col2X + 18, row2Y);

  pdf.setTextColor(100, 116, 139);
  pdf.text('Employment Status:', col2X, row3Y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(15, 23, 42);
  pdf.text(String(emp.status || 'ACTIVE'), col2X + 26, row3Y);

  // Col 3
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text('Corporate Email:', col3X, row1Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(String(emp.email || 'N/A'), col3X + 21, row1Y);

  pdf.setTextColor(100, 116, 139);
  pdf.text('Contact Phone:', col3X, row2Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(String(emp.phone || 'N/A'), col3X + 21, row2Y);

  pdf.setTextColor(100, 116, 139);
  pdf.text('Handover Date:', col3X, row3Y);
  pdf.setTextColor(30, 41, 59);
  pdf.text(generatedDate, col3X + 21, row3Y);

  currentY = empBoxY + empBoxHeight + 5;

  // ==========================================
  // SECTION 2: All IT Hardware Assets Currently Assigned
  // Includes Asset Value (LKR) Column
  // ==========================================
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('2. ALL IT HARDWARE ASSETS CURRENTLY ASSIGNED & VALUATION (LKR)', marginLeft, currentY);
  currentY += 2;

  const tableHeaders = ['#', 'Asset Code', 'Category', 'Make & Model', 'Serial Number', 'Condition', 'Assigned Date', 'Asset Value (LKR)'];

  const tableBody = assets.length > 0 
    ? assets.map((ast, idx) => {
        const asgDate = ast.assignedDate 
          ? new Date(ast.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';
        
        const valObj = ast.valuation || {};
        const formattedVal = valObj.formattedValue || (ast.estimatedValue ? `LKR ${Number(ast.estimatedValue).toLocaleString('en-LK')}` : 'Valuation Pending');
        const sourceLabel = valObj.source ? `\n(${valObj.source})` : '';

        return [
          String(idx + 1),
          String(ast.assetCode || ''),
          String(ast.deviceType || 'Hardware'),
          `${ast.brand || ''} ${ast.model || ''}`.trim() || '—',
          String(ast.serialNumber || 'N/A'),
          String(ast.condition || 'Good'),
          asgDate,
          `${formattedVal}${sourceLabel}`
        ];
      })
    : [['—', 'No hardware assets currently assigned to this employee.', '', '', '', '', '', '—']];

  runAutoTable(pdf, {
    startY: currentY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 20 },
      3: { cellWidth: 38 },
      4: { cellWidth: 26 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 21, halign: 'center' },
      7: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: marginLeft, right: marginRight }
  });

  currentY = (pdf.lastAutoTable?.finalY || currentY + 30) + 4;

  // ==========================================
  // SECTION 2B: TOTAL IT ASSET VALUE ALLOCATED TO EMPLOYEE
  // (Mandatory requirement from Task 4)
  // ==========================================
  if (currentY > pageHeight - 85) {
    pdf.addPage();
    currentY = 16;
  }

  const valCardY = currentY;
  const valCardHeight = 18;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(marginLeft, valCardY, contentWidth, valCardHeight, 1.5, 1.5, 'FD');

  // Left side of total card: Employee & Asset Count
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TOTAL IT ASSET VALUE ALLOCATED TO EMPLOYEE', marginLeft + 4, valCardY + 5.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Employee: ${emp.fullName || 'N/A'} (${emp.employeeCode || 'N/A'})  •  Total Assigned Assets: ${assets.length} Item(s)`, marginLeft + 4, valCardY + 10.5);

  const valDateFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const pendingText = valSummary.pendingCount > 0 
    ? `⚠️ Incomplete Valuation: ${valSummary.pendingCount} asset(s) pending valuation. Shown amount is Known Total.`
    : `Valuation Status: Complete & Verified as of ${valDateFormatted}`;
  
  pdf.setFont('helvetica', valSummary.pendingCount > 0 ? 'bold' : 'normal');
  pdf.setTextColor(valSummary.pendingCount > 0 ? 180 : 100, valSummary.pendingCount > 0 ? 83 : 116, valSummary.pendingCount > 0 ? 9 : 139);
  pdf.text(pendingText, marginLeft + 4, valCardY + 15);

  // Right side of total card: Amount in LKR
  const totalDisplayLKR = valSummary.formattedTotalLKR || (valSummary.totalValueLKR ? `LKR ${Number(valSummary.totalValueLKR).toLocaleString('en-LK')}` : 'LKR 0');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(totalDisplayLKR, pageWidth - marginRight - 4, valCardY + 8, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(valSummary.totalLabel || 'Estimated Total (LKR)', pageWidth - marginRight - 4, valCardY + 13.5, { align: 'right' });

  currentY = valCardY + valCardHeight + 5;

  // ==========================================
  // SECTION 3: Consolidated Accessories Checklist
  // ==========================================
  if (currentY > pageHeight - 75) {
    pdf.addPage();
    currentY = 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('3. ACCESSORIES & PERIPHERALS CUSTODY CHECKLIST', marginLeft, currentY);
  currentY += 2.5;

  const allIssuedAcc = [];
  assets.forEach(a => {
    if (Array.isArray(a.accessories)) {
      a.accessories.forEach(acc => {
        const name = typeof acc === 'string' ? acc : acc?.name;
        if (name && typeof name === 'string') allIssuedAcc.push(name.toLowerCase());
      });
    }
  });

  const checklist = [
    'Charger / Power Adapter',
    'Laptop Bag / Backpack',
    'USB Mouse',
    'External Keyboard',
    'Docking Station / Hub',
    'Headset / Earphones',
    'Tempered Glass / Case',
    'Monitor Display Cable'
  ];

  const accBoxY = currentY;
  const accBoxHeight = 15;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(marginLeft, accBoxY, contentWidth, accBoxHeight, 1.5, 1.5, 'FD');

  const checkColWidth = contentWidth / 4;
  checklist.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const itemX = marginLeft + (col * checkColWidth) + 3;
    const itemY = accBoxY + 5 + (row * 6);

    const isChecked = allIssuedAcc.some(a => item.toLowerCase().includes(a) || a.includes(item.toLowerCase().split(' ')[0]));

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    if (isChecked) {
      pdf.setTextColor(15, 23, 42);
      pdf.text('[X]', itemX, itemY);
    } else {
      pdf.setTextColor(148, 163, 184);
      pdf.text('[  ]', itemX, itemY);
    }

    pdf.setFont('helvetica', isChecked ? 'bold' : 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(isChecked ? 15 : 100, isChecked ? 23 : 116, isChecked ? 42 : 139);
    pdf.text(item, itemX + 5, itemY);
  });

  currentY = accBoxY + accBoxHeight + 5;

  // ==========================================
  // SECTION 4: Employee Acknowledgment Statement
  // ==========================================
  if (currentY > pageHeight - 65) {
    pdf.addPage();
    currentY = 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('4. EMPLOYEE ACKNOWLEDGMENT & RESPONSIBILITY STATEMENT', marginLeft, currentY);
  currentY += 2.5;

  const ackBoxY = currentY;
  const ackBoxHeight = 22;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(marginLeft, ackBoxY, contentWidth, ackBoxHeight, 1.5, 1.5, 'FD');

  const clauses = [
    '1. I confirm receipt of the listed company IT hardware, equipment and accessories in fully operational working condition.',
    '2. I accept personal custody and responsibility for safeguarding these assets against physical damage, loss, negligence, or unauthorized use.',
    '3. I agree to use all assigned hardware strictly for official company business in compliance with Euro Motors IT Security and Cyber Policies.',
    '4. In the event of hardware damage, malfunction, or loss, I agree to notify the Euro Motors IT Helpdesk immediately within 24 hours.',
    '5. I undertake to return all equipment, chargers, cables, and peripherals immediately upon request, transfer, or termination of employment.'
  ];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.2);
  pdf.setTextColor(51, 65, 85);
  clauses.forEach((clause, i) => {
    pdf.text(clause, marginLeft + 3, ackBoxY + 4 + (i * 3.6));
  });

  currentY = ackBoxY + ackBoxHeight + 5;

  // ==========================================
  // SECTION 5: Signatures
  // ==========================================
  if (currentY > pageHeight - 45) {
    pdf.addPage();
    currentY = 20;
  }

  const sigWidth = (contentWidth - 14) / 2;
  const sigLeftX = marginLeft;
  const sigRightX = marginLeft + sigWidth + 14;

  // Left: Employee Signature
  pdf.setDrawColor(100, 116, 139);
  pdf.setLineWidth(0.4);
  pdf.line(sigLeftX, currentY + 14, sigLeftX + sigWidth, currentY + 14);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Employee Acknowledgment & Signature', sigLeftX, currentY + 3);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Name: ${emp.fullName || '________________________'}`, sigLeftX, currentY + 7);
  pdf.text(`Employee Code: ${emp.employeeCode || '________'}`, sigLeftX, currentY + 11);
  pdf.text('Signature Date: ________________________', sigLeftX, currentY + 19);

  // Right: IT Officer Signature
  pdf.line(sigRightX, currentY + 14, sigRightX + sigWidth, currentY + 14);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Authorized IT Department Handover', sigRightX, currentY + 3);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(71, 85, 105);
  pdf.text('Officer Name: IT Department Custodian', sigRightX, currentY + 7);
  pdf.text('Euro Motors IT Operations & Asset Control', sigRightX, currentY + 11);
  pdf.text(`Handover Date: ${generatedDate}`, sigRightX, currentY + 19);

  // ==========================================
  // Footers on all pages
  // ==========================================
  const totalPages = (typeof pdf.getNumberOfPages === 'function') 
    ? pdf.getNumberOfPages() 
    : (pdf.internal?.getNumberOfPages ? pdf.internal.getNumberOfPages() : 1);

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.2);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `Euro Motors Private Limited  •  Standard IT Custody & Valuation Agreement  •  Ref: ${handoverRef}  •  Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  pdf.save(cleanFilename);
}

/**
 * Generates and downloads a clean vector A4 PDF for a single assignment handover.
 *
 * @param {Object} assignment - Assignment record with asset and employee
 * @param {string} [filename] - Optional custom filename
 */
export function downloadAssignmentHandoverPdf(assignment, filename) {
  if (!assignment) throw new Error('Assignment record is required to generate PDF.');

  const asset = assignment.asset || {};
  const employee = assignment.employee || {};

  const handoverData = {
    employee,
    assignedAssets: [{
      ...asset,
      assignedDate: assignment.assignedDate,
      accessories: assignment.accessories,
      remarks: assignment.remarks,
      valuation: asset.valuation || {
        formattedValue: asset.estimatedValue ? `LKR ${Number(asset.estimatedValue).toLocaleString('en-LK')}` : 'Valuation Pending',
        source: asset.valuationSource || 'Recorded Value'
      }
    }],
    valuationSummary: {
      totalValueLKR: asset.estimatedValue || asset.purchasePrice || 0,
      formattedTotalLKR: (asset.estimatedValue || asset.purchasePrice) ? `LKR ${Number(asset.estimatedValue || asset.purchasePrice).toLocaleString('en-LK')}` : 'Valuation Pending',
      pendingCount: (asset.estimatedValue || asset.purchasePrice) ? 0 : 1,
      valuedCount: (asset.estimatedValue || asset.purchasePrice) ? 1 : 0,
      isCompleteValuation: Boolean(asset.estimatedValue || asset.purchasePrice),
      totalLabel: 'TOTAL IT ASSET VALUE'
    },
    handoverReference: `EM-HO-${asset.assetCode || 'AST'}-${employee.employeeCode || 'EMP'}`,
    generatedAt: new Date().toISOString()
  };

  const cleanFilename = filename || `EuroMotors_Handover_${asset.assetCode || 'Asset'}_${employee.employeeCode || 'Employee'}.pdf`;
  downloadEmployeeHandoverPdf(handoverData, cleanFilename);
}
