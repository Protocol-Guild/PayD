import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  getInsightCards,
  type InsightCard as InsightCardType,
  type InsightSeverity,
} from '../services/insightCardsApi';

const CATEGORY_ICON: Record<string, React.ElementType> = {
  payroll: BadgeDollarSign,
  liquidity: Landmark,
  compliance: ShieldAlert,
  workforce: Users,
  schedule: CalendarClock,
};

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  info: 'border-accent/20 bg-accent/5',
  warning: 'border-yellow-500/30 bg-yellow-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
};

const SEVERITY_BADGE: Record<InsightSeverity, string> = {
  info: 'bg-accent/15 text-accent',
  warning: 'bg-yellow-500/15 text-yellow-300',
  critical: 'bg-red-500/15 text-red-300',
};

function severityLabel(s: InsightSeverity): string {
  if (s === 'critical') return 'Action needed';
  if (s === 'warning') return 'Heads up';
  return 'Info';
}

function InsightCardItem({ card }: { card: InsightCardType }) {
  const navigate = useNavigate();
  const Icon = CATEGORY_ICON[card.category] ?? Landmark;

  return (
    <div
      className={`card glass noise border ${SEVERITY_STYLES[card.severity]} flex flex-col gap-4 p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
            <Icon size={20} className="text-muted" />
          </div>
          <h4 className="text-sm font-bold truncate">{card.title}</h4>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${SEVERITY_BADGE[card.severity]}`}
        >
          {severityLabel(card.severity)}
        </span>
      </div>

      <p className="text-muted text-sm leading-relaxed">{card.body}</p>

      {card.metric !== undefined && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight">{card.metric}</span>
          {card.metricLabel && (
            <span className="text-xs text-muted font-medium uppercase">{card.metricLabel}</span>
          )}
        </div>
      )}

      {card.actionLabel && card.actionRoute && (
        <button
          onClick={() => void navigate(card.actionRoute!)}
          className="flex items-center gap-1.5 text-xs font-bold text-accent hover:underline mt-auto pt-1"
        >
          {card.actionLabel}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function InsightCards() {
  const [cards, setCards] = useState<InsightCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInsightCards(30);
      setCards(res.cards);
      setGeneratedAt(res.generatedAt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card glass noise border border-white/5 animate-pulse h-40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card glass noise border border-red-500/20 p-6 flex items-center gap-4">
        <AlertTriangle size={20} className="text-red-400 shrink-0" />
        <p className="text-sm text-muted">{error}</p>
        <button
          onClick={() => void load()}
          className="ml-auto text-xs font-bold text-accent hover:underline flex items-center gap-1"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Insights</h2>
        {generatedAt && (
          <span className="text-xs text-muted">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <InsightCardItem key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
