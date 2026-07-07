import { useState, useEffect, useCallback, useMemo } from 'react';
import { FiUploadCloud, FiRefreshCw, FiTrendingUp, FiTrendingDown, FiPackage, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList, ReferenceLine,
} from 'recharts';
import api from '../utils/api';
import toast from 'react-hot-toast';
import SummaryCards from '../components/SummaryCards';
import UploadModal from '../components/UploadModal';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 14 } },
};

// Validated dark-surface palette (dataviz validator: every co-charted pair scores
// CVD ΔE >= 12 on surface #0f172a). Colour follows the entity/role, not rank:
//   in-ward = blue, out-ward = orange, OK = status-good green, scrap = critical red.
//   pending is diverging (blue positive / red deficit) about a zero baseline.
const C = {
  inward: '#3987e5',
  outward: '#d95926',
  ok: '#0ca30c',
  scrap: '#d03b3b',
  pos: '#3987e5',
  neg: '#d03b3b',
  grid: '#26303f',      // recessive hairline grid
  axis: '#8a94a6',      // muted axis ink
  surface: '#0f172a',   // chart surface - used as the 2px gap between stacked fills
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Compact number for axis ticks and direct labels (1.2k, 950, …).
const compact = (v) => {
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k`;
  return `${n}`;
};

// 'YYYY-MM' -> "Jun '25"
function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1] || m} '${y.slice(2)}`;
}

// Shorten a part code for chart axes: prefer the "(SAxxxx)" token, else truncate.
function shortCode(code) {
  if (!code) return '';
  const m = String(code).match(/\(([^)]+)\)/);
  const base = m ? m[1] : String(code);
  return base.length > 18 ? base.slice(0, 17) + '…' : base;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-900/95 border border-surface-700/80 p-3.5 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md max-w-[260px]">
        <p className="text-white font-semibold mb-2 text-sm break-words">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color || entry.fill }} className="text-sm font-medium tracking-wide">
            {entry.name}: {Number(entry.value).toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Monthly stacked-bar tooltip: shows each series plus the month total (and % in share mode).
const MonthlyTooltip = ({ active, payload, label, share }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const total = row._total || 0;
  return (
    <div className="bg-surface-900/95 border border-surface-700/80 p-3.5 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <p className="text-white font-semibold mb-2 text-sm">{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color }} className="text-sm font-medium tracking-wide">
          {e.name}: {share ? `${e.value}%` : Number(e.value).toLocaleString()}
        </p>
      ))}
      <p className="text-xs text-surface-400 mt-1.5 pt-1.5 border-t border-surface-700/60">
        Total out-ward: {total.toLocaleString()}
      </p>
    </div>
  );
};

function ChartCard({ title, dot, action, children, className = '' }) {
  return (
    <Tilt tiltMaxAngleX={2} tiltMaxAngleY={2} perspective={1200} scale={1.005} transitionSpeed={2000} gyroscope={true} className={className}>
      <div className="bg-surface-900/40 backdrop-blur-2xl border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-full">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-widest flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
            {title}
          </h3>
          {action}
        </div>
        {children}
      </div>
    </Tilt>
  );
}

