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
  Filter,
  ArrowRight,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
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
          className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            isAlex
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-pink-50 text-pink-700 border-pink-200'
          }`}
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
          className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            isNova
              ? 'bg-violet-50 text-violet-700 border-violet-200'
              : 'bg-teal-50 text-teal-700 border-teal-200'
          }`}
        >
          <Bot className="w-3 h-3" />
          <span>{actorId.toUpperCase()}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#657189] border border-slate-200 text-[10px] font-bold">
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
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">Activity</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-[-0.025em] leading-tight">
              Activity & History
            </h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-900/[0.06]">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Monotonic append-only audit trail of every agent run and human decision.
          </p>
        </div>

        <span className="text-[11px] font-mono text-slate-600 bg-white border border-slate-900/[0.08] px-3 py-1.5 rounded-lg self-start sm:self-auto shadow-2xs">
          SQLite monotonic ledger
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="coframe-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F4F8] rounded-xl text-xs border border-slate-900/[0.06]">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'all'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('alex')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'alex'
                ? 'bg-white text-[#2563EB] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alex ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'alex').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('maya')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'maya'
                ? 'bg-white text-[#BE185D] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Maya ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'maya').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('nova')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'nova'
                ? 'bg-white text-[#6D28D9] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            NOVA ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'nova').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('pixel')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'pixel'
                ? 'bg-white text-[#0F766E] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PIXEL ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'pixel').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('prds')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'prds'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            PRDs ({events.filter((e) => (e.event_type || '').includes('prd') || (e.event_type || '').includes('requirement')).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('plans')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'plans'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Plans ({events.filter((e) => (e.event_type || '').includes('proposal') || (e.event_type || '').includes('implementation')).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('decisions')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer shrink-0 ${
              filterType === 'decisions'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Decisions ({events.filter((e) => (e.event_type || '').includes('approved') || (e.event_type || '').includes('rejected') || (e.event_type || '').includes('confirmed')).length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#F8FAFC] border border-slate-900/[0.08] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 focus:border-[#2563EB]/40 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 coframe-card p-8">
          <History className="w-9 h-9 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-slate-900">No events match your filter</h3>
          <p className="text-xs text-slate-500 mt-1">Clear your search query or switch filters above.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-slate-900/[0.1]">
          {filteredEvents.map((e, idx) => {
            const eventKey = e.id || e.event_id || `ev_${e.sequence_no || idx}`;
            const isExpanded = expandedId === (e.id || eventKey);
            return (
              <div key={eventKey} className="relative group">
                <div className="absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#2563EB] transition-transform group-hover:scale-110" />

                <div className="coframe-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      {getActorBadge(e.actor_type, e.actor_id)}
                      <span className="font-mono text-xs font-medium text-slate-900">
                        {e.event_type}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">#{e.sequence_no}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100/80 border border-slate-900/[0.06]">
                        ctx v{e.context_version} · art v{e.artifact_version}
                      </span>
                      <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {formatEventSummary(e)}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-900/[0.05] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide payload' : 'View payload'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => handleCopyPayload(e.id, e.payload)}
                        className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedId === e.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === e.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#0F172A] overflow-x-auto text-[11px] font-mono text-slate-200">
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
