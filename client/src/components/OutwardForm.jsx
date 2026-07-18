import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FiPlus, FiTrash2, FiMail, FiSave, FiChevronDown,
    FiCheck, FiAlertCircle, FiHash, FiDownload, FiTruck, FiPackage, FiEye,
    FiClock, FiSearch, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
    getCustomers, getProducts, getCompanyInfo, peekNextDc, peekNextOutwardLot,
    checkInventory, createDispatch, generateDocument, previewDispatchPdf, downloadDispatchPdf, sendOutwardEmail,
} from '../utils/outwardApi';
import { getEwayBill } from '../utils/ewayBillApi';
import EwayBillModal from './EwayBillModal';
import ItemCodeCombobox from './ItemCodeCombobox';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pcb_outward_history';

function emptyItemRow() {
    return {
        id: Date.now() + Math.random(),
        itemCode: '', description: '', status: 'OK', hsnCode: '', unit: 'Nos',
        quantity: '', rate: '', remaining: null,
    };
}

function createEmailRecipient(email = '', sendEway = false) {
    return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, email, sendEway };
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function HistoryModal({ onClose, onLoad, onDelete, history }) {
    const [search, setSearch] = useState('');

    const filtered = history.filter((entry) => {
        const needle = search.toLowerCase();
        return [entry.dcNo, entry.brand, entry.companyName, entry.challanDate].some((value) => String(value || '').toLowerCase().includes(needle));
    });

    const handleDeleteClick = (id, e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this dispatch from history?')) {
            onDelete(id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="animate-scale-in relative bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-surface-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiClock className="w-5 h-5 text-brand-400" /> Outward Challan History
                    </h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 border-b border-surface-800">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by challan no., customer, or date..."
                            className="w-full pl-9 pr-4 py-2.5 bg-surface-800/60 border border-surface-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-surface-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 ? (
                        <p className="text-center text-surface-500 py-8 text-sm">No saved challans found.</p>
                    ) : (
                        filtered.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between p-3 bg-surface-800/50 border border-surface-700 rounded-xl hover:border-brand-500/40 transition-all">
                                <div>
                                    <p className="text-sm font-semibold text-white">{entry.dcNo || 'Untitled challan'}</p>
                                    <p className="text-xs text-surface-400">{entry.brand} • {entry.challanDate} • Lot {entry.lotNo ?? '-'} • {entry.rows?.length || 0} item(s)</p>
                                    <p className="text-xs text-surface-500">{entry.companyName || entry.brand}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { onLoad(entry); onClose(); }}
                                        className="text-xs px-3 py-1.5 bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-500/30 transition-all cursor-pointer"
                                    >
                                        Load
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(entry.id, e)}
                                        className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all cursor-pointer"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OutwardForm({ user }) {
    const { setHasUnsavedChanges } = useUnsavedChanges();
    const [customers, setCustomers] = useState([]);
    const [brand, setBrand] = useState('');
    const [companyInfo, setCompanyInfo] = useState(null);
    const [showEwayModal, setShowEwayModal] = useState(false);
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
    const [showHistory, setShowHistory] = useState(false);
    const [historyEntries, setHistoryEntries] = useState(() => loadHistory());
    const [loadingHistory, setLoadingHistory] = useState(false);
    const restoringHistoryRef = useRef(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [previewingPdf, setPreviewingPdf] = useState(false);
    const [emailRecipients, setEmailRecipients] = useState([createEmailRecipient()]);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [ewayDetails, setEwayDetails] = useState(null);
    const [hasUserInteracted, setHasUserInteracted] = useState(false);
    const [draftSnapshot, setDraftSnapshot] = useState(() => ({
        brand: '',
        challanDate: new Date().toISOString().split('T')[0],
        vehicleNo: '',
        courierPartner: '',
        remarks: '',
        rows: [],
    }));

    const serializeOutwardDraft = useCallback(() => ({
        brand,
        challanDate,
        vehicleNo,
        courierPartner,
        remarks,
        rows: rows.filter((row) => row.itemCode || row.description || row.hsnCode || row.quantity || row.rate).map((row) => ({
            itemCode: row.itemCode || '',
            description: row.description || '',
            status: row.status || 'OK',
            hsnCode: row.hsnCode || '',
            unit: row.unit || 'Nos',
            quantity: row.quantity ?? '',
            rate: row.rate ?? '',
        })),
    }), [brand, challanDate, vehicleNo, courierPartner, remarks, rows]);

    useEffect(() => {
        const currentDraft = serializeOutwardDraft();
        const isDirty = JSON.stringify(currentDraft) !== JSON.stringify(draftSnapshot);
        setHasUnsavedChanges(hasUserInteracted && isDirty && !savedDispatch);
    }, [draftSnapshot, hasUserInteracted, serializeOutwardDraft, savedDispatch, setHasUnsavedChanges]);

    // ── Load customer list on mount ──
    useEffect(() => {
        getCustomers()
            .then((list) => {
                setCustomers(list);
                if (list.length > 0) setBrand(list[0].brand);
            })
            .catch(() => toast.error('Failed to load customer list.'));
    }, []);

    // ── Load own company info (used to pre-fill E-Way Bill supplier details) ──
    useEffect(() => {
        getCompanyInfo().then(setCompanyInfo).catch(() => { });
    }, []);

    // ── Whenever brand changes: load products, customer details, next DC + Lot ──
    useEffect(() => {
        if (!brand) return;
        let cancelled = false;

        if (loadingHistory) {
            setLoadingHistory(false);
            return;
        }

        if (restoringHistoryRef.current) {
            restoringHistoryRef.current = false;
            return;
        }

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
    }, [brand, loadingHistory]);

    useEffect(() => {
        if (!savedDispatch?.id) {
            setEwayDetails(null);
            return;
        }
        let cancelled = false;
        getEwayBill(savedDispatch.id)
            .then((data) => {
                if (!cancelled) setEwayDetails(data);
            })
            .catch(() => {
                if (!cancelled) setEwayDetails(null);
            });
        return () => {
            cancelled = true;
        };
    }, [savedDispatch?.id, showEwayModal]);

    // ── Row operations ──

    const addRow = () => {
        setHasUserInteracted(true);
        setRows((prev) => [...prev, emptyItemRow()]);
    };
    const removeRow = (id) => {
        setHasUserInteracted(true);
        setRows((prev) => prev.filter((r) => r.id !== id));
    };

    const updateRow = useCallback((id, field, value) => {
        setHasUserInteracted(true);
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

        // Reminder popup if not saved to history first
        const currentHistory = loadHistory();
        const isSavedInHistory = currentHistory.some(
            (h) => h.brand === brand && h.challanDate === challanDate
        );
        if (!isSavedInHistory) {
            const proceed = window.confirm(
                'Reminder: You have not saved this dispatch to history. Are you sure you want to save dispatch without saving to history first? (Saving to history allows you to load these details later)'
            );
            if (!proceed) return;
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

            setDraftSnapshot(serializeOutwardDraft());
            setHasUserInteracted(false);
            setHasUnsavedChanges(false);
            toast.success(`Dispatch saved! (${dispatch.dc_no})`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save dispatch.');
        } finally {
            setSaving(false);
        }
    };

    // ── Save to History (local snapshot only — does NOT touch DB or inventory) ──

    const handleSaveHistory = () => {
        if (!brand) { toast.error('Please select a company before saving to history.'); return; }

        const validRows = rows.filter((r) => r.itemCode || r.description || r.hsnCode || r.quantity || r.rate);

        const entry = {
            id: Date.now(),
            brand,
            dcNo: typeof dcNo === 'object' ? dcNo?.nextDcNo : dcNo || null,
            lotNo: typeof lotNo === 'object' ? lotNo?.nextLotNo : lotNo || null,
            challanDate,
            vehicleNo,
            courierPartner,
            companyName: customerInfo?.companyName || '',
            companyAddress: customerInfo?.address || '',
            phoneNo: customerInfo?.phone || '',
            gstin: customerInfo?.gstin || '',
            remarks,
            rows: validRows.map((r) => ({
                itemCode: r.itemCode,
                description: r.description,
                status: r.status,
                hsnCode: r.hsnCode,
                unit: r.unit,
                quantity: r.quantity,
                rate: r.rate,
            })),
            savedAt: new Date().toISOString(),
        };

        const currentHistory = loadHistory();
        const updated = [entry, ...currentHistory.filter((h) => !(h.brand === entry.brand && h.challanDate === entry.challanDate))].slice(0, 50);
        saveHistory(updated);
        setHistoryEntries(updated);
        toast.success('Dispatch details successfully saved to history!');
    };

    // ── Delete from History ──

    const handleDeleteHistory = (id) => {
        const updated = historyEntries.filter((h) => h.id !== id);
        saveHistory(updated);
        setHistoryEntries(updated);
    };

    // ── Preview PDF before save / send ──

    const handlePreviewReport = async () => {
        if (!brand || !challanDate || rows.filter((r) => r.itemCode && r.quantity !== '').length === 0) {
            toast.error('Please fill in the dispatch details and at least one item row before previewing the report.');
            return;
        }

        setPreviewingPdf(true);
        try {
            await previewDispatchPdf({
                brand,
                companyName: customerInfo?.companyName,
                companyAddress: customerInfo?.address,
                phoneNo: customerInfo?.phone,
                gstin: customerInfo?.gstin,
                vehicleNo,
                courierPartner,
                challanDate,
                remarks,
                items: rows.filter((r) => r.itemCode && r.quantity !== '').map((r) => ({
                    itemCode: r.itemCode,
                    description: r.description,
                    status: r.status,
                    hsnCode: r.hsnCode,
                    unit: r.unit,
                    quantity: r.quantity,
                    rate: r.rate,
                })),
                dcNo: dcNo?.nextDcNo || dcNo || 'PREVIEW',
                lotNo: lotNo?.nextLotNo || lotNo || '-',
            });
            toast.success('Report preview opened.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to preview report.');
        } finally {
            setPreviewingPdf(false);
        }
    };

    const handleLoadHistory = (entry) => {
        if (hasUserInteracted && JSON.stringify(serializeOutwardDraft()) !== JSON.stringify(draftSnapshot)) {
            const confirmed = window.confirm('You have unsaved changes. Click OK to stay here and keep the draft, or Cancel to discard it and load this challan.');
            if (confirmed) return;
        }

        // Only populate form fields from the saved snapshot — does NOT revert DB or inventory
        setLoadingHistory(true);
        restoringHistoryRef.current = true;
        setBrand(entry.brand || '');
        setChallanDate(entry.challanDate || new Date().toISOString().split('T')[0]);
        setVehicleNo(entry.vehicleNo || '');
        setCourierPartner(entry.courierPartner || '');
        setRemarks(entry.remarks || '');
        setRows((entry.rows || []).map((row, index) => ({
            id: Date.now() + index + Math.random(),
            itemCode: row.itemCode || '',
            description: row.description || '',
            status: row.status || 'OK',
            hsnCode: row.hsnCode || '',
            unit: row.unit || 'Nos',
            quantity: row.quantity ?? '',
            rate: row.rate ?? '',
            remaining: null,
        })));
        setSavedDispatch(null);
        setCustomerInfo(customers.find((c) => c.brand === entry.brand) || null);
        setHasUserInteracted(true);
        toast.success('Dispatch details loaded from history!');
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

    const canSendEmail = Boolean(savedDispatch && (!savedDispatch.eway_required || (ewayDetails?.eway_bill_no && ewayDetails?.eway_bill_date && ewayDetails?.eway_pdf_path)));

    const addEmailRecipient = () => {
        setEmailRecipients((prev) => [...prev, createEmailRecipient()]);
    };

    const removeEmailRecipient = (id) => {
        setEmailRecipients((prev) => (prev.length > 1 ? prev.filter((recipient) => recipient.id !== id) : prev));
    };

    const updateEmailRecipient = (id, field, value) => {
        setHasUserInteracted(true);
        setEmailRecipients((prev) => prev.map((recipient) => (recipient.id === id ? { ...recipient, [field]: value } : recipient)));
    };

    const handleSendEmail = async () => {
        if (!savedDispatch) { toast.error('Please save the dispatch first.'); return; }

        const recipients = emailRecipients
            .map((recipient) => ({ ...recipient, email: recipient.email.trim() }))
            .filter((recipient) => recipient.email);

        if (recipients.length === 0) { toast.error('Please enter at least one recipient email address.'); return; }
        if (savedDispatch.eway_required && !canSendEmail) {
            toast.error('Please save the E-Way Bill details and upload the official E-Way Bill PDF before sending email.');
            return;
        }

        setSendingEmail(true);
        try {
            await sendOutwardEmail({ dispatchId: savedDispatch.id, recipients });
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
        <>
            {showHistory && (
                <HistoryModal
                    onClose={() => setShowHistory(false)}
                    onLoad={handleLoadHistory}
                    onDelete={handleDeleteHistory}
                    history={historyEntries}
                />
            )}
            {showEwayModal && savedDispatch && (
                <EwayBillModal
                    dispatch={savedDispatch}
                    company={companyInfo}
                    username={user?.username}
                    onClose={() => setShowEwayModal(false)}
                />
            )}
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
                <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-300 bg-surface-800/60 border border-surface-700/50 rounded-lg hover:bg-surface-700 hover:text-white transition-all cursor-pointer"
                >
                    <FiClock className="w-3.5 h-3.5" />
                    History
                </button>
            </div>

            <div className="px-6 pb-6 pt-2 space-y-5">
                {/* Customer + Dispatch Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-800/30 rounded-xl border border-surface-700/50">
                    {/* Customer (Brand) */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Company Name *</label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selectCls}>
                                    {customers.map((c) => (
                                        <option key={c.brand} value={c.brand}>{c.brand}</option>
                                    ))}
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* DC No - auto */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                            <FiHash className="w-3 h-3" /> Challan No. / DC No. <span className="text-surface-600">(auto)</span>
                        </label>
                        <div className={readonlyCls}>
                            <span className="font-semibold text-white">{dcNo ?? 'Loading...'}</span>
                        </div>
                    </div>

                    {/* Lot No - auto */}
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

                    {/* Company Address - auto, read-only */}
                    <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Company Address <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.address || 'Loading...'}</span>
                        </div>
                    </div>

                    {/* Phone + GSTIN - auto, read-only */}
                    <div>
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">Phone No. <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.phone || '-'}</span>
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-surface-400 mb-1.5">GSTIN <span className="text-surface-600">(auto)</span></label>
                        <div className={readonlyCls}>
                            <span className="text-surface-300">{customerInfo?.gstin || '-'}</span>
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
                                            <ItemCodeCombobox
                                                value={row.itemCode}
                                                onChange={(val) => updateRow(row.id, 'itemCode', val)}
                                                options={products.map((p) => p.itemCode)}
                                            />
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

                {/* E-Way Bill status notice */}
                {savedDispatch && (
                    <div className={`flex flex-wrap items-start justify-between gap-3 p-4 rounded-xl border ${savedDispatch.eway_required ? 'bg-red-500/10 border-red-500/25' : 'bg-emerald-500/10 border-emerald-500/25'}`}>
                        <div className="flex items-start gap-2.5">
                            <FiAlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${savedDispatch.eway_required ? 'text-red-400' : 'text-emerald-400'}`} />
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-wide ${savedDispatch.eway_required ? 'text-red-200' : 'text-emerald-200'}`}>
                                    E-Way Bill {savedDispatch.eway_required ? 'REQUIRED' : 'NOT REQUIRED'}
                                </p>
                                <p className="text-xs text-surface-300 mt-1">
                                    {savedDispatch.eway_required
                                        ? 'Generate an E-Way Bill before dispatching the goods.'
                                        : (savedDispatch.eway_reason || 'Consignment value below applicable threshold.')}
                                </p>
                                {savedDispatch.eway_required && savedDispatch.eway_portal_url && (
                                    <a
                                        href={savedDispatch.eway_portal_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-400 hover:text-brand-300"
                                    >
                                        Open official portal <FiTruck className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowEwayModal(true)}
                            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${savedDispatch.eway_required ? 'text-white bg-red-600 hover:bg-red-500' : 'text-surface-200 bg-surface-800/80 border border-surface-700 hover:bg-surface-700'}`}
                        >
                            <FiTruck className="w-3.5 h-3.5" />
                            {savedDispatch.eway_required ? 'Fill E-Way Bill Details' : 'View E-Way Bill Details'}
                        </button>
                    </div>
                )}

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
                    {/* Preview Report */}
                    <button
                        onClick={handlePreviewReport}
                        disabled={previewingPdf}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {previewingPdf ? (
                            <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiEye className="w-4 h-4" />
                        )}
                        {previewingPdf ? 'Preparing...' : 'View Report'}
                    </button>

                    {/* Save History */}
                    <button
                        onClick={handleSaveHistory}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer"
                    >
                        <FiClock className="w-4 h-4" />
                        Save History
                    </button>

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
                        disabled={!savedDispatch || !canSendEmail}
                        title={!savedDispatch ? 'Save the dispatch first' : savedDispatch.eway_required && !canSendEmail ? 'Please complete E-Way Bill details before sending email' : ''}
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
                    <div className="space-y-3 p-4 bg-surface-800/30 rounded-xl border border-surface-700/50 animate-slide-down">
                        <div className="space-y-2">
                            {emailRecipients.map((recipient) => (
                                <div key={recipient.id} className="flex flex-wrap items-center gap-2">
                                    <FiMail className="w-4 h-4 text-surface-400 shrink-0" />
                                    <input
                                        type="email"
                                        value={recipient.email}
                                        onChange={(e) => updateEmailRecipient(recipient.id, 'email', e.target.value)}
                                        placeholder="customer@example.com"
                                        className={`flex-1 ${inputCls}`}
                                    />
                                    <label className="flex items-center gap-2 rounded-lg border border-surface-700/50 bg-surface-800/60 px-3 py-2 text-xs text-surface-300 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={recipient.sendEway}
                                            onChange={(e) => updateEmailRecipient(recipient.id, 'sendEway', e.target.checked)}
                                            className="h-4 w-4 accent-brand-500"
                                        />
                                        Send E-Way Bill
                                    </label>
                                    {emailRecipients.length > 1 && (
                                        <button
                                            onClick={() => removeEmailRecipient(recipient.id)}
                                            className="p-2.5 text-surface-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                            title="Remove recipient"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={addEmailRecipient}
                                className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
                            >
                                <FiPlus className="w-4 h-4" />
                                Add recipient
                            </button>
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
                    </div>
                )}
            </div>
        </div>
        </>
    );
}
