import { useState } from 'react';
import { FiX, FiSave, FiPlusCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { createCompany } from '../utils/companyApi';

// Shared "Add New Company" modal used by both the Inward (ChallanVerification)
// and Outward (OutwardForm) pages, so a company added from either page
// immediately becomes available on both.
export default function AddCompanyModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        brand: '',
        companyName: '',
        address: '',
        phone: '',
        gstin: '',
        email: '',
        hsnCode: '',
        defaultRate: '',
    });
    const [saving, setSaving] = useState(false);

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async () => {
        if (!form.brand.trim()) { toast.error('Brand Key is required.'); return; }
        if (!form.companyName.trim()) { toast.error('Full Company Name is required.'); return; }
        if (!form.address.trim()) { toast.error('Address is required.'); return; }
        if (!form.phone.trim()) { toast.error('Phone number is required.'); return; }
        if (!form.gstin.trim()) { toast.error('GSTIN is required.'); return; }
        if (!form.email.trim()) { toast.error('Email is required.'); return; }

        setSaving(true);
        try {
            const created = await createCompany({
                brand: form.brand.trim(),
                companyName: form.companyName.trim(),
                address: form.address.trim(),
                phone: form.phone.trim(),
                gstin: form.gstin.trim(),
                email: form.email.trim(),
                hsnCode: form.hsnCode.trim(),
                defaultRate: form.defaultRate ? parseFloat(form.defaultRate) : 0,
            });
            toast.success(`Company "${created.brand}" added.`);
            onCreated(created);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add company.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-surface-500';
    const labelCls = 'block text-xs font-medium text-surface-400 mb-1.5';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500/15">
                            <FiPlusCircle className="w-4 h-4 text-brand-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white tracking-tight">Add New Company</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-surface-500 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Short Name (Brand Key) *</label>
                            <input
                                value={form.brand}
                                onChange={(e) => update('brand', e.target.value)}
                                placeholder="e.g. Atomberg"
                                className={inputCls}
                            />
                            <p className="text-[11px] text-surface-500 mt-1">Shown in dropdowns and transaction lists.</p>
                        </div>
                        <div>
                            <label className={labelCls}>Full Company Name *</label>
                            <input
                                value={form.companyName}
                                onChange={(e) => update('companyName', e.target.value)}
                                placeholder="e.g. Atomberg Technologies Pvt. Ltd."
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Address *</label>
                        <textarea
                            value={form.address}
                            onChange={(e) => update('address', e.target.value)}
                            rows={2}
                            placeholder="Company address for delivery challans"
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Phone No. *</label>
                            <input
                                value={form.phone}
                                onChange={(e) => update('phone', e.target.value)}
                                placeholder="+91 ..."
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>GSTIN *</label>
                            <input
                                value={form.gstin}
                                onChange={(e) => update('gstin', e.target.value)}
                                placeholder="27ABCDE1234F1Z5"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Email *</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => update('email', e.target.value)}
                            placeholder="contact@company.com"
                            className={inputCls}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>HSN Code <span className="text-surface-600">(optional)</span></label>
                            <input
                                value={form.hsnCode}
                                onChange={(e) => update('hsnCode', e.target.value)}
                                placeholder="85340000"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Default Rate (₹/unit) <span className="text-surface-600">(optional)</span></label>
                            <input
                                type="number" min="0"
                                value={form.defaultRate}
                                onChange={(e) => update('defaultRate', e.target.value)}
                                placeholder="0"
                                className={inputCls}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm text-surface-300 hover:text-white transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave className="w-4 h-4" />
                        )}
                        {saving ? 'Saving...' : 'Add Company'}
                    </button>
                </div>
            </div>
        </div>
    );
}
