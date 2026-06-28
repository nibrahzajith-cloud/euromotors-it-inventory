import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  
  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Create CSV rows
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  // Create Blob and trigger download
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportToPDF = (data, filename) => {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }
  
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    
    const headers = Object.keys(data[0]);
    const body = data.map(row => headers.map(header => row[header] || ''));
    
    pdf.setFontSize(14);
    pdf.text(filename.replace(/_/g, ' '), 40, 40);
    
    autoTable(pdf, {
      head: [headers],
      body: body,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42] }, // Slate-900 theme
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 50 }
    });
    
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to generate PDF', error);
    alert('Failed to generate PDF. Check console for details.');
  }
};
