import { useState, useEffect } from 'react';
import {
  Search, Plus, Edit, Trash2, Shield, Loader2, AlertCircle, KeyRound, X, Copy, CheckCircle2, Link2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import {
  API_URL, MODULE_DEFINITIONS, DEFAULT_ROLE_MODULES, ROLE_LABELS, isAdminOrHeadOfIT
} from '../utils/helpdeskApi';

export default function Users() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    employeeId: '',
    customPassword: '',
    modulePermissions: { ...DEFAULT_ROLE_MODULES.EMPLOYEE },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tempPassword, setTempPassword] = useState('');
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);

  const canManageUsers = isAdminOrHeadOfIT(user) || user?.moduleAccess?.USER_MANAGEMENT;

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const [uRes, eRes] = await Promise.all([
        fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/employees`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      if (!uRes.ok) throw new Error('Failed to fetch users');
      setUsers(await uRes.json());
      if (eRes && eRes.ok) {
        setEmployees(await eRes.json());
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to permanently delete this user account?',
      confirmText: 'Delete',
    });
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to delete user');
        }
        await fetchUsers();
        showToast('User deleted successfully!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      id: '',
      fullName: '',
      email: '',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      employeeId: '',
      customPassword: '',
      modulePermissions: { ...DEFAULT_ROLE_MODULES.EMPLOYEE },
    });
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setModalMode('edit');
    setFormData({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      status: u.status,
      employeeId: u.employeeId || '',
      customPassword: '',
      modulePermissions: {
        ...(DEFAULT_ROLE_MODULES[u.role] || DEFAULT_ROLE_MODULES.EMPLOYEE),
        ...(u.moduleAccess || u.modulePermissions || {}),
      },
    });
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole) => {
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      modulePermissions: { ...(DEFAULT_ROLE_MODULES[newRole] || DEFAULT_ROLE_MODULES.EMPLOYEE) },
    }));
  };

  const toggleModule = (key) => {
    setFormData((prev) => ({
      ...prev,
      modulePermissions: {
        ...prev.modulePermissions,
        [key]: !prev.modulePermissions?.[key],
      },
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = modalMode === 'add' ? `${API_URL}/users` : `${API_URL}/users/${formData.id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        employeeId: formData.employeeId || null,
        modulePermissions: formData.modulePermissions,
        ...(modalMode === 'add' && formData.customPassword ? { customPassword: formData.customPassword } : {}),
      };

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');

      await fetchUsers();
      setIsModalOpen(false);
      showToast(modalMode === 'add' ? 'User created successfully.' : 'User & module access updated successfully.', 'success');

      if (modalMode === 'add' && !formData.customPassword && data.tempPassword) {
        setTempPassword(data.tempPassword);
        setIsTempModalOpen(true);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (id) => {
    const confirmed = await confirm({
      title: 'Reset Password',
      message: 'This will reset the user password and force them to change it on next login. Proceed?',
      confirmText: 'Reset Password',
    });
    if (confirmed) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/users/${id}/reset-password`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password');
        setTempPassword(data.tempPassword);
        setIsTempModalOpen(true);
        showToast('Password reset successfully.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    showToast('Temporary password copied to clipboard', 'success');
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl m-6">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Error Loading Data</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchUsers} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">User & Module Access Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Manage user roles, employee links, and individual module ON/OFF permissions.
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New User
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#0d1424] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, email, or role..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 font-medium text-xs uppercase">
              <tr>
                <th className="px-5 py-4">Full Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Linked Employee</th>
                <th className="px-5 py-4">Enabled Modules</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((u) => {
                const enabledCount = Object.values(u.moduleAccess || {}).filter(Boolean).length;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800 dark:text-white">{u.fullName}</td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30">
                        {isAdminOrHeadOfIT(u) && <Shield className="w-3 h-3" />}
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {u.employee ? (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                          <Link2 className="w-3 h-3" /> {u.employee.employeeCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not linked</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {enabledCount} / {MODULE_DEFINITIONS.length} ON
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {canManageUsers ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleResetPassword(u.id)} title="Reset Password" className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(u)} title="Edit User & Module Access" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(u.id)} title="Delete User" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-xs text-slate-400">View Only</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal with Module Access ON/OFF Toggles */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#080d18]">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                {modalMode === 'add' ? 'Add New User & Module Access' : 'Edit User & Module Access'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input required type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input required type="email" disabled={modalMode === 'edit'} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select disabled={modalMode === 'edit' && formData.id === user?.id} value={formData.role} onChange={(e) => handleRoleChange(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none disabled:opacity-50">
                    <option value="EMPLOYEE">Employee</option>
                    <option value="IT_OFFICER">IT Officer / Technician</option>
                    <option value="IT_MANAGER">IT Manager</option>
                    <option value="HEAD_OF_IT">Head of IT</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="PORTAL_ACCESS">Common Employee Support Portal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Employee Master Profile</label>
                  <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none">
                    <option value="">-- Auto-match by email / Unlinked --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} — {emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Initial Password (Optional)</label>
                    <input type="text" value={formData.customPassword} onChange={(e) => setFormData({ ...formData, customPassword: e.target.value })} placeholder="Leave blank to auto-generate" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm outline-none" />
                  </div>
                )}
              </div>

              {/* Individual Module Access ON/OFF Toggles */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Module Access Permissions (ON / OFF)
                  </h4>
                  <span className="text-[11px] text-slate-400">Pre-configured from selected role</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MODULE_DEFINITIONS.map((m) => {
                    const isOn = !!formData.modulePermissions?.[m.key];
                    return (
                      <div key={m.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-white">{m.label}</p>
                          <p className="text-[10px] text-slate-500 truncate">{m.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleModule(m.key)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            isOn ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20 cursor-pointer">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {modalMode === 'add' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Password Modal */}
      {isTempModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 border-t-4 border-amber-500">
            <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Temporary Password</h3>
            <p className="text-sm text-slate-500 mb-6">Please securely share this temporary password with the user. They will be forced to change it on their first login.</p>
            <div className="bg-slate-50 dark:bg-[#080d18] border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between mb-6">
              <code className="text-lg font-bold font-mono text-slate-800 dark:text-white">{tempPassword}</code>
              <button onClick={copyTempPassword} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <button onClick={() => setIsTempModalOpen(false)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">
              I have copied the password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
