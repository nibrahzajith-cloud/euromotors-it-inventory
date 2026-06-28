import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Lock, Mail, AlertCircle, Eye, EyeOff, Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState(localStorage.getItem('rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberedEmail') ? true : false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      showToast('Login successful. Welcome back!', 'success');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#0a0a1a' }}>

      {/* ═══════════ LEFT PANEL — Branding ═══════════ */}
      <div 
        className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)' }}
      >
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)', animation: 'pulse 8s ease-in-out infinite' }} />
          <div className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)', animation: 'pulse 10s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)', animation: 'pulse 6s ease-in-out infinite' }} />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        {/* Top Logo */}
        <div className={`relative z-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-white p-1 overflow-hidden"
            >
              <img src="/logo.png" alt="Euro Motors" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-white/90 font-bold text-lg tracking-tight">Euro Motors</h3>
              <p className="text-purple-300/60 text-[10px] font-bold uppercase tracking-[0.2em]">(Pvt) Ltd.</p>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className={`relative z-10 max-w-lg transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-6 animate-[float_6s_ease-in-out_infinite]">
            IT Inventory
            <br />
            <span 
              className="bg-clip-text text-transparent"
              style={{ 
                backgroundImage: 'linear-gradient(270deg, #c4b5fd, #a78bfa, #7c3aed, #c4b5fd)', 
                backgroundSize: '200% 100%',
                animation: 'shimmer 4s linear infinite'
              }}
            >
              Management System
            </span>
          </h1>
          <p className="text-purple-200/60 text-base leading-relaxed max-w-md">
            Centralized asset tracking, real-time analytics, and intelligent inventory management for enterprise operations.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 mt-8">
            {['Asset Tracking', 'QR Integration', 'Real-time Analytics', 'Audit Logs'].map((feature, i) => (
              <div 
                key={feature}
                className={`px-4 py-2 rounded-full text-xs font-bold text-purple-200/80 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ 
                  transitionDelay: `${400 + i * 100}ms`,
                  background: 'rgba(255,255,255,0.06)', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Stats */}
        <div className={`relative z-10 flex gap-10 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {[
            { value: '99.9%', label: 'Uptime' },
            { value: '256-bit', label: 'Encryption' },
            { value: '24/7', label: 'Monitoring' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-purple-300/50 text-[10px] font-bold uppercase tracking-[0.15em] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — Login Form ═══════════ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative" style={{ background: '#05050f' }}>
        
        {/* Subtle background gradient & noise */}
        <div className="absolute inset-0 opacity-[0.15]" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.4), transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

        <div className={`w-full max-w-[420px] relative z-10 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Mobile Logo (hidden on desktop) */}
          <div className="flex lg:hidden justify-center mb-10">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-white p-1 shadow-md overflow-hidden"
              >
                <img src="/logo.png" alt="Euro Motors" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg tracking-tight">Euro Motors</h3>
                <p className="text-purple-400/60 text-[9px] font-bold uppercase tracking-[0.2em]">(Pvt) Ltd.</p>
              </div>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8 relative z-10">
            <h2 
              className="text-3xl font-black tracking-tight"
              style={{ 
                backgroundImage: 'linear-gradient(270deg, #ffffff, #a78bfa, #ffffff)', 
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'shimmer 5s linear infinite'
              }}
            >
              Welcome back
            </h2>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">Enter your credentials to access the secure system</p>
          </div>

          {/* Login Form Card */}
          <div 
            className="rounded-3xl p-8 relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(145deg, rgba(30, 27, 75, 0.8), rgba(10, 10, 25, 0.95))',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
              backdropFilter: 'blur(25px)'
            }}
          >
            {/* Top edge highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"></div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              
              {/* Error Alert */}
              {error && (
                <div 
                  className="flex items-start gap-3 p-4 rounded-2xl text-sm animate-in fade-in slide-in-from-top-2 duration-300"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                >
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-[13px]">{error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-purple-300/80 uppercase tracking-[0.12em]">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200">
                    <Mail className="w-[18px] h-[18px] text-slate-600 group-focus-within:text-purple-400" />
                  </div>
                  <input
                    type="email"
                    className="w-full rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:ring-2 focus:ring-purple-500/40"
                    style={{ 
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    placeholder="admin@euromotors.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-purple-300/80 uppercase tracking-[0.12em]">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200">
                    <Lock className="w-[18px] h-[18px] text-slate-600 group-focus-within:text-purple-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl pl-12 pr-12 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:ring-2 focus:ring-purple-500/40"
                    style={{ 
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-purple-400 transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Remember Me + Forgot */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div 
                      className="w-5 h-5 rounded-md transition-all duration-200 peer-checked:border-purple-500 flex items-center justify-center"
                      style={{ 
                        background: rememberMe ? 'linear-gradient(135deg, #4c1d95, #6d28d9)' : 'rgba(255,255,255,0.04)',
                        border: rememberMe ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {rememberMe && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[13px] text-slate-500 group-hover:text-slate-400 transition-colors">Remember me</span>
                </label>
                <a href="#" className="text-[13px] font-medium text-purple-400/80 hover:text-purple-300 transition-colors">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full relative group flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
                style={{ 
                  background: 'linear-gradient(135deg, #4c1d95, #6d28d9, #7c3aed)',
                  boxShadow: '0 8px 25px rgba(76, 29, 149, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                {/* Hover shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed, #8b5cf6)' }} />
                
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Shield className="w-3.5 h-3.5 text-emerald-500/60" />
              <p className="text-[10px] text-slate-600 font-medium tracking-wide">Protected by enterprise-grade encryption</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-10 space-y-2 relative z-10">
            <p className="text-[11px] text-slate-500 font-medium tracking-wide">
              © {new Date().getFullYear()} Euro Motors (Private) Limited. All Rights Reserved.
            </p>
            <p className="text-[11px] text-purple-400 font-bold tracking-widest uppercase" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.4)' }}>
              Developed by : Nifraz Ajith, Ph.D
            </p>
          </div>
        </div>
      </div>

      {/* Global Keyframe Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.15); opacity: 0.25; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
