import React, { useState, useEffect } from 'react';
import { AgentRun, HumanIdentity, Delegation } from '../../types';
import { getAgentContextPack, restartAgent } from '../../lib/api';
import { DelegationTimeline } from '../delegation/DelegationTimeline';
import { MCPToolExplorer } from '../mcp/MCPToolExplorer';
import {
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Copy,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Code2,
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
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 font-medium">AI Team</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-bold text-white tracking-[-0.025em] leading-tight">
              AI Collaborators
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                boxShadow: '0 0 10px rgba(52, 211, 153, 0.2)',
              }}
            >
              2 active
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Inspect active AI run context packs, delegation history, and tool execution.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('context')}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#F1F5F9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = '#94A3B8';
              }}
            >
              <Radio className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.75} />
              <span>Context Inspector</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleRestart(selectedAgent)}
            disabled={restarting}
            className="h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
              color: '#FFFFFF',
              boxShadow: '0 0 20px rgba(129, 140, 248, 0.4)',
            }}
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
          className="p-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background:
              selectedAgent === 'nova'
                ? 'rgba(167, 139, 250, 0.08)'
                : 'rgba(255, 255, 255, 0.02)',
            border:
              selectedAgent === 'nova'
                ? '1px solid rgba(167, 139, 250, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow:
              selectedAgent === 'nova'
                ? '0 0 30px rgba(167, 139, 250, 0.2)'
                : 'none',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base"
                style={{
                  background: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  color: '#A78BFA',
                  boxShadow: '0 0 15px rgba(167, 139, 250, 0.3)',
                }}
              >
                N
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">NOVA</h3>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(167, 139, 250, 0.12)',
                      color: '#A78BFA',
                      border: '1px solid rgba(167, 139, 250, 0.25)',
                    }}
                  >
                    Product Strategist
                  </span>
                  <span
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md text-slate-400"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    gemini-2.5
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Idea discovery, requirements formulation & PRDs
                </p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: 'rgba(167, 139, 250, 0.12)',
                color: '#A78BFA',
                border: '1px solid rgba(167, 139, 250, 0.3)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#A78BFA',
                  boxShadow: '0 0 6px rgba(167, 139, 250, 0.8)',
                }}
              />
              <span>Ready</span>
            </span>
          </div>

          <div
            className="mt-4 pt-3.5 grid grid-cols-3 gap-2.5 text-xs border-t"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Context</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                v{novaRun?.base_context_version || 1}
              </span>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Artifact</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                v{novaRun?.base_artifact_version || 1}
              </span>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Engine</span>
              <span className="font-semibold text-purple-300 truncate mt-0.5 block">
                Gemini 2.5
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            <strong className="font-medium text-slate-300">Focus: </strong>
            {novaRun?.current_task || novaRun?.task_description || 'Synthesizing market requirements & audience fit'}
          </p>
        </div>

        {/* PIXEL Card */}
        <div
          onClick={() => setSelectedAgent('pixel')}
          className="p-5 rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background:
              selectedAgent === 'pixel'
                ? 'rgba(34, 211, 238, 0.08)'
                : 'rgba(255, 255, 255, 0.02)',
            border:
              selectedAgent === 'pixel'
                ? '1px solid rgba(34, 211, 238, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow:
              selectedAgent === 'pixel'
                ? '0 0 30px rgba(34, 211, 238, 0.2)'
                : 'none',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base"
                style={{
                  background: 'rgba(34, 211, 238, 0.15)',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                  color: '#22D3EE',
                  boxShadow: '0 0 15px rgba(34, 211, 238, 0.3)',
                }}
              >
                P
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">PIXEL</h3>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(34, 211, 238, 0.12)',
                      color: '#22D3EE',
                      border: '1px solid rgba(34, 211, 238, 0.25)',
                    }}
                  >
                    Software Engineer
                  </span>
                  <span
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md text-slate-400"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    gemini-2.5
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Implementation plans, UI updates & tests
                </p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: 'rgba(34, 211, 238, 0.12)',
                color: '#22D3EE',
                border: '1px solid rgba(34, 211, 238, 0.3)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#22D3EE',
                  boxShadow: '0 0 6px rgba(34, 211, 238, 0.8)',
                }}
              />
              <span>Standby</span>
            </span>
          </div>

          <div
            className="mt-4 pt-3.5 grid grid-cols-3 gap-2.5 text-xs border-t"
            style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Context</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                v{pixelRun?.base_context_version || 1}
              </span>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Artifact</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                v{pixelRun?.base_artifact_version || 1}
              </span>
            </div>
            <div
              className="p-2.5 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Engine</span>
              <span className="font-semibold text-cyan-300 truncate mt-0.5 block">
                Gemini 2.5
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            <strong className="font-medium text-slate-300">Focus: </strong>
            {pixelRun?.current_task || pixelRun?.task_description || 'Implementing LedgerFlow hero and approval policy sections'}
          </p>
        </div>
      </div>

      {/* Segmented Sub-tabs */}
      <div
        className="inline-flex items-center gap-1 p-1 rounded-xl border"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSubTab('context')}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2"
          style={
            activeSubTab === 'context'
              ? {
                  background: 'rgba(167, 139, 250, 0.2)',
                  color: '#A78BFA',
                  boxShadow: '0 0 12px rgba(167, 139, 250, 0.25)',
                }
              : { color: '#64748B' }
          }
        >
          <Cpu className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Context Pack ({selectedAgent.toUpperCase()})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('delegation')}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2"
          style={
            activeSubTab === 'delegation'
              ? {
                  background: 'rgba(34, 211, 238, 0.2)',
                  color: '#22D3EE',
                  boxShadow: '0 0 12px rgba(34, 211, 238, 0.25)',
                }
              : { color: '#64748B' }
          }
        >
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Delegations ({delegations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('mcp')}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2"
          style={
            activeSubTab === 'mcp'
              ? {
                  background: 'rgba(96, 165, 250, 0.2)',
                  color: '#60A5FA',
                  boxShadow: '0 0 12px rgba(96, 165, 250, 0.25)',
                }
              : { color: '#64748B' }
          }
        >
          <Code2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>MCP Tools</span>
        </button>
      </div>

      {/* Sub-tab 1: Context Pack & Recovery Inspector */}
      {activeSubTab === 'context' && (
        <div className="space-y-5">
          {loading ? (
            <div
              className="text-center py-16 text-xs text-slate-400 rounded-2xl border"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
              }}
            >
              Loading authoritative Context Pack...
            </div>
          ) : !packData ? (
            <div
              className="text-center py-16 text-xs text-slate-400 rounded-2xl border"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
              }}
            >
              No active runs found for {selectedAgent.toUpperCase()}. Start collaboration or click Restart.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2 Cols */}
              <div className="lg:col-span-2 space-y-4">
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Run context metadata
                    </span>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('context')}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open in Inspector</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div
                      className="p-3 rounded-xl border"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Run ID
                      </span>
                      <span className="font-mono text-white font-medium truncate block">
                        {packData.run_id}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Context
                      </span>
                      <span className="font-mono text-indigo-400 font-bold">
                        v{pack.context_version ?? packData.base_context_version ?? 1}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Artifact
                      </span>
                      <span className="font-mono text-cyan-400 font-bold">
                        v{pack.artifact_version ?? packData.base_artifact_version ?? 1}
                      </span>
                    </div>
                    <div
                      className="p-3 rounded-xl border"
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <span className="text-[10px] text-slate-500 font-mono uppercase block mb-1">
                        Source
                      </span>
                      <span className="font-mono text-white font-medium truncate block">
                        {packData.source}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verified Requirements Pack */}
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono block mb-3">
                    Supplied requirements ({pack.requirements?.length || 0})
                  </span>
                  <div className="space-y-2 text-xs">
                    {pack.requirements?.map((req: any) => (
                      <div
                        key={req.id || req.key}
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderColor: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-indigo-400 font-semibold">{req.key}</span>
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                color: '#94A3B8',
                              }}
                            >
                              v{req.version}
                            </span>
                          </div>
                          <span className="text-xs text-slate-300 mt-1 block">{req.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw JSON Context Viewer */}
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Authoritative JSON payload
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre
                    className="p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-80 border"
                    style={{
                      background: '#05070E',
                      borderColor: 'rgba(255, 255, 255, 0.06)',
                      color: '#A78BFA',
                    }}
                  >
                    {JSON.stringify(pack, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Right Col: Recovery Summary */}
              <div className="space-y-4">
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-4 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                    <h3 className="font-bold text-xs uppercase tracking-wider font-mono">
                      Context recovery summary
                    </h3>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                        Status
                      </span>
                      <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Reconstructed from database</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                        Agent task
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        {pack.agent_task?.description || 'Active background strategy and prototype execution'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                        Offline delta
                      </span>
                      <p className="text-slate-400 leading-relaxed">
                        {pack.offline_changes?.length > 0
                          ? `${pack.offline_changes.length} event(s) logged while offline`
                          : 'Up to date with all requirement updates'}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border text-xs text-slate-400 leading-relaxed"
                  style={{
                    background: 'rgba(129, 140, 248, 0.05)',
                    borderColor: 'rgba(129, 140, 248, 0.15)',
                  }}
                >
                  <strong className="font-semibold text-indigo-300">Deterministic recovery: </strong>
                  When an agent restarts, COFRAME reconstructs a fresh Context Pack directly from persisted requirement and artifact versions rather than transient chat memory.
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