// Small segmented toggle (Volume ↔ Share) used on the monthly chart.
function SegToggle({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-0.5 bg-surface-800/70 border border-surface-700/60 rounded-lg">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${
            value === o.value ? 'bg-surface-600 text-white' : 'text-surface-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function MainPage({ user }) {
  const [summary, setSummary] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [monthlyMode, setMonthlyMode] = useState('volume'); // 'volume' | 'share'
  const [brandFilter, setBrandFilter] = useState('');
  const [sortOption, setSortOption] = useState('pending_desc');
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    setVisibleCount(8);
  }, [brandFilter, sortOption]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, monthlyRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/transactions/analytics/monthly'),
      ]);
      setSummary(sumRes.data.data);
      setMonthly(monthlyRes.data.data);
    } catch {
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const refreshAll = () => { fetchAnalytics(); };

  const handleUploadComplete = () => { refreshAll(); };

  // ── Derived analytics ──
  const brandOverview = useMemo(() => {
    const map = {};
    summary.forEach((s) => {
      const b = s.brand_name || 'Unknown';
      if (!map[b]) map[b] = { name: b, Inward: 0, Outward: 0 };
      map[b].Inward += Number(s.total_in || 0);
      map[b].Outward += Number(s.total_out || 0);
    });
    return Object.values(map);
  }, [summary]);

  const partRows = useMemo(() => (
    summary
      .map((s) => ({
        code: s.part_code,
        brand: s.brand_name,
        inward: Number(s.total_in || 0),
        outward: Number(s.total_out || 0),
        pending: Number(s.balance || 0),
      }))
      .sort((a, b) => b.pending - a.pending)
  ), [summary]);

  const topPending = useMemo(() => partRows.slice(0, 10), [partRows]);

  const availableBrands = useMemo(() => {
    const brandsSet = new Set(summary.map(s => s.brand_name).filter(Boolean));
    return Array.from(brandsSet).sort();
  }, [summary]);

  const filteredAndSortedPartRows = useMemo(() => {
    let rows = summary.map((s) => ({
      code: s.part_code,
      brand: s.brand_name,
      inward: Number(s.total_in || 0),
      outward: Number(s.total_out || 0),
      pending: Number(s.balance || 0),
    }));

    if (brandFilter) {
      rows = rows.filter((r) => r.brand === brandFilter);
    }

    if (sortOption === 'pending_desc') {
      rows.sort((a, b) => b.pending - a.pending);
    } else if (sortOption === 'pending_asc') {
      rows.sort((a, b) => a.pending - b.pending);
    } else if (sortOption === 'brand_asc') {
      rows.sort((a, b) => a.brand.localeCompare(b.brand));
    }

    return rows;
  }, [summary, brandFilter, sortOption]);

  const visiblePartRows = useMemo(() => {
    return filteredAndSortedPartRows.slice(0, visibleCount);
  }, [filteredAndSortedPartRows, visibleCount]);

  const filteredPendingTotal = useMemo(() => filteredAndSortedPartRows.reduce((s, r) => s + r.pending, 0), [filteredAndSortedPartRows]);

  const hasMoreParts = visibleCount < filteredAndSortedPartRows.length;
  const isPartsExpanded = visibleCount > 8;

  const monthlyChart = useMemo(() => (
    monthly.map((m) => {
      const ok = Number(m.ok || 0);
      const scrap = Number(m.scrap || 0);
      const total = ok + scrap;
      if (monthlyMode === 'share') {
        return {
          month: formatMonth(m.month),
          Ok: total ? +(ok / total * 100).toFixed(1) : 0,
          Scrap: total ? +(scrap / total * 100).toFixed(1) : 0,
          _ok: ok, _scrap: scrap, _total: total,
        };
      }
      return { month: formatMonth(m.month), Ok: ok, Scrap: scrap, _total: total };
    })
  ), [monthly, monthlyMode]);

  const okScrap = useMemo(() => {
    const ok = monthly.reduce((s, m) => s + Number(m.ok || 0), 0);
    const scrap = monthly.reduce((s, m) => s + Number(m.scrap || 0), 0);
    const total = ok + scrap;
    return {
      ok, scrap, total,
      okPct: total ? (ok / total) * 100 : 0,
      scrapPct: total ? (scrap / total) * 100 : 0,
      data: [{ name: 'OK PCB', value: ok }, { name: 'Scrap', value: scrap }],
    };
  }, [monthly]);

  const pendingTotal = useMemo(() => partRows.reduce((s, r) => s + r.pending, 0), [partRows]);
  const hasData = summary.length > 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative overflow-hidden"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[140px] pointer-events-none"
      />

      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-surface-900/50 backdrop-blur-2xl border border-surface-700/50 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">
            Analytics Dashboard
          </h2>
          <p className="text-xs text-brand-400 mt-1 uppercase tracking-widest font-semibold">
            PCB inventory insights across brands, parts and time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            id="refresh-btn" onClick={refreshAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-300 bg-surface-800/80 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-colors duration-300 disabled:opacity-50 cursor-pointer shadow-lg"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            id="upload-btn" onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-surface-200 bg-surface-800/90 border border-surface-700 rounded-xl hover:bg-surface-700 hover:text-white transition-colors duration-300 cursor-pointer shadow-lg"
          >
            <FiUploadCloud className="w-4 h-4 text-brand-300" />
            Import Excel
          </motion.button>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={itemVariants}>
        <SummaryCards summary={summary} />
      </motion.div>

      {!hasData && !loading && (
        <motion.div variants={itemVariants} className="text-center py-16 bg-surface-900/40 border border-surface-700/50 rounded-3xl">
          <FiPackage className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-300 text-lg">No inventory data yet</p>
          <p className="text-surface-500 text-sm mt-1">Import an Excel file or record inward/outward transactions to see analytics.</p>
        </motion.div>
      )}

      {hasData && (
        <>
          {/* Row 1: brand overview + OK/Scrap donut */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
            <ChartCard title="In-Ward vs Out-Ward by Brand" dot="bg-brand-500" className="lg:col-span-2">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={brandOverview} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="name" stroke={C.axis} tick={{ fill: C.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke={C.axis} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.3 }} />
                    <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                    <Bar dataKey="Inward" fill={C.inward} radius={[4, 4, 0, 0]} barSize={40}>
                      <LabelList dataKey="Inward" position="top" formatter={compact} fill="#cbd5e1" fontSize={11} />
                    </Bar>
                    <Bar dataKey="Outward" fill={C.outward} radius={[4, 4, 0, 0]} barSize={40}>
                      <LabelList dataKey="Outward" position="top" formatter={compact} fill="#cbd5e1" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="OK vs Scrap (Out-Ward)" dot="bg-emerald-500">
              <div className="h-[230px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={okScrap.data} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke={C.surface} strokeWidth={2}>
                      <Cell fill={C.ok} style={{ outline: 'none' }} />
                      <Cell fill={C.scrap} style={{ outline: 'none' }} />
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-white">{okScrap.total ? okScrap.okPct.toFixed(1) : '0'}%</span>
                  <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">OK Rate</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.ok }} />
                  <div>
                    <p className="text-sm font-semibold text-white tabular-nums">{okScrap.ok.toLocaleString()}</p>
                    <p className="text-[11px] text-surface-400">OK · {okScrap.okPct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: C.scrap }} />
                  <div>
                    <p className="text-sm font-semibold text-white tabular-nums">{okScrap.scrap.toLocaleString()}</p>
                    <p className="text-[11px] text-surface-400">Scrap · {okScrap.scrapPct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </ChartCard>
          </motion.div>

          {/* Row 2: Pending PCBs by part code */}
          <motion.div variants={itemVariants}>
            <ChartCard title={`Pending PCBs by Part Code (Top 10 · Total ${pendingTotal.toLocaleString()})`} dot="bg-purple-500">
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPending} layout="vertical" margin={{ top: 4, right: 52, left: 10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={C.grid} horizontal={false} />
                    <XAxis type="number" stroke={C.axis} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} />
                    <YAxis type="category" dataKey="code" tickFormatter={shortCode} width={130} stroke={C.axis} tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.25 }} />
                    <ReferenceLine x={0} stroke={C.axis} strokeWidth={1} />
                    <Bar dataKey="pending" name="Pending" radius={[0, 4, 4, 0]} barSize={18}>
                      {topPending.map((e, i) => (
                        <Cell key={i} fill={e.pending >= 0 ? C.pos : C.neg} />
                      ))}
                      <LabelList dataKey="pending" position="right" formatter={compact} fill="#cbd5e1" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </motion.div>

          {/* Row 3: Monthly OK vs Scrap */}
          {monthlyChart.length > 0 && (
            <motion.div variants={itemVariants}>
              <ChartCard
                title="Monthly Out-Ward Split"
                dot="bg-orange-500"
                action={(
                  <SegToggle
                    value={monthlyMode}
                    onChange={setMonthlyMode}
                    options={[{ value: 'volume', label: 'Volume' }, { value: 'share', label: 'Share %' }]}
                  />
                )}
              >
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.grid} vertical={false} />
                      <XAxis dataKey="month" stroke={C.axis} tick={{ fill: C.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        stroke={C.axis} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                        domain={monthlyMode === 'share' ? [0, 100] : [0, 'auto']}
                        tickFormatter={monthlyMode === 'share' ? (v) => `${v}%` : compact}
                      />
                      <RechartsTooltip content={(props) => <MonthlyTooltip {...props} share={monthlyMode === 'share'} />} cursor={{ fill: '#334155', opacity: 0.3 }} />
                      <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                      <Bar dataKey="Ok" name="OK" stackId="a" fill={C.ok} stroke={C.surface} strokeWidth={2} barSize={30} />
                      <Bar dataKey="Scrap" name="Scrap" stackId="a" fill={C.scrap} stroke={C.surface} strokeWidth={2} radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </motion.div>
          )}

          {/* Row 4: Part-code inventory table */}
          <motion.div variants={itemVariants} className="bg-surface-900/40 backdrop-blur-xl border border-surface-700/50 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-surface-800/80 pb-4">
              <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                Part Code Inventory ({filteredAndSortedPartRows.length})
              </h3>
              
              <div className="flex items-center gap-3 flex-wrap">
                {/* Brand Filter */}
                <div className="relative">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="appearance-none bg-surface-800/60 border border-surface-700 text-surface-200 text-xs rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer font-semibold"
                  >
                    <option value="">All Brands</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-500 pointer-events-none" />
                </div>

                {/* Sort Option */}
                <div className="relative">
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="appearance-none bg-surface-800/60 border border-surface-700 text-surface-200 text-xs rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer font-semibold"
                  >
                    <option value="pending_desc">Pending Descending</option>
                    <option value="pending_asc">Pending Ascending</option>
                    <option value="brand_asc">Brand (A-Z)</option>
                  </select>
                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-surface-500 border-b border-surface-700/60">
                    <th className="py-2.5 pr-4 font-semibold">Part Code</th>
                    <th className="py-2.5 px-3 font-semibold">Brand</th>
                    <th className="py-2.5 px-3 font-semibold text-right">In-Ward</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Out-Ward</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePartRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-surface-500">
                        No part codes found matching filters.
                      </td>
                    </tr>
                  ) : (
                    visiblePartRows.map((r) => (
                      <tr key={`${r.brand}-${r.code}`} className="border-b border-surface-800/50 hover:bg-surface-800/40 transition-colors">
                        <td className="py-2.5 pr-4 text-surface-200 font-medium break-words max-w-[320px]">{r.code}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-surface-700/50 text-surface-300 rounded-full">{r.brand}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-mono">{r.inward.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-orange-400 font-mono">{r.outward.toLocaleString()}</td>
                        <td className={`py-2.5 pl-3 text-right font-mono font-semibold ${r.pending < 0 ? 'text-red-400' : 'text-brand-300'}`}>
                          {r.pending.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-700/60 font-semibold text-white">
                    <td className="py-3 pr-4 uppercase text-xs tracking-wider text-surface-400" colSpan={2}>Grand Total</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400">{filteredAndSortedPartRows.reduce((s, r) => s + r.inward, 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono text-orange-400">{filteredAndSortedPartRows.reduce((s, r) => s + r.outward, 0).toLocaleString()}</td>
                    <td className="py-3 pl-3 text-right font-mono text-brand-300">{filteredPendingTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination/Expander for Part Code Inventory */}
            {filteredAndSortedPartRows.length > 0 && (
              <div className="mt-4 pt-3 border-t border-surface-800 flex items-center justify-between gap-3 flex-wrap text-xs">
                <span className="text-surface-500">
                  Showing {visiblePartRows.length} of {filteredAndSortedPartRows.length} part code{filteredAndSortedPartRows.length !== 1 ? 's' : ''}
                </span>
                {(hasMoreParts || isPartsExpanded) && (
                  <div className="flex items-center gap-2">
                    {hasMoreParts && (
                      <button
                        onClick={() => setVisibleCount((c) => Math.min(c + 8, filteredAndSortedPartRows.length))}
                        className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-brand-400 bg-brand-500/10 border border-brand-500/25 rounded-lg hover:bg-brand-500/20 transition-all duration-200 cursor-pointer"
                      >
                        <FiChevronDown className="w-3.5 h-3.5" />
                        Show more
                      </button>
                    )}
                    {hasMoreParts && (
                      <button
                        onClick={() => setVisibleCount(filteredAndSortedPartRows.length)}
                        className="px-3 py-1.5 font-medium text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        Show all
                      </button>
                    )}
                    {isPartsExpanded && (
                      <button
                        onClick={() => setVisibleCount(8)}
                        className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
                      >
                        <FiChevronUp className="w-3.5 h-3.5" />
                        Show less
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}

      {loading && !hasData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-xs font-semibold tracking-widest text-brand-400 animate-pulse uppercase">Syncing Database...</p>
          </div>
        </motion.div>
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleUploadComplete}
      />
    </motion.div>
  );
}
