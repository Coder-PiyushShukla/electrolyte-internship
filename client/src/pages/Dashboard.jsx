import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiUploadCloud, FiRefreshCw } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';
import SummaryCards from '../components/SummaryCards';
import TransactionTable from '../components/TransactionTable';
import AddTransactionModal from '../components/AddTransactionModal';
import UploadModal from '../components/UploadModal';
import EntryFormCard from '../components/EntryFormCard';
import ChallanVerification from '../components/ChallanVerification';

export default function Dashboard({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filters, setFilters] = useState({ brand: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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

  const handleTransactionAdded = (newTxn) => {
    fetchData(); // Re-fetch for accurate summary
  };

  const handleDelete = (deletedId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
    // Re-fetch summary
    api.get('/transactions/summary').then(res => setSummary(res.data.data)).catch(() => { });
  };

  const handleUploadComplete = () => {
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-surface-400 mt-0.5">Track and manage your PCB inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="refresh-btn"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-surface-300 bg-surface-800/60 border border-surface-700 rounded-xl hover:bg-surface-800 hover:text-white transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            id="upload-btn"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <FiUploadCloud className="w-4 h-4" />
            Import Excel
          </button>
          <button
            id="add-transaction-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Entry Form Card */}
      <EntryFormCard user={user} />

      {/* ── Challan Verification (new) ── */}
      <ChallanVerification />

      {/* Transaction Table */}
      <TransactionTable
        transactions={transactions}
        filters={filters}
        onFilterChange={setFilters}
        onDelete={handleDelete}
      />

      {/* Loading Overlay */}
      {loading && transactions.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-sm text-surface-400">Loading transactions...</p>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleTransactionAdded}
      />
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleUploadComplete}
      />
    </div>
  );
}
