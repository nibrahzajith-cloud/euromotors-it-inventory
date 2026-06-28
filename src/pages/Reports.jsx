import { useState, useEffect } from 'react';
import { FileText, Download, MonitorSmartphone, Wrench, ShieldAlert, Users, Search, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const reportTabs = [
  { id: 'assets', name: 'Asset Report', icon: MonitorSmartphone },
  { id: 'assignments', name: 'Assignment Report', icon: Users },
  { id: 'maintenance', name: 'Maintenance Report', icon: Wrench },
  { id: 'warranty', name: 'Warranty Expiry Report', icon: ShieldAlert },
];

export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('assets');
  const [searchTerm, setSearchTerm] = useState('');

  const [assetsData, setAssetsData] = useState([]);
  const [assignmentsData, setAssignmentsData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication missing");
      const headers = { 'Authorization': `Bearer ${token}` };

      const [astRes, asgRes, mntRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/assignments`, { headers }),
        fetch(`${API_URL}/maintenance`, { headers })
      ]);

      if (!astRes.ok || !asgRes.ok || !mntRes.ok) throw new Error("Failed syncing report logs.");

      const [ast, asg, mnt] = await Promise.all([
        astRes.json(), asgRes.json(), mntRes.json()
      ]);

      setAssetsData(ast);
      setAssignmentsData(asg);
      setMaintenanceData(mnt);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Utility logic for warranty computations
  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  // Structured Maps mapped dynamically
  const generateReportData = () => {
    const q = searchTerm.toLowerCase();

    if (activeTab === 'assets') {
      return assetsData.filter(a =>
        (a.assetCode?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q) || a.status?.toLowerCase().includes(q))
      ).map(ast => ({
        'Asset Code': ast.assetCode,
        'Device Type': ast.deviceType,
        'Brand': ast.brand || '-',
        'Model': ast.model,
        'Serial Number': ast.serialNumber,
        'Status': ast.status,
        'Condition': ast.condition,
        'Purchase Date': ast.purchaseDate ? new Date(ast.purchaseDate).toLocaleDateString() : 'Unknown',
        'Warranty Expiry': ast.warrantyExpiryDate ? new Date(ast.warrantyExpiryDate).toLocaleDateString() : 'Unknown',
        'Department': ast.department?.name || 'Unassigned',
        'Location': ast.location?.name || 'Unassigned',
        'Assigned Employee': ast.assignedEmployee?.fullName || 'None'
      }));
    }

    if (activeTab === 'assignments') {
      return assignmentsData.filter(a =>
        (a.asset?.assetCode?.toLowerCase().includes(q) || a.employee?.fullName?.toLowerCase().includes(q) || a.status?.toLowerCase().includes(q))
      ).map(asg => ({
        'Asset Code': asg.asset?.assetCode || 'DELETED',
        'Employee Name': asg.employee?.fullName || 'DELETED',
        'Assigned Date': new Date(asg.assignedDate).toLocaleDateString(),
        'Returned Date': asg.returnedDate ? new Date(asg.returnedDate).toLocaleDateString() : 'Active',
        'Status': asg.status,
        'Remarks': asg.remarks || 'None'
      }));
    }

    if (activeTab === 'maintenance') {
      return maintenanceData.filter(m =>
        (m.asset?.assetCode?.toLowerCase().includes(q) || m.vendor?.toLowerCase().includes(q) || m.status?.toLowerCase().includes(q))
      ).map(mnt => ({
        'Asset Code': mnt.asset?.assetCode || 'DELETED',
        'Issue Description': mnt.issueDescription,
        'Repair Action': mnt.repairAction || 'None',
        'Vendor': mnt.vendor || 'Internal Fix',
        'Repair Cost': mnt.repairCost ? `$${mnt.repairCost.toFixed(2)}` : '$0.00',
        'Repair Date': mnt.repairDate ? new Date(mnt.repairDate).toLocaleDateString() : 'Ongoing',
        'Status': mnt.status,
        'Remarks': mnt.remarks || 'None'
      }));
    }

    if (activeTab === 'warranty') {
      return assetsData
        .filter(ast => ast.warrantyExpiryDate) // Purely filtering constraints
        .filter(ast => ast.assetCode?.toLowerCase().includes(q) || ast.deviceType?.toLowerCase().includes(q))
        .map(ast => {
          const days = getDaysRemaining(ast.warrantyExpiryDate);
          return {
            'Asset Code': ast.assetCode,
            'Device Type': ast.deviceType,
            'Serial Number': ast.serialNumber,
            'Warranty Status': ast.warrantyStatus,
            'Expiry Date': new Date(ast.warrantyExpiryDate).toLocaleDateString(),
            'Days Remaining': days < 0 ? 'Expired' : `${days} Days`,
            '_days': days // Internal sorter
          };
        })
        .sort((a, b) => a._days - b._days)
        .map(({ _days, ...rest }) => rest);
    }

    return [];
  };

  const dynamicDataMap = generateReportData();
  const reportHeaders = dynamicDataMap.length > 0 ? Object.keys(dynamicDataMap[0]) : [];

  const handleExportCSV = () => {
    if (dynamicDataMap.length === 0) {
      showToast("Nothing to export under the current constraint filter.", "warning");
      return;
    }

    const headerStr = reportHeaders.map(h => `"${h}"`).join(",");
    const rowsStr = dynamicDataMap.map(row =>
      reportHeaders.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const csvContent = `${headerStr}\n${rowsStr}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `IT_System_${activeTab}_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); // System export success
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Aggregating global asset bounds natively...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Export Block Blocked</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchData} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Aggregation Map
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Visual Component Headers dynamically constructed */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">Reporting Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Cross-referential tracking parameters globally across all matrices.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={dynamicDataMap.length === 0}
          className="flex items-center w-full md:w-auto justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export Live Table Output (CSV)
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[600px] overflow-hidden">

        {/* Dynamic Mapping Navigation Filter */}
        <div className="flex flex-col md:flex-row border-b border-slate-100">
          <div className="flex-1 overflow-x-auto">
            <div className="flex p-2 gap-1 min-w-max">
              {reportTabs.map(tab => {
                const isActive = activeTab === tab.id; // system
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:text-white'
                      }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 border-t md:border-t-0 md:border-l border-slate-100 flex items-center bg-slate-50/50">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Regex filter rendering data..."
                className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-9 p-2 outline-none shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Global Output Report Grid Output */}
        <div className="overflow-x-auto flex-1 bg-slate-50/30">
          {dynamicDataMap.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <FileText className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-lg font-medium text-slate-700">No Registry Found</h3>
              <p className="text-slate-500 mt-1 max-w-sm">There are absolutely no database mappings found natively across this exact filter trace.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 whitespace-nowrap sticky top-0 shadow-sm z-10 block-border">
                <tr>
                  {reportHeaders.map(h => (
                    <th key={h} className="px-5 py-3.5 tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dynamicDataMap.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    {reportHeaders.map(h => {
                      const cellData = row[h];
                      let badgeClass = '';
                      // Provide coloring dynamically mapping constraints logically
                      if (h === 'Status') {
                        badgeClass = cellData === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                          cellData === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' :
                            cellData === 'UNDER_REPAIR' || cellData === 'IN_PROGRESS' || cellData === 'OPEN' ? 'bg-orange-100 text-orange-700' :
                              cellData === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600';
                      }
                      if (h === 'Days Remaining') {
                        badgeClass = cellData === 'Expired' ? 'bg-red-100 text-red-700 font-bold' : '';
                      }

                      return (
                        <td key={h} className="px-5 py-3.5 whitespace-nowrap">
                          {badgeClass ? (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border shadow-sm border-black/5 ${badgeClass}`}>
                              {cellData}
                            </span>
                          ) : (
                            cellData
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center text-xs text-slate-500 font-medium tracking-wide">
          <span>Total Mappings Extracted: {dynamicDataMap.length} logic queries</span>
          <span>Filtered across Auth Token: <span className="uppercase text-blue-600 font-bold">{user?.role}</span></span>
        </div>

      </div>
    </div>
  );
}
