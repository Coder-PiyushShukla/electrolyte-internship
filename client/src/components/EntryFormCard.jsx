import { useState, useEffect } from 'react';
import { FiPlus, FiUser, FiFileText, FiHash, FiCalendar, FiCpu, FiCheck } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function EntryFormCard({ user }) {
  const [form, setForm] = useState({
    doc_no: '',
    lot_no: '',
    dc_date: new Date().toISOString().split('T')[0],
    part_code: '',
  });
  const [partCodes, setPartCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch available part codes for the dropdown
  useEffect(() => {
    const fetchPartCodes = async () => {
      try {
        const { data } = await api.get('/entries/part-codes');
        setPartCodes(data.data || []);
      } catch {
        // Silently fail — user can still type a part code
      }
    };
    fetchPartCodes();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.doc_no || !form.lot_no || !form.dc_date || !form.part_code) {
      toast.error('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/entries', form);
      setSuccess(true);
      toast.success('Entry added successfully!');
      // Reset form after brief delay to show success state
      setTimeout(() => {
        setForm({
          doc_no: '',
          lot_no: '',
          dc_date: new Date().toISOString().split('T')[0],
          part_code: '',
        });
        setSuccess(false);
      }, 1500);
    } catch (err) {
      const details = err.response?.data?.details;
      toast.error(
        details ? details.join('\n') : err.response?.data?.error || 'Failed to add entry.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/80 backdrop-blur-sm shadow-2xl">
      {/* Decorative gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />

      {/* Header: Title + User badge */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/15">
            <FiFileText className="w-4 h-4 text-brand-400" />
          </div>
          <h3 className="text-lg font-semibold text-white tracking-tight">New Entry</h3>
        </div>
        {/* User badge — top right as shown in photo */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800/60 rounded-lg border border-surface-700/50">
          <FiUser className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-sm text-surface-300 font-medium">{user?.username || 'User'}</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} id="entry-form" className="px-6 pb-6 pt-2 space-y-5">
        {/* Doc No. */}
        <div className="group">
          <label htmlFor="entry-doc-no" className="flex items-center gap-2 text-sm font-medium text-surface-400 mb-2 group-focus-within:text-brand-400 transition-colors">
            <FiFileText className="w-3.5 h-3.5" />
            Doc No.
          </label>
          <input
            id="entry-doc-no"
            name="doc_no"
            value={form.doc_no}
            onChange={handleChange}
            placeholder="Enter document number"
            autoComplete="off"
            className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/40
                       hover:border-surface-600 transition-all duration-200 placeholder:text-surface-600"
          />
        </div>

        {/* Lot No */}
        <div className="group">
          <label htmlFor="entry-lot-no" className="flex items-center gap-2 text-sm font-medium text-surface-400 mb-2 group-focus-within:text-brand-400 transition-colors">
            <FiHash className="w-3.5 h-3.5" />
            Lot No
          </label>
          <input
            id="entry-lot-no"
            name="lot_no"
            value={form.lot_no}
            onChange={handleChange}
            placeholder="Enter lot number"
            autoComplete="off"
            className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/40
                       hover:border-surface-600 transition-all duration-200 placeholder:text-surface-600"
          />
        </div>

        {/* DC Date */}
        <div className="group">
          <label htmlFor="entry-dc-date" className="flex items-center gap-2 text-sm font-medium text-surface-400 mb-2 group-focus-within:text-brand-400 transition-colors">
            <FiCalendar className="w-3.5 h-3.5" />
            DC Date
          </label>
          <input
            id="entry-dc-date"
            name="dc_date"
            type="date"
            value={form.dc_date}
            onChange={handleChange}
            className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/40
                       hover:border-surface-600 transition-all duration-200
                       [color-scheme:dark]"
          />
        </div>

        {/* Part Code — Dropdown + freeform combo */}
        <div className="group">
          <label htmlFor="entry-part-code" className="flex items-center gap-2 text-sm font-medium text-surface-400 mb-2 group-focus-within:text-brand-400 transition-colors">
            <FiCpu className="w-3.5 h-3.5" />
            Part Code
          </label>
          <div className="relative">
            <input
              id="entry-part-code"
              name="part_code"
              list="part-code-options"
              value={form.part_code}
              onChange={handleChange}
              placeholder="Select or type a part code"
              autoComplete="off"
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/40
                         hover:border-surface-600 transition-all duration-200 placeholder:text-surface-600"
            />
            <datalist id="part-code-options">
              {partCodes.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Submit button — "+" style as shown in photo */}
        <div className="flex justify-end pt-1">
          <button
            id="entry-submit"
            type="submit"
            disabled={loading || success}
            className={`group/btn flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm
                       shadow-lg transition-all duration-300 cursor-pointer
                       disabled:cursor-not-allowed
                       ${success
                         ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                         : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98]'
                       }
                       disabled:opacity-60`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : success ? (
              <>
                <FiCheck className="w-5 h-5" />
                Added!
              </>
            ) : (
              <>
                <FiPlus className="w-5 h-5 transition-transform duration-200 group-hover/btn:rotate-90" />
                Add Entry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
