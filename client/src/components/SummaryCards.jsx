import { FiTrendingUp, FiTrendingDown, FiBox, FiLayers } from 'react-icons/fi';

export default function SummaryCards({ summary }) {
  // Aggregate totals from summary data
  const totals = summary.reduce(
    (acc, item) => ({
      totalIn: acc.totalIn + Number(item.total_in || 0),
      totalOut: acc.totalOut + Number(item.total_out || 0),
      balance: acc.balance + Number(item.balance || 0),
      partCodes: acc.partCodes.add(item.part_code),
    }),
    { totalIn: 0, totalOut: 0, balance: 0, partCodes: new Set() }
  );

  const cards = [
    {
      id: 'card-total-in',
      label: 'Total In-Ward',
      value: totals.totalIn.toLocaleString(),
      icon: FiTrendingUp,
      gradient: 'from-emerald-500 to-green-600',
      shadowColor: 'shadow-emerald-500/20',
      bgAccent: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
    },
    {
      id: 'card-total-out',
      label: 'Total Out-Ward',
      value: totals.totalOut.toLocaleString(),
      icon: FiTrendingDown,
      gradient: 'from-orange-500 to-amber-600',
      shadowColor: 'shadow-orange-500/20',
      bgAccent: 'bg-orange-500/10',
      textColor: 'text-orange-400',
    },
    {
      id: 'card-balance',
      label: 'Current Balance',
      value: totals.balance.toLocaleString(),
      icon: FiBox,
      gradient: 'from-brand-500 to-brand-700',
      shadowColor: 'shadow-brand-500/20',
      bgAccent: 'bg-brand-500/10',
      textColor: 'text-brand-400',
    },
    {
      id: 'card-parts',
      label: 'Part Codes',
      value: totals.partCodes.size.toLocaleString(),
      icon: FiLayers,
      gradient: 'from-purple-500 to-violet-600',
      shadowColor: 'shadow-purple-500/20',
      bgAccent: 'bg-purple-500/10',
      textColor: 'text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={card.id}
          id={card.id}
          className="animate-slide-up bg-surface-900/80 backdrop-blur-sm border border-surface-800 rounded-xl p-5 hover:border-surface-700 transition-all duration-300 group"
          style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'backwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-surface-400 font-medium">{card.label}</span>
            <div className={`${card.bgAccent} p-2 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
              <card.icon className={`w-4 h-4 ${card.textColor}`} />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
