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
      <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[#8695B7] border border-[#1A223D] text-[10px] font-bold">
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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#0F1528] border border-[#1A223D] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Activity & Collaboration History
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-white border border-[#1A223D]">
                {events.length} Events Logged
              </span>
            </div>
            <p className="text-xs text-[#8695B7] mt-0.5">
              Monotonic append-only audit trail of every agent action and human decision
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-teal-700 bg-teal-50/70 border border-teal-200 px-3 py-1 rounded-xl self-start sm:self-auto font-medium">
          Source of Truth · SQLite Monotonic Log
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0F1528] border border-[#1A223D] p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs shrink-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'all'
                ? 'bg-[#11152A] text-white font-semibold shadow-xs'
                : 'text-[#8695B7] hover:text-white hover:bg-[#090D1A]'
            }`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilterType('alex')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'alex'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Alex ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'alex').length})
          </button>
          <button
            onClick={() => setFilterType('maya')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'maya'
                ? 'bg-pink-600 text-white font-semibold shadow-xs'
                : 'text-pink-700 hover:bg-pink-50'
            }`}
          >
            Maya ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'maya').length})
          </button>
          <button
            onClick={() => setFilterType('nova')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'nova'
                ? 'bg-violet-600 text-white font-semibold shadow-xs'
                : 'text-violet-700 hover:bg-violet-50'
            }`}
          >
            NOVA ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'nova').length})
          </button>
          <button
            onClick={() => setFilterType('pixel')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'pixel'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-teal-700 hover:bg-teal-50'
            }`}
          >
            PIXEL ({events.filter((e) => (e.actor_id || '').toLowerCase() === 'pixel').length})
          </button>
          <button
            onClick={() => setFilterType('prds')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'prds'
                ? 'bg-purple-600 text-white font-semibold shadow-xs'
                : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            PRDs ({events.filter((e) => (e.event_type || '').includes('prd') || (e.event_type || '').includes('requirement')).length})
          </button>
          <button
            onClick={() => setFilterType('plans')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'plans'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Plans ({events.filter((e) => (e.event_type || '').includes('proposal') || (e.event_type || '').includes('implementation')).length})
          </button>
          <button
            onClick={() => setFilterType('decisions')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 ${
              filterType === 'decisions'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Decisions ({events.filter((e) => (e.event_type || '').includes('approved') || (e.event_type || '').includes('rejected') || (e.event_type || '').includes('confirmed')).length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#8695B7] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[#141A33] border border-[#222C52] text-white focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-[#18203E] transition"
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-[#0F1528] border border-[#1A223D] rounded-2xl p-8 shadow-xs">
          <History className="w-10 h-10 text-[#8695B7] mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-bold text-white">No events match your criteria</h3>
          <p className="text-xs text-[#8695B7] mt-1">Try clearing your search query or switching filters.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E7ECF2]">
          {filteredEvents.map((e, idx) => {
            const eventKey = e.id || e.event_id || `ev_${e.sequence_no || idx}`;
            const isExpanded = expandedId === (e.id || eventKey);
            return (
              <div key={eventKey} className="relative group">
                {/* Timeline Node */}
                <div className="absolute -left-[19px] top-4 w-3 h-3 rounded-full bg-[#0F1528] border-2 border-teal-600 shadow-2xs group-hover:scale-125 transition" />

                <div className="bg-[#0F1528] border border-[#1A223D] hover:border-[#2E3C6E] rounded-2xl p-4 transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  {/* Event Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      {getActorBadge(e.actor_type, e.actor_id)}
                      <span className="font-mono text-xs font-bold text-white">
                        {e.event_type}
                      </span>
                      <span className="text-[11px] text-[#8695B7]">#{e.sequence_no}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-[#8695B7]">
                      <span className="px-2 py-0.5 rounded-lg bg-[#090D1A] border border-[#1A223D]">
                        ctx: v{e.context_version} · art: v{e.artifact_version}
                      </span>
                      <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Summary / Description */}
                  <p className="text-xs text-white font-medium leading-relaxed">
                    {formatEventSummary(e)}
                  </p>

                  {/* Expandable Technical JSON Payload */}
                  <div className="mt-3 pt-2 border-t border-[#F0F3F7] flex items-center justify-between">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 flex items-center space-x-1 transition cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <button
                        onClick={() => handleCopyPayload(e.id, e.payload)}
                        className="text-[11px] text-[#8695B7] hover:text-white flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedId === e.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === e.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#0B1020] border border-[#263244] overflow-x-auto text-[11px] font-mono text-teal-300">
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
