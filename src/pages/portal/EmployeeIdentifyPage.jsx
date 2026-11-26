import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShieldCheck, UserCheck, Building2, MapPin, Briefcase,
  Mail, Phone, AlertCircle, Loader2, LogOut, ArrowRight, KeyRound,
  HelpCircle, Sun, Moon, CheckCircle2, LifeBuoy, MonitorSmartphone,
  Activity, Headphones, X, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { API_URL } from '../../utils/helpdeskApi';
import HelpDeskHeroIllustration from '../../components/portal/HelpDeskHeroIllustration';

export default function EmployeeIdentifyPage() {
  const { user, verifyPortalEmployee, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [portalStatus, setPortalStatus] = useState({
    enabled: true,
    portalEmail: 'itsupport@euromotors.lk',
    verificationMethod: 'EMAIL_OR_PHONE',
    allowRememberDevice: true,
    rememberDeviceDays: 7,
    minSearchChars: 2,
    idleTimeoutMinutes: 30,
  });

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [verificationInput, setVerificationInput] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [contactMissing, setContactMissing] = useState(false);

  const searchInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/portal/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPortalStatus(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const minChars = portalStatus.minSearchChars || 2;
    if (selectedEmployee) return;
    if (trimmed.length < minChars) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setErrorMsg('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/portal/employees/search?q=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to search Employee Directory');
        setResults(data.employees || []);
        setHasSearched(true);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, portalStatus.minSearchChars, selectedEmployee]);

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setVerificationInput('');
    setRememberDevice(false);
    setErrorMsg('');
    setContactMissing(false);
  };

  const handleResetSelection = () => {
    setSelectedEmployee(null);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setVerificationInput('');
    setRememberDevice(false);
    setErrorMsg('');
    setContactMissing(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!verificationInput.trim()) {
      setErrorMsg('Please enter your registered email address or mobile number.');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    setContactMissing(false);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/portal/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          verificationInput: verificationInput.trim(),
          rememberDevice: portalStatus.allowRememberDevice ? rememberDevice : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.contactMissing) setContactMissing(true);
        throw new Error(data.error || 'Identity verification failed.');
      }

      verifyPortalEmployee(data);
      showToast(`Welcome, ${data.user.fullName}! Your IT Help Desk portal is ready.`, 'success');
      navigate('/helpdesk/employee', { replace: true });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const verificationLabel =
    portalStatus.verificationMethod === 'EMAIL_ONLY'
      ? 'Registered Corporate Email Address'
      : portalStatus.verificationMethod === 'PHONE_ONLY'
      ? 'Registered Mobile Number'
      : 'Registered Email Address or Mobile Number';

  const verificationPlaceholder =
    portalStatus.verificationMethod === 'EMAIL_ONLY'
      ? 'e.g. name@euromotors.lk'
      : portalStatus.verificationMethod === 'PHONE_ONLY'
      ? 'e.g. 0771234567'
      : 'e.g. name@euromotors.lk or 0771234567';

  const currentStep = selectedEmployee ? 2 : 1;

  const portalHighlights = [
    {
      icon: LifeBuoy,
      title: 'Request IT Support',
      desc: 'Get assistance with company IT assets and services.',
      accentDark: 'from-blue-500/20 to-cyan-500/10 text-blue-300 border-blue-400/30',
      accentLight: 'from-blue-50 to-sky-50 text-blue-700 border-blue-200',
    },
    {
      icon: MonitorSmartphone,
      title: 'My Assigned IT Assets',
      desc: 'View your allocated hardware and accessories after verification.',
      accentDark: 'from-indigo-500/20 to-blue-500/10 text-indigo-300 border-indigo-400/30',
      accentLight: 'from-indigo-50 to-slate-50 text-indigo-700 border-indigo-200',
    },
    {
      icon: Activity,
      title: 'Track Support Requests',
      desc: 'Monitor the progress of your IT support tickets.',
      accentDark: 'from-emerald-500/20 to-teal-500/10 text-emerald-300 border-emerald-400/30',
      accentLight: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <div className="font-ui relative min-h-screen overflow-x-hidden bg-slate-50 dark:bg-[#040916] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300">
      {/* Ambient Enterprise Navy Glow & Subtle Dot Mesh */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.055]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="absolute -top-44 -left-32 w-[520px] h-[520px] rounded-full bg-blue-500/10 dark:bg-blue-600/20 blur-[130px]" />
        <div className="absolute -bottom-44 -right-28 w-[540px] h-[540px] rounded-full bg-indigo-500/10 dark:bg-cyan-500/12 blur-[140px]" />
      </div>

      {/* 1. HEADER SECTION */}
      <header className="relative z-20 w-full border-b border-slate-200/85 dark:border-blue-500/15 bg-white/90 dark:bg-[#070e21]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {/* Euro Motors Branding + Shield */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 dark:from-blue-500 dark:to-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 ring-1 ring-white/25 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-400/95 truncate">
                EURO MOTORS PRIVATE LIMITED
              </p>
              <h1 className="font-display text-lg sm:text-[21px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white leading-tight truncate">
                Smart Employee IT Support Portal
              </h1>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-[#0b1631] border border-slate-200 dark:border-blue-400/25 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)] animate-pulse shrink-0" />
              <span className="font-code text-[11.5px] font-medium tracking-tight text-slate-700 dark:text-blue-100">
                {user?.email || portalStatus.portalEmail || 'itsupport@euromotors.lk'}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#0b1631] dark:hover:bg-[#122247] border border-slate-200 dark:border-blue-400/25 text-slate-700 dark:text-blue-200 shadow-sm transition-all cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-700" />}
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-[0.01em] bg-white hover:bg-rose-50 dark:bg-[#0b1631] dark:hover:bg-rose-950/45 border border-slate-200 hover:border-rose-300 dark:border-blue-400/25 dark:hover:border-rose-500/40 text-slate-700 hover:text-rose-700 dark:text-slate-100 dark:hover:text-rose-300 shadow-sm transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN TWO-COLUMN SECTION */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* LEFT PANEL: Identification & Verification */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-7 flex flex-col justify-between bg-white dark:bg-[#091227]/95 border border-slate-200/90 dark:border-blue-500/25 rounded-3xl shadow-xl shadow-slate-200/65 dark:shadow-[0_24px_60px_-15px_rgba(15,23,42,0.85),0_0_40px_-14px_rgba(59,130,246,0.28)] p-6 sm:p-8 lg:p-9 space-y-6"
          >
            <div className="space-y-6">
              {/* Two-Step Progress Indicator */}
              <div className="px-4 py-3.5 rounded-2xl bg-slate-50/90 dark:bg-[#0d1936]/90 border border-slate-200/80 dark:border-blue-400/20">
                <div className="flex items-center justify-between gap-3 sm:gap-5">
                  {/* Step 1 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-display text-xs font-extrabold shrink-0 transition-all ${
                        currentStep === 1
                          ? 'bg-blue-700 dark:bg-blue-500 text-white shadow-md shadow-blue-600/35 ring-2 ring-blue-400/35'
                          : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                      }`}
                    >
                      {currentStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-blue-300/75">
                        Step 1
                      </p>
                      <p className="font-display text-[13px] sm:text-sm font-bold tracking-[-0.01em] text-slate-900 dark:text-white truncate">
                        Identify Yourself
                      </p>
                    </div>
                  </div>

                  {/* Connector Bar */}
                  <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800/90 overflow-hidden min-w-[28px]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        currentStep === 2
                          ? 'w-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500'
                          : 'w-1/2 bg-gradient-to-r from-blue-600 to-cyan-400'
                      }`}
                    />
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-display text-xs font-extrabold shrink-0 transition-all ${
                        currentStep === 2
                          ? 'bg-blue-700 dark:bg-blue-500 text-white shadow-md shadow-blue-600/35 ring-2 ring-blue-400/35'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      2
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-blue-300/75">
                        Step 2
                      </p>
                      <p
                        className={`font-display text-[13px] sm:text-sm font-bold tracking-[-0.01em] truncate ${
                          currentStep === 2
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        Verify &amp; Continue
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Title + Lead Subtitle */}
              <div className="space-y-2">
                <h2 className="font-display text-[26px] sm:text-[32px] lg:text-[34px] font-extrabold tracking-[-0.03em] leading-[1.15] text-slate-900 dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-blue-200 dark:bg-clip-text dark:text-transparent">
                  {selectedEmployee ? 'Verify Your Employee Identity' : 'Find Your Employee Profile'}
                </h2>
                <p className="text-[13.5px] sm:text-[14.5px] leading-[1.6] text-slate-600 dark:text-slate-300/90 max-w-xl">
                  {selectedEmployee
                    ? 'Confirm your registered Euro Motors email address or mobile number to securely access your personal Help Desk dashboard and assigned hardware.'
                    : 'Search by your Employee Name or Employee ID in the live Euro Motors directory to access personalized IT support.'}
                </p>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{errorMsg}</p>
                    {contactMissing && (
                      <p className="text-[11.5px] opacity-90">
                        An IT Officer or IT Manager can submit a support request on your behalf immediately while your contact record is updated.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 1: Search Box & Result Cards */}
              {!selectedEmployee && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="portal-employee-search"
                      className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-blue-300"
                    >
                      Search Employee Name or Employee ID
                    </label>
                    <div className="relative rounded-2xl transition-all duration-200 bg-slate-50/90 dark:bg-[#0c1733] border border-slate-300/90 dark:border-blue-400/25 focus-within:border-blue-600 dark:focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/15 dark:focus-within:ring-blue-500/20 dark:focus-within:shadow-[0_0_28px_-4px_rgba(59,130,246,0.35)]">
                      <Search className="w-[18px] h-[18px] text-slate-400 dark:text-blue-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="portal-employee-search"
                        ref={searchInputRef}
                        type="text"
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Type at least ${portalStatus.minSearchChars || 2} characters (e.g. Name or EMP-000001)...`}
                        className="w-full pl-12 pr-12 py-3.5 bg-transparent rounded-2xl text-[14px] sm:text-[15px] font-medium tracking-[-0.005em] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      {searching ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      ) : query ? (
                        <button
                          type="button"
                          onClick={handleResetSelection}
                          aria-label="Clear search"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Selectable Results List */}
                  <AnimatePresence mode="wait">
                    {hasSearched ? (
                      results.length === 0 ? (
                        <motion.div
                          key="no-results"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0c1733] border border-slate-200 dark:border-blue-400/20 text-center space-y-2"
                        >
                          <HelpCircle className="w-7 h-7 text-amber-500 mx-auto" />
                          <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            Employee Not Found in Active Directory
                          </p>
                          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            No active employee matched your search. Please verify the spelling or Employee ID, or contact the Euro Motors IT Department for assistance.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="results-list"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-blue-300/75 px-1">
                            <span>Select Your Profile ({results.length} found)</span>
                            <span>Active Directory</span>
                          </div>
                          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                            {results.map((emp) => (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => handleSelectEmployee(emp)}
                                className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 hover:bg-blue-50/85 dark:bg-[#0c1733] dark:hover:bg-[#112149] border border-slate-200/90 hover:border-blue-500 dark:border-blue-400/20 dark:hover:border-blue-400/75 shadow-sm hover:shadow-md dark:hover:shadow-[0_0_24px_-4px_rgba(59,130,246,0.3)] transition-all flex items-center justify-between gap-3 group cursor-pointer"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-700 dark:from-blue-500/25 dark:to-cyan-500/20 border border-blue-600/20 dark:border-blue-400/35 text-white dark:text-blue-200 flex items-center justify-center font-display font-bold text-xs tracking-wide shrink-0 shadow-sm">
                                    {(emp.fullName || 'E').trim().slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-display text-[15px] font-bold tracking-[-0.015em] text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                        {emp.fullName}
                                      </span>
                                      <span className="font-code px-2 py-0.5 rounded-lg text-[11px] font-semibold tracking-tight bg-blue-100/90 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-400/30">
                                        {emp.employeeCode}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium text-slate-600 dark:text-slate-300/90 mt-1">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-blue-400/90 shrink-0" />
                                        {emp.departmentName || 'Department N/A'}
                                      </span>
                                      <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-blue-400/90 shrink-0" />
                                        {emp.locationName || 'Branch N/A'}
                                      </span>
                                      {emp.designation && (
                                        <span className="inline-flex items-center gap-1.5">
                                          <Briefcase className="w-3.5 h-3.5 text-slate-400 dark:text-blue-400/90 shrink-0" />
                                          {emp.designation}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-blue-500/15 text-blue-700 dark:text-blue-200 border border-slate-200 dark:border-blue-400/30 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shrink-0">
                                  Select
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )
                    ) : (
                      <motion.div
                        key="search-hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 rounded-2xl bg-slate-50/90 dark:bg-[#0c1733]/75 border border-dashed border-slate-300 dark:border-blue-400/25 flex items-start gap-3 text-[12.5px] leading-[1.6] text-slate-600 dark:text-slate-300/90"
                      >
                        <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p>
                          Start typing your name or Employee ID above. Employees with duplicate names are distinguished by Employee ID, Department, and Branch. Only active staff profiles are listed, and contact details remain hidden until verified.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* STEP 2: Highlighted Employee Card + Verification Form */}
              {selectedEmployee && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleVerify}
                  className="space-y-4"
                >
                  <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/90 dark:bg-gradient-to-r dark:from-blue-950/65 dark:to-[#0f1f44] border-2 border-blue-600 dark:border-blue-400/75 shadow-md dark:shadow-[0_0_26px_-4px_rgba(59,130,246,0.3)] space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display text-base sm:text-lg font-extrabold tracking-[-0.015em] text-slate-900 dark:text-white">
                            {selectedEmployee.fullName}
                          </span>
                          <span className="font-code px-2.5 py-0.5 rounded-lg text-[11.5px] font-bold bg-blue-700 dark:bg-blue-500 text-white">
                            {selectedEmployee.employeeCode}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-700 dark:text-blue-100 mt-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                            {selectedEmployee.departmentName || 'Department N/A'}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                            {selectedEmployee.locationName || 'Branch N/A'}
                          </span>
                          {selectedEmployee.designation && (
                            <span className="inline-flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                              {selectedEmployee.designation}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetSelection}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 dark:bg-[#0b1631] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-300 dark:border-blue-400/30 transition-colors shrink-0 cursor-pointer"
                      >
                        Change Profile
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          selectedEmployee.hasEmail
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Mail className="w-3 h-3" />
                        {selectedEmployee.hasEmail ? 'Email Registered' : 'No Email On File'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          selectedEmployee.hasPhone
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Phone className="w-3 h-3" />
                        {selectedEmployee.hasPhone ? 'Mobile Registered' : 'No Mobile On File'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="portal-verify-input"
                      className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700 dark:text-blue-300 mb-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 inline mr-1.5 text-blue-600 dark:text-blue-400" />
                      {verificationLabel}
                    </label>
                    <input
                      id="portal-verify-input"
                      type="text"
                      autoFocus
                      required
                      value={verificationInput}
                      onChange={(e) => setVerificationInput(e.target.value)}
                      placeholder={verificationPlaceholder}
                      className="w-full px-4 py-3.5 bg-white dark:bg-[#0c1733] border border-slate-300 dark:border-blue-400/35 rounded-2xl text-[14px] sm:text-[15px] font-medium outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15 dark:focus:ring-blue-500/20 text-slate-900 dark:text-white"
                    />
                  </div>

                  {portalStatus.allowRememberDevice && (
                    <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c1733]/85 border border-slate-200 dark:border-blue-400/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-display text-xs font-bold text-slate-800 dark:text-slate-100 block">
                          Remember My Device ({portalStatus.rememberDeviceDays || 7} days)
                        </span>
                        <span className="text-[11.5px] leading-[1.5] text-slate-500 dark:text-slate-400">
                          Enable ONLY on your personal computer or mobile. Leave unchecked on shared/kiosk devices (auto-expires after {portalStatus.idleTimeoutMinutes || 30} min inactivity or browser close).
                        </span>
                      </div>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 dark:from-blue-600 dark:to-cyan-600 dark:hover:from-blue-500 dark:hover:to-cyan-500 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[14.5px] sm:text-[15px] tracking-[-0.005em] shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying Identity...
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Open My IT Help Desk</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </div>

            {/* Security Metadata Footer Row */}
            <div className="pt-4 border-t border-slate-100 dark:border-blue-500/15 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Protected by Euro Motors Employee Verification
              </span>
              <span className="font-code text-[11px] font-medium text-slate-400 dark:text-slate-400">
                Idle Timeout: {portalStatus.idleTimeoutMinutes || 30} min
              </span>
            </div>
          </motion.section>

          {/* RIGHT PANEL: 3D Help Desk Illustration & Action Cards */}
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="lg:col-span-5 bg-white dark:bg-gradient-to-b dark:from-[#0b1530] dark:to-[#081024] border border-slate-200/90 dark:border-blue-500/25 rounded-3xl shadow-xl shadow-slate-200/65 dark:shadow-[0_24px_60px_-15px_rgba(15,23,42,0.85),0_0_40px_-14px_rgba(59,130,246,0.22)] p-6 sm:p-7 flex flex-col justify-between space-y-5"
          >
            {/* 3D Illustration Card */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-100/90 to-slate-50 dark:from-[#0e1b3c] dark:to-[#091228] border border-slate-200/80 dark:border-blue-400/20 p-4 shadow-inner">
              <HelpDeskHeroIllustration isDark={isDark} />
            </div>

            {/* 3 Enterprise Action Highlight Cards */}
            <div className="space-y-3">
              {portalHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-[#0d1834]/95 border border-slate-200/85 dark:border-blue-400/20 shadow-sm flex items-start gap-3.5 transition-all duration-200 hover:-translate-y-0.5 dark:hover:border-blue-400/40"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 shadow-sm ${
                        isDark ? item.accentDark : item.accentLight
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-[14px] font-bold tracking-[-0.01em] text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-[12.5px] leading-[1.55] text-slate-600 dark:text-slate-300/90 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.aside>
        </div>
      </main>

      {/* 3. BOTTOM SUPPORT BANNER */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="rounded-2xl bg-white dark:bg-[#091227]/95 border border-slate-200 dark:border-blue-500/25 shadow-md dark:shadow-[0_0_32px_-12px_rgba(59,130,246,0.28)] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/35 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display text-[13.5px] sm:text-[14px] font-bold tracking-[-0.01em] text-slate-900 dark:text-white">
                Can&apos;t find your profile or need to update your contact information?
              </p>
              <p className="text-[12px] leading-[1.5] text-slate-600 dark:text-slate-300/90 mt-0.5">
                Contact the Euro Motors IT Department for assistance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              showToast(
                'Please contact the Euro Motors IT Help Desk team so an IT Officer can update your directory contact info or log a ticket on your behalf.',
                'info'
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold tracking-[0.005em] bg-slate-100 hover:bg-blue-50 dark:bg-[#0e1b3b] dark:hover:bg-[#142652] text-slate-800 hover:text-blue-700 dark:text-blue-200 dark:hover:text-white border border-slate-200 hover:border-blue-300 dark:border-blue-400/30 dark:hover:border-blue-400/60 transition-all shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>IT Help Desk Team Can Log Tickets On Your Behalf</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
