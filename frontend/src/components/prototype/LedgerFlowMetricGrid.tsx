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
}

export const LedgerFlowMetricGrid: React.FC<LedgerFlowMetricGridProps> = ({ data, version }) => {
  const metrics = data.metrics || [];
  const categories = data.categories || [];

  return (
    <div className="rounded-[22px] border border-[#303A4B] bg-[#1A202C] p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#EDF2FA]">{data.title || 'Finance Overview'}</h2>
          <p className="mt-1 text-xs text-[#96A6BE]">Design sample. Live expense totals appear above.</p>
        </div>
        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#1D2633] border border-[#303A4B] text-[10px] text-[#96A6BE] font-mono">
          <span>dashboard</span>
          <span className="font-bold text-[#C6D2E4]">v{version}</span>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, idx) => (
          <div key={idx} className="min-h-[115px] rounded-2xl border border-[#303A4B]/80 bg-[#F8FAFD] p-5">
            <span className="text-xs text-[#96A6BE] font-medium">{m.label}</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-[28px] font-semibold text-[#EDF2FA] tracking-tight">{m.value}</span>
              {m.change && (
                <div
                  className={`flex items-center text-[11px] font-semibold ${
                    m.trend === 'up'
                      ? 'text-emerald-300'
                      : m.trend === 'down'
                      ? 'text-rose-300'
                      : 'text-[#ACBAD0]'
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
        <div className="pt-4 border-t border-[#303A4B]">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#C6D2E4]">
            Category Breakdown
          </h3>
          <div className="space-y-4">
            {categories.map((c, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs text-[#ACBAD0] font-medium">
                  <span>{c.category}</span>
                  <div className="space-x-2">
                    <span className="text-[#EDF2FA] font-bold">{c.amount}</span>
                    <span className="text-[#8495AD]">({c.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-[#1D2633] h-2 rounded-full overflow-hidden">
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
