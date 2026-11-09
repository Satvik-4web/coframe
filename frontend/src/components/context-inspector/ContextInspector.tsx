import React, { useState, useEffect } from 'react';
import {
  HumanIdentity,
  ContextProvenance,
  HistoricalContextItem,
  ContextRetrievalMetrics,
  RecoveryRecord,
} from '../../types';
import {
  getAgentContextPack,
  getAgentRuns,
  rebuildAgentContext,
  resumeAgentExecution,
  getAgentRecoveryHistory,
  getInterruptedTask,
} from '../../lib/api';
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
  RefreshCw,
  Eye,
  Play,
  AlertTriangle,
  GitCompare,
  ArrowRight,
  Database,
  XCircle,
} from 'lucide-react';

interface ContextInspectorProps {
  agentRuns?: any[];
  identity?: HumanIdentity;
  onRefresh?: () => void;
  onNavigateTab?: (tab: any, param?: string) => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({ identity, onRefresh, onNavigateTab }) => {
  const [selectedAgent, setSelectedAgent] = useState<'nova' | 'pixel'>('nova');
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runMetadata, setRunMetadata] = useState<any>(null);
  const [packData, setPackData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [operating, setOperating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interrupted task tracking
  const [interruptedTask, setInterruptedTask] = useState<any>(null);

  // Three Main Tabs / Views: 'inspect' | 'reconstructed' | 'result' | 'history'
  const [mainView, setMainView] = useState<'inspect' | 'reconstructed' | 'result' | 'history'>('inspect');

  // Sub tab for inspect view
  const [activeTab, setActiveTab] = useState<'requirements' | 'advisory' | 'history' | 'provenance' | 'raw'>('requirements');

  // Reconstructed & Recovery Data State
  const [reconstructedData, setReconstructedData] = useState<any>(null);
  const [recoveryResult, setRecoveryResult] = useState<any>(null);
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryRecord[]>([]);

  // 1. Fetch runs and interrupted status whenever selectedAgent changes
  const loadAgentRunsAndTask = async (agent: 'nova' | 'pixel') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedRuns, taskStatus, history] = await Promise.all([
        getAgentRuns('demo-ledgerflow', agent),
        getInterruptedTask('demo-ledgerflow', agent),
        getAgentRecoveryHistory('demo-ledgerflow', agent),
      ]);
      setRuns(fetchedRuns);
      setInterruptedTask(taskStatus);
      setRecoveryHistory(history);

      if (fetchedRuns.length > 0) {
        const initialRunId = fetchedRuns[0].id;
        setSelectedRunId(initialRunId);
        await loadRunPack(agent, initialRunId);
      } else {
        setSelectedRunId('');
        setPackData(null);
        setRunMetadata(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load agent runs');
    } finally {
      setLoading(false);
    }
  };

  // 2. Load specific persisted run context pack (Operation A: Inspect)
  const loadRunPack = async (agent: 'nova' | 'pixel', runId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAgentContextPack('demo-ledgerflow', agent, runId);
      setPackData(data);
      setRunMetadata(data);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to load context pack for run ${runId}`);
      setPackData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentRunsAndTask(selectedAgent);
  }, [selectedAgent]);

  // Handle run selection from dropdown
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    loadRunPack(selectedAgent, runId);
  };

  // Operation A: Inspect Context (Refresh selected run)
  const handleInspect = async () => {
    if (!selectedRunId) return;
    setOperating('inspect');
    try {
      await loadRunPack(selectedAgent, selectedRunId);
      const [taskStatus, history] = await Promise.all([
        getInterruptedTask('demo-ledgerflow', selectedAgent),
        getAgentRecoveryHistory('demo-ledgerflow', selectedAgent),
      ]);
      setInterruptedTask(taskStatus);
      setRecoveryHistory(history);
      setMainView('inspect');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect context');
    } finally {
      setOperating(null);
    }
  };

  // Operation B: Rebuild Context Pack
  const handleRebuild = async () => {
    setOperating('rebuild');
    setErrorMsg(null);
    try {
      const result = await rebuildAgentContext('demo-ledgerflow', selectedAgent, selectedRunId || undefined);
      setReconstructedData(result);
      setMainView('reconstructed');
      // Refresh recovery history
      const history = await getAgentRecoveryHistory('demo-ledgerflow', selectedAgent);
      setRecoveryHistory(history);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rebuild context pack');
    } finally {
      setOperating(null);
    }
  };

  // Operation C: Resume Agent Execution / Restart & Recover
  const handleResume = async () => {
    setOperating('resume');
    setErrorMsg(null);
    try {
      const result = await resumeAgentExecution('demo-ledgerflow', selectedAgent, selectedRunId || undefined);
      setRecoveryResult(result);
      setReconstructedData(result);
      setMainView('result');

      // Refresh runs list and interrupted task status
      const [fetchedRuns, taskStatus, history] = await Promise.all([
        getAgentRuns('demo-ledgerflow', selectedAgent),
        getInterruptedTask('demo-ledgerflow', selectedAgent),
        getAgentRecoveryHistory('demo-ledgerflow', selectedAgent),
      ]);
      setRuns(fetchedRuns);
      setInterruptedTask(taskStatus);
      setRecoveryHistory(history);

      if (result.resulting_run_id) {
        setSelectedRunId(result.resulting_run_id);
        await loadRunPack(selectedAgent, result.resulting_run_id);
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resume agent execution');
    } finally {
      setOperating(null);
    }
  };

  const handleCopyJson = (content: any) => {
    if (content) {
      navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const pack = packData?.context_pack || {};
  const metrics: ContextRetrievalMetrics | null = pack.retrieval_metrics || null;
  const provenanceList: ContextProvenance[] = pack.item_provenance || [];
  const historicalItems: HistoricalContextItem[] = pack.historical_context || [];
  const openProposals: any[] = pack.open_proposals || [];

  const diff = reconstructedData?.diff || recoveryResult?.diff || null;
  const hasInterrupted = interruptedTask?.has_interrupted_task || false;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700 shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-[#172033] tracking-tight">
                Context Pack &amp; Recovery Inspector
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Authoritative Persisted State
              </span>
            </div>
            <p className="text-xs text-[#657189] mt-0.5">
              Deterministic, typed context packs with semantic versioning, offline checkpoint replay, and genuine task resumption.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('agents')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-800 shadow-xs transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-violet-600" />
              <span>Back to AI Team</span>
            </button>
          )}
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

          {/* Run Picker Dropdown */}
          <div className="flex items-center bg-white px-2.5 py-1.5 rounded-xl border border-[#E7ECF2] shadow-xs">
            <span className="text-[11px] font-bold text-[#657189] mr-2">Run:</span>
            <select
              value={selectedRunId}
              onChange={(e) => handleSelectRun(e.target.value)}
              disabled={loading || runs.length === 0}
              className="text-xs font-mono font-medium text-[#172033] bg-transparent outline-none cursor-pointer pr-1"
            >
              {runs.map((r, idx) => (
                <option key={r.id} value={r.id}>
                  {r.id.length > 22 ? `${r.id.slice(0, 22)}...` : r.id} ({r.status}) {idx === 0 ? '· Latest' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Operation A: Inspect Context */}
          <button
            onClick={handleInspect}
            disabled={operating === 'inspect' || !selectedRunId}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E7ECF2] text-xs font-semibold text-[#172033] shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Inspect the exact Context Pack from the selected persisted agent run"
          >
            <Eye className={`w-3.5 h-3.5 text-blue-600 ${operating === 'inspect' ? 'animate-spin' : ''}`} />
            <span>Inspect</span>
          </button>

          {/* Operation B: Rebuild Context */}
          <button
            onClick={handleRebuild}
            disabled={operating === 'rebuild'}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E7ECF2] text-xs font-semibold text-[#172033] shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Reconstruct a fresh Context Pack from latest approved requirements and artifact sections without resuming"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${operating === 'rebuild' ? 'animate-spin' : ''}`} />
            <span>Rebuild Context</span>
          </button>

          {/* Operation C: Resume Agent Execution */}
          <button
            onClick={handleResume}
            disabled={operating === 'resume'}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 ${
              hasInterrupted
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-white hover:bg-slate-50 border border-[#E7ECF2] text-[#172033]'
            }`}
            title={
              hasInterrupted
                ? 'Interrupted task detected! Click to resume agent execution with recovered context'
                : 'Resume agent execution (or verify nothing is interrupted)'
            }
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasInterrupted ? 'text-white' : 'text-amber-600'} ${operating === 'resume' ? 'animate-spin' : ''}`} />
            <span>{hasInterrupted ? 'Resume Interrupted Task' : 'Restart & Recover Context'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-[11px] font-semibold text-rose-700 hover:underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Interrupted Task Alert (If active) */}
      {hasInterrupted && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Interrupted Work Found: </span>
              <span>{interruptedTask.task_info?.task_description || 'Active task stopped before completion.'}</span>
              {interruptedTask.task_info?.pending_work?.length > 0 && (
                <span className="ml-1 text-amber-700 font-medium">
                  ({interruptedTask.task_info.pending_work.length} step(s) pending)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleResume}
            disabled={operating === 'resume'}
            className="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold text-[11px] hover:bg-amber-700 cursor-pointer shadow-xs transition"
          >
            Resume Now
          </button>
        </div>
      )}

      {/* Persisted Run Metadata Row */}
      {runMetadata && (
        <div className="bg-white border border-[#E7ECF2] p-4 rounded-2xl shadow-xs grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Run ID</span>
            <span className="font-mono text-violet-700 font-bold text-xs truncate block" title={runMetadata.run_id}>
              {runMetadata.run_id}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Run Status</span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                runMetadata.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : runMetadata.status === 'working'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : runMetadata.status === 'interrupted'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {runMetadata.status?.toUpperCase() || 'IDLE'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Context / Artifact</span>
            <span className="font-mono text-cyan-700 font-bold text-xs block">
              Ctx v{runMetadata.base_context_version} / Art v{runMetadata.base_artifact_version}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Checkpoint</span>
            <span className="font-mono text-[#172033] font-medium text-xs block truncate" title={JSON.stringify(runMetadata.last_checkpoint || 'None')}>
              {runMetadata.last_checkpoint?.checkpoint_id || (runMetadata.last_checkpoint ? 'Recorded' : 'None')}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Execution Source</span>
            <span className="font-mono text-slate-700 font-medium text-xs block">
              {runMetadata.source || 'live_llm'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Started At</span>
            <span className="font-mono text-[#657189] text-[11px] block truncate" title={runMetadata.started_at}>
              {runMetadata.started_at ? new Date(runMetadata.started_at).toLocaleTimeString() : 'Baseline'}
            </span>
          </div>
        </div>
      )}

      {/* Main View Selector Navigation */}
      <div className="flex border-b border-[#E7ECF2] text-xs space-x-2 bg-white px-4 pt-3 rounded-t-2xl">
        <button
          onClick={() => setMainView('inspect')}
          className={`pb-2.5 px-3 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
            mainView === 'inspect'
              ? 'border-b-2 border-violet-600 text-violet-700'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>1. Previous Agent Context ({selectedRunId ? `#${selectedRunId.slice(-6)}` : 'Historical'})</span>
        </button>

        <button
          onClick={() => setMainView('reconstructed')}
          className={`pb-2.5 px-3 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
            mainView === 'reconstructed'
              ? 'border-b-2 border-teal-600 text-teal-700'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>2. Reconstructed Context &amp; Diff</span>
          {reconstructedData && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-teal-100 text-teal-800 font-mono">
              Ready
            </span>
          )}
        </button>

        <button
          onClick={() => setMainView('result')}
          className={`pb-2.5 px-3 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
            mainView === 'result'
              ? 'border-b-2 border-amber-600 text-amber-700'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>3. Recovery Execution Result</span>
          {recoveryResult && (
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
              recoveryResult.task_resumed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
            }`}>
              {recoveryResult.task_resumed ? 'Resumed' : 'Rebuilt'}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainView('history')}
          className={`pb-2.5 px-3 font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
            mainView === 'history'
              ? 'border-b-2 border-blue-600 text-blue-700'
              : 'text-[#657189] hover:text-[#172033]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Recovery History ({recoveryHistory.length})</span>
        </button>
      </div>

      {/* VIEW 1: PREVIOUS AGENT CONTEXT (HISTORICAL RUN) */}
      {mainView === 'inspect' && (
        <div className="space-y-5">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
              Loading exact persisted Context Pack from database...
            </div>
          ) : !packData ? (
            <div className="text-center py-16 text-xs text-[#657189] bg-white rounded-2xl border border-[#E7ECF2] shadow-sm">
              No runs found for {selectedAgent.toUpperCase()}. Start collaboration or click Rebuild Context.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Performance Cards */}
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
                    {metrics ? `${metrics.items_retrieved} / ${metrics.total_candidates_evaluated}` : `${pack.requirements?.length || 0} retrieved`}
                  </span>
                </div>

                <div className="bg-white border border-[#E7ECF2] p-3.5 rounded-2xl shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-[#657189] flex items-center space-x-1 mb-1">
                    <ShieldCheck className="w-3 h-3 text-blue-500 mr-1 inline" />
                    <span>Retrieval Mode</span>
                  </span>
                  <span className="font-mono text-blue-700 font-semibold text-[11px] block truncate">
                    {pack.retrieval_mode || 'Hybrid Task-Aware'}
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

              {/* Sub-tab 1: Authoritative Requirements */}
              {activeTab === 'requirements' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-3">
                    <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs">
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

                              {req.provenance && (
                                <div className="mt-2 text-[11px] text-[#657189] flex items-center space-x-1.5">
                                  <span className="text-violet-700 font-semibold">Retrieval Reason:</span>
                                  <span>{req.provenance.retrieval_reason}</span>
                                </div>
                              )}

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
                                    <span className="text-[#657189] block">Freshness</span>
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
                                    <span className="text-[#657189] block">Approval Multiplier</span>
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

                  {/* Task & Section Summary Column */}
                  <div className="space-y-4">
                    <div className="bg-violet-50/50 border border-violet-200 rounded-2xl p-5 shadow-xs">
                      <div className="flex items-center space-x-2 mb-3 text-violet-700">
                        <Sparkles className="w-4 h-4" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-violet-900">
                          Active Task Summary
                        </h3>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Task Description</span>
                          <p className="text-[#172033] font-medium leading-relaxed">
                            {pack.agent_task?.description || runMetadata?.task_description || 'Background strategy & engineering'}
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
                              <span className="text-[#657189]">Auto-bounded from task domain</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#657189] block mb-0.5">Offline Changes</span>
                          <p className="text-[#657189] leading-relaxed">
                            {pack.offline_changes?.length > 0
                              ? `${pack.offline_changes.length} event(s) logged since checkpoint`
                              : 'No drift events since run baseline'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-[#E7ECF2] text-xs text-[#657189] leading-relaxed shadow-xs">
                      <strong className="text-[#172033]">Strict Provenance:</strong> The Context Pack shown here is the exact immutable snapshot persisted in the database for Run #{selectedRunId}. It is never modified retroactively.
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Advisory Context */}
              {activeTab === 'advisory' && (
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                      Advisory Context &amp; Open Proposals
                    </h3>
                    <p className="text-xs text-[#657189] mt-0.5">
                      Proposals pending review. Kept strictly partitioned from authoritative requirements.
                    </p>
                  </div>

                  {openProposals.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#657189] bg-[#F8FAFC] rounded-xl border border-[#E7ECF2]">
                      No open proposals pending decision. All requirements in this pack are approved.
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
                              <span className="text-[11px] font-medium text-[#657189]">by {prop.agent_id?.toUpperCase()}</span>
                            </div>
                          </div>
                          <p className="text-[#172033] font-medium">{prop.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: History */}
              {activeTab === 'history' && (
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                      Historical Context &amp; Superseded Snapshots ({historicalItems.length})
                    </h3>
                    <p className="text-xs text-[#657189] mt-0.5">
                      Archived versions preserved for reference without polluting active context.
                    </p>
                  </div>

                  {historicalItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#657189] bg-[#F8FAFC] rounded-xl border border-[#E7ECF2]">
                      No historical versions archived in this run's scope.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historicalItems.map((item, idx) => (
                        <div
                          key={item.source_id || idx}
                          className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-amber-700">{item.key}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                                v{item.version}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-[#657189]">{item.timestamp}</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-[#E7ECF2] text-xs text-[#657189] font-mono">
                            {typeof item.value === 'object' ? JSON.stringify(item.value) : item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Provenance */}
              {activeTab === 'provenance' && (
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                      Context Provenance &amp; Multi-Factor Scoring
                    </h3>
                    <p className="text-xs text-[#657189] mt-0.5">
                      Audit trail showing why each item was selected into this agent run.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-[#657189] border-b border-[#E7ECF2]">
                        <tr>
                          <th className="p-3">Source ID</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Ver</th>
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
                              <span className="font-mono font-bold text-violet-700">
                                {(prov.relevance_score * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-[#657189]">{prov.retrieval_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 5: Raw JSON */}
              {activeTab === 'raw' && (
                <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                      Authoritative Immutable JSON (Run #{selectedRunId})
                    </span>
                    <button
                      onClick={() => handleCopyJson(pack)}
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
        </div>
      )}

      {/* VIEW 2: RECONSTRUCTED CONTEXT & COMPARISON DIFF */}
      {mainView === 'reconstructed' && (
        <div className="space-y-5">
          {!reconstructedData ? (
            <div className="text-center py-16 bg-white border border-[#E7ECF2] rounded-2xl shadow-xs space-y-3">
              <GitCompare className="w-8 h-8 text-teal-600 mx-auto opacity-60" />
              <p className="text-xs text-[#657189]">
                Click <strong className="text-[#172033]">"Rebuild Context"</strong> in the top controls to reconstruct a fresh Context Pack from the latest approved state.
              </p>
              <button
                onClick={handleRebuild}
                disabled={operating === 'rebuild'}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 shadow-xs cursor-pointer"
              >
                Rebuild Context Now
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Context Diff Banner */}
              <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-teal-700">
                    <GitCompare className="w-5 h-5" />
                    <h2 className="text-sm font-bold text-[#172033]">
                      Context Drift &amp; Rebuild Comparison
                    </h2>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    reconstructedData.validation_outcome === 'PASSED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Validation: {reconstructedData.validation_outcome}
                  </span>
                </div>

                {/* Conflicts Alert Box */}
                {diff?.conflicts_detected?.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                    <span className="font-bold flex items-center space-x-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 inline" />
                      <span>Conflicts &amp; Drift Detected During Interruption ({diff.conflicts_detected.length}):</span>
                    </span>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-amber-800">
                      {diff.conflicts_detected.map((c: string, idx: number) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diff Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Requirements Changed</span>
                    <span className="text-sm font-bold font-mono text-amber-700">
                      {diff?.changed_requirements?.length || 0}
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Sections Updated</span>
                    <span className="text-sm font-bold font-mono text-cyan-700">
                      {diff?.updated_artifact_sections?.length || 0}
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Events Consumed</span>
                    <span className="text-sm font-bold font-mono text-violet-700">
                      {diff?.events_consumed_count || 0} events
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Version Evolution</span>
                    <span className="text-xs font-bold font-mono text-emerald-700">
                      Ctx v{diff?.context_drift?.old_context_version} → v{diff?.context_drift?.new_context_version}
                    </span>
                  </div>
                </div>

                {/* Detailed Changed Requirements List */}
                {diff?.changed_requirements?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wide">
                      Reconciled Requirement Versions
                    </h4>
                    <div className="space-y-2">
                      {diff.changed_requirements.map((req: any) => (
                        <div key={req.key} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-teal-700">{req.key}</span>
                            <p className="text-[11px] text-[#172033] font-medium">{req.title}</p>
                          </div>
                          <div className="flex items-center space-x-2 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700">v{req.old_version}</span>
                            <ArrowRight className="w-3 h-3 text-[#657189]" />
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">v{req.new_version}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reconstructed Pack Raw JSON Toggle */}
              <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                    Reconstructed Authoritative Pack JSON
                  </span>
                  <button
                    onClick={() => handleCopyJson(reconstructedData.reconstructed_context_pack)}
                    className="flex items-center space-x-1.5 text-xs text-teal-600 hover:text-teal-800 font-semibold cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="bg-[#0B1020] border border-[#263244] p-4 rounded-xl font-mono text-[11px] text-teal-300 overflow-x-auto max-h-96">
                  {JSON.stringify(reconstructedData.reconstructed_context_pack, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RECOVERY EXECUTION RESULT */}
      {mainView === 'result' && (
        <div className="space-y-5">
          {!recoveryResult ? (
            <div className="text-center py-16 bg-white border border-[#E7ECF2] rounded-2xl shadow-xs space-y-3">
              <Sparkles className="w-8 h-8 text-amber-600 mx-auto opacity-60" />
              <p className="text-xs text-[#657189]">
                Click <strong className="text-[#172033]">"Restart &amp; Recover Context"</strong> or <strong className="text-[#172033]">"Resume Interrupted Task"</strong> to execute genuine recovery.
              </p>
              <button
                onClick={handleResume}
                disabled={operating === 'resume'}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 shadow-xs cursor-pointer"
              >
                Execute Recovery Now
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-white border border-[#E7ECF2] p-5 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {recoveryResult.task_resumed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                    )}
                    <h2 className="text-sm font-bold text-[#172033]">
                      {recoveryResult.task_resumed ? 'Agent Execution Resumed' : 'Context Reconstructed (No Active Task)'}
                    </h2>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                    recoveryResult.task_resumed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {recoveryResult.recovery_status || (recoveryResult.task_resumed ? 'COMPLETED' : 'NO_TASK_TO_RESUME')}
                  </span>
                </div>

                {/* Honest Outcome Message */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] text-xs text-[#172033] leading-relaxed">
                  <span className="font-bold text-[#657189] block text-[10px] uppercase mb-1">Backend Trace</span>
                  {recoveryResult.message || recoveryResult.recovery_data?.recovery_summary}
                </div>

                {/* Outcome Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Previous Run</span>
                    <span className="font-mono text-xs font-bold text-violet-700 truncate block">
                      {recoveryResult.previous_run_id || 'None'}
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Resulting Run</span>
                    <span className="font-mono text-xs font-bold text-emerald-700 truncate block">
                      {recoveryResult.resulting_run_id || 'None (Not Dispatched)'}
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Events Discovered</span>
                    <span className="font-mono text-xs font-bold text-amber-700 block">
                      {recoveryResult.events_discovered || recoveryResult.recovery_data?.events_discovered || 0} events
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E7ECF2] p-3 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-[#657189] block mb-1">Validation Outcome</span>
                    <span className="font-mono text-xs font-bold text-teal-700 block">
                      {recoveryResult.validation_outcome || 'PASSED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: RECOVERY HISTORY */}
      {mainView === 'history' && (
        <div className="bg-white border border-[#E7ECF2] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                Persisted Recovery History ({recoveryHistory.length})
              </h3>
              <p className="text-xs text-[#657189] mt-0.5">
                Every context rebuild and resumption attempt is permanently audited in SQLite.
              </p>
            </div>
          </div>

          {recoveryHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#657189] bg-[#F8FAFC] rounded-xl border border-[#E7ECF2]">
              No recovery attempts recorded for {selectedAgent.toUpperCase()} yet. Click Rebuild or Resume above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-[#657189] border-b border-[#E7ECF2]">
                  <tr>
                    <th className="p-3">Recovery ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Validation</th>
                    <th className="p-3">Task Resumed</th>
                    <th className="p-3">Prev Run</th>
                    <th className="p-3">Result Run</th>
                    <th className="p-3">Events</th>
                    <th className="p-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7ECF2]">
                  {recoveryHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#F8FAFC] transition">
                      <td className="p-3 font-mono font-bold text-teal-700">{rec.id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          rec.recovery_status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.recovery_status === 'REBUILT_ONLY'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {rec.recovery_status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-amber-700 font-semibold">
                        {rec.validation_outcome}
                      </td>
                      <td className="p-3">
                        {rec.task_resumed ? (
                          <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5 inline mr-1" />
                            <span>Resumed</span>
                          </span>
                        ) : (
                          <span className="text-[#657189]">Rebuilt Only</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[#657189] text-[11px] truncate max-w-[120px]" title={rec.previous_run_id || ''}>
                        {rec.previous_run_id || '-'}
                      </td>
                      <td className="p-3 font-mono text-emerald-700 text-[11px] truncate max-w-[120px]" title={rec.resulting_agent_run_id || ''}>
                        {rec.resulting_agent_run_id || '-'}
                      </td>
                      <td className="p-3 font-mono text-violet-700 font-semibold">
                        {rec.events_consumed_count || 0}
                      </td>
                      <td className="p-3 font-mono text-[#657189] text-[11px]">
                        {new Date(rec.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
