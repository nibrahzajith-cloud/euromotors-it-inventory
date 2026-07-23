import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, Loader2, AlertCircle, Trash2, Undo2, MousePointer2, ListMinus, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';

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
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-grab active:cursor-grabbing shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-3 ${isDragging ? 'opacity-50' : ''}`}>
      <GripVertical className="w-4 h-4 text-slate-400" />
      <div>
        <p className="font-bold text-sm text-slate-800 dark:text-white">{asset.assetCode}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{asset.model}</p>
      </div>
    </div>
  );
}

function DraggableAssetOverlay({ asset }) {
  if (!asset) return null;
  return (
    <div className="p-3 bg-white dark:bg-slate-800 border border-blue-500 rounded-xl shadow-2xl flex items-center gap-3 scale-105 rotate-2 cursor-grabbing z-[100]">
      <GripVertical className="w-4 h-4 text-blue-500" />
      <div>
        <p className="font-bold text-sm text-blue-700 dark:text-blue-300">{asset.assetCode}</p>
        <p className="text-xs text-blue-500/70">{asset.model}</p>
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
  
  const [assets, setAssets] = useState(() => {
    try {
      const cached = localStorage.getItem('assetsCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [employees, setEmployees] = useState(() => {
    try {
      const cached = localStorage.getItem('employeesCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [assignments, setAssignments] = useState(() => {
    try {
      const cached = localStorage.getItem('assignmentsCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  
  const [loading, setLoading] = useState(assets.length === 0 && employees.length === 0 && assignments.length === 0);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [assignmentType, setAssignmentType] = useState('EMPLOYEE');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // UI State
  const [assignmentMode, setAssignmentMode] = useState('standard'); // 'standard' | 'dnd'
  const [empSearch, setEmpSearch] = useState('');
  const [astSearch, setAstSearch] = useState('');
  const [activeId, setActiveId] = useState(null);

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

      const [astRes, empRes, asgRes, deptRes, locRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/assignments`, { headers }),
        fetch(`${API_URL}/departments`, { headers }),
        fetch(`${API_URL}/locations`, { headers })
      ]);

      if (!astRes.ok || !empRes.ok || !asgRes.ok) {
        throw new Error('Failed to synchronize deployment endpoints');
      }

      const [astData, empData, asgData, deptData, locData] = await Promise.all([
        astRes.json(), empRes.json(), asgRes.json(),
        deptRes.ok ? deptRes.json() : Promise.resolve([]),
        locRes.ok ? locRes.json() : Promise.resolve([])
      ]);

      setAssets(astData);
      setEmployees(empData);
      setAssignments(asgData);
      setDepartments(deptData);
      setLocations(locData);
      localStorage.setItem('assetsCache', JSON.stringify(astData));
      localStorage.setItem('employeesCache', JSON.stringify(empData));
      localStorage.setItem('assignmentsCache', JSON.stringify(asgData));
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
    if (!assetId) {
       showToast("Asset must be selected.", "warning");
       return;
    }
    
    if (assignmentType === 'EMPLOYEE' && !employeeId) {
       showToast("Employee bounds must be fulfilled.", "warning");
       return;
    }

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

    const success = await performAssignment(payload);
    if (success) {
      setAssetId('');
      setEmployeeId('');
      setDepartmentId('');
      setLocationId('');
      setRemarks('');
      showToast('Asset assigned successfully.', 'success');
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
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
          
          <DndContext 
            sensors={sensors} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
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
                  {empSearch.trim().length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">Type to search for an employee</div>
                  ) : filteredDroppableEmployees.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">No matching employees found.</div>
                  ) : (
                    <>
                      {filteredDroppableEmployees.slice(0, 15).map(emp => (
                        <DroppableEmployee key={emp.id} employee={emp} />
                      ))}
                      {filteredDroppableEmployees.length > 15 && (
                        <div className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">Keep typing to refine search...</div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
            
            <DragOverlay>
              {activeId ? (
                <DraggableAssetOverlay asset={availableAssets.find(a => `asset-${a.id}` === activeId)} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Standard Form and History */}
      <div className="flex flex-col gap-6">
        
        {/* Assignment Form Frame */}
        {canCreateEdit && assignmentMode === 'standard' && (
          <div className="w-full bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 shrink-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Standard Check-Out
            </h2>
            <form className="flex flex-col gap-4" onSubmit={handleAssign}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assignment Type *</label>
                  <select 
                    required value={assignmentType} onChange={e => setAssignmentType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                  >
                    <option value="EMPLOYEE">Employee Asset</option>
                    <option value="DEPARTMENT">Department Asset</option>
                    <option value="LOCATION">Location Asset</option>
                    <option value="SHARED">Shared Asset</option>
                    <option value="STORE">Store Asset</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hardware Asset *</label>
                  <select 
                    required value={assetId} onChange={e => setAssetId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                  >
                    <option value="" disabled>Select Stock Asset...</option>
                    {availableAssets.map(ast => (
                      <option key={ast.id} value={ast.id}>{ast.assetCode} - {ast.model}</option>
                    ))}
                  </select>
                  {availableAssets.length === 0 && <p className="text-xs text-amber-500 font-medium mt-1">No devices available in stock.</p>}
                </div>

                {assignmentType === 'EMPLOYEE' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Personnel *</label>
                    <select 
                      required value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                    >
                      <option value="" disabled>Select User Identity...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.employeeCode} - {emp.fullName}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {assignmentType === 'DEPARTMENT' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Department *</label>
                    <select 
                      required value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                    >
                      <option value="" disabled>Select Department...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(assignmentType === 'LOCATION' || assignmentType === 'STORE') && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Location *</label>
                    <select 
                      required value={locationId} onChange={e => setLocationId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                    >
                      <option value="" disabled>Select Location...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {assignmentType === 'SHARED' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Department</label>
                      <select 
                        value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                      >
                        <option value="">Select Department...</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Location</label>
                      <select 
                        value={locationId} onChange={e => setLocationId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                      >
                        <option value="">Select Location...</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hardware Asset *</label>
                  <select 
                    required value={assetId} onChange={e => setAssetId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 px-3 py-2 outline-none transition-all text-sm"
                  >
                    <option value="" disabled>Select Stock Asset...</option>
                    {availableAssets.map(ast => (
                      <option key={ast.id} value={ast.id}>{ast.assetCode} - {ast.model}</option>
                    ))}
                  </select>
                  {availableAssets.length === 0 && <p className="text-xs text-amber-500 font-medium mt-1">No devices available in stock.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Execution Date</label>
                  <input 
                    type="date" value={assignedDate} onChange={e => setAssignedDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200 text-sm" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Operation Remarks</label>
                  <input 
                    type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 text-sm" 
                    placeholder="Documentation / Condition State..."
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button type="submit" disabled={availableAssets.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed">
                  Sign Out Physical Asset
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Global Historical Matrix Table */}
        <div className="w-full bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white w-full">Asset Assignment & Returns</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search asset or employee"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-9 p-2 outline-none w-full"
              />
            </div>
          </div>

          <div className="flex-1">
             {filteredAssignments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 mt-10">No assignment records discovered scaling parameters.</div>
             ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden lg:block w-full">
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-[13px] text-slate-600 dark:text-slate-400 table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-2 py-2.5 w-[17%]">Asset</th>
                          <th className="px-2 py-2.5 w-[17%]">Assigned To</th>
                          <th className="px-2 py-2.5 w-[20%] text-center">Current Status</th>
                          <th className="px-2 py-2.5 w-[12%]">Assigned On</th>
                          <th className="px-2 py-2.5 w-[12%]">Returned On</th>
                          <th className="px-2 py-2.5 w-[12%]">Current Location</th>
                          {canCreateEdit && <th className="px-2 py-2.5 w-[10%] text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredAssignments.map((log) => {
                          const deployedDate = new Date(log.assignedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                          const returnedLogDate = log.returnedDate ? new Date(log.returnedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                          
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors group align-middle">
                              
                              <td className="px-2 py-2.5">
                                 <div className="flex flex-col">
                                   <span className="font-bold text-slate-800 dark:text-white line-clamp-2">{log.asset?.assetCode || 'DELETED'}</span>
                                   <span className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">{log.asset?.model || 'Link Corrupted'}</span>
                                 </div>
                              </td>
                              
                              <td className="px-2 py-2.5">
                                 <div className="flex flex-col">
                                   <span className="font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">{log.employee?.fullName || 'Terminated User'}</span>
                                   <span className="text-[11px] font-mono text-slate-400 mt-0.5 break-all">{log.employee?.employeeCode}</span>
                                 </div>
                              </td>
                              
                              <td className="px-2 py-2.5 text-center">
                                <span className={`px-2 py-1 rounded-full text-[11px] font-medium flex items-center justify-center gap-1 w-max mx-auto ${
                                  log.status === 'ACTIVE' 
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50 shadow-sm' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50 shadow-sm'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.status === 'ACTIVE' ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                                  <span className="truncate max-w-[100px] xl:max-w-none">{log.status === 'ACTIVE' ? 'Assigned to Employee' : 'Available (In Store)'}</span>
                                </span>
                              </td>
                              
                              <td className="px-2 py-2.5 text-slate-800 dark:text-slate-300">
                                 {deployedDate}
                              </td>
                              
                              <td className="px-2 py-2.5">
                                 <span className={log.status === 'RETURNED' ? 'text-slate-800 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                                    {returnedLogDate}
                                 </span>
                              </td>
                              
                              <td className="px-2 py-2.5">
                                 <span className="font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">
                                    {log.status === 'ACTIVE' ? 'With Employee' : 'IT Store'}
                                 </span>
                              </td>
                              
                              {canCreateEdit && (
                                <td className="px-2 py-2.5 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      {log.status === 'ACTIVE' ? (
                                         <button onClick={() => handleReturn(log.id)} className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 rounded-md text-[11px] font-medium transition-colors shadow-sm flex items-center gap-1">
                                            <Undo2 className="w-3.5 h-3.5 shrink-0" />
                                            <span className="hidden xl:inline">Return Asset</span>
                                            <span className="inline xl:hidden">Return</span>
                                         </button>
                                      ) : (
                                         <button className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-transparent text-slate-400 dark:text-slate-500 rounded-md text-[11px] font-medium cursor-default flex items-center justify-center min-w-[50px]">
                                            View
                                         </button>
                                      )}
                                      
                                      {canDelete && (
                                         <button onClick={() => handleDelete(log.id)} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-100 lg:opacity-0 group-hover:opacity-100 shrink-0">
                                            <Trash2 className="w-3.5 h-3.5" />
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
                    </div>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="block lg:hidden p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                    {filteredAssignments.map((log) => {
                      const deployedDate = new Date(log.assignedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                      const returnedLogDate = log.returnedDate ? new Date(log.returnedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                      
                      return (
                        <div key={`mobile-${log.id}`} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex justify-between items-start gap-2">
                             <div>
                               <span className="font-bold text-slate-800 dark:text-white text-sm block">{log.asset?.assetCode || 'DELETED'}</span>
                               <span className="text-xs text-slate-500">{log.asset?.model || 'Link Corrupted'}</span>
                             </div>
                             <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
                               log.status === 'ACTIVE' 
                                 ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50' 
                                 : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50'
                             }`}>
                               {log.status === 'ACTIVE' ? 'Assigned' : 'Available'}
                             </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[13px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                             <div>
                                <span className="text-slate-400 text-xs block mb-0.5">Assigned To</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{log.employee?.fullName || 'Terminated User'}</span>
                             </div>
                             <div>
                                <span className="text-slate-400 text-xs block mb-0.5">Location</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{log.status === 'ACTIVE' ? 'With Employee' : 'IT Store'}</span>
                             </div>
                             <div>
                                <span className="text-slate-400 text-xs block mb-0.5">Assigned On</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{deployedDate}</span>
                             </div>
                             <div>
                                <span className="text-slate-400 text-xs block mb-0.5">Returned On</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{returnedLogDate}</span>
                             </div>
                          </div>
                          
                          {canCreateEdit && (
                             <div className="pt-1 flex items-center gap-2">
                                {log.status === 'ACTIVE' ? (
                                   <button onClick={() => handleReturn(log.id)} className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5">
                                      <Undo2 className="w-3.5 h-3.5" /> Return Asset
                                   </button>
                                ) : (
                                   <button className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 border border-transparent text-slate-400 dark:text-slate-500 rounded-lg text-xs font-medium cursor-default flex items-center justify-center gap-1.5">
                                      View History
                                   </button>
                                )}
                                {canDelete && (
                                   <button onClick={() => handleDelete(log.id)} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30 shrink-0">
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                )}
                             </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
