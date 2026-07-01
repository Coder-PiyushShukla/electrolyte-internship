import { useState, useEffect, useCallback } from 'react';
import { FiUploadCloud, FiRefreshCw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';
import SummaryCards from '../components/SummaryCards';
import TransactionTable from '../components/TransactionTable';

import UploadModal from '../components/UploadModal';
import EntryFormCard from '../components/EntryFormCard';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 100, damping: 14 } 
  }
};

export default function MainPage({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filters, setFilters] = useState({ brand: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.brand) params.brand = filters.brand;
      if (filters.type) params.type = filters.type;

      const [txnRes, sumRes] = await Promise.all([
        api.get('/transactions', { params }),
        api.get('/transactions/summary'),
      ]);

      setTransactions(txnRes.data.data);
      setSummary(sumRes.data.data);
    } catch (err) {
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = (deletedId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
    api.get('/transactions/summary').then(res => setSummary(res.data.data)).catch(() => { });
  };

  const handleUploadComplete = () => {
    fetchData();
  };

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
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Dashboard
          </h2>
          <p className="text-xs text-brand-400 mt-1 uppercase tracking-widest font-semibold">
            Track and manage your PCB inventory
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            id="refresh-btn"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-300 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-colors duration-300 disabled:opacity-50 cursor-pointer shadow-lg"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            Refresh
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            id="upload-btn"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-200 bg-surface-800/90 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-colors duration-300 cursor-pointer shadow-lg"
          >
            <FiUploadCloud className="w-4 h-4 text-brand-300" />
            Import Excel
          </motion.button>
          

        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <SummaryCards summary={summary} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <EntryFormCard user={user} />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface-900/40 backdrop-blur-xl border border-surface-700/50 rounded-3xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <TransactionTable
          transactions={transactions}
          filters={filters}
          onFilterChange={setFilters}
          onDelete={handleDelete}
        />
      </motion.div>

      {loading && transactions.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-20"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-xs font-semibold tracking-widest text-brand-400 animate-pulse uppercase">Syncing Database...</p>
          </div>
        </motion.div>
      )}


      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleUploadComplete}
      />
    </motion.div>
  );
}
