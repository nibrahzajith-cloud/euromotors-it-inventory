import React from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable 3D-styled IT Help Desk illustration featuring a laptop,
 * headset, settings gear, and support checklist. Adapts cleanly to Dark and Light themes.
 */
export default function HelpDeskHeroIllustration({ isDark = true }) {
  const screenBg = isDark ? '#0b1630' : '#f1f5f9';
  const laptopShell = isDark ? '#1e293b' : '#cbd5e1';
  const laptopShellDark = isDark ? '#0f172a' : '#94a3b8';
  const laptopBezel = isDark ? '#0a1224' : '#1e293b';
  const cardBg = isDark ? '#101d38' : '#ffffff';
  const cardBorder = isDark ? '#2563eb' : '#cbd5e1';
  const accentBlue = isDark ? '#38bdf8' : '#2563eb';
  const gearMain = isDark ? '#60a5fa' : '#1d4ed8';
  const headsetBand = isDark ? '#3b82f6' : '#1e40af';

  return (
    <div className="relative w-full flex items-center justify-center py-2 select-none">
      {/* Ambient Halo */}
      <div
        className={`absolute inset-4 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isDark
            ? 'bg-gradient-to-tr from-blue-600/25 via-cyan-500/15 to-indigo-500/25 opacity-90'
            : 'bg-gradient-to-tr from-blue-400/20 via-sky-300/20 to-indigo-300/20 opacity-80'
        }`}
      />

      <motion.svg
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        viewBox="0 0 420 280"
        className="relative z-10 w-full max-w-[360px] h-auto drop-shadow-2xl"
        role="img"
        aria-label="Euro Motors IT Help Desk 3D Support Illustration"
      >
        <defs>
          <linearGradient id="hdLaptopLid" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#1e3a8a' : '#334155'} />
            <stop offset="100%" stopColor={laptopBezel} />
          </linearGradient>
          <linearGradient id="hdLaptopBase" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={laptopShell} />
            <stop offset="50%" stopColor={isDark ? '#334155' : '#e2e8f0'} />
            <stop offset="100%" stopColor={laptopShellDark} />
          </linearGradient>
          <linearGradient id="hdGlowBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="hdEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="hdSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor={isDark ? '#020617' : '#1e293b'} floodOpacity={isDark ? '0.65' : '0.18'} />
          </filter>
        </defs>

        {/* Ground Perspective Ellipse Shadow */}
        <ellipse
          cx="205"
          cy="248"
          rx="150"
          ry="16"
          fill={isDark ? '#020617' : '#94a3b8'}
          opacity={isDark ? '0.65' : '0.28'}
        />

        {/* Floating Settings Gear (Top Left) */}
        <motion.g
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '86px 76px' }}
          filter="url(#hdSoftShadow)"
        >
          <circle cx="86" cy="76" r="24" fill={isDark ? '#0f172a' : '#e2e8f0'} stroke={gearMain} strokeWidth="3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="81"
              y="44"
              width="10"
              height="12"
              rx="2.5"
              fill={gearMain}
              transform={`rotate(${deg} 86 76)`}
            />
          ))}
          <circle cx="86" cy="76" r="17" fill="url(#hdGlowBlue)" />
          <circle cx="86" cy="76" r="7.5" fill={isDark ? '#0b1329' : '#f8fafc'} />
        </motion.g>

        {/* Main 3D Laptop */}
        <g filter="url(#hdSoftShadow)">
          {/* Laptop Lid / Frame */}
          <rect x="108" y="54" width="194" height="132" rx="12" fill="url(#hdLaptopLid)" stroke={isDark ? '#3b82f6' : '#475569'} strokeWidth="2" />
          {/* Inner Screen */}
          <rect x="118" y="64" width="174" height="110" rx="6" fill={screenBg} />

          {/* Screen Header Strip */}
          <rect x="126" y="72" width="158" height="18" rx="4" fill={isDark ? '#172554' : '#dbeafe'} />
          <circle cx="136" cy="81" r="3" fill="#38bdf8" />
          <circle cx="145" cy="81" r="3" fill="#60a5fa" />
          <rect x="155" y="78" width="68" height="6" rx="3" fill={accentBlue} opacity="0.85" />
          <rect x="252" y="77" width="24" height="8" rx="4" fill="url(#hdEmerald)" />

          {/* Screen Main UI Panel */}
          <rect x="126" y="96" width="96" height="70" rx="5" fill={isDark ? '#111c3d' : '#ffffff'} stroke={isDark ? '#1e3a8a' : '#cbd5e1'} strokeWidth="1" />
          <rect x="134" y="105" width="54" height="6" rx="3" fill={accentBlue} />
          <rect x="134" y="117" width="76" height="5" rx="2.5" fill={isDark ? '#475569' : '#94a3b8'} />
          <rect x="134" y="127" width="64" height="5" rx="2.5" fill={isDark ? '#334155' : '#cbd5e1'} />
          <rect x="134" y="141" width="78" height="16" rx="4" fill="url(#hdGlowBlue)" />

          {/* Mini Hardware Shield Tile Inside Screen */}
          <rect x="228" y="96" width="56" height="70" rx="5" fill={isDark ? '#111c3d' : '#ffffff'} stroke={isDark ? '#1e3a8a' : '#cbd5e1'} strokeWidth="1" />
          <path
            d="M256 108 L272 114 V127 C272 137 265 144 256 148 C247 144 240 137 240 127 V114 Z"
            fill="url(#hdGlowBlue)"
          />
          <path d="M250 128 L254.5 132.5 L263 123" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <rect x="237" y="154" width="38" height="5" rx="2.5" fill={isDark ? '#38bdf8' : '#2563eb'} opacity="0.6" />

          {/* 3D Laptop Keyboard Deck */}
          <polygon points="104,188 306,188 338,224 72,224" fill="url(#hdLaptopBase)" />
          <rect x="72" y="224" width="266" height="9" rx="4.5" fill={laptopShellDark} />
          {/* Keyboard Keys Hint */}
          <polygon points="120,194 290,194 304,209 106,209" fill={isDark ? '#0f172a' : '#64748b'} opacity="0.55" />
          {/* Trackpad */}
          <polygon points="178,212 232,212 237,220 173,220" fill={isDark ? '#1e293b' : '#cbd5e1'} stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="0.8" />
        </g>

        {/* Floating Support Checklist Card (Top/Mid Right) */}
        <motion.g
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#hdSoftShadow)"
        >
          <rect x="274" y="42" width="114" height="96" rx="12" fill={cardBg} stroke={cardBorder} strokeWidth="1.5" />
          <rect x="286" y="54" width="60" height="7" rx="3.5" fill={accentBlue} />
          {[0, 1, 2].map((idx) => {
            const y = 73 + idx * 20;
            return (
              <g key={idx}>
                <circle cx="294" cy={y} r="6.5" fill="url(#hdEmerald)" />
                <path
                  d={`M${291} ${y} L${293.5} ${y + 2.5} L${297.5} ${y - 2}`}
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <rect x="306" y={y - 3.5} width={idx === 1 ? 54 : 68} height="6" rx="3" fill={isDark ? '#94a3b8' : '#475569'} opacity="0.8" />
              </g>
            );
          })}
        </motion.g>

        {/* Floating 3D Support Headset (Bottom Left/Front) */}
        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          filter="url(#hdSoftShadow)"
        >
          {/* Headband Arc */}
          <path
            d="M66 190 C66 146 128 146 128 190"
            fill="none"
            stroke={headsetBand}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M70 188 C70 151 124 151 124 188"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* Left Earcup */}
          <rect x="55" y="182" width="16" height="28" rx="8" fill={isDark ? '#1e3a8a' : '#1e293b'} stroke="#38bdf8" strokeWidth="1.5" />
          {/* Right Earcup */}
          <rect x="123" y="182" width="16" height="28" rx="8" fill={isDark ? '#1e3a8a' : '#1e293b'} stroke="#38bdf8" strokeWidth="1.5" />
          {/* Boom Mic */}
          <path
            d="M131 206 C128 223 114 225 103 224"
            fill="none"
            stroke={isDark ? '#94a3b8' : '#334155'}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="101" cy="224" r="4.5" fill="url(#hdGlowBlue)" />
        </motion.g>
      </motion.svg>
    </div>
  );
}
