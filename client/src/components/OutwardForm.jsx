import { useState, useEffect, useCallback } from 'react';
import {
    FiPlus, FiTrash2, FiMail, FiSave, FiChevronDown,
    FiCheck, FiAlertCircle, FiHash, FiDownload, FiTruck, FiPackage,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
    getCustomers, getProducts, peekNextDc, peekNextOutwardLot,
    checkInventory, createDispatch, generateDocument, downloadDispatchPdf, sendOutwardEmail,
} from '../utils/outwardApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyItemRow() {
    return {
        id: Date.now() + Math.random(),
        itemCode: '', description: '', status: 'OK', hsnCode: '', unit: 'Nos',
        quantity: '', rate: '', remaining: null,
    };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OutwardForm() {
    const [customers, setCustomers] = useState([]);
    const [brand, setBrand] = useState('');
    const [products, setProducts] = useState([]);
    const [customerInfo, setCustomerInfo] = useState(null);

    const [dcNo, setDcNo] = useState(null);
    const [lotNo, setLotNo] = useState(null);
    const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleNo, setVehicleNo] = useState('');
    const [courierPartner, setCourierPartner] = useState('');
    const [remarks, setRemarks] = useState('');

    const [rows, setRows] = useState([emptyItemRow()]);
    const [saving, setSaving] = useState(false);
    const [savedDispatch, setSavedDispatch] = useState(null); // dispatch record once saved
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    // ── Load customer list on mount ──
    useEffect(() => {
        getCustomers()
            .then((list) => {
                setCustomers(list);
                if (list.length > 0) setBrand(list[0].brand);
            })
            .catch(() => toast.error('Failed to load customer list.'));
    }, []);

    // ── Whenever brand changes: load products, customer details, next DC + Lot ──
    useEffect(() => {
        if (!brand) return;
        let cancelled = false;

        getCustomers().then((list) => {
            if (cancelled) return;
            const info = list.find((c) => c.brand === brand);
            setCustomerInfo(info || null);
        });

        getProducts(brand).then((list) => { if (!cancelled) setProducts(list); }).catch(() => { });
        peekNextDc().then((dc) => { if (!cancelled) setDcNo(dc); }).catch(() => { });
        peekNextOutwardLot(brand).then((lot) => { if (!cancelled) setLotNo(lot); }).catch(() => { });

        // Reset rows + saved state when switching customer, since item codes differ
        setRows([emptyItemRow()]);
        setSavedDispatch(null);

        return () => { cancelled = true; };
    }, [brand]);

    // ── Row operations ──

    const addRow = () => setRows((prev) => [...prev, emptyItemRow()]);
    const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

    const updateRow = useCallback((id, field, value) => {
        setRows((prev) =>
            prev.map((row) => {
                if (row.id !== id) return row;
                const updated = { ...row, [field]: value };

                // Auto-fill description / HSN / unit / rate when item code changes
                if (field === 'itemCode') {
                    const product = products.find((p) => String(p.itemCode) === String(value));
                    updated.description = product?.description || '';
                    updated.hsnCode = product?.hsnCode || '';
                    updated.unit = product?.unit || 'Nos';
                    updated.rate = product?.rate ?? '';
                    updated.remaining = null;
                }
                return updated;
            })
        );
    }, [products]);

    // ── Live inventory check when item codes change ──
    useEffect(() => {
        rows.forEach((row) => {
            if (!row.itemCode) return;
            checkInventory(row.itemCode)
                .then((info) => {
                    setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, remaining: info.remaining } : r))
                    );
                })
                .catch(() => { });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows.map((r) => r.itemCode).join(',')]);

    // ── Duplicate OK/SCRAP-per-item validation (client-side, mirrors server rule) ──
    const findDuplicateError = () => {
        const seen = new Set();
        for (const row of rows) {
            if (!row.itemCode) continue;
            const key = `${row.itemCode}::${row.status}`;
            if (seen.has(key)) {
                return `An ${row.status} entry already exists for this item. Edit the existing row instead.`;
            }
            seen.add(key);
        }
        return null;
    };

    // ── Totals ──

    const totalQty = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (parseInt(r.quantity, 10) || 0) * (parseFloat(r.rate) || 0), 0);

    // ── Save Dispatch ──

    const handleSaveDispatch = async () => {
        if (!brand) { toast.error('Please select a customer/company.'); return; }
        if (!challanDate) { toast.error('Please select a challan date.'); return; }
        const validRows = rows.filter((r) => r.itemCode && r.quantity !== '');
        if (validRows.length === 0) { toast.error('Please add at least one item row with quantity.'); return; }

        const dupError = findDuplicateError();
        if (dupError) { toast.error(dupError); return; }

        // Client-side inventory pre-check (server re-validates authoritatively)
        for (const row of validRows) {
            if (row.remaining !== null && (parseInt(row.quantity, 10) || 0) > row.remaining) {
                toast.error(`Cannot dispatch ${row.quantity} of "${row.itemCode}". Only ${row.remaining} unit(s) remain available from Inward inventory.`);
                return;
            }
        }

        setSaving(true);
        try {
            const dispatch = await createDispatch({
                brand,
                companyName: customerInfo?.companyName,
                companyAddress: customerInfo?.address,
                phoneNo: customerInfo?.phone,
                gstin: customerInfo?.gstin,
                vehicleNo,
                courierPartner,
                challanDate,
                remarks,
                items: validRows.map((r) => ({
                    itemCode: r.itemCode,
                    description: r.description,
                    status: r.status,
                    hsnCode: r.hsnCode,
                    unit: r.unit,
                    quantity: r.quantity,
                    rate: r.rate,
                })),
            });
            setSavedDispatch(dispatch);
            setDcNo(dispatch.dc_no);
            setLotNo(dispatch.lot_no);
            toast.success(`Dispatch saved! (${dispatch.dc_no})`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save dispatch.');
        } finally {
            setSaving(false);
        }
    };

    // ── Generate + Download PDF ──

    const handleGenerateAndDownload = async () => {
        if (!savedDispatch) { toast.error('Please save the dispatch first.'); return; }
        setGeneratingPdf(true);
        try {
            await generateDocument(savedDispatch.id);
            await downloadDispatchPdf(savedDispatch.id, `${savedDispatch.dc_no.replace(/\//g, '-')}.pdf`);
            toast.success('Delivery challan PDF downloaded.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to generate document.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    // ── Send Email (PDF attachment + HTML summary) ──

    const handleSendEmail = async () => {
        if (!savedDispatch) { toast.error('Please save the dispatch first.'); return; }
        if (!emailTo.trim()) { toast.error('Please enter a recipient email address.'); return; }

        setSendingEmail(true);
        try {
            await sendOutwardEmail({ dispatchId: savedDispatch.id, to: emailTo.trim() });
            toast.success('Email successfully sent.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send email.');
        } finally {
            setSendingEmail(false);
        }
    };

    const inputCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-surface-500';
    const selectCls = 'appearance-none w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer';
    const readonlyCls = 'w-full bg-surface-800/30 border border-surface-700/50 text-surface-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2 cursor-not-allowed';

    return (
        <div className="animate-slide-up relative overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/80 backdrop-blur-sm shadow-2xl">
            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-400 to-orange-500" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/15">
                        <FiTruck className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white tracking-tight">PCB Dispatch (Outward)</h3>
                        <p className="text-xs text-surface-500">Generate delivery challan for repaired PCBs</p>
                    </div>
                </div>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-5">
                {/* Customer + Dispatch Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-800/30 rounded-xl border border-surface-700/50">
                    {/* Customer (Brand) */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Company Name *</label>
                        <div className="relative">
                            <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls}>
                                {customers.map((c) => (
                                    <option key={c.brand} value={c.brand}>{c.brand}</option>
                                ))}
                            </select>
                            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* DC No — auto */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                            <FiHash className="w-3 h-3" /> Challan No. / DC No. <span className="text-surface-600">(auto)</span>
                        </label>
                        <div className={readonlyCls}>
                            <span className="font-semibold text-white">{dcNo ?? 'Loading...'}</span>
                        </div>
                    </div>

                    {/* Lot No — auto */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                            <FiHash className="w-3 h-3" /> Lot No. <span className="text-surface-600">(auto)</span>
                        </label>
                        <div className={readonlyCls}>
                            <span className="font-semibold text-white">{lotNo ?? 'Loading...'}</span>
                        </div>
                    </div>

                    {/* Challan Date */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Challan Date</label>
                        <input
                            type="date"
                            value={challanDate}
                            onChange={(e) => setChallanDate(e.target.value)}
                            className={`${inputCls} [color-scheme:dark]`}
                        />
                    </div>

                    {/* Vehicle No */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Vehicle No.</label>
                        <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. MH04KU9365" className={inputCls} />
                    </div>

                    {/* Courier Partner */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Courier Partner</label>
                        <input value={courierPartner} onChange={(e) => setCourierPartner(e.target.value)} placeholder="e.g. Delhivery Ltd" className={inputCls} />
                    </div>

                    {/* Company Address — auto, read-only */}
                    <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Company Address <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.address || 'Loading...'}</span>
                        </div>
                    </div>

                    {/* Phone + GSTIN — auto, read-only */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Phone No. <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.phone || '—'}</span>
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">GSTIN <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.gstin || '—'}</span>
                        </div>
                    </div>
                </div>

                {/* PCB Dispatch Table */}
                <div className="overflow-x-auto rounded-xl border border-surface-700/50">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-800/60 text-surface-400 text-xs uppercase tracking-wider">
                                <th className="px-3 py-2.5 text-left font-medium">Item Code</th>
                                <th className="px-3 py-2.5 text-left font-medium">Description</th>
                                <th className="px-3 py-2.5 text-center font-medium w-24">Status</th>
                                <th className="px-3 py-2.5 text-center font-medium w-20">HSN</th>
                                <th className="px-3 py-2.5 text-center font-medium w-16">Unit</th>
                                <th className="px-3 py-2.5 text-right font-medium w-24">Qty</th>
                                <th className="px-3 py-2.5 text-right font-medium w-20">Rate</th>
                                <th className="px-3 py-2.5 text-right font-medium w-24">Amount</th>
                                <th className="px-3 py-2.5 text-center font-medium w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-800/50">
                            {rows.map((row) => {
                                const qty = parseInt(row.quantity, 10) || 0;
                                const rate = parseFloat(row.rate) || 0;
                                const amount = qty * rate;
                                const overLimit = row.remaining !== null && qty > row.remaining;
                                return (
                                    <tr key={row.id} className={`transition-colors duration-150 ${overLimit ? 'bg-red-500/10' : 'hover:bg-surface-800/30'}`}>
                                        {/* Item Code */}
                                        <td className="px-3 py-2">
                                            <div className="relative min-w-[120px]">
                                                <input
                                                    list={`outward-codes-${row.id}`}
                                                    value={row.itemCode}
                                                    onChange={(e) => updateRow(row.id, 'itemCode', e.target.value)}
                                                    placeholder="Search code..."
                                                    autoComplete="off"
                                                    className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all"
                                                />
                                                <datalist id={`outward-codes-${row.id}`}>
                                                    {products.map((p) => (
                                                        <option key={p.itemCode} value={p.itemCode} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            {row.remaining !== null && (
                                                <p className={`text-[11px] mt-1 ${overLimit ? 'text-red-400 font-semibold' : 'text-surface-500'}`}>
                                                    {row.remaining} remaining in stock
                                                </p>
                                            )}
                                        </td>
                                        {/* Description */}
                                        <td className="px-3 py-2 min-w-[180px]">
                                            <input
                                                value={row.description}
                                                onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                                placeholder="Auto-filled from code..."
                                                className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all"
                                            />
                                        </td>
                                        {/* Status */}
                                        <td className="px-3 py-2">
                                            <div className="relative">
                                                <select
                                                    value={row.status}
                                                    onChange={(e) => updateRow(row.id, 'status', e.target.value)}
                                                    className="w-full appearance-none bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 pr-6 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 cursor-pointer"
                                                >
                                                    <option value="OK">OK</option>
                                                    <option value="SCRAP">SCRAP</option>
                                                </select>
                                                <FiChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-500 pointer-events-none" />
                                            </div>
                                        </td>
                                        {/* HSN */}
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.hsnCode}
                                                onChange={(e) => updateRow(row.id, 'hsnCode', e.target.value)}
                                                className="w-full text-center bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 transition-all"
                                            />
                                        </td>
                                        {/* Unit */}
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.unit}
                                                onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                                                className="w-full text-center bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 transition-all"
                                            />
                                        </td>
                                        {/* Quantity */}
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={row.quantity}
                                                onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                                                placeholder="0"
                                                className={`w-full text-right bg-surface-800/50 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 placeholder:text-surface-600 transition-all tabular-nums text-white ${overLimit ? 'border-red-500/60 focus:ring-red-500/60' : 'border-surface-700 focus:ring-brand-500/60'}`}
                                            />
                                        </td>
                                        {/* Rate */}
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={row.rate}
                                                onChange={(e) => updateRow(row.id, 'rate', e.target.value)}
                                                placeholder="0"
                                                className="w-full text-right bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all tabular-nums"
                                            />
                                        </td>
                                        {/* Amount */}
                                        <td className="px-3 py-2 text-right">
                                            <span className="font-semibold tabular-nums text-sm text-white">{amount.toLocaleString()}</span>
                                        </td>
                                        {/* Remove */}
                                        <td className="px-3 py-2 text-center">
                                            {rows.length > 1 && (
                                                <button
                                                    onClick={() => removeRow(row.id)}
                                                    className="p-1 text-surface-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                                >
                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Totals Row */}
                            <tr className="bg-surface-800/40 border-t-2 border-surface-700">
                                <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-surface-300 uppercase tracking-wider">
                                    Grand Total
                                </td>
                                <td className="px-3 py-2.5 text-right text-sm font-bold text-white tabular-nums">
                                    {totalQty.toLocaleString()}
                                </td>
                                <td />
                                <td className="px-3 py-2.5 text-right text-sm font-bold text-white tabular-nums">
                                    ₹{totalAmount.toLocaleString()}
                                </td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Add Row */}
                <button
                    onClick={addRow}
                    className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
                >
                    <FiPlus className="w-4 h-4" />
                    Add item row
                </button>

                {/* Remarks */}
                <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Remarks (optional)</label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={2}
                        placeholder="e.g. Returned after repair. Packed carefully. Handle with care."
                        className={`${inputCls} resize-none`}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-1">
                    {/* Save Dispatch */}
                    <button
                        onClick={handleSaveDispatch}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave className="w-4 h-4" />
                        )}
                        {saving ? 'Saving...' : savedDispatch ? 'Saved' : 'Save Dispatch'}
                    </button>

                    {/* Generate + Download PDF */}
                    <button
                        onClick={handleGenerateAndDownload}
                        disabled={!savedDispatch || generatingPdf}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generatingPdf ? (
                            <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiDownload className="w-4 h-4" />
                        )}
                        {generatingPdf ? 'Generating...' : 'Generate & Download PDF'}
                    </button>

                    {/* Send Email */}
                    <button
                        onClick={() => setShowEmailInput((v) => !v)}
                        disabled={!savedDispatch}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FiMail className="w-4 h-4" />
                        Send Email
                    </button>
                </div>

                {!savedDispatch && (
                    <p className="text-xs text-surface-500 flex items-center gap-1.5">
                        <FiPackage className="w-3.5 h-3.5" />
                        Save the dispatch first to enable PDF generation and email sending.
                    </p>
                )}

                {/* Email Input (toggle) */}
                {showEmailInput && (
                    <div className="flex items-center gap-3 p-4 bg-surface-800/30 rounded-xl border border-surface-700/50 animate-slide-down">
                        <FiMail className="w-4 h-4 text-surface-400 shrink-0" />
                        <input
                            type="email"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            placeholder="customer@example.com"
                            className={`flex-1 ${inputCls}`}
                        />
                        <button
                            onClick={handleSendEmail}
                            disabled={sendingEmail}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl shadow-lg shadow-brand-500/25 transition-all duration-200 whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {sendingEmail ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FiMail className="w-4 h-4" />
                            )}
                            {sendingEmail ? 'Sending...' : 'Send with PDF Attached'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
