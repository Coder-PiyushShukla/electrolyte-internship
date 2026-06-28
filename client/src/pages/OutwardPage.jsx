import { motion } from 'framer-motion';
import { FiArrowUp, FiClock } from 'react-icons/fi';

export default function OutwardPage({ user }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-surface-900/50 backdrop-blur-2xl border border-surface-700/50 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Outward
          </h2>
          <p className="text-xs text-orange-400 mt-1 uppercase tracking-widest font-semibold">
            PCB Dispatch Management
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 py-20 bg-surface-900/40 backdrop-blur-xl border border-surface-700/50 rounded-3xl">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10">
          <FiArrowUp className="w-6 h-6 text-orange-400" />
        </div>
        <p className="text-surface-300 font-medium">Outward functionality coming soon</p>
        <p className="text-sm text-surface-500 flex items-center gap-1.5">
          <FiClock className="w-3.5 h-3.5" />
          This page is reserved for the upcoming Outward PCB Dispatch feature.
        </p>
      </div>
    </motion.div>
  );
}
