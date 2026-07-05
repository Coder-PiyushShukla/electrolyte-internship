import { useState, useEffect, useCallback } from 'react';
import { FiX, FiSave, FiTruck, FiDownload, FiPrinter, FiInfo, FiMapPin } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getEwayBill, saveEwayBill, downloadEwayBillPdf, printEwayBillPdf } from '../utils/ewayBillApi';
import { lookupStateFromVehicle, getSupplyType, calcValidUntil } from '../utils/vehicleStateLookup';

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
        generatedByGstin: company?.gstin || '',
        generatedByName: company?.companyName || '',
        distanceKm: '',
        validFrom: toDateTimeInput(new Date()),
        validUntil: '',
        supplierGstin: company?.gstin || '',
        placeOfDispatch: company?.address || '',
        recipientGstin: dispatch.gstin || '',
        placeOfDelivery: dispatch.company_address || '',
        reason: REASONS[0],
        transporterName: dispatch.courier_partner || '',
        transportMode: 'Road',
        vehicleNo: dispatch.vehicle_no || '',
        fromState: '',
    });
    const [validUntilTouched, setValidUntilTouched] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [printing, setPrinting] = useState(false);

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    // ── Load any previously-saved e-way bill for this dispatch ──
    useEffect(() => {
        let cancelled = false;
        getEwayBill(dispatch.id)
            .then((existing) => {
                if (cancelled || !existing) return;
                setForm({
                    ewayBillNo: existing.eway_bill_no || '',
                    ewayBillDate: toDateInput(existing.eway_bill_date) || toDateInput(new Date()),
                    generatedByGstin: existing.generated_by_gstin || company?.gstin || '',
                    generatedByName: existing.generated_by_name || company?.companyName || '',
                    distanceKm: existing.distance_km || '',
                    validFrom: toDateTimeInput(existing.valid_from) || toDateTimeInput(new Date()),
                    validUntil: toDateTimeInput(existing.valid_until),
                    supplierGstin: existing.supplier_gstin || company?.gstin || '',
                    placeOfDispatch: existing.place_of_dispatch || company?.address || '',
                    recipientGstin: existing.recipient_gstin || dispatch.gstin || '',
                    placeOfDelivery: existing.place_of_delivery || dispatch.company_address || '',
                    reason: existing.reason || REASONS[0],
                    transporterName: existing.transporter_name || dispatch.courier_partner || '',
                    transportMode: existing.transport_mode || 'Road',
                    vehicleNo: existing.vehicle_no || dispatch.vehicle_no || '',
                    fromState: existing.from_state || '',
                });
                setValidUntilTouched(true); // don't overwrite a previously saved validUntil automatically
                setSaved(true);
            })
            .catch(() => { /* no existing record — that's fine, use defaults */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch.id]);

    // ── Auto-detect state from vehicle number as it's typed ──
    const handleVehicleChange = (value) => {
        update('vehicleNo', value);
        const detected = lookupStateFromVehicle(value);
        if (detected) update('fromState', detected.state);
    };

    // ── Auto-calculate Valid Until whenever distance or Valid From changes (unless the user has manually edited it) ──
    useEffect(() => {
        if (validUntilTouched) return;
        if (!form.distanceKm) return;
        const until = calcValidUntil(form.validFrom, form.distanceKm);
        update('validUntil', toDateTimeInput(until));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.distanceKm, form.validFrom, validUntilTouched]);

    const supplyType = getSupplyType(form.supplierGstin, form.recipientGstin);

    const handleSave = async () => {
        if (!form.ewayBillNo.trim()) {
            toast.error('Please enter the E-Way Bill No. (from the government E-Way Bill portal).');
            return;
        }
        if (!form.vehicleNo.trim()) {
            toast.error('Please enter the vehicle number.');
            return;
        }

        setSaving(true);
        try {
            await saveEwayBill(dispatch.id, {
                ewayBillNo: form.ewayBillNo.trim(),
                ewayBillDate: form.ewayBillDate || null,
                generatedByGstin: form.generatedByGstin,
                generatedByName: form.generatedByName,
                distanceKm: form.distanceKm ? parseInt(form.distanceKm, 10) : null,
                validFrom: form.validFrom || null,
                validUntil: form.validUntil || null,
                supplierGstin: form.supplierGstin,
                placeOfDispatch: form.placeOfDispatch,
                recipientGstin: form.recipientGstin,
                placeOfDelivery: form.placeOfDelivery,
                documentNo: dispatch.dc_no,
                documentDate: toDateInput(dispatch.challan_date),
                valueOfGoods: dispatch.total_amount,
                reason: form.reason,
                transporterName: form.transporterName,
                transportMode: form.transportMode,
                vehicleNo: form.vehicleNo.trim().toUpperCase(),
                fromState: form.fromState,
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

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadEwayBillPdf(dispatch.id, `EWAY-${(dispatch.dc_no || '').replace(/\//g, '-')}.pdf`);
        } catch {
            toast.error('Failed to download e-way bill PDF.');
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = async () => {
        setPrinting(true);
        try {
            await printEwayBillPdf(dispatch.id);
        } catch {
            toast.error('Failed to open e-way bill for printing.');
        } finally {
            setPrinting(false);
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
                            <p className="text-xs text-surface-500">Dispatch value exceeds ₹50,000 — required for interstate transport (Sec. 68, CGST Act)</p>
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
                            <p className="text-xs text-amber-200/90">
                                Generate the actual E-Way Bill on the government portal (ewaybillgst.gov.in) first, then record its details here.
                                This creates an internal copy for your records — it does not file anything with the government.
                            </p>
                        </div>

                        {/* Header fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>E-Way Bill No. *</label>
                                <input value={form.ewayBillNo} onChange={(e) => update('ewayBillNo', e.target.value)} placeholder="e.g. 5652 XXXX 6583" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>E-Way Bill Date</label>
                                <input type="date" value={form.ewayBillDate} onChange={(e) => update('ewayBillDate', e.target.value)} className={inputCls} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Approx. Distance (km)</label>
                                <input type="number" min="0" value={form.distanceKm} onChange={(e) => update('distanceKm', e.target.value)} placeholder="e.g. 850" className={inputCls} />
                                <p className="text-[11px] text-surface-500 mt-1">Used to auto-calculate validity (1 day per 200 km).</p>
                            </div>
                            <div>
                                <label className={labelCls}>Valid From</label>
                                <input type="datetime-local" value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} className={inputCls} />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>
                                Valid Until {form.distanceKm && !validUntilTouched && <span className="text-brand-400">(auto-calculated)</span>}
                            </label>
                            <input
                                type="datetime-local"
                                value={form.validUntil}
                                onChange={(e) => { update('validUntil', e.target.value); setValidUntilTouched(true); }}
                                className={inputCls}
                            />
                        </div>

                        {/* Part A */}
                        <div className="pt-2">
                            <div className="bg-brand-600/90 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-3 py-2 mb-3">Part A</div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>GSTIN of Supplier</label>
                                        <input value={form.supplierGstin} onChange={(e) => update('supplierGstin', e.target.value)} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>GSTIN of Recipient</label>
                                        <input value={form.recipientGstin} onChange={(e) => update('recipientGstin', e.target.value)} className={inputCls} />
                                    </div>
                                </div>

                                {supplyType && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/40 border border-surface-700/50 rounded-xl text-xs text-surface-300">
                                        <FiMapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                        {supplyType.supplierState} → {supplyType.recipientState} —{' '}
                                        <span className={`font-semibold ${supplyType.isInterstate ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            {supplyType.isInterstate ? 'Interstate' : 'Intrastate'}
                                        </span>{' '}
                                        (tax: {supplyType.taxType})
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Place of Dispatch</label>
                                        <input value={form.placeOfDispatch} onChange={(e) => update('placeOfDispatch', e.target.value)} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Place of Delivery</label>
                                        <input value={form.placeOfDelivery} onChange={(e) => update('placeOfDelivery', e.target.value)} className={inputCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Document No. (auto)</label>
                                        <div className={readonlyCls}>{dispatch.dc_no}</div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Value of Goods (auto)</label>
                                        <div className={readonlyCls}>₹{Number(dispatch.total_amount || 0).toLocaleString('en-IN')}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Reason for Transportation</label>
                                        <select value={form.reason} onChange={(e) => update('reason', e.target.value)} className={selectCls}>
                                            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Transporter</label>
                                        <input value={form.transporterName} onChange={(e) => update('transporterName', e.target.value)} placeholder="e.g. Delhivery Ltd" className={inputCls} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Part B */}
                        <div className="pt-2">
                            <div className="bg-brand-600/90 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-3 py-2 mb-3">Part B</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Mode</label>
                                    <select value={form.transportMode} onChange={(e) => update('transportMode', e.target.value)} className={selectCls}>
                                        <option value="Road">Road</option>
                                        <option value="Rail">Rail</option>
                                        <option value="Air">Air</option>
                                        <option value="Ship">Ship</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Vehicle No. *</label>
                                    <input
                                        value={form.vehicleNo}
                                        onChange={(e) => handleVehicleChange(e.target.value)}
                                        placeholder="e.g. MH12AB1234"
                                        className={`${inputCls} uppercase`}
                                    />
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className={labelCls}>
                                    From (State) {form.fromState && <span className="text-brand-400">(auto-detected from vehicle no.)</span>}
                                </label>
                                <input value={form.fromState} onChange={(e) => update('fromState', e.target.value)} className={inputCls} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-surface-800 shrink-0">
                    <button onClick={onClose} className="px-4 py-2.5 text-sm text-surface-300 hover:text-white transition-colors cursor-pointer">
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={!saved || printing}
                        title={!saved ? 'Save the e-way bill details first' : ''}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {printing ? <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" /> : <FiPrinter className="w-4 h-4" />}
                        Print
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!saved || downloading}
                        title={!saved ? 'Save the e-way bill details first' : ''}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {downloading ? <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" /> : <FiDownload className="w-4 h-4" />}
                        Download
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                        {saving ? 'Saving...' : saved ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
