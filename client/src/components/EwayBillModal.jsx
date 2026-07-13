import { useState, useEffect } from 'react';
import { FiX, FiSave, FiTruck, FiInfo, FiMapPin, FiUploadCloud } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getEwayBill, saveEwayBill, uploadEwayBillPdf } from '../utils/ewayBillApi';
import { getSupplyType } from '../utils/vehicleStateLookup';

const REASONS = [
    'Outward Supply (Sales)',
    'Non-Supply (Stock Transfer)',
    'Job Work',
    'Sales Return',
    'Others',
];

function toDateInput(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function toDateTimeInput(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// dispatch: the saved outward dispatch record (id, dc_no, challan_date, company_name,
//           company_address, gstin, vehicle_no, courier_partner, total_amount)
// company:  own company info (companyName, address, gstin)
// username: current logged-in user, for "Entered By"
export default function EwayBillModal({ dispatch, company, username, onClose }) {
    const [form, setForm] = useState({
        ewayBillNo: '',
        ewayBillDate: toDateInput(dispatch.challan_date) || toDateInput(new Date()),
        supplierGstin: company?.gstin || '',
        recipientGstin: dispatch.gstin || '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    // ── Load any previously-saved e-way bill for this dispatch ──
    useEffect(() => {
        let cancelled = false;
        getEwayBill(dispatch.id)
            .then((existing) => {
                if (cancelled || !existing) return;
                setForm((prev) => ({
                    ...prev,
                    ewayBillNo: existing.eway_bill_no || '',
                    ewayBillDate: toDateInput(existing.eway_bill_date) || toDateInput(new Date()),
                    supplierGstin: existing.supplier_gstin || company?.gstin || prev.supplierGstin,
                    recipientGstin: existing.recipient_gstin || dispatch.gstin || prev.recipientGstin,
                }));
                setSaved(true);
            })
            .catch(() => { /* no existing record - that's fine, use defaults */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch.id]);

    const isRequired = Boolean(dispatch.eway_required);

    const supplyType = getSupplyType(form.supplierGstin, form.recipientGstin);

    const handleSave = async () => {
        if (!form.ewayBillNo.trim()) {
            toast.error('Please enter the E-Way Bill No. (from the government E-Way Bill portal).');
            return;
        }

        setSaving(true);
        try {
            await saveEwayBill(dispatch.id, {
                ewayBillNo: form.ewayBillNo.trim(),
                ewayBillDate: form.ewayBillDate || null,
                supplierGstin: form.supplierGstin,
                recipientGstin: form.recipientGstin,
                documentNo: dispatch.dc_no,
                documentDate: toDateInput(dispatch.challan_date),
                valueOfGoods: dispatch.total_amount,
                enteredDate: toDateInput(new Date()),
                enteredBy: username || 'system',
            });
            toast.success('E-Way Bill details saved.');
            setSaved(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save e-way bill details.');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadPdf = async () => {
        if (!selectedFile) {
            toast.error('Please choose an official E-Way Bill PDF to upload.');
            return;
        }
        setUploadingPdf(true);
        try {
            await uploadEwayBillPdf(dispatch.id, selectedFile);
            toast.success('E-Way Bill PDF uploaded.');
            setSelectedFile(null);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to upload E-Way Bill PDF.');
        } finally {
            setUploadingPdf(false);
        }
    };


    const inputCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-surface-500';
    const readonlyCls = 'w-full bg-surface-800/30 border border-surface-700/50 text-surface-300 rounded-xl px-3 py-2 text-sm cursor-not-allowed';
    const selectCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer';
    const labelCls = 'block text-xs font-medium text-surface-400 mb-1.5';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/15">
                            <FiTruck className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight">E-Way Bill Details</h3>
                            <p className="text-xs text-surface-500">Dispatch value exceeds ₹50,000, required for interstate transport (Sec. 68, CGST Act)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-surface-500 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-5 overflow-y-auto">
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                            <FiInfo className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <p className="text-xs text-amber-200/90">
                                    {isRequired
                                        ? 'Generate the actual E-Way Bill on the government portal before dispatching the goods.'
                                        : 'This dispatch does not currently require an E-Way Bill.'}
                                </p>
                                {isRequired && dispatch.eway_portal_url && (
                                    <a
                                        href={dispatch.eway_portal_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                                    >
                                        Open official portal <FiTruck className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className={labelCls}>GSTIN of Supplier</label>
                                <div className={readonlyCls}>{form.supplierGstin || '-'}</div>
                            </div>
                            <div>
                                <label className={labelCls}>GSTIN of Recipient</label>
                                <div className={readonlyCls}>{form.recipientGstin || '-'}</div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Movement Type</label>
                                <div className={readonlyCls}>
                                    {supplyType ? (supplyType.isInterstate ? 'Interstate' : 'Intrastate') : 'Auto-detected'}
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelCls}>Total Value of Goods</label>
                                <div className={readonlyCls}>₹{Number(dispatch.total_amount || 0).toLocaleString('en-IN')}</div>
                            </div>
                        </div>

                        {isRequired && (
                            <>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={labelCls}>E-Way Bill No. *</label>
                                        <input
                                            value={form.ewayBillNo}
                                            onChange={(e) => update('ewayBillNo', e.target.value)}
                                            placeholder="e.g. 5652 XXXX 6583"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>E-Way Bill Date</label>
                                        <input
                                            type="date"
                                            value={form.ewayBillDate}
                                            onChange={(e) => update('ewayBillDate', e.target.value)}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>

                                <div className="p-3 border border-surface-700/60 rounded-xl bg-surface-800/40">
                                    <label className={labelCls}>Official E-Way Bill PDF</label>
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-surface-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-500"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                                        <button
                                            onClick={handleUploadPdf}
                                            disabled={uploadingPdf || !selectedFile}
                                            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {uploadingPdf ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiUploadCloud className="w-4 h-4" />}
                                            {uploadingPdf ? 'Uploading...' : 'Upload PDF'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-surface-800 shrink-0">
                    <button onClick={onClose} className="px-4 py-2.5 text-sm text-surface-300 hover:text-white transition-colors cursor-pointer">
                        Close
                    </button>
                    {isRequired ? (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                            {saving ? 'Saving...' : saved ? 'Update' : 'Save'}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
