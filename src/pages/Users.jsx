import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Shield, Loader2, AlertCircle, KeyRound, X, Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Users() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState({ id: '', fullName: '', email: '', role: 'VIEWER', status: 'ACTIVE' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temporary Password Modal State
  const [tempPassword, setTempPassword] = useState('');
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
       const token = localStorage.getItem('token');
       const res = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
       if (!res.ok) throw new Error('Failed to fetch users');
       const data = await res.json();
       setUsers(data);
       setError('');
    } catch(err) {
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
      confirmText: 'Delete'
    });
    if (confirmed) {
      try {
         const token = localStorage.getItem('token');
         const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
         });
         
         if(!res.ok) {
           const errData = await res.json();
           throw new Error(errData.error || 'Failed to delete user');
         }
         
         await fetchUsers();
         showToast(`User deleted successfully!`, 'success');
      } catch(err) {
         showToast(err.message, 'error');
      }
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ id: '', fullName: '', email: '', role: 'VIEWER', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEditModal = (u) => {
    setModalMode('edit');
    setFormData({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, status: u.status });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const url = modalMode === 'add' ? `${API_URL}/users` : `${API_URL}/users/${formData.id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');

      await fetchUsers();
      setIsModalOpen(false);
      showToast(modalMode === 'add' ? 'User created successfully.' : 'User updated successfully.', 'success');

      if (modalMode === 'add' && data.tempPassword) {
        setTempPassword(data.tempPassword);
        setIsTempModalOpen(true);
      }
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (id) => {
    const confirmed = await confirm({
      title: 'Reset Password',
      message: 'This will reset the user password and force them to change it on next login. Proceed?',
      confirmText: 'Reset Password'
    });
    if (confirmed) {
      try {
         const token = localStorage.getItem('token');
         const res = await fetch(`${API_URL}/users/${id}/reset-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
         });
         
         const data = await res.json();
         if(!res.ok) throw new Error(data.error || 'Failed to reset password');
         
         setTempPassword(data.tempPassword);
         setIsTempModalOpen(true);
         showToast(`Password reset successfully.`, 'success');
      } catch(err) {
         showToast(err.message, 'error');
      }
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    showToast('Temporary password copied to clipboard', 'success');
  };

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
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
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
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">User Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage system access, roles, and user accounts.</p>
        </div>
        {user?.role === 'ADMIN' && (
           <button 
             onClick={openAddModal}
             className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
           >
             <Plus className="w-4 h-4" />
             Add New User
           </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search users..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-5 py-4">Full Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const displayRole = u.role === 'IT_OFFICER' ? 'IT Officer' : u.role === 'ADMIN' ? 'Admin' : 'Viewer';
                const displayStatus = u.status === 'ACTIVE' ? 'Active' : 'Inactive';
                
                return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-4 font-medium text-slate-800 dark:text-white">{u.fullName}</td>
                  <td className="px-5 py-4 text-slate-500">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      u.role === 'IT_OFFICER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {u.role === 'ADMIN' && <Shield className="w-3 h-3" />}
                      {displayRole}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                     <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {user?.role === 'ADMIN' ? (
                       <div className="flex items-center justify-center gap-1">
                         <button onClick={() => handleResetPassword(u.id)} title="Reset Password" className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                           <KeyRound className="w-4 h-4" />
                         </button>
                         <button onClick={() => openEditModal(u)} title="Edit User" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                           <Edit className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDelete(u.id)} title="Delete User" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                    ) : (
                       <div className="flex items-center justify-center text-xs text-slate-400">View Only</div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{modalMode === 'add' ? 'Add New User' : 'Edit User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input required type="email" disabled={modalMode === 'edit'} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select disabled={modalMode === 'edit' && formData.id === user?.id} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50">
                    <option value="VIEWER">Viewer</option>
                    <option value="IT_OFFICER">IT Officer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm shadow-blue-600/20">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center p-6 border-t-4 border-amber-500">
            <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">Temporary Password</h3>
            <p className="text-sm text-slate-500 mb-6">Please securely share this temporary password with the user. They will be forced to change it on their first login.</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between mb-6">
              <code className="text-lg font-bold font-mono text-slate-800 dark:text-white">{tempPassword}</code>
              <button onClick={copyTempPassword} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Copy className="w-5 h-5" />
              </button>
            </div>
            
            <button onClick={() => setIsTempModalOpen(false)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors">
              I have copied the password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
