import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
  changeBadge?: string;
  isProposed?: boolean;
}

export const LedgerFlowMetricGrid: React.FC<LedgerFlowMetricGridProps> = ({
  data,
  version,
  changeBadge,
  isProposed = false,
}) => {
  const metrics = data.metrics || [];
  const categories = data.categories || [];

  return (
    <div
      className={`bg-white border rounded-2xl p-6 shadow-sm relative transition-all ${
        isProposed
          ? 'border-teal-500 ring-2 ring-teal-200'
          : 'border-slate-200'
      }`}
    >
      {/* Proposed unapplied ribbon */}
      {isProposed && (
        <div className="absolute -top-3 right-6 bg-teal-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
          Proposed (Unapplied)
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">{data.title || 'Finance Overview'}</h2>
            {changeBadge && (
              <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800 font-mono">
                {changeBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Live operational telemetry & spend allocation</p>
        </div>
        <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500 font-mono self-start sm:self-center">
          <span>dashboard</span>
          <span className="font-bold text-slate-700">v{version}</span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium">{m.label}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{m.value}</span>
              {m.change && (
                <div
                  className={`flex items-center text-[11px] font-semibold ${
                    m.trend === 'up'
                      ? 'text-emerald-700'
                      : m.trend === 'down'
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {m.trend === 'up' && <TrendingUp className="w-3 h-3 mr-0.5" />}
                  {m.trend === 'down' && <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {m.trend === 'neutral' && <Minus className="w-3 h-3 mr-0.5" />}
                  <span>{m.change}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Spend Allocation Breakdown */}
      {categories.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
            Category Breakdown
          </h3>
          <div className="space-y-2">
            {categories.map((c, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>{c.category}</span>
                  <div className="space-x-2">
                    <span className="text-slate-900 font-bold">{c.amount}</span>
                    <span className="text-slate-400">({c.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-teal-500' : idx === 1 ? 'bg-blue-500' : 'bg-violet-500'
                    }`}
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
