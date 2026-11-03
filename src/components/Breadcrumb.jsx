import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS = {
  '': 'Control Center',
  'assets': 'Asset Management',
  'add': 'Register New Asset',
  'edit': 'Edit Asset',
  'employees': 'Employees',
  'departments': 'Departments',
  'locations': 'Locations',
  'assignments': 'Asset Assignments & Returns',
  'maintenance': 'Maintenance & Repairs',
  'tickets': 'Support Tickets',
  'reports': 'Reports & Analytics',
  'warranty': 'Warranty Management',
  'qr-code': 'QR Code Management',
  'scanner': 'QR Scanner',
  'audit-logs': 'Audit Logs',
  'settings': 'Settings & Administration',
  'users': 'User Management',
  'database': 'Database & Storage'
};

export default function Breadcrumb({ customItems, titleOverride, fallbackBack, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // If on root dashboard, don't show breadcrumb
  if (location.pathname === '/' && !customItems) return null;

  // Build segments from path
  const pathParts = location.pathname.split('/').filter(Boolean);

  let items = [];
  if (customItems && customItems.length > 0) {
    items = customItems;
  } else {
    items.push({ label: 'Control Center', to: '/' });
    let acc = '';
    pathParts.forEach((part, idx) => {
      acc += `/${part}`;
      const isLast = idx === pathParts.length - 1;
      let label = ROUTE_LABELS[part] || decodeURIComponent(part);
      if (isLast && titleOverride) {
        label = titleOverride;
      }
      items.push({
        label,
        to: isLast ? null : acc
      });
    });
  }

  const handleBack = () => {
    // If there is history to go back to, use navigate(-1)
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (fallbackBack) {
      navigate(fallbackBack);
    } else if (items.length > 1 && items[items.length - 2]?.to) {
      navigate(items[items.length - 2].to);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="w-full flex items-center justify-between gap-3 px-4 md:px-6 py-2.5 bg-white/70 dark:bg-[#080d18]/70 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 select-none transition-colors">
      <div className="flex items-center gap-2.5 min-w-0 overflow-x-auto custom-scrollbar py-0.5">
        {/* Back Button */}
        <button
          onClick={handleBack}
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0 shadow-sm"
          title="Return to previous page (preserving filters)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Separator */}
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Trail Items */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
          {items.map((it, idx) => {
            const isLast = idx === items.length - 1;
            const isFirst = idx === 0;

            return (
              <div key={idx} className="flex items-center gap-1.5 min-w-0 shrink-0">
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                )}

                {isLast ? (
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[320px] tracking-wide">
                    {it.label}
                  </span>
                ) : (
                  <Link
                    to={it.to || '/'}
                    className="flex items-center gap-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors font-medium truncate"
                  >
                    {isFirst && <Home className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{it.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Extra Action Slot */}
      {children && (
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
