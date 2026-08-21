import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, Loader2, AlertCircle, Trash2, Undo2, MousePointer2, GripVertical, Building2, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

function DraggableAsset({ asset }) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id: `asset-${asset.id}`,
    data: asset
  });
  
  const style = {
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-grab active:cursor-grabbing shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-3 ${isDragging ? 'opacity-50' : ''}`}>
      <GripVertical className="w-4 h-4 text-slate-400" />
      <div>
        <p className="font-extrabold text-sm text-slate-900 dark:text-white">{asset.assetCode}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{asset.model}</p>
      </div>
    </div>
  );
}

function DraggableAssetOverlay({ asset }) {
  if (!asset) return null;
  return (
    <div className="pointer-events-none p-3 bg-white dark:bg-slate-800 border border-blue-500 rounded-xl shadow-2xl flex items-center gap-3 scale-105 rotate-2 cursor-grabbing z-[100]">
      <GripVertical className="w-4 h-4 text-blue-500" />
      <div>
        <p className="font-bold text-sm text-blue-700 dark:text-blue-300">{asset.assetCode}</p>
        <p className="text-xs text-blue-500/70">{asset.model}</p>
      </div>
    </div>
  );
}

function DroppableTarget({ id, data, title, subtitle, icon: Icon }) {
  const {isOver, setNodeRef} = useDroppable({
    id,
    data
  });

  return (
    <div ref={setNodeRef} className={`p-3 rounded-xl border transition-all ${isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm scale-[1.01]' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
          {Icon ? <Icon className="w-4 h-4" /> : title.charAt(0)}
        </div>
        <div className="overflow-hidden">
          <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
      {isOver && (
        <div className="mt-2 text-[10px] font-bold text-blue-600 uppercase text-center tracking-widest bg-blue-100/50 rounded py-0.5">
          Drop to Assign
        </div>
      )}
    </div>
  );
}

