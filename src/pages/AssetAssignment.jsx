import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, Loader2, AlertCircle, Trash2, Undo2, MousePointer2, ListMinus, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

function DraggableAsset({ asset }) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id: `asset-${asset.id}`,
    data: asset
  });
  
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-grab active:cursor-grabbing shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-3">
      <GripVertical className="w-4 h-4 text-slate-400" />
      <div>
        <p className="font-bold text-sm text-slate-800 dark:text-white">{asset.assetCode}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{asset.model}</p>
      </div>
    </div>
  );
}

function DroppableEmployee({ employee }) {
  const {isOver, setNodeRef} = useDroppable({
    id: `emp-${employee.id}`,
    data: employee
  });

  return (
    <div ref={setNodeRef} className={`p-4 rounded-xl border-2 transition-all ${isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md scale-[1.02]' : 'border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
          {employee.fullName.charAt(0)}
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-white">{employee.fullName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{employee.employeeCode}</p>
        </div>
      </div>
      {isOver && (
        <div className="mt-2 text-[10px] font-bold text-blue-600 uppercase text-center tracking-widest bg-blue-100/50 rounded py-1">
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
  
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [employeeId, setEmployeeId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // UI State
  const [assignmentMode, setAssignmentMode] = useState('standard'); // 'standard' | 'dnd'
  const [empSearch, setEmpSearch] = useState('');
  const [astSearch, setAstSearch] = useState('');

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication required");
      
      const headers = { 'Authorization': `Bearer ${token}` };

      const [astRes, empRes, asgRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/assignments`, { headers })
      ]);

      if (!astRes.ok || !empRes.ok || !asgRes.ok) {
        throw new Error('Failed to synchronize deployment endpoints');
      }

      const [astData, empData, asgData] = await Promise.all([
        astRes.json(), empRes.json(), asgRes.json()
      ]);

      setAssets(astData);
      setEmployees(empData);
      setAssignments(asgData);
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

  const performAssignment = async (payload) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assignments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Assignment Transaction Failed');
      }

      showToast('Asset successfully deployed to employee profile.', 'success');
      await fetchData();
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assetId || !employeeId) {
       showToast("Asset and Employee bounds must be fulfilled.", "warning");
       return;
    }

    const payload = {
      assetId,
      employeeId,
      assignedDate: new Date(assignedDate).toISOString(),
      status: 'ACTIVE',
      remarks
    };

    const success = await performAssignment(payload);
    if (success) {
      setAssetId('');
      setEmployeeId('');
      setRemarks('');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const asset = active.data.current;
    const employee = over.data.current;

    const confirmed = await confirm({
      title: 'Confirm Drag & Drop Assignment',
      message: `Are you sure you want to assign asset ${asset.assetCode} (${asset.model}) to ${employee.fullName}?`,
      confirmText: 'Assign Asset'
    });

    if (!confirmed) return;

    await performAssignment({
      assetId: asset.id,
      employeeId: employee.id,
      assignedDate: new Date().toISOString(),
      status: 'ACTIVE',
      remarks: 'Assigned via Drag & Drop Studio'
    });
  };

  const handleReturn = async (id) => {
    const confirmed = await confirm({
      title: 'Confirm Check-in',
      message: 'Are you confirming the check-in/return of this hardware asset?',
      confirmText: 'Check-in Asset'
    });
    if (!confirmed) return;
    try {
      const token = localStorage.getItem('token');
      const payload = {
        status: 'RETURNED',
        returnedDate: new Date().toISOString()
      };

      const res = await fetch(`${API_URL}/assignments/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Return execution aborted safely. Missing dependency link.');
      
      showToast('Asset check-in resolved properly.', 'success');
      await fetchData();
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Confirm Wipe',
      message: 'Are you absolutely certain you want to wipe this historical assignment? This action cannot be reversed.',
      confirmText: 'Wipe Record'
    });
    if (!confirmed) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assignments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to wipe historical record');
      showToast('Historical record removed.', 'success');
      await fetchData();
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const availableAssets = assets.filter(a => a.status === 'AVAILABLE');
  const filteredDraggableAssets = availableAssets.filter(a => (a.assetCode + ' ' + a.model).toLowerCase().includes(astSearch.toLowerCase()));
  const filteredDroppableEmployees = employees.filter(e => (e.fullName + ' ' + e.employeeCode).toLowerCase().includes(empSearch.toLowerCase()));

  const filteredAssignments = assignments.filter(asg => {
    const q = searchTerm.toLowerCase();
    const empName = asg.employee?.fullName?.toLowerCase() || '';
    const astCode = asg.asset?.assetCode?.toLowerCase() || '';
    const astModel = asg.asset?.model?.toLowerCase() || '';
    
    return empName.includes(q) || astCode.includes(q) || astModel.includes(q);
  }).sort((a,b) => new Date(b.assignedDate) - new Date(a.assignedDate));

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Resolving assignment bindings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Error Mapping Logs</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchData} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Logic Binding
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Deployments</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage physical hardware lifecycle check-outs and check-ins.</p>
        </div>
        
        {canCreateEdit && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setAssignmentMode('standard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${assignmentMode === 'standard' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              <ListMinus className="w-4 h-4" /> Standard Form
            </button>
            <button 
              onClick={() => setAssignmentMode('dnd')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${assignmentMode === 'dnd' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              <MousePointer2 className="w-4 h-4" /> D&D Studio
            </button>
          </div>
        )}
      </div>

      {canCreateEdit && assignmentMode === 'dnd' && (
        <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 relative z-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <MousePointer2 className="w-5 h-5 text-blue-500" />
              Interactive Drag & Drop Studio
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Drag Available Stock to Target Employee</p>
          </div>
          
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[400px]">
              
              {/* Left Column: Draggable Assets */}
              <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Available Stock ({availableAssets.length})</h3>
                  <input 
                    type="text" placeholder="Search asset stock..." value={astSearch} onChange={e => setAstSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredDraggableAssets.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">No matching assets found.</div>
                  ) : filteredDraggableAssets.map(asset => (
                    <DraggableAsset key={asset.id} asset={asset} />
                  ))}
                </div>
              </div>

              {/* Right Column: Droppable Employees */}
              <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 relative z-0">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Target Personnel</h3>
                  <input 
                    type="text" placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {filteredDroppableEmployees.slice(0, 15).map(emp => (
                    <DroppableEmployee key={emp.id} employee={emp} />
                  ))}
                  {filteredDroppableEmployees.length > 15 && (
                    <div className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">Keep typing to refine search...</div>
                  )}
                </div>
              </div>

            </div>
          </DndContext>
        </div>
      )}

      {/* Standard Form and History */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Assignment Form Frame */}
        {canCreateEdit && assignmentMode === 'standard' && (
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 xl:col-span-1 h-fit pb-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Standard Check-Out
            </h2>
            <form className="space-y-5" onSubmit={handleAssign}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Personnel *</label>
                <select 
                  required value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                >
                  <option value="" disabled>Select User Identity...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employeeCode} - {emp.fullName}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hardware Asset *</label>
                <select 
                  required value={assetId} onChange={e => setAssetId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                >
                  <option value="" disabled>Select Stock Asset...</option>
                  {availableAssets.map(ast => (
                    <option key={ast.id} value={ast.id}>{ast.assetCode} - {ast.model}</option>
                  ))}
                </select>
                {availableAssets.length === 0 && <p className="text-xs text-amber-500 font-medium mt-1.5">No devices available in system stock.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Execution Date</label>
                <input 
                  type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Operation Remarks</label>
                <textarea 
                  value={remarks} onChange={e => setRemarks(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" 
                  rows="3" placeholder="Documentation / Condition State upon checkout..."
                />
              </div>

              <button type="submit" disabled={availableAssets.length === 0} className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed">
                Sign Out Physical Asset
              </button>
            </form>
          </div>
        )}

        {/* Global Historical Matrix Table */}
        <div className={`bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col ${canCreateEdit && assignmentMode === 'standard' ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white w-full">Audit & Return Hub</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Regex trace execution logs..."
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-9 p-2 outline-none w-full"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[500px]">
             {filteredAssignments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 mt-10">No assignment records discovered scaling parameters.</div>
             ) : (
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                    <tr>
                      <th className="px-4 py-3">Hardware Logic</th>
                      <th className="px-4 py-3">Identity Entity</th>
                      <th className="px-4 py-3">Execution Timeline</th>
                      <th className="px-4 py-3 text-center">Protocol State</th>
                      {canCreateEdit && <th className="px-4 py-3 text-right">Overrides</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAssignments.map((log) => {
                      const deployedDate = new Date(log.assignedDate).toLocaleDateString();
                      const returnedLogDate = log.returnedDate ? new Date(log.returnedDate).toLocaleDateString() : '--';
                      
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors group">
                          
                          <td className="px-4 py-3.5">
                             <div className="flex flex-col">
                               <span className="font-bold text-slate-800 dark:text-white">{log.asset?.assetCode || 'DELETED'}</span>
                               <span className="text-xs text-slate-500 mt-0.5">{log.asset?.model || 'Link Corrupted'}</span>
                             </div>
                          </td>
                          
                          <td className="px-4 py-3.5">
                             <div className="flex flex-col">
                               <span className="font-medium text-slate-700 dark:text-slate-300">{log.employee?.fullName || 'Terminated User'}</span>
                               <span className="text-xs font-mono text-slate-400 mt-0.5">{log.employee?.employeeCode}</span>
                             </div>
                          </td>
                          
                          <td className="px-4 py-3.5 whitespace-nowrap">
                             <div className="flex flex-col">
                                <span className="text-slate-800 dark:text-slate-300"><span className="text-xs text-slate-400 font-mono w-6 inline-block">OUT</span> {deployedDate}</span>
                                <span className={log.status === 'RETURNED' ? 'text-slate-600 dark:text-slate-500 mt-0.5' : 'text-slate-300 dark:text-slate-600 mt-0.5'}>
                                   <span className="text-xs font-mono w-6 inline-block">IN</span> {returnedLogDate}
                                </span>
                             </div>
                          </td>
                          
                          <td className="px-4 py-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                              log.status === 'ACTIVE' ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 shadow-sm' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {log.status === 'ACTIVE' ? 'DEPLOYED' : 'CHECKED IN'}
                            </span>
                          </td>
                          
                          {canCreateEdit && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                               <div className="flex items-center justify-end gap-1">
                                  {log.status === 'ACTIVE' && (
                                     <button onClick={() => handleReturn(log.id)} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5">
                                        <Undo2 className="w-3.5 h-3.5" />
                                        Return
                                     </button>
                                  )}
                                  
                                  {canDelete && (
                                     <button onClick={() => handleDelete(log.id)} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-1 opacity-100 lg:opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                  )}
                               </div>
                            </td>
                          )}

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
