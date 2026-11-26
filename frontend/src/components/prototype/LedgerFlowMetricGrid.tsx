import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Activity } from 'lucide-react';

interface MetricItem {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface CategoryItem {
  category: string;
  amount: string;
  percentage: number;
}

interface LedgerFlowMetricGridProps {
  data: {
    title?: string;
    metrics?: MetricItem[];
    categories?: CategoryItem[];
  };
  version: number;
}

export const LedgerFlowMetricGrid: React.FC<LedgerFlowMetricGridProps> = ({ data, version }) => {
  const metrics = data.metrics || [];
  const categories = data.categories || [];

  const categoryColors = ['#22D3EE', '#818CF8', '#A78BFA', '#F472B6', '#34D399'];

  return (
    <div
      className="rounded-2xl p-6 border transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>{data.title || 'Finance Overview'}</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Live operational telemetry & spend allocation</p>
        </div>
        <div
          className="flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[10px] font-mono font-semibold"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#94A3B8',
          }}
        >
          <span>dashboard</span>
          <span className="font-bold text-indigo-400">v{version}</span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="rounded-xl p-4 border transition-all"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderColor: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <span className="text-xs text-slate-400 font-medium">{m.label}</span>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black text-white tracking-tight font-mono">{m.value}</span>
              {m.change && (
                <div
                  className={`flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    m.trend === 'up'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : m.trend === 'down'
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                  }`}
                >
                  {m.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
                  {m.trend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
                  {m.trend === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
                  <span>{m.change}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Spend Allocation Breakdown */}
      {categories.length > 0 && (
        <div
          className="pt-4 border-t"
          style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
        >
          <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider mb-3">
            Category Breakdown
          </h3>
          <div className="space-y-3">
            {categories.map((c, idx) => {
              const color = categoryColors[idx % categoryColors.length];
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{c.category}</span>
                    <span className="text-white font-mono">{c.amount} ({c.percentage}%)</span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${c.percentage}%`,
                        background: color,
                        boxShadow: `0 0 10px ${color}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
