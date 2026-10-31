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
        <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
          <User className="w-3 h-3 mr-0.5" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    if (actorType === 'agent') {
      const isNova = actorId.toLowerCase() === 'nova';
      return (
        <div
          className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            isNova
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-teal-500/20 text-teal-400 border-teal-500/30'
          }`}
        >
          <Bot className="w-3 h-3 mr-0.5" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-700/30 text-gray-400 border border-gray-600/30 text-[10px] font-bold">
        <Server className="w-3 h-3 mr-0.5" />
        <span>SYSTEM</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[#151B29] border border-[#263244] p-3 rounded-xl">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wider">
            Authoritative Event Timeline ({events.length})
          </h2>
        </div>
        <span className="text-[11px] text-[#98A5B7]">Monotonic Append-Only Log</span>
      </div>

      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#263244]">
        {events.map((e) => {
          const isExpanded = expandedId === e.id;
          return (
            <div key={e.id} className="relative group">
              {/* Dot */}
              <div className="absolute -left-[19px] top-3.5 w-3 h-3 rounded-full bg-[#1B2433] border-2 border-blue-400 group-hover:scale-125 transition" />

              <div className="bg-[#151B29] border border-[#263244] hover:border-slate-600 rounded-xl p-3.5 transition">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    {getActorBadge(e.actor_type, e.actor_id)}
                    <span className="font-mono text-xs font-bold text-[#F4F7FB]">{e.event_type}</span>
                    <span className="text-[10px] text-[#98A5B7]">#{e.sequence_no}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-[#98A5B7]">
                    <span className="px-1.5 py-0.2 rounded bg-[#1B2433] border border-[#263244]">
                      ctx: v{e.context_version} · art: v{e.artifact_version}
                    </span>
                    <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Event Message / Description */}
                <p className="text-xs text-[#98A5B7] leading-relaxed">
                  {e.payload?.summary ||
                    e.payload?.message ||
                    (e.payload?.requirement_key
                      ? `Requirement ${e.payload.requirement_key} updated to '${e.payload.new_value}'`
                      : e.payload?.section_key
                      ? `Section '${e.payload.section_key}' updated to v${e.payload.new_version}`
                      : e.payload?.stale_reason || 'System state mutation recorded')}
                </p>

                {/* Expand payload */}
                <div className="mt-2 pt-2 border-t border-[#263244]/60 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center space-x-1 cursor-pointer font-medium"
                  >
                    <span>{isExpanded ? 'Hide Payload JSON' : 'Inspect Payload JSON'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <span className="text-[10px] text-[#98A5B7] font-mono">{e.id}</span>
                </div>

                {isExpanded && (
                  <pre className="mt-2 p-2.5 rounded bg-[#0B1020] border border-[#263244] font-mono text-[11px] text-teal-300 overflow-x-auto">
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
