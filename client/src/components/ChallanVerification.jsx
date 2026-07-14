import { useState, useCallback, useEffect, useRef } from 'react';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import {
    FiPlus, FiTrash2, FiMail, FiSave, FiClock, FiSearch,
    FiChevronDown, FiFileText, FiX, FiCheck, FiAlertTriangle,
    FiAlertCircle, FiEye, FiHash,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { lookupDescription, getItemCodes } from '../data/masterData';
import { peekNextLotNo, incrementLotNo, sendChallanReportEmail, recordInwardInventory, revertInwardChallan } from '../utils/lotAndEmail';
import { getCustomers } from '../utils/outwardApi';
import ItemCodeCombobox from './ItemCodeCombobox';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pcb_challan_history';

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
            .filter((entry) => String(entry?.brand || '').toLowerCase() !== 'havells');
    } catch {
        return [];
    }
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function calcDiff(challanQty, physicalQty) {
    const c = parseInt(challanQty, 10);
    const p = parseInt(physicalQty, 10);
    if (isNaN(c) || isNaN(p)) return null;
    return p - c;
}

function remarkFromDiff(diff) {
    if (diff === null) return '';
    if (diff === 0) return 'OK';
    if (diff > 0) return 'Excess';
    return 'Short';
}

function emptyRow() {
    return { id: Date.now() + Math.random(), itemCode: '', description: '', challanQty: '', physicalQty: '' };
}

function createEmailRecipient(email = '', sendEway = false) {
    return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, email, sendEway };
}

// ── Row Status Colors ─────────────────────────────────────────────────────────

