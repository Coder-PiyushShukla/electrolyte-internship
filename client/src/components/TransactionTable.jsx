import { FiTrash2, FiArrowDown, FiArrowUp, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function TransactionTable({ transactions, filters, onFilterChange, onDelete }) {
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transaction deleted.');
      onDelete(id);
    } catch {
      toast.error('Failed to delete transaction.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="animate-fade-in bg-surface-900/80 backdrop-blur-sm border border-surface-800 rounded-xl overflow-hidden">
      {/* Filters Bar */}
      <div id="transaction-filters" className="p-4 border-b border-surface-800 flex flex-wrap gap-3 items-center">
        <h3 className="text-white font-semibold mr-auto">Transactions</h3>

        {/* Brand Filter */}
        <div className="relative">
          <select
            id="filter-brand"
            value={filters.brand}
            onChange={(e) => onFilterChange({ ...filters, brand: e.target.value })}
            className="appearance-none bg-surface-800/60 border border-surface-700 text-surface-200 text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">All Brands</option>
            <option value="Atomberg">Atomberg</option>
            <option value="Bajaj">Bajaj</option>
          </select>
          <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <select
            id="filter-type"
            value={filters.type}
            onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
            className="appearance-none bg-surface-800/60 border border-surface-700 text-surface-200 text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="in_ward">In-Ward</option>
            <option value="out_ward">Out-Ward</option>
          </select>
          <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-surface-400 text-xs uppercase tracking-wider border-b border-surface-800">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">DC Number</th>
              <th className="px-4 py-3 font-medium">Part Code</th>
              <th className="px-4 py-3 font-medium text-right">Qty</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Remarks</th>
              <th className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800/50">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-surface-500">
                  <div className="flex flex-col items-center gap-2">
                    <FiArrowDown className="w-8 h-8 text-surface-700" />
                    <p>No transactions found.</p>
                    <p className="text-xs text-surface-600">Add a new transaction to get started.</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="hover:bg-surface-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-surface-300 whitespace-nowrap">{formatDate(txn.transaction_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                      txn.brand_name === 'Atomberg'
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {txn.brand_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                      txn.transaction_type === 'in_ward'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-orange-500/15 text-orange-400'
                    }`}>
                      {txn.transaction_type === 'in_ward' ? (
                        <><FiArrowDown className="w-3 h-3" /> In</>
                      ) : (
                        <><FiArrowUp className="w-3 h-3" /> Out</>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-300 font-mono text-xs">{txn.dc_number}</td>
                  <td className="px-4 py-3 text-white font-medium">{txn.part_code}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">{txn.quantity}</td>
                  <td className="px-4 py-3">
                    {txn.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                        txn.status === 'ok'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {txn.status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-surface-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-surface-400 text-xs max-w-[150px] truncate">{txn.remarks || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(txn.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 cursor-pointer"
                      title="Delete transaction"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {transactions.length > 0 && (
        <div className="px-4 py-3 border-t border-surface-800 text-xs text-surface-500">
          Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
