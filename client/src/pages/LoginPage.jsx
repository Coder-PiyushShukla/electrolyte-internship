import { useState } from 'react';
import { FiUser, FiLock, FiLogIn, FiZap, FiEye, FiEyeOff, FiCpu } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const BOOT_LINES = [
  '> INITIALIZING BOARD CONTROLLER...',
  '> TRACE MAP LOADED [OK]',
  '> POWER RAIL: STABLE 3.3V',
  '> AWAITING OPERATOR AUTH_',
];

function CircuitArt() {
  const trace = {
    hidden: { pathLength: 0, opacity: 0 },
    show: (i) => ({
      pathLength: 1,
      opacity: 1,
      transition: { pathLength: { delay: 0.15 * i, duration: 0.9, ease: 'easeInOut' }, opacity: { delay: 0.15 * i, duration: 0.2 } },
    }),
  };

  return (
    <svg viewBox="0 0 420 420" className="w-full max-w-md drop-shadow-[0_0_35px_rgba(77,232,212,0.15)]">
      <g stroke="#c9834a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <motion.path custom={0} variants={trace} initial="hidden" animate="show" d="M15,55 L120,55 L120,150 L168,150" />
        <motion.path custom={1} variants={trace} initial="hidden" animate="show" d="M15,150 L70,150 L70,190 L168,190" />
        <motion.path custom={2} variants={trace} initial="hidden" animate="show" d="M15,345 L100,345 L100,262 L168,262" />
        <motion.path custom={1.5} variants={trace} initial="hidden" animate="show" d="M15,255 L55,255 L55,300 L168,300" />
        <motion.path custom={0} variants={trace} initial="hidden" animate="show" d="M405,55 L300,55 L300,150 L252,150" />
        <motion.path custom={1} variants={trace} initial="hidden" animate="show" d="M405,150 L350,150 L350,190 L252,190" />
        <motion.path custom={2} variants={trace} initial="hidden" animate="show" d="M405,345 L320,345 L320,262 L252,262" />
        <motion.path custom={1.5} variants={trace} initial="hidden" animate="show" d="M405,255 L365,255 L365,300 L252,300" />
      </g>

      {/* gold pads at trace ends */}
      {[[15,55],[15,150],[15,345],[15,255],[405,55],[405,150],[405,345],[405,255]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="4.5" fill="#d4af37" opacity="0.9" />
      ))}

      {/* resistor zigzag on one trace */}
      <motion.path
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
        d="M35,255 l6,-8 l8,16 l8,-16 l8,16 l6,-8" stroke="#7d9186" strokeWidth="2" fill="none" strokeLinecap="round"
      />

      {/* capacitor symbol on another trace */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
        <line x1="80" y1="330" x2="80" y2="360" stroke="#4de8d4" strokeWidth="3" />
        <path d="M72,345 a8,15 0 0 1 16,0" stroke="#4de8d4" strokeWidth="3" fill="none" />
      </motion.g>

      {/* central chip */}
      <motion.g initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.9, duration: 0.5, ease: 'backOut' }}>
        <rect x="168" y="140" width="84" height="140" rx="8" fill="#0d2818" stroke="#4de8d4" strokeWidth="1.5" />
        <rect x="176" y="148" width="68" height="124" rx="4" fill="none" stroke="#163b26" strokeWidth="1" />
        <text x="210" y="200" textAnchor="middle" fill="#7d9186" fontSize="10" fontFamily="'JetBrains Mono', monospace" letterSpacing="1">MCU</text>
        <text x="210" y="216" textAnchor="middle" fill="#4de8d4" fontSize="8" fontFamily="'JetBrains Mono', monospace" letterSpacing="1">v2.1</text>
        <circle cx="210" cy="240" r="6" fill="#4de8d4" className="pcb-led" />
      </motion.g>
    </svg>
  );
}

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('pcb_token', data.token);
      localStorage.setItem('pcb_user', JSON.stringify(data.user));
      toast.success('Welcome back!');
      onLogin(data.user);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#060a08] font-['Inter',sans-serif] overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        @keyframes pcbPulse { 0%,100% { filter: drop-shadow(0 0 2px #4de8d4) drop-shadow(0 0 6px #4de8d4); opacity: 1; } 50% { filter: drop-shadow(0 0 6px #4de8d4) drop-shadow(0 0 16px #4de8d4); opacity: 0.6; } }
        .pcb-led { animation: pcbPulse 2.2s ease-in-out infinite; }
        @keyframes blinkCursor { 0%,45% { opacity: 1; } 50%,100% { opacity: 0; } }
        .pcb-cursor::after { content: '\\2588'; animation: blinkCursor 1s step-start infinite; color: #4de8d4; margin-left: 2px; }
        @keyframes scanMove { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        .pcb-scan { animation: scanMove 6s linear infinite; }
      `}</style>

      {/* LEFT — storytelling / circuit board */}
      <div className="hidden lg:flex lg:w-[56%] relative items-center justify-center overflow-hidden bg-gradient-to-br from-[#060a08] via-[#0a1710] to-[#0d2818] border-r border-[#163b26]">
        <div
          className="absolute inset-0 opacity-[0.14] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#4de8d4 1px, transparent 1px), linear-gradient(90deg, #4de8d4 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        />
        <div className="pcb-scan absolute left-0 right-0 h-40 bg-gradient-to-b from-transparent via-[#4de8d4]/[0.06] to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center px-10">
          <CircuitArt />

          <div className="mt-8 self-start font-['JetBrains_Mono',monospace] text-[11px] text-[#4de8d4]/80 space-y-1.5">
            {BOOT_LINES.map((line, i) => (
              <motion.p
                key={line}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.1 + i * 0.22 }}
                className={i === BOOT_LINES.length - 1 ? 'pcb-cursor' : ''}
              >
                {line}
              </motion.p>
            ))}
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.1 }}
            className="mt-8 font-['Chakra_Petch',sans-serif] text-3xl font-bold text-[#eaf2ec] tracking-wide text-center"
          >
            SYSTEM <span className="text-[#4de8d4]">ONLINE</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.3 }}
            className="mt-2 text-[#7d9186] text-sm text-center max-w-sm"
          >
            Real-time electrolyte capacitor inventory, mapped like the board it protects.
          </motion.p>
        </div>
      </div>

      {/* RIGHT — auth form */}
      <div className="flex-1 flex items-center justify-center relative px-6 py-12">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] bg-[#4de8d4]/10 rounded-full blur-[130px] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-[-15%] left-[-10%] w-[420px] h-[420px] bg-[#c9834a]/10 rounded-full blur-[130px] pointer-events-none"
        />

        <Tilt
          tiltMaxAngleX={4}
          tiltMaxAngleY={4}
          perspective={1200}
          scale={1.01}
          transitionSpeed={2000}
          gyroscope={true}
          className="w-full max-w-md z-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, type: 'spring', bounce: 0.35 }}
          >
            <div className="text-center mb-7">
              <motion.div
                whileHover={{ rotate: 180, scale: 1.1 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-[#163b26] to-[#0d2818] border border-[#4de8d4]/40 shadow-[0_0_30px_rgba(77,232,212,0.25)] mb-4"
              >
                <FiZap className="w-7 h-7 text-[#4de8d4]" />
              </motion.div>
              <h1 className="font-['Chakra_Petch',sans-serif] text-3xl font-bold text-[#eaf2ec] tracking-tight">
                PCB TRACKER
              </h1>
              <p className="text-[#7d9186] mt-1.5 tracking-[0.15em] text-[11px] uppercase font-['JetBrains_Mono',monospace]">
                Electrolyte Inventory Management
              </p>
            </div>

            {/* form styled as a component module */}
            <form
              onSubmit={handleSubmit}
              className="relative bg-[#0a130f]/80 backdrop-blur-2xl border border-[#163b26] rounded-2xl p-7 pt-9 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
            >
              {/* pin row along the top edge, like an IC */}
              <div className="absolute -top-[5px] left-6 right-6 flex justify-between px-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/70" />
                ))}
              </div>

              <div className="flex items-center gap-2 mb-6">
                <FiCpu className="text-[#4de8d4] w-4 h-4" />
                <h2 className="font-['JetBrains_Mono',monospace] text-xs tracking-[0.15em] uppercase text-[#eaf2ec]/90">
                  Authenticate Session
                </h2>
              </div>

              <div className="mb-5 relative group">
                <label className="block text-[10px] uppercase tracking-[0.15em] font-semibold text-[#7d9186] mb-2 font-['JetBrains_Mono',monospace]">
                  Username or Email
                </label>
                <div className="relative">
                  <span className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-[#4de8d4]/50 rounded-tl" />
                  <span className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-[#4de8d4]/50 rounded-br" />
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#7d9186] group-focus-within:text-[#4de8d4] transition-colors" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter identifier (username/email)"
                    className="w-full pl-12 pr-4 py-3.5 bg-[#060a08] border border-[#163b26] rounded-lg text-[#eaf2ec] placeholder:text-[#7d9186]/50 focus:outline-none focus:ring-1 focus:ring-[#4de8d4]/50 focus:border-[#4de8d4]/60 transition-all duration-300 font-['JetBrains_Mono',monospace] text-sm"
                  />
                </div>
              </div>

              <div className="mb-8 relative group">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] uppercase tracking-[0.15em] font-semibold text-[#7d9186] font-['JetBrains_Mono',monospace]">
                    Security Key
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-[11px] text-[#4de8d4] hover:text-[#7ff2e0] transition-colors font-['JetBrains_Mono',monospace]"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-[#4de8d4]/50 rounded-tl" />
                  <span className="absolute right-0 bottom-0 w-3 h-3 border-r-2 border-b-2 border-[#4de8d4]/50 rounded-br" />
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#7d9186] group-focus-within:text-[#4de8d4] transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security key"
                    className="w-full pl-12 pr-12 py-3.5 bg-[#060a08] border border-[#163b26] rounded-lg text-[#eaf2ec] placeholder:text-[#7d9186]/50 focus:outline-none focus:ring-1 focus:ring-[#4de8d4]/50 focus:border-[#4de8d4]/60 transition-all duration-300 font-['JetBrains_Mono',monospace] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7d9186] hover:text-[#4de8d4] transition-colors"
                  >
                    {showPassword ? <FiEyeOff className="w-4.5 h-4.5" /> : <FiEye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0d2818] to-[#163b26] hover:from-[#123524] hover:to-[#1a4d2e] text-[#eaf2ec] font-medium rounded-lg shadow-[0_0_24px_rgba(77,232,212,0.15)] transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 border border-[#4de8d4]/30 font-['JetBrains_Mono',monospace] text-sm tracking-wide"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#4de8d4]/30 border-t-[#4de8d4] rounded-full animate-spin" />
                ) : (
                  <>
                    <FiLogIn className="w-4.5 h-4.5" />
                    ACCESS SYSTEM
                  </>
                )}
              </motion.button>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-[13px] text-[#7d9186] hover:text-[#eaf2ec] transition-colors duration-200 font-['JetBrains_Mono',monospace]"
                >
                  Request system access →
                </button>
              </div>
            </form>
          </motion.div>
        </Tilt>
      </div>
    </div>
  );
}