function remarkBadge(remark) {
    if (!remark) return null;
    const styles = {
        OK: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        Excess: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
        Short: 'bg-red-500/15 text-red-400 border border-red-500/30',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${styles[remark] || ''}`}>
            {remark === 'OK' && <FiCheck className="w-3 h-3" />}
            {remark === 'Excess' && <FiAlertTriangle className="w-3 h-3" />}
            {remark === 'Short' && <FiAlertCircle className="w-3 h-3" />}
            {remark}
        </span>
    );
}

function rowBg(remark) {
    if (remark === 'OK') return 'hover:bg-emerald-500/5';
    if (remark === 'Excess') return 'hover:bg-orange-500/5';
    if (remark === 'Short') return 'hover:bg-red-500/10 bg-red-500/5';
    return 'hover:bg-surface-800/30';
}

// ── Build HTML Email Report (fixes jagged plain-text table) ──────────────────
// Mirrors the server-side HTML builder so the "Verify Report" preview shows
// the user EXACTLY what will be sent.

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildHtmlReport({ brand, challanNo, challanDate, lotNo, rows }) {
    let totalChallan = 0;
    let totalPhysical = 0;

    const rowsHtml = rows.map((row) => {
        const c = parseInt(row.challanQty, 10) || 0;
        const p = parseInt(row.physicalQty, 10) || 0;
        totalChallan += c;
        totalPhysical += p;
        const diff = calcDiff(row.challanQty, row.physicalQty);
        const remark = remarkFromDiff(diff);
        const diffStr = diff === null ? '-' : diff > 0 ? `+${diff}` : String(diff);
        const remarkColor = remark === 'OK' ? '#059669' : remark === 'Excess' ? '#d97706' : remark === 'Short' ? '#dc2626' : '#475569';
        const remarkBg = remark === 'OK' ? '#d1fae5' : remark === 'Excess' ? '#fef3c7' : remark === 'Short' ? '#fee2e2' : '#f1f5f9';

        return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(row.itemCode)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;">${escapeHtml(row.description)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${c}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${p}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${diffStr}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;">
          ${remark ? `<span style="background:${remarkBg};color:${remarkColor};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;">${remark}</span>` : ''}
        </td>
      </tr>`;
    }).join('');

    return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:760px;">
    <h2 style="margin:0 0 4px;">PCB Verification Report</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;">
      <strong>Challan No:</strong> ${escapeHtml(challanNo)} &nbsp;&nbsp;
      <strong>Date:</strong> ${escapeHtml(challanDate)} &nbsp;&nbsp;
      <strong>Brand:</strong> ${escapeHtml(brand)} &nbsp;&nbsp;
      <strong>Lot No:</strong> ${escapeHtml(lotNo)}
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;">Item Code</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;">Description</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Challan Qty</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Physical Qty</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Difference</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;">Remark</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr style="background:#f8fafc;font-weight:700;">
          <td colspan="2" style="padding:8px 10px;border:1px solid #e2e8f0;">TOTAL</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${totalChallan}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${totalPhysical}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;"></td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;"></td>
        </tr>
      </tbody>
    </table>
    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">Generated by PCB Tracker - Electrolyte Inventory</p>
  </div>`;
}

// ── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({ onClose, onLoad }) {
    const [history] = useState(loadHistory);
    const [search, setSearch] = useState('');

    const filtered = history.filter(
        (h) =>
            h.challanNo.toLowerCase().includes(search.toLowerCase()) ||
            (h.brand || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="animate-scale-in relative bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-surface-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiClock className="w-5 h-5 text-brand-400" /> Challan History
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
                            placeholder="Search by challan no. or brand..."
                            className="w-full pl-9 pr-4 py-2.5 bg-surface-800/60 border border-surface-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-surface-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 ? (
                        <p className="text-center text-surface-500 py-8 text-sm">No saved challans found.</p>
                    ) : (
                        filtered.map((h) => (
                            <div
                                key={h.id}
                                className="flex items-center justify-between p-3 bg-surface-800/50 border border-surface-700 rounded-xl hover:border-brand-500/40 transition-all"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-white">{h.challanNo}</p>
                                    <p className="text-xs text-surface-400">{h.brand} • {h.challanDate} • Lot {h.lotNo ?? '-'} • {h.rows.length} item(s)</p>
                                </div>
                                <button
                                    onClick={() => { onLoad(h); onClose(); }}
                                    className="text-xs px-3 py-1.5 bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg hover:bg-brand-500/30 transition-all cursor-pointer"
                                >
                                    Load
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Verify Report Modal (preview-only - shows exact email format, never sends) ──

function VerifyReportModal({ onClose, challanNo, emailTo, htmlBody }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="animate-scale-in relative bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-surface-800">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FiEye className="w-5 h-5 text-brand-400" /> Verify Report: Email Preview
                    </h2>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Mail header fields, mimicking a real mail client */}
                <div className="px-5 py-3 border-b border-surface-800 space-y-1.5 text-sm">
                    <div className="flex gap-2">
                        <span className="text-surface-500 w-16 shrink-0">To:</span>
                        <span className="text-surface-200">{emailTo?.trim() || <span className="text-surface-600 italic">(no recipient entered yet)</span>}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-surface-500 w-16 shrink-0">Subject:</span>
                        <span className="text-surface-200">PCB Verification Report - {challanNo || '(no challan no.)'}</span>
                    </div>
                </div>

                {/* Rendered HTML body preview, exactly as it will be sent */}
                <div className="flex-1 overflow-y-auto p-5 bg-white rounded-b-2xl">
                    <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
                </div>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChallanVerification() {
    const { setHasUnsavedChanges } = useUnsavedChanges();
    const [brand, setBrand] = useState('Bajaj');
    const [companies, setCompanies] = useState([]);
    const [challanNo, setChallanNo] = useState('');
    const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
    const [lotNo, setLotNo] = useState(null); // auto-calculated, never user-editable
    const [rows, setRows] = useState([emptyRow()]);
    const [showHistory, setShowHistory] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [emailRecipients, setEmailRecipients] = useState([createEmailRecipient()]);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const historyRestoreRef = useRef(false);
    const [hasUserInteracted, setHasUserInteracted] = useState(false);
    const [draftSnapshot, setDraftSnapshot] = useState(() => ({
        brand: 'Bajaj',
        challanNo: '',
        challanDate: new Date().toISOString().split('T')[0],
        rows: [],
    }));

    const itemCodes = getItemCodes(brand);

    const serializeInwardDraft = useCallback(() => ({
        brand,
        challanNo,
        challanDate,
        rows: rows.filter((row) => row.itemCode || row.description || row.challanQty || row.physicalQty).map((row) => ({
            itemCode: row.itemCode || '',
            description: row.description || '',
            challanQty: row.challanQty || '',
            physicalQty: row.physicalQty || '',
        })),
    }), [brand, challanNo, challanDate, rows]);

    useEffect(() => {
        const currentDraft = serializeInwardDraft();
        const isDirty = JSON.stringify(currentDraft) !== JSON.stringify(draftSnapshot);
        setHasUnsavedChanges(hasUserInteracted && isDirty);
    }, [draftSnapshot, hasUserInteracted, serializeInwardDraft, setHasUnsavedChanges]);

    // ── Load the shared company/brand list on mount (same source as Outward page) ──
    useEffect(() => {
        getCustomers()
            .then((list) => {
                setCompanies(list);
                if (list.length > 0 && !list.some((c) => c.brand === brand)) {
                    setBrand(list[0].brand);
                }
            })
            .catch(() => toast.error('Failed to load company list.'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Lot No: peek the next lot number whenever the brand changes ──
    // (Feature 1) Default value conceptually starts at 0; the upcoming lot
    // shown here is "next lot for this brand" and only actually increments
    // for real when the challan is saved.
    useEffect(() => {
        let cancelled = false;
        if (historyRestoreRef.current) {
            historyRestoreRef.current = false;
            return () => { cancelled = true; };
        }
        peekNextLotNo(brand)
            .then((next) => { if (!cancelled) setLotNo(next); })
            .catch(() => { if (!cancelled) setLotNo(null); });
        return () => { cancelled = true; };
    }, [brand]);

    // ── Row Operations ──

    const addRow = () => {
        setHasUserInteracted(true);
        setRows((prev) => [...prev, emptyRow()]);
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
                // Auto-fill description when item code changes
                if (field === 'itemCode') {
                    updated.description = lookupDescription(brand, value);
                }
                return updated;
            })
        );
    }, [brand]);

    // When brand changes, re-look up all descriptions
    const handleBrandChange = (newBrand) => {
        setHasUserInteracted(true);
        setBrand(newBrand);
        setRows((prev) =>
            prev.map((row) => ({
                ...row,
                description: lookupDescription(newBrand, row.itemCode),
            }))
        );
    };

    // ── Totals ──

    const totalChallan = rows.reduce((s, r) => s + (parseInt(r.challanQty, 10) || 0), 0);
    const totalPhysical = rows.reduce((s, r) => s + (parseInt(r.physicalQty, 10) || 0), 0);
    const totalDiff = totalPhysical - totalChallan;

    // ── Save to History ──
    // (Feature 1) This is the moment the Lot No. is actually, permanently
    // incremented for the brand - saving a challan "uses up" that lot number.

    const handleSave = async () => {
        if (!challanNo.trim()) { toast.error('Please enter a Challan Number.'); return; }

        // Require at least one row with both an item code and a physical qty
        const validRows = rows.filter(
            (r) => r.itemCode && r.itemCode.trim() && parseInt(r.physicalQty, 10) > 0
        );
        if (validRows.length === 0) {
            toast.error('Please fill in at least one item code and physical quantity before saving.');
            return;
        }

        try {
            // 1. Assign (and commit) the next Lot No. for this brand
            const finalLotNo = await incrementLotNo(brand);
            setLotNo(finalLotNo);

            // 2. Record each row's physical qty as an in_ward transaction in the DB
            //    so the Outward page's inventory check immediately sees the new stock.
            await recordInwardInventory({
                brand,
                challanNo: challanNo.trim(),
                challanDate,
                lotNo: finalLotNo,
                rows: validRows,
            });

            // 3. Save to local history for the History modal
            const history = loadHistory();
            const entry = {
                id: Date.now(),
                brand,
                challanNo: challanNo.trim(),
                challanDate,
                lotNo: finalLotNo,
                rows,
                savedAt: new Date().toISOString(),
            };
            const updated = [entry, ...history.filter((h) => h.challanNo !== entry.challanNo)].slice(0, 50);
            saveHistory(updated);

            setDraftSnapshot(serializeInwardDraft());
            setHasUserInteracted(false);
            setHasUnsavedChanges(false);
            toast.success(`Challan saved! Lot No. ${finalLotNo}: ${validRows.length} item(s) added to inventory.`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save challan / update inventory.');
        }
    };

    // ── Load from History ──

    const handleLoad = async (h) => {
        if (hasUserInteracted && JSON.stringify(serializeInwardDraft()) !== JSON.stringify(draftSnapshot)) {
            const confirmed = window.confirm('You have unsaved changes. Click OK to stay here and keep the draft, or Cancel to discard it and load this challan.');
            if (confirmed) return;
        }

        try {
            await revertInwardChallan({ brand: h.brand, challanNo: h.challanNo });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove the previously saved challan from inventory.');
            return;
        }

        const loadedBrand = companies.some((c) => c.brand === h.brand) ? h.brand : 'Bajaj';
        historyRestoreRef.current = true;
        setBrand(loadedBrand);
        setChallanNo(h.challanNo);
        setChallanDate(h.challanDate);
        setLotNo(h.lotNo ?? null);
        setRows(h.rows);
        setHasUserInteracted(false);
        setDraftSnapshot({
            brand: loadedBrand,
            challanNo: h.challanNo,
            challanDate: h.challanDate,
            rows: (h.rows || []).map((row) => ({
                itemCode: row.itemCode || '',
                description: row.description || '',
                challanQty: row.challanQty || '',
                physicalQty: row.physicalQty || '',
            })),
        });
        setHasUnsavedChanges(false);
    };

    // ── Email: real server-side send (Feature 3) ──
    // Replaces the old mailto: approach, which silently did nothing on
    // desktops without a configured default mail client. The server now
    // sends the email directly via SMTP and confirms success.

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
        if (!challanNo.trim()) { toast.error('Please enter a Challan Number.'); return; }

        const recipients = emailRecipients
            .map((recipient) => ({ ...recipient, email: recipient.email.trim() }))
            .filter((recipient) => recipient.email);

        if (recipients.length === 0) { toast.error('Please enter at least one recipient email address.'); return; }

        setSendingEmail(true);
        try {
            await sendChallanReportEmail({
                recipients,
                brand,
                challanNo: challanNo.trim(),
                challanDate,
                lotNo: lotNo ?? '-',
                rows,
            });
            toast.success('Email successfully sent.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send email.');
        } finally {
            setSendingEmail(false);
        }
    };

    // ── Verify Report (Feature 2) - preview only, never sends ──

    const handleVerifyReport = () => {
        if (!challanNo.trim()) { toast.error('Please enter a Challan Number.'); return; }
        setShowVerify(true);
    };

    const inputCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-surface-500';
    const selectCls = 'appearance-none w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer';

    return (
        <>
            {showHistory && <HistoryModal onClose={() => setShowHistory(false)} onLoad={handleLoad} />}
            {showVerify && (
                <VerifyReportModal
                    onClose={() => setShowVerify(false)}
                    challanNo={challanNo}
                    emailTo={emailRecipients.map((recipient) => recipient.email).filter(Boolean).join(', ')}
                    htmlBody={buildHtmlReport({ brand, challanNo, challanDate, lotNo: lotNo ?? '-', rows })}
                />
            )}

            <div className="animate-slide-up relative overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/80 backdrop-blur-sm shadow-2xl">
                {/* Accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15">
                            <FiFileText className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight">Challan Verification</h3>
                            <p className="text-xs text-surface-500">Verify incoming shipment quantities</p>
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
                    {/* Shipment Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-surface-800/30 rounded-xl border border-surface-700/50">
                        {/* Brand */}
                        <div>
                            <label className="block text-xs font-medium text-surface-400 mb-1.5">Brand</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <select value={brand} onChange={(e) => handleBrandChange(e.target.value)} className={selectCls}>
                                        {companies.map((c) => (
                                            <option key={c.brand} value={c.brand}>{c.brand}</option>
                                        ))}
                                    </select>
                                    <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        {/* Challan No */}
                        <div>
                            <label className="block text-xs font-medium text-surface-400 mb-1.5">Challan Number *</label>
                            <input
                                value={challanNo}
                                onChange={(e) => setChallanNo(e.target.value)}
                                placeholder="e.g. RC2527001175"
                                className={inputCls}
                            />
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
                        {/* Lot No - auto-calculated, read-only (Feature 1) */}
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-surface-400 mb-1.5">
                                <FiHash className="w-3 h-3" />
                                Lot No. <span className="text-surface-600">(auto)</span>
                            </label>
                            <div className="w-full bg-surface-800/30 border border-surface-700/50 text-surface-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2 cursor-not-allowed">
                                {lotNo !== null ? (
                                    <>
                                        <span className="font-semibold text-white tabular-nums">{lotNo}</span>
                                        <span className="text-surface-500 text-xs">(next for {brand})</span>
                                    </>
                                ) : (
                                    <span className="text-surface-600">Loading...</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PCB Items Table */}
                    <div className="overflow-x-auto rounded-xl border border-surface-700/50">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-surface-800/60 text-surface-400 text-xs uppercase tracking-wider">
                                    <th className="px-3 py-2.5 text-left font-medium">Item Code</th>
                                    <th className="px-3 py-2.5 text-left font-medium">Description</th>
                                    <th className="px-3 py-2.5 text-right font-medium w-28">Challan Qty</th>
                                    <th className="px-3 py-2.5 text-right font-medium w-28">Physical Qty</th>
                                    <th className="px-3 py-2.5 text-right font-medium w-24">Difference</th>
                                    <th className="px-3 py-2.5 text-center font-medium w-24">Remark</th>
                                    <th className="px-3 py-2.5 text-center font-medium w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-800/50">
                                {rows.map((row) => {
                                    const diff = calcDiff(row.challanQty, row.physicalQty);
                                    const remark = remarkFromDiff(diff);
                                    return (
                                        <tr key={row.id} className={`transition-colors duration-150 ${rowBg(remark)}`}>
                                            {/* Item Code */}
                                            <td className="px-3 py-2">
                                                <ItemCodeCombobox
                                                    value={row.itemCode}
                                                    onChange={(val) => updateRow(row.id, 'itemCode', val)}
                                                    options={itemCodes}
                                                />
                                            </td>
                                            {/* Description */}
                                            <td className="px-3 py-2 min-w-[200px]">
                                                <input
                                                    value={row.description}
                                                    onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                                                    placeholder="Auto-filled from code..."
                                                    className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all"
                                                />
                                            </td>
                                            {/* Challan Qty */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.challanQty}
                                                    onChange={(e) => updateRow(row.id, 'challanQty', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full text-right bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all tabular-nums"
                                                />
                                            </td>
                                            {/* Physical Qty */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.physicalQty}
                                                    onChange={(e) => updateRow(row.id, 'physicalQty', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full text-right bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all tabular-nums"
                                                />
                                            </td>
                                            {/* Difference */}
                                            <td className="px-3 py-2 text-right">
                                                {diff !== null ? (
                                                    <span className={`font-semibold tabular-nums text-sm ${diff === 0 ? 'text-surface-400' : diff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                                                        {diff > 0 ? `+${diff}` : diff === 0 ? '-' : diff}
                                                    </span>
                                                ) : (
                                                    <span className="text-surface-600 text-xs">-</span>
                                                )}
                                            </td>
                                            {/* Remark */}
                                            <td className="px-3 py-2 text-center">
                                                {remarkBadge(remark)}
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
                                    <td colSpan={2} className="px-3 py-2.5 text-xs font-bold text-surface-300 uppercase tracking-wider">
                                        Grand Total
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm font-bold text-white tabular-nums">
                                        {totalChallan.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm font-bold text-white tabular-nums">
                                        {totalPhysical.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className={`text-sm font-bold tabular-nums ${totalDiff === 0 ? 'text-surface-400' : totalDiff > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                                            {totalDiff > 0 ? `+${totalDiff}` : totalDiff === 0 ? '-' : totalDiff}
                                        </span>
                                    </td>
                                    <td colSpan={2} />
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

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-1">
                        {/* Save */}
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer"
                        >
                            <FiSave className="w-4 h-4" />
                            Save Challan
                        </button>

                        {/* Verify Report (replaces Copy Report - Feature 2) */}
                        <button
                            onClick={handleVerifyReport}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer"
                        >
                            <FiEye className="w-4 h-4" />
                            Verify Report
                        </button>

                        {/* Send Email */}
                        <button
                            onClick={() => setShowEmailInput((v) => !v)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 cursor-pointer"
                        >
                            <FiMail className="w-4 h-4" />
                            Send Email
                        </button>
                    </div>

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
                                            placeholder="recipient@example.com"
                                            className={`flex-1 ${inputCls}`}
                                        />
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
                                    {sendingEmail ? 'Sending...' : 'Open Email'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
