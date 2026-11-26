import React, { useState } from 'react';
import { EventRecord } from '../../types';
import {
  History,
  User,
  Bot,
  Server,
  ChevronDown,
  ChevronUp,
  Search,
  Copy,
  Check,
} from 'lucide-react';

interface ActivityHistoryViewProps {
  events: EventRecord[];
}

export const ActivityHistoryView: React.FC<ActivityHistoryViewProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<'all' | 'alex' | 'maya' | 'nova' | 'pixel' | 'prds' | 'plans' | 'decisions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getActorBadge = (actorType: string, actorId: string) => {
    if (actorType === 'human') {
      const isAlex = actorId.toLowerCase() === 'alex';
      return (
        <div
          className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
          style={
            isAlex
              ? {
                  background: 'rgba(96, 165, 250, 0.15)',
                  color: '#60A5FA',
                  borderColor: 'rgba(96, 165, 250, 0.3)',
                  boxShadow: '0 0 8px rgba(96, 165, 250, 0.2)',
                }
              : {
                  background: 'rgba(244, 114, 182, 0.15)',
                  color: '#F472B6',
                  borderColor: 'rgba(244, 114, 182, 0.3)',
                  boxShadow: '0 0 8px rgba(244, 114, 182, 0.2)',
                }
          }
        >
          <User className="w-3 h-3" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    if (actorType === 'agent') {
      const isNova = actorId.toLowerCase() === 'nova';
      return (
        <div
          className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
          style={
            isNova
              ? {
                  background: 'rgba(167, 139, 250, 0.15)',
                  color: '#A78BFA',
                  borderColor: 'rgba(167, 139, 250, 0.3)',
                  boxShadow: '0 0 8px rgba(167, 139, 250, 0.2)',
                }
              : {
                  background: 'rgba(34, 211, 238, 0.15)',
                  color: '#22D3EE',
                  borderColor: 'rgba(34, 211, 238, 0.3)',
                  boxShadow: '0 0 8px rgba(34, 211, 238, 0.2)',
                }
          }
        >
          <Bot className="w-3 h-3" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    return (
      <div
        className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          color: '#94A3B8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <Server className="w-3 h-3" />
        <span>SYSTEM</span>
      </div>
    );
  };

  const formatEventSummary = (e: EventRecord): string => {
    const p = e.payload || {};
    const evType = e.event_type.toLowerCase();

    if (evType.includes('proposal_submitted') || evType === 'proposal_stamped') {
      const author = p.created_by || p.agent_id || e.actor_id;
      const typeLabel = p.proposal_type ? p.proposal_type.replace(/_/g, ' ') : 'contribution';
      return `${author.toUpperCase()} submitted ${typeLabel}: "${p.summary || ''}"`;
    }

    if (evType.includes('proposal_approved')) {
      const approver = p.decided_by || e.actor_id;
      const origAuthor = p.created_by || p.agent_id;
      const artVer = p.new_artifact_version || e.artifact_version;
      return `${approver.toUpperCase()} approved ${origAuthor ? `${origAuthor.toUpperCase()}'s ` : ''}proposal #${(p.proposal_id || '').slice(-6)} (Artifact advanced to v${artVer})`;
    }

    if (evType.includes('proposal_rejected')) {
      const rejecter = p.decided_by || e.actor_id;
      const origAuthor = p.created_by || p.agent_id;
      return `${rejecter.toUpperCase()} rejected ${origAuthor ? `${origAuthor.toUpperCase()}'s ` : ''}proposal #${(p.proposal_id || '').slice(-6)}: ${p.reason || 'Decision owner rejection'}`;
    }

    if (evType.includes('proposal_redirected')) {
      return `Proposal #${(p.original_proposal_id || p.proposal_id || '').slice(-6)} redirected with guidance -> revised proposal #${(p.new_proposal_id || '').slice(-6)}`;
    }

    if (evType.includes('proposal_reconciled')) {
      return `Stale proposal #${(p.original_proposal_id || p.proposal_id || '').slice(-6)} reconciled with enterprise context -> revised proposal #${(p.new_proposal_id || '').slice(-6)}`;
    }

    if (p.summary) return p.summary;
    if (p.message) return p.message;
    if (p.requirement_key) {
      return `Updated requirement ${p.requirement_key} to '${p.new_value}'`;
    }
    if (p.section_key) {
      return `Mutated artifact section '${p.section_key}' to version v${p.new_version}`;
    }
    if (evType === 'agent_restarted') {
      return `Agent ${e.actor_id.toUpperCase()} restarted; context restored from authoritative DB snapshot`;
    }
    return p.stale_reason || p.conflict_reason || `${e.event_type.replace(/_/g, ' ')}`;
  };

  const filteredEvents = events.filter((e) => {
    const actId = (e.actor_id || '').toLowerCase();
    const evType = (e.event_type || '').toLowerCase();
    const payloadStr = JSON.stringify(e.payload || '').toLowerCase();

    // 1. Filter by category
    if (filterType === 'alex' && actId !== 'alex') return false;
    if (filterType === 'maya' && actId !== 'maya') return false;
    if (filterType === 'nova' && actId !== 'nova') return false;
    if (filterType === 'pixel' && actId !== 'pixel') return false;
    if (filterType === 'prds' && !(evType.includes('prd') || evType.includes('requirement') || payloadStr.includes('prd'))) return false;
    if (filterType === 'plans' && !(evType.includes('proposal') || evType.includes('implementation') || evType.includes('mutation'))) return false;
    if (filterType === 'decisions' && !(evType.includes('approved') || evType.includes('rejected') || evType.includes('confirmed') || evType.includes('decision'))) return false;

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchType = e.event_type.toLowerCase().includes(q);
      const matchActor = e.actor_id.toLowerCase().includes(q);
      const matchSummary = formatEventSummary(e).toLowerCase().includes(q);
      const matchPayload = JSON.stringify(e.payload).toLowerCase().includes(q);
      return matchType || matchActor || matchSummary || matchPayload;
    }

    return true;
  });

  const handleCopyPayload = (id: string, payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span>Workspace</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-medium">Activity</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-bold text-white tracking-[-0.025em] leading-tight">
              Activity & History
            </h1>
            <span
              className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border"
              style={{
                background: 'rgba(129, 140, 248, 0.1)',
                color: '#A78BFA',
                borderColor: 'rgba(129, 140, 248, 0.25)',
              }}
            >
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Monotonic append-only audit trail of every agent run and human decision.
          </p>
        </div>

        <span
          className="text-[11px] font-mono border px-3 py-1.5 rounded-xl self-start sm:self-auto"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            color: '#34D399',
            boxShadow: '0 0 10px rgba(52, 211, 153, 0.1)',
          }}
        >
          SQLite monotonic ledger
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="p-3 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="flex flex-wrap items-center gap-1 p-1 rounded-xl text-xs border"
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'all'
                ? {
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                  }
                : { color: '#64748B' }
            }
          >
            All ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('alex')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'alex'
                ? {
                    background: 'rgba(96, 165, 250, 0.2)',
                    color: '#60A5FA',
                    boxShadow: '0 0 10px rgba(96, 165, 250, 0.2)',
                  }
                : { color: '#64748B' }
            }
          >
            Alex ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'alex').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('maya')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'maya'
                ? {
                    background: 'rgba(244, 114, 182, 0.2)',
                    color: '#F472B6',
                    boxShadow: '0 0 10px rgba(244, 114, 182, 0.2)',
                  }
                : { color: '#64748B' }
            }
          >
            Maya ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'maya').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('nova')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'nova'
                ? {
                    background: 'rgba(167, 139, 250, 0.2)',
                    color: '#A78BFA',
                    boxShadow: '0 0 10px rgba(167, 139, 250, 0.2)',
                  }
                : { color: '#64748B' }
            }
          >
            NOVA ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'nova').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('pixel')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'pixel'
                ? {
                    background: 'rgba(34, 211, 238, 0.2)',
                    color: '#22D3EE',
                    boxShadow: '0 0 10px rgba(34, 211, 238, 0.2)',
                  }
                : { color: '#64748B' }
            }
          >
            PIXEL ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'pixel').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('prds')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'prds'
                ? {
                    background: 'rgba(129, 140, 248, 0.2)',
                    color: '#A78BFA',
                  }
                : { color: '#64748B' }
            }
          >
            PRDs ({events.filter((e) => (e.event_type || '').includes('prd') || (e.event_type || '').includes('requirement')).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('plans')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'plans'
                ? {
                    background: 'rgba(129, 140, 248, 0.2)',
                    color: '#A78BFA',
                  }
                : { color: '#64748B' }
            }
          >
            Plans ({events.filter((e) => (e.event_type || '').includes('proposal') || (e.event_type || '').includes('implementation')).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('decisions')}
            className="px-3 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0"
            style={
              filterType === 'decisions'
                ? {
                    background: 'rgba(129, 140, 248, 0.2)',
                    color: '#A78BFA',
                  }
                : { color: '#64748B' }
            }
          >
            Decisions ({events.filter((e) => (e.event_type || '').includes('approved') || (e.event_type || '').includes('rejected') || (e.event_type || '').includes('confirmed')).length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none border transition"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div
          className="text-center py-16 p-8 rounded-2xl border"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <History className="w-9 h-9 text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-white">No events match your filter</h3>
          <p className="text-xs text-slate-500 mt-1">Clear your search query or switch filters above.</p>
        </div>
      ) : (
        <div
          className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px"
          style={{
            ['--tw-before' as any]: 'transparent',
          }}
        >
          {filteredEvents.map((e, idx) => {
            const eventKey = e.id || e.event_id || `ev_${e.sequence_no || idx}`;
            const isExpanded = expandedId === (e.id || eventKey);
            return (
              <div key={eventKey} className="relative group">
                <div
                  className="absolute -left-[19px] top-4 w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125"
                  style={{
                    background: '#818CF8',
                    boxShadow: '0 0 8px rgba(129, 140, 248, 0.8)',
                  }}
                />

                <div
                  className="p-4 rounded-2xl border transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.07)',
                  }}
                  onMouseEnter={(el) => {
                    el.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    el.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.3)';
                    el.currentTarget.style.boxShadow = '0 0 20px rgba(129, 140, 248, 0.1)';
                  }}
                  onMouseLeave={(el) => {
                    el.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    el.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    el.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      {getActorBadge(e.actor_type, e.actor_id)}
                      <span className="font-mono text-xs font-semibold text-white">
                        {e.event_type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">#{e.sequence_no}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                      <span
                        className="px-2 py-0.5 rounded-md border"
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#A78BFA',
                        }}
                      >
                        ctx v{e.context_version} · art v{e.artifact_version}
                      </span>
                      <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {formatEventSummary(e)}
                  </p>

                  <div
                    className="mt-3 pt-2.5 border-t flex items-center justify-between"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide payload' : 'View payload'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => handleCopyPayload(e.id, e.payload)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedId === e.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === e.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div
                      className="mt-2.5 p-3 rounded-xl overflow-x-auto text-[11px] font-mono border"
                      style={{
                        background: '#05070E',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#A78BFA',
                      }}
                    >
                      <pre>{JSON.stringify(e.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
