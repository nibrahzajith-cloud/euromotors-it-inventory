import { useState, useEffect } from 'react';
import { Settings, Plus, Save, Loader2, Tag, Clock, Bell, Shield, Mail, QrCode, KeyRound, Download, Copy, Users, Activity } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, isAdminOrHeadOfIT } from '../../utils/helpdeskApi';
import { HelpDeskSubNav } from './HelpDeskShared';

export default function HelpDeskSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = isAdminOrHeadOfIT(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState(null);
  const [slaRules, setSlaRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);

  const [portalConfig, setPortalConfig] = useState(null);
  const [portalStats, setPortalStats] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [portalLogs, setPortalLogs] = useState([]);
  const [newPortalPassword, setNewPortalPassword] = useState('');
  const [savingPortal, setSavingPortal] = useState(false);
  const [resettingPortalPw, setResettingPortalPw] = useState(false);

  const [newCat, setNewCat] = useState({ name: '', description: '', examples: '' });
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const promises = [apiFetch('/helpdesk/settings')];
      if (isAdmin) {
        promises.push(
          apiFetch('/portal/admin/config').catch(() => null),
          apiFetch('/portal/admin/logs').catch(() => null)
        );
      }
      const [data, pCfg, pLogs] = await Promise.all(promises);
      setSettings(data.settings);
      setSlaRules(data.slaRules || []);
      setCategories(data.categories || []);
      setEmailLogs(data.emailLogs || []);
      if (pCfg) {
        setPortalConfig(pCfg.portalConfig);
        setPortalStats(pCfg.stats);
        setDepartments(pCfg.departments || []);
      }
      if (pLogs) {
        setPortalLogs(pLogs.auditLogs || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiFetch('/helpdesk/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }),
        apiFetch('/helpdesk/sla-rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: slaRules }),
        }),
      ]);
      showToast('Help Desk settings and SLA rules saved!', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    try {
      await apiFetch('/helpdesk/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat),
      });
      setNewCat({ name: '', description: '', examples: '' });
      showToast('Category added.', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleCategory = async (cat) => {
    try {
      await apiFetch(`/helpdesk/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      showToast(`Category "${cat.name}" ${cat.isActive ? 'deactivated' : 'activated'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSavePortalConfig = async () => {
    if (!portalConfig) return;
    setSavingPortal(true);
    try {
      const updated = await apiFetch('/portal/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portalConfig),
      });
      setPortalConfig(updated.portalConfig);
      showToast('Smart Employee Support Portal settings saved!', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingPortal(false);
    }
  };

  const handleResetPortalPassword = async (e) => {
    e.preventDefault();
    if (!newPortalPassword || newPortalPassword.trim().length < 6) {
      showToast('Portal password must be at least 6 characters.', 'error');
      return;
    }
    setResettingPortalPw(true);
    try {
      const res = await apiFetch('/portal/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPortalPassword.trim() }),
      });
      setNewPortalPassword('');
      showToast(res.message || 'Common portal password updated!', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResettingPortalPw(false);
    }
  };

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';

  const handleDownloadPortalQr = () => {
    const canvas = document.getElementById('portal-qr-canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = 'EuroMotors_Employee_Support_Portal_QR.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading || !settings) {
    return (
      <div className="p-6 flex h-72 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600" />
            Help Desk Settings & Configuration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure categories, SLA rules, working hours, holidays, ticket numbering, notifications, feedback, and escalation rules.
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Settings
        </button>
      </div>

      {/* 1. SLA Rules */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          SLA Response & Resolution Targets (Minutes)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Priority</th>
                <th className="px-3 py-2.5">First Response (min)</th>
                <th className="px-3 py-2.5">Resolution Target (min)</th>
                <th className="px-3 py-2.5">Warning Threshold (%)</th>
                <th className="px-3 py-2.5">Escalate Delay (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {slaRules.map((r, idx) => (
                <tr key={r.priority}>
                  <td className="px-3 py-2.5 font-extrabold">{r.priority}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={1}
                      value={r.firstResponseMinutes}
                      onChange={(e) => setSlaRules((prev) => prev.map((x, i) => i === idx ? { ...x, firstResponseMinutes: Number(e.target.value) } : x))}
                      className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={5}
                      value={r.resolutionMinutes}
                      onChange={(e) => setSlaRules((prev) => prev.map((x, i) => i === idx ? { ...x, resolutionMinutes: Number(e.target.value) } : x))}
                      className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={10}
                      max={95}
                      value={r.warningThresholdPercent}
                      onChange={(e) => setSlaRules((prev) => prev.map((x, i) => i === idx ? { ...x, warningThresholdPercent: Number(e.target.value) } : x))}
                      className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      value={r.escalateAfterBreachMinutes}
                      onChange={(e) => setSlaRules((prev) => prev.map((x, i) => i === idx ? { ...x, escalateAfterBreachMinutes: Number(e.target.value) } : x))}
                      className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Ticket Numbering, Working Hours, Holidays, Assignment & Escalation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm text-xs">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Ticket Format, Working Hours & Holidays
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-500 mb-1">Ticket Prefix</label>
              <input
                value={settings.ticketPrefix || 'HD'}
                onChange={(e) => setSettings((p) => ({ ...p, ticketPrefix: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Numbering Format</label>
              <input
                value={settings.ticketNumberFormat || 'HD-{YYYY}-{SEQ6}'}
                onChange={(e) => setSettings((p) => ({ ...p, ticketNumberFormat: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Support Start Time</label>
              <input
                type="time"
                value={settings.workingHours?.start || '08:30'}
                onChange={(e) => setSettings((p) => ({ ...p, workingHours: { ...p.workingHours, start: e.target.value } }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Support End Time</label>
              <input
                type="time"
                value={settings.workingHours?.end || '17:30'}
                onChange={(e) => setSettings((p) => ({ ...p, workingHours: { ...p.workingHours, end: e.target.value } }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="block font-bold text-slate-500">Public / Company Holidays (Excluded from SLA)</label>
            <div className="flex gap-2">
              <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5" />
              <input type="text" placeholder="Holiday name" value={newHoliday.name} onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5" />
              <button
                type="button"
                onClick={() => {
                  if (!newHoliday.date) return;
                  setSettings((p) => ({ ...p, holidays: [...(p.holidays || []), newHoliday] }));
                  setNewHoliday({ date: '', name: '' });
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(settings.holidays || []).map((h, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] flex items-center gap-1.5">
                  {h.date} {h.name ? `(${h.name})` : ''}
                  <button type="button" onClick={() => setSettings((p) => ({ ...p, holidays: p.holidays.filter((_, idx) => idx !== i) }))} className="text-rose-500 font-bold cursor-pointer">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm text-xs">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Notifications, Feedback & Escalation Rules
          </h2>
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 cursor-pointer">
            <span className="font-semibold">In-App Notifications</span>
            <input type="checkbox" checked={!!settings.notificationSettings?.inAppEnabled} onChange={(e) => setSettings((p) => ({ ...p, notificationSettings: { ...p.notificationSettings, inAppEnabled: e.target.checked } }))} />
          </label>
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 cursor-pointer">
            <span className="font-semibold">Auto-Escalate Breached Tickets to Head of IT</span>
            <input type="checkbox" checked={!!settings.escalationRules?.escalateToHeadOfItOnBreach} onChange={(e) => setSettings((p) => ({ ...p, escalationRules: { ...p.escalationRules, escalateToHeadOfItOnBreach: e.target.checked } }))} />
          </label>
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 cursor-pointer">
            <span className="font-semibold">Require Employee Rating on Confirmation</span>
            <input type="checkbox" checked={!!settings.feedbackSettings?.requireRatingOnConfirm} onChange={(e) => setSettings((p) => ({ ...p, feedbackSettings: { ...p.feedbackSettings, requireRatingOnConfirm: e.target.checked } }))} />
          </label>
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 cursor-pointer">
            <span className="font-semibold">Production Outbound Emails (Suppressed in Dev)</span>
            <input type="checkbox" checked={!!settings.notificationSettings?.emailEnabled} onChange={(e) => setSettings((p) => ({ ...p, notificationSettings: { ...p.notificationSettings, emailEnabled: e.target.checked } }))} />
          </label>
        </div>
      </div>

      {/* 3. Inquiry Categories Management */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm text-xs">
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-600" />
          Help Desk Inquiry Categories (Deactivate instead of deleting historical categories)
        </h2>

        <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input required placeholder="Category Name" value={newCat.name} onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
          <input placeholder="Description" value={newCat.description} onChange={(e) => setNewCat((p) => ({ ...p, description: e.target.value }))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
          <input placeholder="Examples (e.g. Laptop, Printer)" value={newCat.examples} onChange={(e) => setNewCat((p) => ({ ...p, examples: e.target.value }))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {categories.map((cat) => (
            <div key={cat.id} className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <span className={`font-bold ${cat.isActive ? 'text-slate-800 dark:text-white' : 'line-through text-slate-400'}`}>
                  {cat.name}
                </span>
                <span className="ml-2 text-[10px] text-slate-400">({cat._count?.tickets || 0} tickets)</span>
                {cat.examples && <p className="text-[11px] text-slate-500">{cat.examples}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleToggleCategory(cat)}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                  cat.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
              >
                {cat.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Safe Dev Email Notification Preview Log */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm text-xs">
        <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-500" />
          Safe Localhost Email Notification Log (Outbound Emails Disabled in Dev)
        </h2>
        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {emailLogs.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">No email notification events logged yet.</p>
          ) : (
            emailLogs.map((el) => (
              <div key={el.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold truncate">{el.subject}</p>
                  <p className="text-[11px] text-slate-500">To: {el.recipientEmail} • Event: {el.eventType}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-[10px] shrink-0">
                  {el.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Smart Employee Support Portal Administration (Admin / Head of IT only) */}
      {isAdmin && portalConfig && (
        <div className="bg-white dark:bg-[#0d1424] border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Smart Employee IT Support Portal Configuration
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Manage the single common employee gateway account, identity verification rules, session timeouts, restrictions, and portal QR code.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePortalConfig}
              disabled={savingPortal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
            >
              {savingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Portal Settings
            </button>
          </div>

          {portalStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Active Employee Sessions</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{portalStats.activeSessionsCount}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Eligible Active Directory</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{portalStats.totalActiveEmployees} Employees</p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Missing Email &amp; Mobile</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{portalStats.unverifiableCount} Staff (Use IT Officer On-Behalf)</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Common Account & Verification Rules */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer sm:col-span-2">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white block">Enable Common Employee Portal Access</span>
                    <span className="text-[11px] text-slate-500">Allow employees to sign in via the shared portal gateway and verify identity.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!portalConfig.enabled}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                </label>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Common Portal Account Email</label>
                  <input
                    type="email"
                    value={portalConfig.portalEmail || ''}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, portalEmail: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Identity Verification Method</label>
                  <select
                    value={portalConfig.verificationMethod || 'EMAIL_OR_PHONE'}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, verificationMethod: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="EMAIL_OR_PHONE">Email Address OR Mobile Number</option>
                    <option value="EMAIL_ONLY">Corporate Email Address Only</option>
                    <option value="PHONE_ONLY">Registered Mobile Number Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Idle Session Expiry (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={portalConfig.idleTimeoutMinutes ?? 30}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, idleTimeoutMinutes: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Minimum Search Characters</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={portalConfig.minSearchChars ?? 2}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, minSearchChars: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white block">Allow &quot;Remember My Device&quot;</span>
                    <span className="text-[10px] text-slate-500">Always unchecked by default on shared computers</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={portalConfig.allowRememberDevice !== false}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, allowRememberDevice: e.target.checked }))}
                  />
                </label>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Remember Device Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={portalConfig.rememberDeviceDays ?? 7}
                    onChange={(e) => setPortalConfig((p) => ({ ...p, rememberDeviceDays: Number(e.target.value) }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Access Restrictions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Restricted Employee IDs (Comma-Separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-0001, EMP-0045"
                    value={(portalConfig.restrictedEmployeeCodes || []).join(', ')}
                    onChange={(e) =>
                      setPortalConfig((p) => ({
                        ...p,
                        restrictedEmployeeCodes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Exclude Department from Portal
                  </label>
                  <select
                    multiple
                    value={portalConfig.restrictedDepartmentIds || []}
                    onChange={(e) =>
                      setPortalConfig((p) => ({
                        ...p,
                        restrictedDepartmentIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                      }))
                    }
                    className="w-full h-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Common Portal Password Reset */}
              <form onSubmit={handleResetPortalPassword} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-end gap-2.5">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    <KeyRound className="w-3 h-3 inline mr-1" /> Set / Update Common Portal Account Password
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={newPortalPassword}
                    onChange={(e) => setNewPortalPassword(e.target.value)}
                    placeholder="Enter new shared password (min 6 chars)..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resettingPortalPw}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl font-bold shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {resettingPortalPw ? 'Updating...' : 'Update Portal Password'}
                </button>
              </form>
            </div>

            {/* QR Code & Portal URL */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-white">
                <QrCode className="w-4 h-4 text-blue-600" />
                Portal Access QR &amp; Link
              </div>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <QRCodeCanvas id="portal-qr-canvas" value={portalUrl} size={140} level="H" includeMargin={false} />
              </div>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all">{portalUrl}</p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(portalUrl);
                    showToast('Portal URL copied to clipboard!', 'success');
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy URL
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPortalQr}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> QR PNG
                </button>
              </div>
            </div>
          </div>

          {/* Employee Portal Access Activity Logs */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Recent Employee Portal Access &amp; Verification Activity
            </h3>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-800 px-3">
              {portalLogs.length === 0 ? (
                <p className="text-slate-400 py-4 text-center">No employee portal activity recorded yet.</p>
              ) : (
                portalLogs.map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{log.description}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {log.action} • IP: {log.ipAddress || 'local'} • {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                      log.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
