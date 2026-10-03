interface Stats {
  total: number;
  active: number;
  inactive: number;
  avgSalary: number;
}

interface Props {
  stats: Stats;
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label: 'Total', value: stats.total, color: '#3b82f6' },
    { label: 'Active', value: stats.active, color: '#22c55e' },
    { label: 'Inactive', value: stats.inactive, color: '#ef4444' },
    { label: 'Avg Salary', value: `$${stats.avgSalary.toLocaleString()}`, color: '#a855f7' },
  ];

  return (
    <div className="stats-grid">
      {cards.map(card => (
        <div className="stat-card" key={card.label}>
          <div className="stat-value" style={{ color: card.color }}>
            {card.value}
          </div>
          <div className="stat-label">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
