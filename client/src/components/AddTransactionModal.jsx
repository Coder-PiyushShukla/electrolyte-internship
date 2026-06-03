import { useState } from 'react';
import { FiX, FiSave, FiChevronDown } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function AddTransactionModal({ isOpen, onClose, onAdded }) {
  const [form, setForm] = useState({
    brand_name: 'Atomberg',
    transaction_type: 'in_ward',
    dc_number: '',
    transaction_date: new Date().toISOString().split('T')[0],
    part_code: '',
    quantity: '',
    status: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dc_number || !form.part_code || !form.quantity) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        quantity: parseInt(form.quantity, 10),
        status: form.status || null,
        remarks: form.remarks || null,
      };
      const { data } = await api.post('/transactions', payload);
      toast.success('Transaction added!');
      onAdded(data.data);
      onClose();
      setForm({
        brand_name: 'Atomberg',
        transaction_type: 'in_ward',
        dc_number: '',
        transaction_date: new Date().toISOString().split('T')[0],
        part_code: '',
        quantity: '',
        status: '',
        remarks: '',
      });
    } catch (err) {
      const details = err.response?.data?.details;
      toast.error(details ? details.join('\n') : err.response?.data?.error || 'Failed to add transaction.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 placeholder:text-surface-500";
  const selectClasses = "appearance-none w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-4 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 cursor-pointer";
  const labelClasses = "block text-sm font-medium text-surface-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="animate-scale-in relative bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-800">
          <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} id="add-transaction-form" className="p-5 space-y-4">
          {/* Row: Brand + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="txn-brand" className={labelClasses}>Brand *</label>
              <div className="relative">
                <select id="txn-brand" name="brand_name" value={form.brand_name} onChange={handleChange} className={selectClasses}>
                  <option value="Atomberg">Atomberg</option>
                  <option value="Bajaj">Bajaj</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label htmlFor="txn-type" className={labelClasses}>Type *</label>
              <div className="relative">
                <select id="txn-type" name="transaction_type" value={form.transaction_type} onChange={handleChange} className={selectClasses}>
                  <option value="in_ward">In-Ward</option>
                  <option value="out_ward">Out-Ward</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row: DC + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="txn-dc" className={labelClasses}>DC Number *</label>
              <input id="txn-dc" name="dc_number" value={form.dc_number} onChange={handleChange} placeholder="e.g. DC-2024-001" className={inputClasses} />
            </div>
            <div>
              <label htmlFor="txn-date" className={labelClasses}>Date *</label>
              <input id="txn-date" name="transaction_date" type="date" value={form.transaction_date} onChange={handleChange} className={inputClasses} />
            </div>
          </div>

          {/* Row: Part Code + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="txn-part" className={labelClasses}>Part Code *</label>
              <input id="txn-part" name="part_code" value={form.part_code} onChange={handleChange} placeholder="e.g. PCB-ATM-001" className={inputClasses} />
            </div>
            <div>
              <label htmlFor="txn-qty" className={labelClasses}>Quantity *</label>
              <input id="txn-qty" name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} placeholder="0" className={inputClasses} />
            </div>
          </div>

          {/* Status (only for out_ward) */}
          {form.transaction_type === 'out_ward' && (
            <div>
              <label htmlFor="txn-status" className={labelClasses}>Status</label>
              <div className="relative">
                <select id="txn-status" name="status" value={form.status} onChange={handleChange} className={selectClasses}>
                  <option value="">— Select —</option>
                  <option value="ok">OK</option>
                  <option value="scrap">Scrap</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label htmlFor="txn-remarks" className={labelClasses}>Remarks</label>
            <textarea
              id="txn-remarks"
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              rows={2}
              placeholder="Optional notes..."
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="txn-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiSave className="w-4.5 h-4.5" />
                  Save Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
