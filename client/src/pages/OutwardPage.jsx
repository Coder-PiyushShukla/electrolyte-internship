import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import OutwardForm from '../components/OutwardForm';
import TransactionTable from '../components/TransactionTable';

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

export default function OutwardPage({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ brand: '' });

  const fetchTransactions = useCallback(async () => {
    try {
      const params = { type: 'out_ward' };
      if (filters.brand) params.brand = filters.brand;
      const { data } = await api.get('/transactions', { params });
      setTransactions(data.data);
    } catch {
      toast.error('Failed to load outward transactions.');
    }
  }, [filters]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = (deletedId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
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
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Outward
          </h2>
          <p className="text-xs text-orange-400 mt-1 uppercase tracking-widest font-semibold">
            PCB Dispatch &amp; Delivery Challan Management
          </p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <OutwardForm user={user} />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface-900/40 backdrop-blur-xl border border-surface-700/50 rounded-3xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <TransactionTable
          transactions={transactions}
          filters={filters}
          onFilterChange={setFilters}
          onDelete={handleDelete}
          canDelete={user?.role === 'admin'}
          title="Outward Transactions"
          showTypeFilter={false}
        />
      </motion.div>
    </motion.div>
  );
}
