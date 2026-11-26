import React, { useState } from 'react';
import { EventRecord } from '../../types';
import { History, ChevronDown, ChevronUp, User, Bot, Server, Tag } from 'lucide-react';

interface EventTimelineProps {
  events: EventRecord[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getActorBadge = (actorType: string, actorId: string) => {
    if (actorType === 'human') {
      return (
        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25 text-[10px] font-bold">
          <User className="w-3 h-3 mr-0.5" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    if (actorType === 'agent') {
      const isNova = actorId.toLowerCase() === 'nova';
      return (
        <div
          className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
            isNova
              ? 'bg-violet-500/10 text-violet-300 border-violet-500/25'
              : 'bg-teal-500/10 text-teal-300 border-teal-500/25'
          }`}
        >
          <Bot className="w-3 h-3 mr-0.5" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#1D2633] text-[#C6D2E4] border border-[#303A4B] text-[10px] font-bold">
        <Server className="w-3 h-3 mr-0.5" />
        <span>SYSTEM</span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1A202C] border border-[#E5EAF0] p-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
            <History className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#E7EDF7] tracking-tight">
              Authoritative Event Timeline ({events.length})
            </h2>
            <p className="text-xs text-[#A3B0C4]">
              Monotonic append-only log of every agent execution and human decision
            </p>
          </div>
        </div>
        <span className="text-xs text-[#A3B0C4] font-medium bg-[#141A24] px-2.5 py-1 rounded-md border border-[#E5EAF0] self-start sm:self-auto">
          Monotonic Append-Only Log
        </span>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E5EAF0]">
        {events.map((e) => {
          const isExpanded = expandedId === e.id;
          return (
            <div key={e.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-[19px] top-3.5 w-3 h-3 rounded-full bg-[#1A202C] border-2 border-blue-500 shadow-xs group-hover:scale-125 transition" />

              <div className="bg-[#1A202C] border border-[#E5EAF0] hover:border-[#303A4B] rounded-xl p-4 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    {getActorBadge(e.actor_type, e.actor_id)}
                    <span className="font-mono text-xs font-bold text-[#E7EDF7]">{e.event_type}</span>
                    <span className="text-[11px] text-[#A3B0C4]">#{e.sequence_no}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-[#A3B0C4]">
                    <span className="px-2 py-0.5 rounded-md bg-[#141A24] border border-[#E5EAF0]">
                      ctx: v{e.context_version} · art: v{e.artifact_version}
                    </span>
                    <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Event Message / Description */}
                <p className="text-xs text-[#A3B0C4] leading-relaxed">
                  {e.payload?.summary ||
                    e.payload?.message ||
                    (e.payload?.requirement_key
                      ? `Requirement ${e.payload.requirement_key} updated to '${e.payload.new_value}'`
                      : e.payload?.section_key
                      ? `Section '${e.payload.section_key}' updated to v${e.payload.new_version}`
                      : e.payload?.stale_reason || 'System state mutation recorded')}
                </p>

                {/* Expand payload */}
                <div className="mt-2.5 pt-2.5 border-t border-[#E5EAF0] flex items-center justify-between">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center space-x-1 cursor-pointer font-medium"
                  >
                    <span>{isExpanded ? 'Hide Payload JSON' : 'Inspect Payload JSON'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[11px] text-[#A3B0C4] font-mono">{e.id}</span>
                </div>

                {isExpanded && (
                  <pre className="mt-2.5 p-3 rounded-lg bg-[#0B1020] border border-[#263244] font-mono text-[11px] text-teal-300 overflow-x-auto">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
