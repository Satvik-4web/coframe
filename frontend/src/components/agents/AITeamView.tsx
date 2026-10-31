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
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#172033] tracking-tight">
                AI Collaborator Team
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                2 Agents Active
              </span>
            </div>
            <p className="text-xs text-[#657189] mt-0.5">
              Specialized autonomous AI partners collaborating with Alex & Maya on LedgerFlow
            </p>
          </div>
        </div>

        {/* Global Agent Control Buttons */}
        <div className="flex items-center gap-2.5">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('context')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100/70 border border-teal-200 text-xs font-semibold text-teal-900 shadow-xs transition cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-teal-700" />
              <span>Full Context Inspector</span>
              <ExternalLink className="w-3 h-3 text-teal-600 ml-0.5" />
            </button>
          )}

          <button
            onClick={() => handleRestart(selectedAgent)}
            disabled={restarting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E7ECF2] text-xs font-semibold text-[#172033] shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Demonstrate Step 5: Restart this agent and recover fresh Context Pack from persisted state"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-amber-600 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart & Recover Context</span>
          </button>
        </div>
      </div>

      {/* Dual Agent Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NOVA Card */}
        <div
          onClick={() => setSelectedAgent('nova')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            selectedAgent === 'nova'
              ? 'bg-white border-violet-300 ring-2 ring-violet-100 shadow-sm'
              : 'bg-white border-[#E7ECF2] hover:border-violet-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center font-bold text-violet-700 text-sm">
                N
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#172033]">NOVA</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    Product Strategist
                  </span>
                </div>
                <p className="text-[11px] text-[#657189] mt-0.5">
                  Audience validation, market positioning & governance
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {novaRun?.status === 'working' ? 'Working' : 'Ready'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E7ECF2]">
              <span className="text-[10px] text-[#657189] block font-medium">Context Base</span>
              <span className="font-mono font-bold text-blue-700">v{novaRun?.base_context_version || 1}</span>
            </div>
            <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E7ECF2]">
              <span className="text-[10px] text-[#657189] block font-medium">Artifact Base</span>
              <span className="font-mono font-bold text-emerald-700">v{novaRun?.base_artifact_version || 1}</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-[#657189] line-clamp-2 leading-relaxed">
            <strong className="text-[#172033]">Active Task: </strong>
            {novaRun?.task_description || 'Synthesizing market requirements & audience fit'}
          </p>
        </div>

        {/* PIXEL Card */}
        <div
          onClick={() => setSelectedAgent('pixel')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            selectedAgent === 'pixel'
              ? 'bg-white border-teal-300 ring-2 ring-teal-100 shadow-sm'
              : 'bg-white border-[#E7ECF2] hover:border-teal-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center font-bold text-teal-700 text-sm">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#172033]">PIXEL</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    Prototype Engineer
                  </span>
                </div>
                <p className="text-[11px] text-[#657189] mt-0.5">
                  Artifact mutations, code proposals & policy automation
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {pixelRun?.status === 'working' ? 'Working' : 'Ready'}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E7ECF2]">
              <span className="text-[10px] text-[#657189] block font-medium">Context Base</span>
              <span className="font-mono font-bold text-blue-700">v{pixelRun?.base_context_version || 1}</span>
            </div>
            <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E7ECF2]">
              <span className="text-[10px] text-[#657189] block font-medium">Artifact Base</span>
              <span className="font-mono font-bold text-emerald-700">v{pixelRun?.base_artifact_version || 1}</span>
            </div>
          </div>

          <p className="mt-3 text-xs text-[#657189] line-clamp-2 leading-relaxed">
            <strong className="text-[#172033]">Active Task: </strong>
            {pixelRun?.task_description || 'Implementing LedgerFlow hero and approval policy sections'}
          </p>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-[#E7ECF2] pb-2">
        <button
          onClick={() => setActiveSubTab('context')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'context'
              ? 'bg-white text-teal-800 border border-[#E7ECF2] shadow-2xs'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-violet-600" />
          <span>Context Pack & Recovery Inspector ({selectedAgent.toUpperCase()})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('delegation')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'delegation'
              ? 'bg-white text-teal-800 border border-[#E7ECF2] shadow-2xs'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>Agent-to-Agent Delegation ({delegations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mcp')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'mcp'
              ? 'bg-white text-teal-800 border border-[#E7ECF2] shadow-2xs'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-blue-600" />
          <span>MCP Tool Explorer</span>
        </button>
      </div>

      {/* Sub-tab 1: Context Pack & Recovery Inspector */}
      {activeSubTab === 'context' && (
        <div className="space-y-5">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
              Loading authoritative Context Pack...
            </div>
          ) : !packData ? (
            <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
              No active runs found for {selectedAgent.toUpperCase()}. Start collaboration first or click Restart.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols: Pack Structure Breakdown */}
              <div className="lg:col-span-2 space-y-4">
                {/* Version Metadata Summary */}
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                      Run Context Metadata
                    </span>
                    {onNavigateTab && (
                      <button
                        onClick={() => onNavigateTab('context')}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in Context Inspector</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E7ECF2]">
                      <span className="text-[11px] text-[#657189] block mb-0.5 font-medium">Run ID</span>
                      <span className="font-mono text-teal-700 font-semibold">{packData.run_id}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E7ECF2]">
                      <span className="text-[11px] text-[#657189] block mb-0.5 font-medium">Context Version</span>
                      <span className="font-mono text-blue-700 font-semibold">v{pack.context_version}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E7ECF2]">
                      <span className="text-[11px] text-[#657189] block mb-0.5 font-medium">Artifact Version</span>
                      <span className="font-mono text-emerald-700 font-semibold">v{pack.artifact_version}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E7ECF2]">
                      <span className="text-[11px] text-[#657189] block mb-0.5 font-medium">Data Source</span>
                      <span className="font-mono text-violet-700 font-semibold">{packData.source}</span>
                    </div>
                  </div>
                </div>

                {/* Verified Requirements Pack */}
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#657189] block mb-3">
                    Supplied Requirements ({pack.requirements?.length || 0})
                  </span>
                  <div className="space-y-2 text-xs">
                    {pack.requirements?.map((req: any) => (
                      <div
                        key={req.id || req.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2]"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-blue-700 font-bold">{req.key}</span>
                            <span className="text-[11px] font-medium text-[#657189] bg-white px-1.5 py-0.5 rounded border border-[#E7ECF2]">
                              v{req.version}
                            </span>
                          </div>
                          <span className="text-xs text-[#172033] mt-1 block font-medium">{req.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON Context Viewer (Targeted by Playwright) */}
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                      Authoritative Immutable JSON
                    </span>
                    <button
                      onClick={handleCopyJson}
                      className="flex items-center space-x-1.5 text-xs text-teal-600 hover:text-teal-800 font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="bg-[#0B1020] border border-[#263244] p-4 rounded-xl font-mono text-[11px] text-teal-300 overflow-x-auto max-h-80">
                    {JSON.stringify(pack, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Right Col: Recovery Summary & Agent Task (Targeted by Playwright) */}
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
                      <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Agent Task</span>
                      <p className="text-[#172033] font-medium leading-relaxed">
                        {pack.agent_task?.description || 'Active background strategy and prototype execution'}
                      </p>
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
                  💡 <strong className="text-[#172033]">Deterministic Recovery:</strong> When an agent restarts, COFRAME does not rely on transient chat logs. The backend reconstitutes an authoritative Context Pack consisting of verified requirement versions, artifact section versions, and unapplied changes.
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
