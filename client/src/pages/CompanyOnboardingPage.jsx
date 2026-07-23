import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiPlus, FiEye, FiEdit3, FiPackage, FiPower, FiX, FiSave, FiSearch,
  FiTrash2, FiCheck, FiChevronRight, FiArrowLeft, FiRefreshCw, FiAlertTriangle,
  FiZapOff, FiZap, FiInfo, FiTag,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as companyApi from '../utils/companyApi';

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 16 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls = 'w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all placeholder:text-surface-500';
const labelCls = 'block text-xs font-medium text-surface-400 mb-1.5';

// ─── Company Form (shared for Add & Edit) ────────────────────────────────────

function CompanyForm({ initial = {}, onSubmit, onCancel, saving, submitLabel = 'Save' }) {
  const [form, setForm] = useState({
    brand: initial.brand || '',
    companyName: initial.companyName || '',
    address: initial.address || '',
    phone: initial.phone || '',
    gstin: initial.gstin || '',
    email: initial.email || '',
    hsnCode: initial.hsnCode || '',
    defaultRate: initial.defaultRate != null ? String(initial.defaultRate) : '',
  });

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = () => {
    if (!form.brand.trim()) { toast.error('Brand Key is required.'); return; }
    if (!form.companyName.trim()) { toast.error('Company Name is required.'); return; }
    if (!form.address.trim()) { toast.error('Address is required.'); return; }
    if (!form.phone.trim()) { toast.error('Phone number is required.'); return; }
    if (!form.gstin.trim()) { toast.error('GSTIN is required.'); return; }
    if (!form.email.trim()) { toast.error('Email is required.'); return; }
    onSubmit({
      brand: form.brand.trim(),
      companyName: form.companyName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      gstin: form.gstin.trim(),
      email: form.email.trim(),
      hsnCode: form.hsnCode.trim(),
      defaultRate: form.defaultRate ? parseFloat(form.defaultRate) : 0,
    });
  };

  const isEditing = !!initial.brand;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Brand Key *</label>
          <input
            value={form.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="e.g. Atomberg"
            disabled={isEditing}
            className={`${inputCls} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <p className="text-[11px] text-surface-500 mt-1">Unique ID shown in dropdowns. Cannot be changed after creation.</p>
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
          rows={3}
          placeholder="Full company address for delivery challans"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Phone *</label>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>HSN Code <span className="text-surface-600 font-normal">(optional)</span></label>
          <input
            value={form.hsnCode}
            onChange={(e) => update('hsnCode', e.target.value)}
            placeholder="85340000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Default Rate ₹/unit <span className="text-surface-600 font-normal">(optional)</span></label>
          <input
            type="number" min="0"
            value={form.defaultRate}
            onChange={(e) => update('defaultRate', e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-800">
        <button onClick={onCancel} className="px-4 py-2.5 text-sm text-surface-400 hover:text-white transition-colors cursor-pointer">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Post-Create: "Add Products?" prompt ─────────────────────────────────────

function AddProductsPrompt({ company, onAddProducts, onSkip }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center py-12 space-y-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mx-auto">
        <FiCheck className="w-8 h-8 text-emerald-400" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white">Company Created Successfully!</h3>
        <p className="text-surface-400 mt-1 text-sm">
          <span className="text-brand-400 font-semibold">{company.brand}</span> — {company.companyName}
        </p>
      </div>
      <p className="text-surface-400 text-sm max-w-sm mx-auto">
        Would you like to add products (item codes &amp; descriptions) for this company now?
        These will be available in the Inward &amp; Outward forms.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onAddProducts}
          className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-500/20 transition-all duration-200 cursor-pointer"
        >
          <FiPackage className="w-4 h-4" />
          Add Products
        </button>
        <button
          onClick={onSkip}
          className="px-5 py-2.5 text-sm text-surface-300 bg-surface-800/60 border border-surface-700 hover:bg-surface-700 rounded-xl transition-all duration-200 cursor-pointer"
        >
          Skip for Now
        </button>
      </div>
    </motion.div>
  );
}

// ─── Product Manager ─────────────────────────────────────────────────────────

function ProductManager({ brand, onDone }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await companyApi.getProductsForCompany(brand);
      setProducts(data || []);
    } catch {
      toast.error('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [brand]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    products.filter((p) =>
      String(p.itemCode).toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
    ), [products, search]);

  const handleAdd = async () => {
    if (!newCode.trim()) { toast.error('Item Code is required.'); return; }
    setSavingNew(true);
    try {
      await companyApi.addSingleProductToCompany(brand, { itemCode: newCode.trim(), description: newDesc.trim() });
      toast.success('Product added.');
      setNewCode(''); setNewDesc(''); setAdding(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add product.');
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (p) => { setEditingId(p.id); setEditCode(p.itemCode); setEditDesc(p.description); };

  const handleSaveEdit = async (id) => {
    if (!editCode.trim()) { toast.error('Item Code is required.'); return; }
    setSavingEdit(true);
    try {
      await companyApi.updateProduct(id, { item_code: editCode.trim(), description: editDesc.trim() });
      toast.success('Product updated.');
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update product.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product? It will be deactivated (historical records are preserved).')) return;
    setDeletingId(id);
    try {
      await companyApi.deleteProduct(id);
      toast.success('Product deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete product.');
    } finally {
      setDeletingId(null);
    }
  };

  const smallInput = 'bg-surface-900/80 border border-surface-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-surface-600 transition-all';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item codes or descriptions..."
            className="w-full pl-9 pr-3 py-2 bg-surface-800/60 border border-surface-700 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-surface-500"
          />
        </div>
        <button
          onClick={() => { setAdding(true); setNewCode(''); setNewDesc(''); }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all cursor-pointer"
        >
          <FiPlus className="w-4 h-4" /> Add Product
        </button>
        <button onClick={load} className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Add Row */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 bg-brand-600/10 border border-brand-500/30 rounded-xl">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Item Code *"
                className={`${smallInput} w-36 shrink-0`}
                autoFocus
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description"
                className={`${smallInput} flex-1`}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
              <button onClick={handleAdd} disabled={savingNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-all cursor-pointer disabled:opacity-60">
                {savingNew ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                Save
              </button>
              <button onClick={() => setAdding(false)} className="p-1.5 text-surface-500 hover:text-white hover:bg-surface-700 rounded-lg transition-all cursor-pointer">
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Table */}
      <div className="border border-surface-700/60 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-surface-500 text-sm">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-surface-500 text-sm">
            {search ? 'No products match your search.' : 'No products yet. Add your first product above.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800/60 text-surface-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Item Code</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {filtered.map((p) => (
                <tr key={p.id} className={`transition-colors hover:bg-surface-800/30 ${!p.isActive ? 'opacity-40' : ''}`}>
                  {editingId === p.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input value={editCode} onChange={(e) => setEditCode(e.target.value)} className={`${smallInput} w-full`} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={`${smallInput} w-full`} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(p.id); }} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSaveEdit(p.id)} disabled={savingEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer">
                            {savingEdit ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-surface-500 hover:text-white hover:bg-surface-700 rounded-lg transition-all cursor-pointer">
                            <FiX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-surface-200">{p.itemCode}</td>
                      <td className="px-4 py-3 text-surface-300">{p.description || <span className="text-surface-600 italic">No description</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(p)} className="p-1.5 text-surface-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-all cursor-pointer" title="Edit">
                            <FiEdit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id} className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer disabled:opacity-50" title="Delete">
                            {deletingId === p.id ? <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <FiTrash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-surface-500 flex items-center gap-1.5">
        <FiInfo className="w-3.5 h-3.5 shrink-0" />
        Editing a product updates the master. Historical inward/outward records preserve the original values.
      </div>

      {onDone && (
        <div className="flex justify-end pt-2 border-t border-surface-800">
          <button onClick={onDone} className="px-4 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-xl transition-all cursor-pointer">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Info Row helper ──────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-sm text-white break-words">{value || <span className="text-surface-600 italic">—</span>}</dd>
    </div>
  );
}

// ─── Manage Company Panel ─────────────────────────────────────────────────────

function ManageCompanyPanel({ company, products, onBack, onRefresh }) {
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'products'
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const handleEdit = async (fields) => {
    setSaving(true);
    try {
      await companyApi.updateCompany(company.brand, {
        company_name: fields.companyName,
        address: fields.address,
        phone: fields.phone,
        gstin: fields.gstin,
        email: fields.email,
        hsn_code: fields.hsnCode,
        default_rate: fields.defaultRate,
      });
      toast.success('Company updated.');
      onRefresh();
      setMode('view');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update company.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(
      `Deactivate ${company.brand}?\n\n` +
      '• The company will disappear from new Inward/Outward forms.\n' +
      '• All historical transactions and documents are fully preserved.\n' +
      '• You can reactivate the company at any time.\n\n' +
      'Click OK to deactivate.'
    )) return;
    setDeactivating(true);
    try {
      await companyApi.deactivateCompany(company.brand);
      toast.success(`${company.brand} deactivated.`);
      onRefresh();
      setMode('view');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await companyApi.reactivateCompany(company.brand);
      toast.success(`${company.brand} reactivated.`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reactivate.');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors cursor-pointer">
        <FiArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      {/* Company header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30">
              <FiTag className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{company.companyName}</h2>
              <p className="text-sm text-surface-400">Brand Key: <span className="font-mono text-brand-400">{company.brand}</span></p>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${company.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {company.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'view' && (
          <motion.div key="view" variants={fadeUp} initial="hidden" animate="show" exit="exit" className="space-y-6">
            {/* Company Information */}
            <div className="bg-surface-800/30 border border-surface-700/50 rounded-2xl p-5 space-y-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Company Information</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Brand Key" value={company.brand} />
                <InfoRow label="Company Name" value={company.companyName} />
                <InfoRow label="GSTIN" value={company.gstin} />
                <InfoRow label="Phone" value={company.phone} />
                <InfoRow label="Email" value={company.email} />
                <InfoRow label="Default HSN" value={company.hsnCode} />
                <InfoRow label="Default Rate" value={company.defaultRate ? `₹${company.defaultRate}` : null} />
              </dl>
              <div>
                <dt className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-0.5">Address</dt>
                <dd className="text-sm text-white whitespace-pre-wrap">{company.address || <span className="text-surface-600 italic">—</span>}</dd>
              </div>
            </div>

            {/* Products */}
            <div className="bg-surface-800/30 border border-surface-700/50 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Products ({products.length})</h3>
              {products.length === 0 ? (
                <p className="text-sm text-surface-500">No products configured yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {products.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-surface-700/30 last:border-0">
                      <span className="font-mono text-sm text-surface-200 w-28 shrink-0">{p.itemCode}</span>
                      <span className="text-sm text-surface-400 truncate">{p.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-brand-600/80 hover:bg-brand-600 border border-brand-500/40 rounded-xl transition-all cursor-pointer"
              >
                <FiEdit3 className="w-4 h-4" /> Edit Company
              </button>
              <button
                onClick={() => setMode('products')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-surface-200 bg-surface-800/60 border border-surface-700 hover:bg-surface-700 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <FiPackage className="w-4 h-4" /> Manage Products
              </button>
              {company.isActive ? (
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  {deactivating ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <FiZapOff className="w-4 h-4" />}
                  Deactivate Company
                </button>
              ) : (
                <button
                  onClick={handleReactivate}
                  disabled={reactivating}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  {reactivating ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <FiZap className="w-4 h-4" />}
                  Reactivate Company
                </button>
              )}
            </div>

            {!company.isActive && (
              <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300">
                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                This company is inactive. It is hidden from new Inward/Outward forms but all historical records are preserved.
              </div>
            )}
          </motion.div>
        )}

        {mode === 'edit' && (
          <motion.div key="edit" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-800/30 border border-surface-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-5">Edit Company</h3>
              <CompanyForm
                initial={company}
                onSubmit={handleEdit}
                onCancel={() => setMode('view')}
                saving={saving}
                submitLabel="Save Changes"
              />
            </div>
          </motion.div>
        )}

        {mode === 'products' && (
          <motion.div key="products" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-800/30 border border-surface-700/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">{company.brand} — Products</h3>
              </div>
              <ProductManager brand={company.brand} onDone={() => { setMode('view'); onRefresh(); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyOnboardingPage() {
  // 'list' | 'add' | 'post-create' | 'manage'
  const [view, setView] = useState('list');
  const [companies, setCompanies] = useState([]);
  const [productCounts, setProductCounts] = useState({}); // { brand: count }
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState(null);
  const [managingBrand, setManagingBrand] = useState(null); // brand key
  const [managingProducts, setManagingProducts] = useState([]);
  const [savingAdd, setSavingAdd] = useState(false);

  const managingCompany = useMemo(
    () => companies.find((c) => c.brand === managingBrand) || null,
    [companies, managingBrand]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await companyApi.listCompanies();
      setCompanies(data || []);
      return data || [];
    } catch {
      toast.error('Failed to load companies.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProductCounts = useCallback(async (companiesList) => {
    if (!companiesList || companiesList.length === 0) return;
    setLoadingCounts(true);
    try {
      const results = await Promise.all(
        companiesList.map((c) =>
          companyApi.getProductsForCompany(c.brand)
            .then((prods) => ({ brand: c.brand, count: prods.length }))
            .catch(() => ({ brand: c.brand, count: '?' }))
        )
      );
      const counts = {};
      results.forEach(({ brand, count }) => { counts[brand] = count; });
      setProductCounts(counts);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    load().then(loadProductCounts);
  }, [load, loadProductCounts]);

  const handleRefresh = useCallback(() => {
    load().then(loadProductCounts);
    // Also reload managing company products if we're in manage view
    if (managingBrand) {
      companyApi.getProductsForCompany(managingBrand)
        .then(setManagingProducts)
        .catch(() => setManagingProducts([]));
    }
  }, [load, loadProductCounts, managingBrand]);

  // ── Add company submit ──
  const handleAddSubmit = async (fields) => {
    setSavingAdd(true);
    try {
      const created = await companyApi.createCompany(fields);
      setNewlyCreated(created);
      setView('post-create');
      load().then(loadProductCounts);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create company.');
    } finally {
      setSavingAdd(false);
    }
  };

  // ── Manage company ──
  const handleManage = async (brand) => {
    setManagingBrand(brand);
    try {
      const prods = await companyApi.getProductsForCompany(brand);
      setManagingProducts(prods || []);
    } catch {
      setManagingProducts([]);
    }
    setView('manage');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      {/* Page Header */}
      <motion.div
        variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-surface-900/50 backdrop-blur-2xl border border-surface-700/50 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Company Management
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            Onboard new customers, manage products, and control company status.
          </p>
        </div>
        <div className="relative z-10 flex gap-3 flex-wrap">
          <button
            onClick={() => setView('add')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-all cursor-pointer ${view === 'add' ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'bg-surface-800/60 border border-surface-700 text-surface-200 hover:bg-surface-700 hover:text-white'}`}
          >
            <FiPlus className="w-4 h-4" /> Add Company
          </button>
          <button
            onClick={() => { setView('list'); load().then(loadProductCounts); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-all cursor-pointer ${view === 'list' ? 'bg-surface-700 text-white' : 'bg-surface-800/60 border border-surface-700 text-surface-200 hover:bg-surface-700 hover:text-white'}`}
          >
            <FiEye className="w-4 h-4" /> View Companies
          </button>
        </div>
      </motion.div>

      {/* Content area */}
      <AnimatePresence mode="wait">

        {/* ── Add Company ── */}
        {view === 'add' && (
          <motion.div key="add" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-900/50 border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30">
                  <FiPlus className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Add New Company</h3>
                  <p className="text-xs text-surface-500">Fields marked * are required.</p>
                </div>
              </div>
              <CompanyForm
                onSubmit={handleAddSubmit}
                onCancel={() => setView('list')}
                saving={savingAdd}
                submitLabel="Create Company"
              />
            </div>
          </motion.div>
        )}

        {/* ── Post-Create Prompt ── */}
        {view === 'post-create' && newlyCreated && (
          <motion.div key="post-create" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-900/50 border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <AddProductsPrompt
                company={newlyCreated}
                onAddProducts={() => {
                  setManagingBrand(newlyCreated.brand);
                  setManagingProducts([]);
                  setView('manage');
                }}
                onSkip={() => setView('list')}
              />
            </div>
          </motion.div>
        )}

        {/* ── Manage Company ── */}
        {view === 'manage' && managingCompany && (
          <motion.div key="manage" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-900/50 border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <ManageCompanyPanel
                company={managingCompany}
                products={managingProducts}
                onBack={() => { setView('list'); setManagingBrand(null); }}
                onRefresh={handleRefresh}
              />
            </div>
          </motion.div>
        )}

        {/* ── View Companies (list) ── */}
        {(view === 'list' || (view === 'manage' && !managingCompany)) && (
          <motion.div key="list" variants={fadeUp} initial="hidden" animate="show" exit="exit">
            <div className="bg-surface-900/50 border border-surface-700/50 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800/60">
                <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">
                  All Companies
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-surface-500">
                    {loading ? 'Loading…' : `${companies.length} total`}
                  </span>
                  <button onClick={() => load().then(loadProductCounts)} className="p-1.5 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
                    <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-800/40 text-surface-400 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium">Brand</th>
                      <th className="px-5 py-3 text-left font-medium">Company</th>
                      <th className="px-5 py-3 text-left font-medium">GSTIN</th>
                      <th className="px-5 py-3 text-right font-medium">Products</th>
                      <th className="px-5 py-3 text-center font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/40">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-surface-500">Loading companies…</td>
                      </tr>
                    ) : companies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-surface-500">No companies yet. Click "Add Company" to get started.</td>
                      </tr>
                    ) : (
                      companies.map((c) => (
                        <tr key={c.brand} className={`transition-colors hover:bg-surface-800/30 ${!c.isActive ? 'opacity-60' : ''}`}>
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-semibold text-brand-400">{c.brand}</span>
                          </td>
                          <td className="px-5 py-3.5 text-surface-200">{c.companyName}</td>
                          <td className="px-5 py-3.5 font-mono text-surface-400 text-xs">{c.gstin || '—'}</td>
                          <td className="px-5 py-3.5 text-right">
                            {loadingCounts ? (
                              <span className="text-surface-600 text-xs">…</span>
                            ) : (
                              <span className="font-semibold text-white tabular-nums">
                                {productCounts[c.brand] ?? '?'}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-red-500/10 text-red-400 border-red-500/25'}`}>
                              {c.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => handleManage(c.brand)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-200 bg-surface-800/60 border border-surface-700/60 hover:bg-brand-600/20 hover:border-brand-500/40 hover:text-brand-300 rounded-lg transition-all cursor-pointer"
                            >
                              Manage <FiChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
