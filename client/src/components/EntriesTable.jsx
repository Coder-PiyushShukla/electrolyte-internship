import { FiTrash2, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function EntriesTable({ entries, onDelete }) {
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/entries/${id}`);
      toast.success('Entry deleted.');
      onDelete(id);
    } catch {
      toast.error('Failed to delete entry.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="animate-fade-in bg-surface-900/80 backdrop-blur-sm border border-surface-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div id="entries-header" className="p-4 border-b border-surface-800 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-500/15">
          <FiFileText className="w-3.5 h-3.5 text-brand-400" />
        </div>
        <h3 className="text-white font-semibold">Entries</h3>
        {entries.length > 0 && (
          <span className="ml-auto text-xs text-surface-500 bg-surface-800/60 px-2 py-0.5 rounded-md">
            {entries.length} total
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-surface-400 text-xs uppercase tracking-wider border-b border-surface-800">
              <th className="px-4 py-3 font-medium">DC Date</th>
              <th className="px-4 py-3 font-medium">Doc No.</th>
              <th className="px-4 py-3 font-medium">Lot No</th>
              <th className="px-4 py-3 font-medium">Part Code</th>
              <th className="px-4 py-3 font-medium">Created By</th>
              <th className="px-4 py-3 font-medium">Created At</th>
              <th className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                  <div className="flex flex-col items-center gap-2">
                    <FiFileText className="w-8 h-8 text-surface-700" />
                    <p>No entries found.</p>
                    <p className="text-xs text-surface-600">Use the form above to add a new entry.</p>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-surface-800/30 transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-surface-300 whitespace-nowrap">{formatDate(entry.dc_date)}</td>
                  <td className="px-4 py-3 text-white font-medium font-mono text-xs">{entry.doc_no}</td>
                  <td className="px-4 py-3 text-surface-300 font-mono text-xs">{entry.lot_no}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-brand-500/15 text-brand-400">
                      {entry.part_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-400 text-xs">{entry.created_by || '—'}</td>
                  <td className="px-4 py-3 text-surface-400 text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 cursor-pointer"
                      title="Delete entry"
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
    </div>
  );
}
