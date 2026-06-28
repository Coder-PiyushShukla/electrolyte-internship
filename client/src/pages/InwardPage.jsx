import { motion } from 'framer-motion';
import ChallanVerification from '../components/ChallanVerification';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 14 },
  },
};

export default function InwardPage({ user }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-surface-900/50 backdrop-blur-2xl border border-surface-700/50 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Inward
          </h2>
          <p className="text-xs text-amber-400 mt-1 uppercase tracking-widest font-semibold">
            Challan Verification &amp; PCB Receiving Management
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ChallanVerification />
      </motion.div>
    </motion.div>
  );
}