export default function AssetAssignment() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  
  const [assets, setAssets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetsCache')) || []; } catch(e) { return []; }
  });
  const [employees, setEmployees] = useState(() => {
    try { return JSON.parse(localStorage.getItem('employeesCache')) || []; } catch(e) { return []; }
  });
  const [assignments, setAssignments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assignmentsCache')) || []; } catch(e) { return []; }
  });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [loading, setLoading] = useState(assets.length === 0);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State for Standard Check-Out
  const [showManualModal, setShowManualModal] = useState(false);
  const [assignmentType, setAssignmentType] = useState('EMPLOYEE');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // UI State for D&D Studio
  const [targetTab, setTargetTab] = useState('EMPLOYEE'); // EMPLOYEE, DEPARTMENT, LOCATION
  const [astSearch, setAstSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [activeId, setActiveId] = useState(null);
  
  // Post-Drop details panel state
  const [pendingAssignment, setPendingAssignment] = useState(null);

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication required");
      const headers = { 'Authorization': `Bearer ${token}` };
      const [astRes, empRes, asgRes, deptRes, locRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/assignments`, { headers }),
        fetch(`${API_URL}/departments`, { headers }),
        fetch(`${API_URL}/locations`, { headers })
      ]);
      if (!astRes.ok || !empRes.ok || !asgRes.ok) throw new Error('Failed to synchronize deployment endpoints');
      
      const [astData, empData, asgData, deptData, locData] = await Promise.all([
        astRes.json(), empRes.json(), asgRes.json(),
        deptRes.ok ? deptRes.json() : [], locRes.ok ? locRes.json() : []
      ]);

      setAssets(astData); setEmployees(empData); setAssignments(asgData);
      setDepartments(deptData); setLocations(locData);
      localStorage.setItem('assetsCache', JSON.stringify(astData));
      localStorage.setItem('employeesCache', JSON.stringify(empData));
      localStorage.setItem('assignmentsCache', JSON.stringify(asgData));
      setError('');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const performAssignment = async (payload) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assignments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Assignment Transaction Failed');
      }
      showToast('Asset assigned successfully.', 'success');
      await fetchData();
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleManualAssign = async (e) => {
    e.preventDefault();
    if (!assetId) return showToast("Asset must be selected.", "warning");
    if (assignmentType === 'EMPLOYEE' && !employeeId) return showToast("Employee must be selected.", "warning");
    if (assignmentType === 'DEPARTMENT' && !departmentId) return showToast("Department must be selected.", "warning");
    if (assignmentType === 'LOCATION' && !locationId) return showToast("Location must be selected.", "warning");

    const payload = {
      assetId,
      assignmentType,
      employeeId: assignmentType === 'EMPLOYEE' ? employeeId : undefined,
      departmentId: assignmentType !== 'EMPLOYEE' ? departmentId : undefined,
      locationId: assignmentType !== 'EMPLOYEE' ? locationId : undefined,
      assignedDate: new Date(assignedDate).toISOString(),
      status: 'ACTIVE',
      remarks
    };

    if (await performAssignment(payload)) {
      setShowManualModal(false);
      setAssetId(''); setEmployeeId(''); setDepartmentId(''); setLocationId(''); setRemarks('');
    }
  };

  const handleDragStart = (event) => setActiveId(event.active.id);
  const handleDragCancel = () => setActiveId(null);

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    
    const asset = active.data.current;
    const target = over.data.current;
    
    setPendingAssignment({
      asset,
      target,
      assignmentType: target.type, // 'EMPLOYEE', 'DEPARTMENT', 'LOCATION'
      assignedDate: new Date().toISOString().split('T')[0],
      remarks: ''
    });
  };

  const submitPendingAssignment = async () => {
    if (!pendingAssignment) return;
    const payload = {
      assetId: pendingAssignment.asset.id,
      assignmentType: pendingAssignment.assignmentType,
      employeeId: pendingAssignment.assignmentType === 'EMPLOYEE' ? pendingAssignment.target.id : undefined,
      departmentId: pendingAssignment.assignmentType === 'DEPARTMENT' ? pendingAssignment.target.id : undefined,
      locationId: pendingAssignment.assignmentType === 'LOCATION' ? pendingAssignment.target.id : undefined,
      assignedDate: new Date(pendingAssignment.assignedDate).toISOString(),
      status: 'ACTIVE',
      remarks: pendingAssignment.remarks || 'Assigned via Drag & Drop Studio'
    };
    
    if (await performAssignment(payload)) {
      setPendingAssignment(null);
    }
  };

  const handleReturn = async (id) => {
    if (!await confirm({ title: 'Confirm Check-in', message: 'Return this hardware asset?', confirmText: 'Check-in Asset' })) return;
    try {
      const res = await fetch(`${API_URL}/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RETURNED', returnedDate: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Return failed.');
      showToast('Asset returned.', 'success');
      await fetchData();
    } catch(err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!await confirm({ title: 'Confirm Delete', message: 'Wipe historical assignment?', confirmText: 'Wipe Record' })) return;
    try {
      const res = await fetch(`${API_URL}/assignments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Delete failed.');
      showToast('Record deleted.', 'success');
      await fetchData();
    } catch(err) { showToast(err.message, 'error'); }
  };

  const availableAssets = assets.filter(a => a.status === 'AVAILABLE');
  const filteredAssets = availableAssets.filter(a => (a.assetCode + ' ' + (a.model || '')).toLowerCase().includes(astSearch.toLowerCase()));
  
  const getFilteredTargets = () => {
    const q = targetSearch.toLowerCase();
    if (targetTab === 'EMPLOYEE') {
      return employees.filter(e => (e.fullName + ' ' + (e.employeeCode || '')).toLowerCase().includes(q)).map(e => ({...e, type: 'EMPLOYEE'}));
    }
    if (targetTab === 'DEPARTMENT') {
      return departments.filter(d => d.name.toLowerCase().includes(q)).map(d => ({...d, type: 'DEPARTMENT'}));
    }
    if (targetTab === 'LOCATION') {
      return locations.filter(l => l.name.toLowerCase().includes(q)).map(l => ({...l, type: 'LOCATION'}));
    }
    return [];
  };
  const filteredTargets = getFilteredTargets();

  const filteredAssignments = assignments.filter(asg => {
    const q = searchTerm.toLowerCase();
    return asg.employee?.fullName?.toLowerCase().includes(q) || 
           asg.asset?.assetCode?.toLowerCase().includes(q) || 
           asg.asset?.model?.toLowerCase().includes(q);
  }).sort((a,b) => new Date(b.assignedDate) - new Date(a.assignedDate));

  if (loading) return <div className="flex h-64 justify-center items-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
  if (error) return <div className="flex h-64 justify-center items-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Deployments</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage physical hardware lifecycle assignments.</p>
        </div>
        {canCreateEdit && (
          <button onClick={() => setShowManualModal(true)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm">
            Manual Assignment
          </button>
        )}
      </div>

      {canCreateEdit && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-blue-500" />
              Drag & Drop Studio
            </h2>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              
              {/* Left Column: Assets */}
              <div className="p-4 h-[450px] flex flex-col bg-slate-50/30 dark:bg-slate-900/20">
                <div className="mb-3 sticky top-0 z-10">
                  <input type="text" placeholder="Search available assets..." value={astSearch} onChange={e => setAstSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredAssets.map(asset => <DraggableAsset key={asset.id} asset={asset} />)}
                  {filteredAssets.length === 0 && <div className="text-center text-slate-400 text-xs py-8">No matching assets found.</div>}
                </div>
              </div>

              {/* Right Column: Targets */}
              <div className="p-4 h-[450px] flex flex-col bg-slate-50/30 dark:bg-slate-900/20">
                <div className="mb-3 sticky top-0 z-10 space-y-2">
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {['EMPLOYEE', 'DEPARTMENT', 'LOCATION'].map(tab => (
                      <button key={tab} onClick={() => setTargetTab(tab)}
                        className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${targetTab === tab ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {tab.charAt(0) + tab.slice(1).toLowerCase()}s
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder={`Search ${targetTab.toLowerCase()}s...`} value={targetSearch} onChange={e => setTargetSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredTargets.map(target => (
                    <DroppableTarget 
                      key={target.id} 
                      id={`target-${target.id}`} 
                      data={target}
                      title={target.fullName || target.name}
                      subtitle={target.employeeCode || `${target.type.charAt(0) + target.type.slice(1).toLowerCase()} Entity`}
                      icon={target.type === 'DEPARTMENT' ? Building2 : target.type === 'LOCATION' ? MapPin : null}
                    />
                  ))}
                  {filteredTargets.length === 0 && <div className="text-center text-slate-400 text-xs py-8">No matching targets found.</div>}
                </div>
              </div>
            </div>
            
            <DragOverlay>
              {activeId ? <DraggableAssetOverlay asset={availableAssets.find(a => `asset-${a.id}` === activeId)} /> : null}
            </DragOverlay>
          </DndContext>

          {/* Post-Drop Details Panel */}
          {pendingAssignment && (
            <div className="border-t border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 p-5 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-blue-800 dark:text-blue-300">Confirm Assignment</h3>
                <button onClick={() => setPendingAssignment(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-4 mb-4 text-sm bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <div className="flex-1 truncate"><strong>Asset:</strong> {pendingAssignment.asset.assetCode} - {pendingAssignment.asset.model}</div>
                <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 truncate"><strong>Target:</strong> {pendingAssignment.target.fullName || pendingAssignment.target.name} ({pendingAssignment.assignmentType})</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assignment Date</label>
                  <input type="date" value={pendingAssignment.assignedDate} onChange={e => setPendingAssignment({...pendingAssignment, assignedDate: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                  <input type="text" value={pendingAssignment.remarks} onChange={e => setPendingAssignment({...pendingAssignment, remarks: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={submitPendingAssignment} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition">
                  Confirm Assignment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Historical Matrix Table */}
      <div className="w-full bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center gap-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Assignment History</h2>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search records..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 p-2 text-sm outline-none"
            />
          </div>
        </div>
        <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAssignments.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-800 dark:text-white">{log.asset?.assetCode}</p>
                    <p className="text-xs">{log.asset?.model}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {log.employee?.fullName || (log.asset?.assignmentType === 'DEPARTMENT' ? 'Department Asset' : log.asset?.assignmentType === 'LOCATION' ? 'Location Asset' : 'Non-Employee Entity')}
                    </p>
                    <p className="text-xs">{log.employee?.employeeCode || 'Check Timeline for details'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.status === 'ACTIVE' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {log.status === 'ACTIVE' ? 'Assigned' : 'Returned'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Assigned:</span> {new Date(log.assignedDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {log.status === 'RETURNED' && log.returnedDate && (
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Returned:</span> {new Date(log.returnedDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {canCreateEdit && log.status === 'ACTIVE' && (
                      <button onClick={() => handleReturn(log.id)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold bg-blue-50 px-2 py-1 rounded">Return</button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4 inline"/></button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAssignments.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-slate-500">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Assignment Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-blue-600" /> Manual Assignment</h2>
              <button type="button" onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleManualAssign} className="p-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Asset</label>
                  <select required value={assetId} onChange={e => setAssetId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                    <option value="">Select Asset...</option>
                    {availableAssets.map(a => <option key={a.id} value={a.id}>{a.assetCode} - {a.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Type</label>
                  <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                    <option value="EMPLOYEE">Employee</option>
                    <option value="DEPARTMENT">Department</option>
                    <option value="LOCATION">Location</option>
                    <option value="SHARED">Shared</option>
                    <option value="STORE">Store</option>
                  </select>
                </div>
                {assignmentType === 'EMPLOYEE' && (
                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Employee</label>
                    <select required value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                      <option value="">Select...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                    </select>
                  </div>
                )}
                {assignmentType === 'DEPARTMENT' && (
                   <div className="col-span-2">
                    <label className="block font-semibold mb-1">Department</label>
                    <select required value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                      <option value="">Select...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {(assignmentType === 'LOCATION' || assignmentType === 'STORE') && (
                   <div className="col-span-2">
                    <label className="block font-semibold mb-1">Location</label>
                    <select required value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                      <option value="">Select...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}
                {assignmentType === 'SHARED' && (
                  <>
                    <div>
                      <label className="block font-semibold mb-1">Department</label>
                      <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                        <option value="">Select...</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Location</label>
                      <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full border rounded-lg p-2 outline-none">
                        <option value="">Select...</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block font-semibold mb-1">Date</label>
                  <input type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} className="w-full border rounded-lg p-2 outline-none" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Remarks</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full border rounded-lg p-2 outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowManualModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Assign Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
