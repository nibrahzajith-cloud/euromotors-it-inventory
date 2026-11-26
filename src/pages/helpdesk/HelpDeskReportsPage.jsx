import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileBarChart, Download, Printer, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../utils/helpdeskApi';
import { HelpDeskSubNav } from './HelpDeskShared';

const REPORT_TYPES = [
  { id: 'daily', label: 'Daily IT Support Report' },
  { id: 'weekly', label: 'Weekly IT Support Report' },
  { id: 'monthly', label: 'Monthly IT Support Report' },
  { id: 'department', label: 'Department-wise Report' },
  { id: 'branch', label: 'Branch-wise Report' },
  { id: 'technician', label: 'Technician Performance Report' },
  { id: 'outstanding', label: 'Outstanding Tickets Report' },
  { id: 'overdue', label: 'Overdue Tickets Report' },
  { id: 'sla', label: 'SLA Compliance Report' },
  { id: 'satisfaction', label: 'Employee Satisfaction Report' },
  { id: 'asset-maintenance', label: 'Asset Maintenance History Report' },
  { id: 'category', label: 'Category-wise Incident Report' },
];

export default function HelpDeskReportsPage() {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [reportType, setReportType] = useState(searchParams.get('type') || 'monthly');
  const [options, setOptions] = useState({ categories: [], departments: [], locations: [], officers: [] });
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    departmentId: 'ALL',
    locationId: 'ALL',
    assignedToId: 'ALL',
    categoryId: 'ALL',
    priority: 'ALL',
  });
  const [reportData, setReportData] = useState({ rows: [], count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/helpdesk/form-options').then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: reportType });
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'ALL') params.set(k, v);
    });
    apiFetch(`/helpdesk/reports?${params.toString()}`)
      .then(setReportData)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [reportType, filters]);

  const rows = reportData.rows || [];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const activeTitle = REPORT_TYPES.find((r) => r.id === reportType)?.label || 'Help Desk Report';

  const exportPDF = () => {
    if (!rows.length) return showToast('No records to export.', 'warning');
    const pdf = new jsPDF('landscape');
    pdf.setFontSize(16);
    pdf.text(`Euro Motors IT Help Desk — ${activeTitle}`, 14, 20);
    pdf.setFontSize(9);
    pdf.text(`Generated: ${new Date().toLocaleString()} | Records: ${rows.length}`, 14, 28);
    autoTable(pdf, {
      head: [headers],
      body: rows.map((r) => headers.map((h) => String(r[h] ?? ''))),
      startY: 34,
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    pdf.save(`EuroMotors_HelpDesk_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportExcel = async () => {
    if (!rows.length) return showToast('No records to export.', 'warning');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(activeTitle.slice(0, 31));
    ws.addRow([`Euro Motors IT Help Desk — ${activeTitle}`]).font = { bold: true, size: 14 };
    ws.addRow([`Generated: ${new Date().toLocaleString()}`]);
    ws.addRow([]);
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };
    rows.forEach((r) => ws.addRow(headers.map((h) => r[h])));
    ws.columns.forEach((c) => { c.width = 20; });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `EuroMotors_HelpDesk_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <div className="print:hidden">
        <HelpDeskSubNav />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart className="w-6 h-6 text-blue-600" />
            Help Desk Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Filter, print, and export operational reports in PDF and Excel formats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={exportExcel} className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={exportPDF} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Report Type Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 print:hidden">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setReportType(rt.id)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
              reportType === rt.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-[#0d1424] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 print:hidden">
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
        <select value={filters.departmentId} onChange={(e) => setFilters((p) => ({ ...p, departmentId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Depts</option>
          {options.departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filters.locationId} onChange={(e) => setFilters((p) => ({ ...p, locationId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Branches</option>
          {options.locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filters.assignedToId} onChange={(e) => setFilters((p) => ({ ...p, assignedToId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Officers</option>
          {options.officers?.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
        </select>
        <select value={filters.categoryId} onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Categories</option>
          {options.categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">{activeTitle}</h2>
          <span className="text-xs font-bold text-slate-400">{rows.length} record(s)</span>
        </div>
        {loading ? (
          <div className="flex h-52 items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No records found for the selected report & filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {headers.map((h) => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {headers.map((h) => <td key={h} className="px-4 py-3 whitespace-nowrap">{String(row[h] ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
