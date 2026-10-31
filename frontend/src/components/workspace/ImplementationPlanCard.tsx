import React from 'react';
import {
  Layers,
  Code2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { ImplementationPlan } from '../../types';

interface ImplementationPlanCardProps {
  plan: ImplementationPlan | null;
  onViewProposal?: (proposalId: string) => void;
}

export const ImplementationPlanCard: React.FC<ImplementationPlanCardProps> = ({
  plan,
  onViewProposal,
}) => {
  if (!plan) return null;

  return (
    <div className="bg-white border border-[#E5EAF0] rounded-2xl p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-xs">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#172033]">
                {plan.title}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                PIXEL · Prototype Engineer
              </span>
            </div>
            <p className="text-[11px] text-[#657189] mt-0.5">
              Structured engineering plan derived from confirmed PRD requirements
            </p>
          </div>
        </div>

        {plan.proposal_id && onViewProposal && (
          <button
            onClick={() => onViewProposal(plan.proposal_id!)}
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <span>Inspect Generated Proposal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Target Sections & Dependencies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5EAF0]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] block mb-1">
            Target Prototype Sections
          </span>
          <div className="flex flex-wrap gap-1.5">
            {plan.target_sections.map((sec) => (
              <span
                key={sec}
                className="px-2 py-0.5 rounded-md bg-white border border-[#E5EAF0] font-mono text-[11px] font-semibold text-teal-700"
              >
                {sec}
              </span>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5EAF0]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] block mb-1">
            Expected UI Changes
          </span>
          <ul className="space-y-1 text-[11px] text-[#172033]">
            {plan.expected_ui_changes.map((change, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-teal-600 shrink-0" />
                <span className="truncate">{change}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Planned Tasks */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] block mb-2">
          Engineering Tasks ({plan.tasks.length})
        </span>
        <div className="space-y-2">
          {plan.tasks.map((task) => (
            <div
              key={task.id}
              className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E5EAF0] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-[#E5EAF0] text-slate-700">
                  {task.id}
                </span>
                <span className="font-medium text-[#172033]">{task.task}</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Ready for review
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
