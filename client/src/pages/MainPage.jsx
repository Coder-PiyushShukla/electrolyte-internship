import { useState, useEffect, useCallback } from 'react';
import { FiUploadCloud, FiRefreshCw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api from '../utils/api';
import toast from 'react-hot-toast';
import SummaryCards from '../components/SummaryCards';
import TransactionTable from '../components/TransactionTable';
import EntriesTable from '../components/EntriesTable';
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

// --- REAL EXCEL DATA ANALYTICS ---
const companyData = [
  { name: 'Atomberg', Inward: 109923, Outward: 86222 },
  { name: 'Bajaj', Inward: 65962, Outward: 64030 }
];

const atombergTopParts = [
  { name: 'GV3 Consolidate', value: 32993 },
  { name: 'GV2 Consolidate', value: 27145 },
  { name: 'Power GV3', value: 25702 },
  { name: 'Remote GV4', value: 5286 },
  { name: 'Main 1200mm', value: 4928 }
];
const COLORS = ['#3a86ff', '#8338ec', '#ff006e', '#fb5607', '#ffbe0b'];

// Custom Tooltip for aesthetic dark mode styling in Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-900/95 border border-surface-700/80 p-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <p className="text-white font-semibold mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm font-medium tracking-wide">
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MainPage({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [entries, setEntries] = useState([]);
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

  const fetchEntries = useCallback(async () => {
    try {
      const { data } = await api.get('/entries');
      setEntries(data.data);
    } catch {
      // Silently fail — entries section is supplementary
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchEntries();
  }, [fetchData, fetchEntries]);

  const handleDelete = (deletedId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
    api.get('/transactions/summary').then(res => setSummary(res.data.data)).catch(() => { });
  };

  const handleEntryDelete = (deletedId) => {
    setEntries((prev) => prev.filter((e) => e.id !== deletedId));
  };

  const handleUploadComplete = () => {
    fetchData();
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative overflow-hidden"
    >
      {/* Background Glowing Orbs for extra aesthetics */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[140px] pointer-events-none"
      />

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

      {/* --- NEW AESTHETIC CHARTS SECTION --- */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8 z-10 relative">
        <Tilt tiltMaxAngleX={3} tiltMaxAngleY={3} perspective={1000} scale={1.01} transitionSpeed={2000} gyroscope={true}>
          <div className="bg-surface-900/40 backdrop-blur-2xl border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-full">
            <h3 className="text-sm font-semibold text-surface-300 mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              In-Ward vs Out-Ward Overview
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                  <Bar dataKey="Inward" fill="#3a86ff" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="Outward" fill="#8338ec" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Tilt>

        <Tilt tiltMaxAngleX={3} tiltMaxAngleY={3} perspective={1000} scale={1.01} transitionSpeed={2000} gyroscope={true}>
          <div className="bg-surface-900/40 backdrop-blur-2xl border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-full">
            <h3 className="text-sm font-semibold text-surface-300 mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              Top Atomberg Components
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={atombergTopParts}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {atombergTopParts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Tilt>
      </motion.div>
      {/* ------------------------------------- */}

      <motion.div variants={itemVariants}>
        <EntryFormCard user={user} onEntryAdded={fetchEntries} />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-surface-900/40 backdrop-blur-xl border border-surface-700/50 rounded-3xl p-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <EntriesTable entries={entries} onDelete={handleEntryDelete} />
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