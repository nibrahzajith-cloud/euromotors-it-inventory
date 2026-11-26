import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Server, GitCommit, Database, Clock, Globe } from 'lucide-react';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

/* global __APP_VERSION__, __FRONTEND_COMMIT__, __BUILD_TIME__, __API_CONTRACT__ */
const FRONTEND_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0';
const FRONTEND_COMMIT = typeof __FRONTEND_COMMIT__ !== 'undefined' ? __FRONTEND_COMMIT__ : 'unknown';
const FRONTEND_COMMIT_SHORT = FRONTEND_COMMIT && FRONTEND_COMMIT !== 'unknown' ? FRONTEND_COMMIT.slice(0, 7) : 'unknown';
const FRONTEND_BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
const EXPECTED_CONTRACT = typeof __API_CONTRACT__ !== 'undefined' ? __API_CONTRACT__ : 'helpdesk-v1';

function detectFrontendEnvironment() {
  if (typeof window === 'undefined') return 'Localhost';
  const host = window.location.hostname;
  return (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.'))
    ? 'Localhost'
    : 'Production';
}

function formatTimestamp(iso) {
  if (!iso) return 'Unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' (IST)';
}

function computeCompatibility(backendInfo, httpStatus, errorMsg) {
  if (errorMsg) {
    return {
      level: 'error',
      label: 'Backend Unreachable',
      detail: errorMsg,
    };
  }
  if (httpStatus === 404) {
    return {
      level: 'error',
      label: 'Incompatible — Outdated Backend',
      detail: 'Live API is missing /settings/version (HTTP 404), indicating backend deployment is behind frontend.',
    };
  }
  if (!backendInfo) {
    return {
      level: 'warn',
      label: 'Checking Compatibility...',
      detail: 'Querying live backend metadata.',
    };
  }
  if (backendInfo.apiContract !== EXPECTED_CONTRACT) {
    return {
      level: 'error',
      label: 'Incompatible — API Contract Mismatch',
      detail: `Frontend expects ${EXPECTED_CONTRACT}, backend reports ${backendInfo.apiContract || 'legacy'}.`,
    };
  }
  if (backendInfo.dbSchemaReady === false) {
    return {
      level: 'error',
      label: 'Incompatible — DB Migration Incomplete',
      detail: `Missing schema objects: ${(backendInfo.dbMissingItems || []).slice(0, 4).join(', ')}`,
    };
  }
  if (
    FRONTEND_COMMIT_SHORT !== 'unknown' &&
    backendInfo.gitCommitShort &&
    backendInfo.gitCommitShort !== 'unknown' &&
    FRONTEND_COMMIT_SHORT !== backendInfo.gitCommitShort
  ) {
    return {
      level: 'warn',
      label: 'Compatible (Commit Differs)',
      detail: `API contract matches (${EXPECTED_CONTRACT}), but Frontend (${FRONTEND_COMMIT_SHORT}) and Backend (${backendInfo.gitCommitShort}) are on different commits.`,
    };
  }
  return {
    level: 'ok',
    label: 'Compatible & Synchronized',
    detail: `Frontend and Backend share contract ${EXPECTED_CONTRACT} and verified database schema.`,
  };
}

export default function SystemVersionCard({ user }) {
  const isAuthorized = ['ADMIN', 'HEAD_OF_IT'].includes(user?.role);
  const [backendInfo, setBackendInfo] = useState(null);
  const [httpStatus, setHttpStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadVersion = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/settings/version`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHttpStatus(res.status);
      if (res.ok) {
        const json = await res.json();
        setBackendInfo(json);
      } else {
        setBackendInfo(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error querying backend version');
      setBackendInfo(null);
      setHttpStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);

  if (!isAuthorized) return null;

  const uiEnv = detectFrontendEnvironment();
  const compat = computeCompatibility(backendInfo, httpStatus, errorMsg);
  const compatStyles = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
    warn: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50',
    error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/50',
  }[compat.level];

  const CompatIcon = compat.level === 'ok' ? CheckCircle2 : compat.level === 'warn' ? AlertTriangle : XCircle;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Version &amp; Deployment Telemetry</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Administrator visibility into frontend, backend, commit, and database migration alignment.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadVersion}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Check
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${compatStyles}`}>
          <CompatIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              Frontend &amp; Backend Compatibility: {compat.label}
            </div>
            <p className="text-xs mt-0.5 opacity-90">{compat.detail}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" /> Environment
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {backendInfo?.environment || uiEnv}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={API_URL}>
              API: {API_URL}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Frontend Version</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
              v{FRONTEND_VERSION}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Contract: {EXPECTED_CONTRACT}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Backend Version</div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
              {backendInfo ? `v${backendInfo.backendVersion}` : httpStatus === 404 ? 'Legacy (< v2.0.0)' : 'Unavailable'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Contract: {backendInfo?.apiContract || (httpStatus === 404 ? 'Pre-HelpDesk' : 'N/A')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-indigo-500" /> Git Commit ID
            </div>
            <div className="text-xs font-mono text-slate-900 dark:text-white mt-1 space-y-0.5">
              <div>Frontend: <span className="font-bold">{FRONTEND_COMMIT_SHORT}</span></div>
              <div>Backend: <span className="font-bold">{backendInfo?.gitCommitShort || (httpStatus === 404 ? 'Outdated' : 'Unavailable')}</span></div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-500" /> Database Migration Version
            </div>
            <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">
              {backendInfo?.migrationVersion || 'Unknown'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Schema Check: {backendInfo ? (backendInfo.dbSchemaReady ? 'Verified Ready' : 'Missing Objects') : 'Unverified'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Last Deployment Date &amp; Time
            </div>
            <div className="text-[11px] text-slate-800 dark:text-slate-200 mt-1 space-y-0.5">
              <div>UI Build: <span className="font-medium">{formatTimestamp(FRONTEND_BUILD_TIME)}</span></div>
              <div>API Boot: <span className="font-medium">{backendInfo ? formatTimestamp(backendInfo.lastDeployedAt) : 'Unavailable'}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
