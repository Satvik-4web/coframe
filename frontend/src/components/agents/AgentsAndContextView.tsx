import React, { useState, useEffect } from 'react';
import { AgentRun, HumanIdentity, Delegation, Requirement } from '../../types';
import {
  getAgentContextPack,
  restartAgent,
  rebuildAgentContext,
  getAgentRecoveryHistory,
} from '../../lib/api';
import { MCPToolExplorer } from '../mcp/MCPToolExplorer';
import { EditRequirementModal } from '../requirements/EditRequirementModal';
import { useToast } from '../common/Toast';
import {
  Brain,
  Code2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  Cpu,
  Clock,
  Radio,
  ExternalLink,
  Edit3,
  Terminal,
  Shield,
  Zap,
  Code,
  AlertTriangle,
} from 'lucide-react';

interface AgentsAndContextViewProps {
  agentRuns: AgentRun[];
  delegations?: Delegation[];
  identity: HumanIdentity;
  onRefresh: () => void;
  onNavigateTab?: (tab: any, param?: string) => void;
  requirements?: Requirement[];
  events?: any[];
}

export type UnifiedAgentStatus =
  | 'idle'
  | 'working'
  | 'waiting for review'
  | 'failed'
  | 'offline';

export const AgentsAndContextView: React.FC<AgentsAndContextViewProps> = ({
  agentRuns,
  delegations = [],
  identity,
  onRefresh,
  onNavigateTab,
  requirements = [],
  events = [],
}) => {
  const { showToast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<'nova' | 'pixel'>('nova');
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [packData, setPackData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<any | null>(null);

  const novaRun = agentRuns.find((r) => r.agent_id === 'nova');
  const pixelRun = agentRuns.find((r) => r.agent_id === 'pixel');

  // Compute unified status for an agent
  const getUnifiedStatus = (run?: AgentRun): UnifiedAgentStatus => {
    if (!run) return 'offline';
    const st = (run.status || '').toLowerCase();
    const lifecycle = (run.lifecycle_state || '').toLowerCase();

    if (st === 'error' || st === 'failed' || lifecycle === 'failed') {
      return 'failed';
    }
    if (st === 'running' || st === 'working' || lifecycle === 'running') {
      return 'working';
    }
    if (st === 'waiting_review' || st === 'pending_review' || lifecycle === 'waiting_for_review') {
      return 'waiting for review';
    }
    if (st === 'idle' || lifecycle === 'idle') {
      return 'idle';
    }
    return 'idle';
  };

  const novaStatus = getUnifiedStatus(novaRun);
  const pixelStatus = getUnifiedStatus(pixelRun);

  // Status badge styling
  const getStatusBadge = (status: UnifiedAgentStatus) => {
    switch (status) {
      case 'working':
        return {
          bg: 'bg-teal-50 text-teal-800 border-teal-200',
          dot: 'bg-teal-500 animate-pulse',
          label: 'working',
        };
      case 'waiting for review':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
          label: 'waiting for review',
        };
      case 'failed':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          label: 'failed',
        };
      case 'offline':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: 'offline',
        };
      case 'idle':
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'idle',
        };
    }
  };

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

  // Combined single "Restart & recover" button action
  const handleRestartAndRecover = async (agentId: string) => {
    setRestartingAgent(agentId);
    try {
      await restartAgent('demo-ledgerflow', agentId);
      await rebuildAgentContext('demo-ledgerflow', agentId);
      await fetchPack(agentId as 'nova' | 'pixel');
      showToast(`${agentId.toUpperCase()} restarted and resumed from latest event!`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(`Failed to restart ${agentId}: ${err.message || 'Error'}`, 'error');
    } finally {
      setRestartingAgent(null);
    }
  };

  const handleCopyJson = () => {
    if (packData?.context_pack) {
      navigator.clipboard.writeText(JSON.stringify(packData.context_pack, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Plain-language summary of what the agent knows right now
  const getAgentKnowledgeDescription = (agentId: 'nova' | 'pixel', run?: AgentRun) => {
    const baseCtx = run?.base_context_version || 1;
    const baseArt = run?.base_artifact_version || 1;

    if (agentId === 'nova') {
      return `NOVA is synchronized with requirements v${baseCtx} and LedgerFlow prototype v${baseArt}. It actively monitors strategic goals, expense policy rules, and market positioning.`;
    }
    return `PIXEL is synchronized with requirements v${baseCtx} and LedgerFlow prototype v${baseArt}. It has compiled full schema specifications for hero, metric dashboard, and approval queue sections.`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Developer Mode Toggle */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-teal-600 flex items-center justify-center text-white shadow-md">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#172033] tracking-tight">
                Agents & Context
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                2 Agents Active
              </span>
            </div>
            <p className="text-xs text-[#657189] mt-0.5">
              Specialized autonomous AI team & deterministic context synchronization engine
            </p>
          </div>
        </div>

        {/* Controls: Developer Mode Toggle + Refresh */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setIsDeveloperMode(!isDeveloperMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs border ${
              isDeveloperMode
                ? 'bg-slate-900 text-teal-300 border-slate-800'
                : 'bg-white hover:bg-slate-50 text-[#172033] border-[#E7ECF2]'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-teal-500" />
            <span>Developer Mode: {isDeveloperMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Half: Dual Agent Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NOVA Card */}
        <div
          onClick={() => setSelectedAgent('nova')}
          className={`p-5 rounded-3xl border transition cursor-pointer flex flex-col justify-between ${
            selectedAgent === 'nova'
              ? 'bg-white border-violet-400 ring-2 ring-violet-100 shadow-sm'
              : 'bg-white border-[#E7ECF2] hover:border-violet-200 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-2xs">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#172033]">NOVA</h2>
                  <p className="text-xs text-[#657189]">AI Product Strategist</p>
                </div>
              </div>

              {/* Unified Status Badge */}
              <div className="flex items-center space-x-1.5">
                {(() => {
                  const b = getStatusBadge(novaStatus);
                  return (
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${b.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                      <span className="capitalize">{b.label}</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* What this agent knows right now box */}
            <div className="mt-3 p-3 rounded-2xl bg-violet-50/70 border border-violet-100 text-xs text-violet-950 leading-relaxed">
              <span className="font-bold text-violet-900 block mb-1">What NOVA knows right now:</span>
              <p>{getAgentKnowledgeDescription('nova', novaRun)}</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">
              Task: {novaRun?.task_description || 'Product specification & requirements'}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRestartAndRecover('nova');
              }}
              disabled={restartingAgent === 'nova'}
              className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Restart NOVA and recover fresh Context Pack from SQLite events"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-violet-600 ${restartingAgent === 'nova' ? 'animate-spin' : ''}`} />
              <span>Restart & Recover</span>
            </button>
          </div>
        </div>

        {/* PIXEL Card */}
        <div
          onClick={() => setSelectedAgent('pixel')}
          className={`p-5 rounded-3xl border transition cursor-pointer flex flex-col justify-between ${
            selectedAgent === 'pixel'
              ? 'bg-white border-teal-400 ring-2 ring-teal-100 shadow-sm'
              : 'bg-white border-[#E7ECF2] hover:border-teal-200 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#172033]">PIXEL</h2>
                  <p className="text-xs text-[#657189]">AI Software Engineer</p>
                </div>
              </div>

              {/* Unified Status Badge */}
              <div className="flex items-center space-x-1.5">
                {(() => {
                  const b = getStatusBadge(pixelStatus);
                  return (
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${b.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                      <span className="capitalize">{b.label}</span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* What this agent knows right now box */}
            <div className="mt-3 p-3 rounded-2xl bg-teal-50/70 border border-teal-100 text-xs text-teal-950 leading-relaxed">
              <span className="font-bold text-teal-900 block mb-1">What PIXEL knows right now:</span>
              <p>{getAgentKnowledgeDescription('pixel', pixelRun)}</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F3F7] flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">
              Task: {pixelRun?.task_description || 'React component engineering'}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRestartAndRecover('pixel');
              }}
              disabled={restartingAgent === 'pixel'}
              className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Restart PIXEL and recover fresh Context Pack from SQLite events"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-teal-600 ${restartingAgent === 'pixel' ? 'animate-spin' : ''}`} />
              <span>Restart & Recover</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Half: Context Inspector */}
      <div className="bg-white border border-[#E7ECF2] rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0F3F7]">
          <div>
            <h2 className="text-base font-bold text-[#172033] flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Deterministic Context Pack: {selectedAgent.toUpperCase()}</span>
            </h2>
            <p className="text-xs text-[#657189] mt-0.5">
              Authoritative requirement constraints delivered to agent inference
            </p>
          </div>

          {isDeveloperMode && (
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E7ECF2] text-xs font-semibold text-slate-700 transition flex items-center space-x-1.5 cursor-pointer self-start sm:self-center"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied JSON!' : 'Copy Raw Pack'}</span>
            </button>
          )}
        </div>

        {/* Standard View: Active Requirements with inline edit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Strategic Requirements ({requirements.length || (packData?.context_pack?.requirements?.length ?? 0)})
            </span>
            <span className="text-[11px] text-slate-400">
              Alex retains exclusive authority to edit requirements
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(requirements.length > 0 ? requirements : packData?.context_pack?.requirements || []).map((req: any) => (
              <div
                key={req.requirement_key || req.key || req.id}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E7ECF2] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs text-blue-700">
                      {req.requirement_key || req.key}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-[#E7ECF2] text-slate-600">
                      v{req.version || 1}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-[#172033] mb-1">{req.title || req.requirement_key}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {typeof req.value === 'string' ? req.value : JSON.stringify(req.value)}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Updated by {req.updated_by || 'Alex'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (identity !== 'alex') {
                        showToast('Only Alex (Founder / Decision Owner) can edit requirements.', 'error');
                        return;
                      }
                      setEditingRequirement(req);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 flex items-center space-x-1 cursor-pointer transition"
                  >
                    <Edit3 className="w-3 h-3 text-blue-500" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Developer Mode Panels */}
        {isDeveloperMode && (
          <div className="pt-6 border-t border-[#E7ECF2] space-y-6 animate-fadeIn">
            {/* 1. MCP Tool Explorer with Warning */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-[#172033]">
                  Model Context Protocol (MCP) Tool Explorer
                </h3>
              </div>
              <MCPToolExplorer identity={identity} isDeveloperMode={true} />
            </div>

            {/* 2. Raw JSON Pack Viewer */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Authoritative Context Pack JSON
              </span>
              <pre className="p-4 rounded-2xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800 shadow-inner">
                {JSON.stringify(packData?.context_pack || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Edit Requirement Modal for Alex */}
      {editingRequirement && (
        <EditRequirementModal
          isOpen={Boolean(editingRequirement)}
          requirementKey={editingRequirement.requirement_key || editingRequirement.key}
          requirementTitle={editingRequirement.title || editingRequirement.requirement_key || ''}
          currentValue={editingRequirement.value}
          identity={identity}
          onClose={() => setEditingRequirement(null)}
          onUpdated={() => {
            setEditingRequirement(null);
            onRefresh();
            fetchPack(selectedAgent);
          }}
        />
      )}
    </div>
  );
};
