import React, { useState, useEffect } from 'react';
import { AgentRun, HumanIdentity, Delegation } from '../../types';
import { getAgentContextPack, restartAgent } from '../../lib/api';
import { DelegationTimeline } from '../delegation/DelegationTimeline';
import { MCPToolExplorer } from '../mcp/MCPToolExplorer';
import { ContextInspector } from '../context-inspector/ContextInspector';
import {
  Bot,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Code2,
  Clock,
  Compass,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface AITeamViewProps {
  agentRuns: AgentRun[];
  delegations?: Delegation[];
  identity: HumanIdentity;
  onRefresh: () => void;
  onNavigateTab?: (tab: any, param?: string) => void;
}

export const AITeamView: React.FC<AITeamViewProps> = ({
  agentRuns,
  delegations = [],
  identity,
  onRefresh,
  onNavigateTab,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<'nova' | 'pixel'>('nova');
  const [activeSubTab, setActiveSubTab] = useState<'context' | 'delegation' | 'mcp'>('context');
  const [packData, setPackData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const novaRun = agentRuns.find((r) => r.agent_id === 'nova');
  const pixelRun = agentRuns.find((r) => r.agent_id === 'pixel');

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

  const handleRestart = async (agent: 'nova' | 'pixel') => {
    setRestarting(true);
    try {
      await restartAgent('demo-ledgerflow', agent);
      await fetchPack(agent);
      onRefresh();
    } catch (err) {
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
            <span>Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">AI Team</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-[-0.025em] leading-tight">
              AI Collaborators
            </h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              2 active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inspect active AI run context packs, delegation history, and tool execution.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('context')}
              className="h-9 px-3.5 rounded-lg btn-apple-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={1.75} />
              <span>Context Inspector</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleRestart(selectedAgent)}
            disabled={restarting}
            className="h-9 px-3.5 rounded-lg btn-obsidian text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Restart agent and reconstruct context pack from persisted state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart & recover</span>
          </button>
        </div>
      </div>

      {/* Dual Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NOVA Card */}
        <div
          onClick={() => setSelectedAgent('nova')}
          className={`coframe-card p-5 cursor-pointer transition-all ${
            selectedAgent === 'nova'
              ? 'ring-2 ring-[#2563EB]/25 border-[#2563EB]/50'
              : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200/80 text-[#6D28D9] flex items-center justify-center font-semibold text-sm">
                N
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">NOVA</h3>
                  <span className="text-[11px] font-medium px-2 py-0.2 rounded-md bg-violet-50 text-[#6D28D9] border border-violet-200/60">
                    Product Strategist
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                    gemini-2.5
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Idea discovery, requirements formulation & PRDs
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              novaRun?.status === 'working'
                ? 'bg-violet-50 text-[#6D28D9] border-violet-200/70'
                : novaRun?.status === 'waiting_for_review'
                ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                novaRun?.status === 'working' ? 'bg-[#6D28D9]' : novaRun?.status === 'waiting_for_review' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span>
                {novaRun?.status === 'working'
                  ? 'Creating PRD'
                  : novaRun?.status === 'waiting_for_review'
                  ? 'Waiting review'
                  : 'Ready'}
              </span>
            </span>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-900/[0.06] grid grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Context</span>
              <span className="font-mono font-semibold text-slate-900 mt-0.5 block">v{novaRun?.base_context_version || 1}</span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Artifact</span>
              <span className="font-mono font-semibold text-slate-900 mt-0.5 block">v{novaRun?.base_artifact_version || 1}</span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Engine</span>
              <span className="font-medium text-slate-900 truncate mt-0.5 block">Gemini 2.5</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            <strong className="font-medium text-slate-900">Focus: </strong>
            {novaRun?.current_task || novaRun?.task_description || 'Synthesizing market requirements & audience fit'}
          </p>
        </div>

        {/* PIXEL Card */}
        <div
          onClick={() => setSelectedAgent('pixel')}
          className={`coframe-card p-5 cursor-pointer transition-all ${
            selectedAgent === 'pixel'
              ? 'ring-2 ring-[#2563EB]/25 border-[#2563EB]/50'
              : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 text-[#0F766E] flex items-center justify-center font-semibold text-sm">
                P
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">PIXEL</h3>
                  <span className="text-[11px] font-medium px-2 py-0.2 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200/60">
                    Software Engineer
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                    gemini-2.5
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Implementation plans, UI updates & tests
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              pixelRun?.status === 'working'
                ? 'bg-teal-50 text-[#0F766E] border-teal-200/70'
                : pixelRun?.status === 'waiting_for_review'
                ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                pixelRun?.status === 'working' ? 'bg-[#0F766E]' : pixelRun?.status === 'waiting_for_review' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span>
                {pixelRun?.status === 'working'
                  ? 'Implementing'
                  : pixelRun?.status === 'waiting_for_review'
                  ? 'Waiting review'
                  : 'Ready'}
              </span>
            </span>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-900/[0.06] grid grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Context</span>
              <span className="font-mono font-semibold text-slate-900 mt-0.5 block">v{pixelRun?.base_context_version || 1}</span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Artifact</span>
              <span className="font-mono font-semibold text-slate-900 mt-0.5 block">v{pixelRun?.base_artifact_version || 1}</span>
            </div>
            <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-900/[0.05]">
              <span className="text-[11px] text-slate-500 block">Engine</span>
              <span className="font-medium text-slate-900 truncate mt-0.5 block">Gemini 2.5</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
            <strong className="font-medium text-slate-900">Focus: </strong>
            {pixelRun?.current_task || pixelRun?.task_description || 'Implementing LedgerFlow hero and approval policy sections'}
          </p>
        </div>
      </div>

      {/* Apple Segmented Sub-tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-[#F1F4F8] border border-slate-900/[0.06] rounded-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('context')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'context'
              ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-[#6D28D9]" strokeWidth={1.75} />
          <span>Context Pack ({selectedAgent.toUpperCase()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('delegation')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'delegation'
              ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowRight className="w-3.5 h-3.5 text-[#0F766E]" strokeWidth={1.75} />
          <span>Delegations ({delegations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('mcp')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'mcp'
              ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={1.75} />
          <span>MCP Tools</span>
        </button>
      </div>

      {/* Sub-tab 1: Context Pack & Recovery Inspector */}
      {activeSubTab === 'context' && (
        <div className="space-y-5">
          {loading ? (
            <div className="text-center py-16 text-xs text-slate-500 coframe-card">
              Loading authoritative Context Pack...
            </div>
          ) : !packData ? (
            <div className="text-center py-16 text-xs text-slate-500 coframe-card">
              No active runs found for {selectedAgent.toUpperCase()}. Start collaboration or click Restart.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols */}
              <div className="lg:col-span-2 space-y-4">
                <div className="coframe-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-900">
                      Run context metadata
                    </span>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('context')}
                        className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in Inspector</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-900/[0.06]">
                      <span className="text-[11px] text-slate-500 block mb-0.5">Run ID</span>
                      <span className="font-mono text-slate-900 font-medium truncate block">{packData.run_id}</span>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-900/[0.06]">
                      <span className="text-[11px] text-slate-500 block mb-0.5">Context</span>
                      <span className="font-mono text-[#2563EB] font-medium">v{pack.context_version ?? packData.base_context_version ?? 1}</span>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-900/[0.06]">
                      <span className="text-[11px] text-slate-500 block mb-0.5">Artifact</span>
                      <span className="font-mono text-[#0F766E] font-medium">v{pack.artifact_version ?? packData.base_artifact_version ?? 1}</span>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-900/[0.06]">
                      <span className="text-[11px] text-slate-500 block mb-0.5">Source</span>
                      <span className="font-mono text-slate-900 font-medium truncate block">{packData.source}</span>
                    </div>
                  </div>
                </div>

                {/* Verified Requirements Pack */}
                <div className="coframe-card p-5">
                  <span className="text-xs font-semibold text-slate-900 block mb-3">
                    Supplied requirements ({pack.requirements?.length || 0})
                  </span>
                  <div className="space-y-2 text-xs">
                    {pack.requirements?.map((req: any) => (
                      <div
                        key={req.id || req.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-900/[0.06]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#2563EB] font-medium">{req.key}</span>
                            <span className="text-[11px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-900/[0.08]">
                              v{req.version}
                            </span>
                          </div>
                          <span className="text-xs text-slate-700 mt-1 block">{req.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON Context Viewer */}
                <div className="coframe-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-900">
                      Authoritative JSON payload
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="bg-[#0F172A] p-4 rounded-xl font-mono text-[11px] text-slate-200 overflow-x-auto max-h-80">
                    {JSON.stringify(pack, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Right Col: Recovery Summary */}
              <div className="space-y-4">
                <div className="coframe-card p-5">
                  <div className="flex items-center gap-2 mb-3.5 text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                    <h3 className="font-semibold text-xs">
                      Context recovery summary
                    </h3>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">Status</span>
                      <p className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Reconstructed from database</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">Agent task</span>
                      <p className="text-slate-800 leading-relaxed">
                        {pack.agent_task?.description || 'Active background strategy and prototype execution'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">Offline delta</span>
                      <p className="text-slate-600 leading-relaxed">
                        {pack.offline_changes?.length > 0
                          ? `${pack.offline_changes.length} event(s) logged while offline`
                          : 'Up to date with all requirement updates'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-900/[0.07] text-xs text-slate-600 leading-relaxed">
                  <strong className="font-medium text-slate-900">Deterministic recovery:</strong> When an agent restarts, COFRAME reconstructs a fresh Context Pack directly from persisted requirement and artifact versions rather than transient chat memory.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: Delegation Timeline */}
      {activeSubTab === 'delegation' && (
        <DelegationTimeline
          delegations={delegations}
          identity={identity}
          onRefresh={onRefresh}
        />
      )}

      {/* Sub-tab 3: MCP Tool Explorer */}
      {activeSubTab === 'mcp' && (
        <MCPToolExplorer identity={identity} onNavigateTab={onNavigateTab} />
      )}
    </div>
  );
};
