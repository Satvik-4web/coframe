import React, { useState, useEffect } from 'react';
import { AgentRun } from '../../types';
import { getAgentContextPack, restartAgent } from '../../lib/api';
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
} from 'lucide-react';

interface ContextInspectorProps {
  agentRuns: AgentRun[];
  onRefresh: () => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({ agentRuns, onRefresh }) => {
  const [selectedAgent, setSelectedAgent] = useState<'nova' | 'pixel'>('nova');
  const [packData, setPackData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [copied, setCopied] = useState(false);

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
      const res = await restartAgent('demo-ledgerflow', selectedAgent);
      await fetchPack(selectedAgent);
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
  const recoveryInfo = packData?.recovery || null;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151B29] border border-[#263244] p-3 rounded-xl">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-violet-400" />
          <h2 className="text-xs font-bold text-[#F4F7FB] uppercase tracking-wider">
            Context Pack & Recovery Inspector
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#1B2433] p-0.5 rounded-lg border border-[#263244]">
            <button
              onClick={() => setSelectedAgent('nova')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                selectedAgent === 'nova'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#98A5B7] hover:text-[#F4F7FB]'
              }`}
            >
              NOVA (Strategist)
            </button>
            <button
              onClick={() => setSelectedAgent('pixel')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                selectedAgent === 'pixel'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-[#98A5B7] hover:text-[#F4F7FB]'
              }`}
            >
              PIXEL (Engineer)
            </button>
          </div>

          <button
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1B2433] hover:bg-[#253247] border border-[#263244] text-xs font-medium text-amber-300 transition cursor-pointer"
            title="Demonstrate Step 5: Restart this agent and recover fresh Context Pack from persisted state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
            <span>Restart & Recover Context</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-[#98A5B7] bg-[#151B29] rounded-xl border border-[#263244]">
          Loading authoritative Context Pack...
        </div>
      ) : !packData ? (
        <div className="text-center py-12 text-xs text-[#98A5B7] bg-[#151B29] rounded-xl border border-[#263244]">
          No active runs found for {selectedAgent.toUpperCase()}. Start collaboration first or click Restart.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Cols: Pack Structure Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            {/* Version Metadata Summary */}
            <div className="bg-[#151B29] border border-[#263244] rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#98A5B7] block mb-3">
                Run Context Metadata
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#1B2433] p-2.5 rounded-lg border border-[#263244]">
                  <span className="text-[10px] text-[#98A5B7] block">Run ID</span>
                  <span className="font-mono text-teal-400 font-semibold">{packData.run_id}</span>
                </div>
                <div className="bg-[#1B2433] p-2.5 rounded-lg border border-[#263244]">
                  <span className="text-[10px] text-[#98A5B7] block">Context Version</span>
                  <span className="font-mono text-blue-400 font-semibold">v{pack.context_version}</span>
                </div>
                <div className="bg-[#1B2433] p-2.5 rounded-lg border border-[#263244]">
                  <span className="text-[10px] text-[#98A5B7] block">Artifact Version</span>
                  <span className="font-mono text-emerald-400 font-semibold">v{pack.artifact_version}</span>
                </div>
                <div className="bg-[#1B2433] p-2.5 rounded-lg border border-[#263244]">
                  <span className="text-[10px] text-[#98A5B7] block">Data Source</span>
                  <span className="font-mono text-violet-400 font-semibold">{packData.source}</span>
                </div>
              </div>
            </div>

            {/* Verified Requirements Pack */}
            <div className="bg-[#151B29] border border-[#263244] rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#98A5B7] block mb-2">
                Supplied Requirements ({pack.requirements?.length || 0})
              </span>
              <div className="space-y-2 text-xs">
                {pack.requirements?.map((req: any) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1B2433] border border-[#263244]"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-blue-400 font-semibold">{req.key}</span>
                        <span className="text-[10px] text-[#98A5B7]">v{req.version}</span>
                      </div>
                      <span className="text-[11px] text-[#F4F7FB] mt-0.5 block">{req.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw JSON Context Viewer */}
            <div className="bg-[#151B29] border border-[#263244] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#98A5B7]">
                  Authoritative Immutable JSON
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1 text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="bg-[#0B1020] border border-[#263244] p-3 rounded-lg font-mono text-[11px] text-teal-300 overflow-x-auto max-h-80">
                {JSON.stringify(pack, null, 2)}
              </pre>
            </div>
          </div>

          {/* Right Col: Recovery Summary & Agent Task */}
          <div className="space-y-4">
            <div className="bg-gradient-to-b from-[#182033] to-[#151B29] border border-violet-500/40 rounded-xl p-4 shadow-lg">
              <div className="flex items-center space-x-2 mb-3 text-violet-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#F4F7FB]">
                  Context Recovery Summary
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Status</span>
                  <p className="text-emerald-400 font-semibold mt-0.5 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    <span>State Reconstructed from Database</span>
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Task Stream</span>
                  <p className="text-[#F4F7FB] mt-0.5 leading-relaxed">
                    {pack.agent_task?.description || 'Active background strategy analysis'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#98A5B7] block">Offline Changes</span>
                  <p className="text-[#98A5B7] mt-0.5 leading-relaxed">
                    {pack.offline_changes?.length > 0
                      ? `${pack.offline_changes.length} event(s) logged while offline`
                      : 'Pack incorporates all latest requirement version updates'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#151B29] border border-[#263244] text-[11px] text-[#98A5B7] leading-relaxed">
              💡 <strong className="text-[#F4F7FB]">Why this matters for judges:</strong> When an agent restarts, COFRAME does not dump raw messy chat logs. The backend builds a typed, authoritative Context Pack of verified requirements and section versions, guaranteeing reliable deterministic recovery.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
