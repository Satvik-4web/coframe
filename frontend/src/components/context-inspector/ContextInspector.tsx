import React, { useState, useEffect } from 'react';
import { AgentRun, HumanIdentity, ContextProvenance, HistoricalContextItem, ContextRetrievalMetrics } from '../../types';
import { getAgentContextPack, restartAgent } from '../../lib/api';
import { MCPToolExplorer } from '../mcp/MCPToolExplorer';
import {
  RotateCcw,
  Cpu,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
  Zap,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
} from 'lucide-react';

interface ContextInspectorProps {
  agentRuns: AgentRun[];
  identity?: HumanIdentity;
  onRefresh: () => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({ agentRuns, identity, onRefresh }) => {
  const [selectedAgent, setSelectedAgent] = useState<'nova' | 'pixel'>('nova');
  const [activeTab, setActiveTab] = useState<'requirements' | 'advisory' | 'history' | 'provenance' | 'raw'>('requirements');
  const [packData, setPackData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  const fetchPack = async (agent: 'nova' | 'pixel') => {
    setLoading(true);
    try {
      const data = await getAgentContextPack('demo-ledgerflow', agent);
      setPackData(data);
    } catch {
      setPackData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPack(selectedAgent);
  }, [selectedAgent]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartAgent('demo-ledgerflow', selectedAgent);
      await fetchPack(selectedAgent);
      onRefresh();
    } catch {
      alert('Failed to restart agent');
    } finally {
      setRestarting(false);
    }
  };

  const handleCopyJson = () => {
    if (packData?.context_pack) {
      navigator.clipboard.writeText(JSON.stringify(packData.context_pack, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const pack = packData?.context_pack || {};
  const metrics: ContextRetrievalMetrics | null = pack.retrieval_metrics || null;
  const provenanceList: ContextProvenance[] = pack.item_provenance || [];
  const historicalItems: HistoricalContextItem[] = pack.historical_context || [];
  const openProposals: any[] = pack.open_proposals || [];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700 shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#172033] tracking-tight">
              Context Retrieval & Provenance Inspector
            </h1>
            <p className="text-xs text-[#657189] mt-0.5">
              Deterministic, typed context packs assembled via Weighted Keyword &amp; Concept-Based Hybrid Retrieval
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent Picker Pill */}
          <div className="flex items-center bg-[#F8FAFC] p-1 rounded-xl border border-[#E7ECF2]">
            <button
              onClick={() => setSelectedAgent('nova')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedAgent === 'nova'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              NOVA (Strategist)
            </button>
            <button
              onClick={() => setSelectedAgent('pixel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedAgent === 'pixel'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              PIXEL (Engineer)
            </button>
          </div>

          <button
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E7ECF2] text-xs font-semibold text-[#172033] shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Restart agent and rebuild fresh Context Pack from persisted state"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart &amp; Recover Context</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
          Executing hybrid retrieval and loading authoritative Context Pack...
        </div>
      ) : !packData ? (
        <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
          No active runs found for {selectedAgent.toUpperCase()}. Start collaboration first or click Restart.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Performance & Version Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                <Clock className="w-3 h-3 text-amber-500 mr-1 inline" />
                <span>Retrieval Latency</span>
              </span>
              <span className="font-mono text-amber-700 font-bold text-sm block">
                {metrics ? `${metrics.retrieval_latency_ms.toFixed(1)} ms` : '< 2 ms'}
              </span>
            </div>

            <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                <Zap className="w-3 h-3 text-purple-500 mr-1 inline" />
                <span>Context Tokens</span>
              </span>
              <span className="font-mono text-purple-700 font-bold text-sm block">
                {metrics ? `${metrics.estimated_token_count.toLocaleString()} tok` : '~1,200 tok'}
              </span>
            </div>

            <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                <Layers className="w-3 h-3 text-cyan-500 mr-1 inline" />
                <span>Version Freshness</span>
              </span>
              <span className="font-mono text-cyan-700 font-bold text-sm block">
                Ctx v{pack.context_version} / Art v{pack.artifact_version}
              </span>
            </div>

            <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                <Search className="w-3 h-3 text-emerald-500 mr-1 inline" />
                <span>Items Evaluated</span>
              </span>
              <span className="font-mono text-emerald-700 font-bold text-sm block">
                {metrics ? `${metrics.items_retrieved} / ${metrics.total_candidates_evaluated}` : `${pack.requirements?.length || 5} retrieved`}
              </span>
            </div>

            <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                <ShieldCheck className="w-3 h-3 text-blue-500 mr-1 inline" />
                <span>Retrieval Mode</span>
              </span>
              <span className="font-mono text-blue-700 font-semibold text-[11px] block truncate" title="Weighted Keyword & Concept-Based Hybrid Retrieval">
                Weighted Hybrid
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-[#E7ECF2] text-xs space-x-4 bg-white px-4 pt-3 rounded-t-2xl">
            <button
              onClick={() => setActiveTab('requirements')}
              className={`pb-2.5 font-semibold transition cursor-pointer ${
                activeTab === 'requirements'
                  ? 'border-b-2 border-teal-600 text-teal-700'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              Authoritative Requirements ({pack.requirements?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('advisory')}
              className={`pb-2.5 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'advisory'
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Advisory &amp; Proposals ({openProposals.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'border-b-2 border-amber-600 text-amber-700'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historical Context ({historicalItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('provenance')}
              className={`pb-2.5 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'provenance'
                  ? 'border-b-2 border-violet-600 text-violet-700'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Provenance &amp; Scoring ({provenanceList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`pb-2.5 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'raw'
                  ? 'border-b-2 border-cyan-600 text-cyan-700'
                  : 'text-[#657189] hover:text-[#172033]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Authoritative JSON</span>
            </button>
          </div>

          {/* Tab 1: Authoritative Requirements */}
          {activeTab === 'requirements' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#657189] block mb-3">
                    Supplied Requirements ({pack.requirements?.length || 0})
                  </span>
                  <div className="space-y-3 text-xs">
                    {pack.requirements?.map((req: any, idx: number) => {
                      const isExpanded = expandedReq === req.id || expandedReq === req.key;
                      const score = req.provenance?.relevance_score ?? 0;
                      const scorePercent = Math.round(score * 100);

                      return (
                        <div
                          key={req.id || req.key}
                          className="bg-[#F8FAFC] border border-[#E7ECF2] rounded-xl p-4 transition hover:border-[#CBD5E1]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-mono font-bold text-teal-700">
                                  #{idx + 1} {req.key}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                  v{req.version}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {req.status || 'approved'}
                                </span>
                              </div>
                              <span className="text-xs text-[#172033] font-medium block">
                                {req.title}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                                  scorePercent >= 80
                                    ? 'bg-violet-100 text-violet-800 border border-violet-300'
                                    : 'bg-white text-[#657189] border border-[#E7ECF2]'
                                }`}
                              >
                                Score: {scorePercent}%
                              </span>
                              <button
                                onClick={() => setExpandedReq(isExpanded ? null : (req.id || req.key))}
                                className="p-1 text-[#657189] hover:text-[#172033] transition cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="mt-2.5 p-2.5 rounded-lg bg-white border border-[#E7ECF2] text-xs text-[#172033]">
                            {typeof req.value === 'object' ? JSON.stringify(req.value) : req.value}
                          </div>

                          {/* Retrieval Reason */}
                          {req.provenance && (
                            <div className="mt-2 text-[11px] text-[#657189] flex items-center space-x-1.5">
                              <span className="text-violet-700 font-semibold">Retrieval Reason:</span>
                              <span>{req.provenance.retrieval_reason}</span>
                            </div>
                          )}

                          {/* Expandable Scoring Breakdown */}
                          {isExpanded && req.provenance?.scoring_breakdown && (
                            <div className="mt-3 pt-3 border-t border-[#E7ECF2] grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-mono">
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Keyword Match</span>
                                <span className="text-teal-700 font-bold">
                                  {((req.provenance.scoring_breakdown.keyword_score || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Semantic Match</span>
                                <span className="text-violet-700 font-bold">
                                  {((req.provenance.scoring_breakdown.semantic_score || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Task Dependency</span>
                                <span className="text-blue-700 font-bold">
                                  {((req.provenance.scoring_breakdown.task_dependency_score || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Version Freshness</span>
                                <span className="text-emerald-700 font-bold">
                                  {((req.provenance.scoring_breakdown.freshness_score || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Source Reliability</span>
                                <span className="text-amber-700 font-bold">
                                  {((req.provenance.scoring_breakdown.source_reliability || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded-lg border border-[#E7ECF2]">
                                <span className="text-[#657189] block">Approval Gate</span>
                                <span className="text-cyan-700 font-bold">
                                  x{req.provenance.scoring_breakdown.approval_multiplier}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Task & Recovery Summary */}
              <div className="space-y-4">
                <div className="bg-violet-50/50 border border-violet-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center space-x-2 mb-3 text-violet-700">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-violet-900">
                      Context Recovery Summary
                    </h3>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Status</span>
                      <p className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-600" />
                        <span>State Reconstructed from Database</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Task Stream</span>
                      <p className="text-[#172033] font-medium leading-relaxed">
                        {pack.agent_task?.description || 'Active background strategy and prototype execution'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Target Sections</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {pack.agent_task?.target_sections?.length > 0 ? (
                          pack.agent_task.target_sections.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white text-teal-700 border border-[#E7ECF2]">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#657189]">Auto-detected from context domain</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Offline Changes</span>
                      <p className="text-[#657189] leading-relaxed">
                        {pack.offline_changes?.length > 0
                          ? `${pack.offline_changes.length} event(s) logged while offline`
                          : 'Pack incorporates all latest requirement version updates'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E7ECF2] text-xs text-[#657189] leading-relaxed shadow-xs">
                  <strong className="text-[#172033]">Deterministic Retrieval:</strong> When an agent runs, COFRAME selectively retrieves only task-relevant requirements and sections, strictly preventing unconfirmed drafts or outdated information from masquerading as authoritative baseline state.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Advisory Context & Open Proposals */}
          {activeTab === 'advisory' && (
            <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Advisory Context &amp; Open Proposals
                </h3>
                <p className="text-xs text-[#657189] mt-0.5">
                  Proposals and recommendations pending review. Kept strictly separate from authoritative requirements.
                </p>
              </div>

              {openProposals.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#657189] bg-[#F8FAFC] rounded-xl border border-[#E7ECF2]">
                  No open proposals pending decision. All active requirements are confirmed.
                </div>
              ) : (
                <div className="space-y-3">
                  {openProposals.map((prop: any) => (
                    <div key={prop.proposal_id} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-violet-700">{prop.proposal_id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {prop.status}
                          </span>
                          <span className="text-[11px] font-medium text-[#657189]">by {prop.agent_id.toUpperCase()}</span>
                        </div>
                      </div>
                      <p className="text-[#172033] font-medium">{prop.summary}</p>
                      <div className="flex items-center gap-3 text-[11px] text-[#657189]">
                        <span>Affected Reqs: {prop.affected_requirements?.join(', ') || 'None'}</span>
                        <span>Target Sections: {prop.target_sections?.join(', ') || 'None'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Historical Context (Archived Versions) */}
          {activeTab === 'history' && (
            <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Historical Context &amp; Superseded Snapshots ({historicalItems.length})
                </h3>
                <p className="text-xs text-[#657189] mt-0.5">
                  Archived versions of requirements and sections. Preserved for diffing and audit without polluting active context.
                </p>
              </div>

              {historicalItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#657189] bg-[#F8FAFC] rounded-xl border border-[#E7ECF2]">
                  No historical versions archived yet. Initial project baseline is currently active.
                </div>
              ) : (
                <div className="space-y-3">
                  {historicalItems.map((item, idx) => (
                    <div
                      key={item.source_id || idx}
                      className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs space-y-2 opacity-85 hover:opacity-100 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-amber-700">{item.key}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                            v{item.version}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.status}
                          </span>
                          {item.superseded_by_version && (
                            <span className="text-[10px] font-mono text-[#657189]">
                              (Superseded by v{item.superseded_by_version})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#657189]">{item.timestamp}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-[#E7ECF2] text-xs text-[#657189] font-mono">
                        {typeof item.value === 'object' ? JSON.stringify(item.value) : item.value}
                      </div>

                      {item.reason_archived && (
                        <div className="text-[11px] text-[#657189]">
                          <span className="font-semibold text-amber-700">Reason Archived:</span> {item.reason_archived}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Provenance & Scoring */}
          {activeTab === 'provenance' && (
            <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                  Context Provenance &amp; Multi-Factor Scoring
                </h3>
                <p className="text-xs text-[#657189] mt-0.5">
                  Complete audit trail showing why each item was selected, its source, freshness decay, and relevance score.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-[#657189] border-b border-[#E7ECF2]">
                    <tr>
                      <th className="p-3">Source ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Ver</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Relevance</th>
                      <th className="p-3">Retrieval Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7ECF2]">
                    {provenanceList.map((prov) => (
                      <tr key={prov.source_id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3 font-mono text-teal-700 font-semibold">{prov.source_id}</td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {prov.source_type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[#657189]">v{prov.version}</td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {prov.approval_status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-violet-700">
                            {(prov.relevance_score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-[#657189] max-w-md truncate" title={prov.retrieval_reason}>
                          {prov.retrieval_reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 5: Raw JSON */}
          {activeTab === 'raw' && (
            <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                  Authoritative Immutable JSON
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1.5 text-xs text-teal-600 hover:text-teal-800 font-semibold cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="bg-[#0B1020] border border-[#263244] p-4 rounded-xl font-mono text-[11px] text-teal-300 overflow-x-auto max-h-96">
                {JSON.stringify(pack, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Model Context Protocol (MCP) Tools Explorer */}
      <div className="pt-2">
        <MCPToolExplorer identity={identity || null} />
      </div>
    </div>
  );
};
