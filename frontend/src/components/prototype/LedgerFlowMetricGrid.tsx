import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign } from 'lucide-react';

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{data.title || 'Finance Overview'}</h2>
          <p className="text-xs text-slate-500">Live operational telemetry & spend allocation</p>
        </div>
        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] text-slate-500 font-mono">
          <span>dashboard</span>
          <span className="font-bold text-slate-700">v{version}</span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-4">
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
