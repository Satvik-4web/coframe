import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { MCPToolManifest, HumanIdentity } from '../../types';
import { fetchMCPTools, callMCPTool } from '../../lib/api';

interface MCPToolExplorerProps {
  identity: HumanIdentity;
  onNavigateTab?: (tab: any, param?: string) => void;
}

export const MCPToolExplorer: React.FC<MCPToolExplorerProps> = ({ identity, onNavigateTab }) => {
  const [tools, setTools] = useState<MCPToolManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPToolManifest | null>(null);
  const [testPayload, setTestPayload] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const data = await fetchMCPTools();
      setTools(data);
      if (data.length > 0 && !selectedTool) {
        setSelectedTool(data[0]);
        initDefaultPayload(data[0]);
      }
    } catch (err) {
      console.error('Failed to load MCP tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const initDefaultPayload = (tool: MCPToolManifest) => {
    const defaultArgs: Record<string, any> = {
      project_id: 'demo-ledgerflow',
    };
    if (tool.name === 'create_proposal') {
      defaultArgs.agent_id = 'pixel';
      defaultArgs.summary = 'MCP-driven proposal test';
      defaultArgs.reasoning = 'Automated validation via COFRAME MCP client';
      defaultArgs.affected_requirements = ['REQ_AUDIENCE'];
      defaultArgs.target_sections = ['hero'];
      defaultArgs.changes = {
        operations: [{ op: 'update_hero', fields: { headline: 'Generated via MCP protocol' } }],
      };
    } else if (tool.name === 'get_artifact') {
      defaultArgs.section_key = 'hero';
    } else if (tool.name === 'send_workspace_message') {
      defaultArgs.recipient = 'maya';
      defaultArgs.message = 'Hello from MCP client!';
    } else if (tool.name === 'request_human_decision') {
      defaultArgs.title = 'Audit Threshold Elevation';
      defaultArgs.explanation = 'Requesting sign-off for enterprise tiering';
      defaultArgs.escalation_reason = 'Enterprise policy bounds exceeded';
      defaultArgs.expected_impact = 'high';
      defaultArgs.assigned_decider_id = 'alex';
    } else if (tool.name === 'delegate_to_agent') {
      defaultArgs.target_agent = 'pixel';
      defaultArgs.task = 'Refactor metric cards layout';
      defaultArgs.acceptance_criteria = ['Grid alignment verified', 'Responsive test passed'];
    }
    setTestPayload(JSON.stringify(defaultArgs, null, 2));
    setExecutionResult(null);
    setExecutionError(null);
  };

  const handleSelectTool = (tool: MCPToolManifest) => {
    setSelectedTool(tool);
    initDefaultPayload(tool);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;
    setExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);
    try {
      let args: any = {};
      try {
        args = JSON.parse(testPayload);
      } catch (err: any) {
        throw new Error(`Invalid JSON arguments: ${err.message}`);
      }

      const res = await callMCPTool(
        selectedTool.name,
        args,
        identity || 'alex',
        'human'
      );
      setExecutionResult(res);
    } catch (err: any) {
      setExecutionError(err.message || 'MCP tool execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5EAF0] rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5EAF0]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 border border-teal-100">
              <Cpu className="w-4 h-4 text-teal-700" />
            </span>
            <h2 className="text-base font-bold text-[#172033]">
              COFRAME Model Context Protocol (MCP) Server
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              Active ({tools.length} Tools)
            </span>
          </div>
          <p className="text-xs text-[#657189] mt-1">
            Standardized tool interfaces allowing external agents, IDEs, and local models to inspect context, query artifacts, and dispatch actions safely.
          </p>
        </div>

        <button
          onClick={loadTools}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#657189] bg-white border border-[#E5EAF0] rounded-xl hover:bg-[#F8FAFC] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          Refresh Tools
        </button>
      </div>

      {/* Tool Browser & Interactive Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tool List */}
        <div className="lg:col-span-4 space-y-2 border-r border-[#F0F3F7] pr-0 lg:pr-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#657189] mb-2">
            Registered Workspace Tools
          </p>
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {tools.map((tool) => {
              const isSelected = selectedTool?.name === tool.name;
              return (
                <button
                  key={tool.name}
                  onClick={() => handleSelectTool(tool)}
                  className={`w-full text-left p-3 rounded-xl transition text-xs flex flex-col gap-1 border ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-200 text-teal-950 font-semibold shadow-2xs'
                      : 'bg-[#F8FAFC] border-transparent hover:border-[#E5EAF0] text-[#172033]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs">{tool.name}</span>
                    <span className="text-[10px] uppercase font-bold text-[#657189] bg-white px-1.5 py-0.5 rounded border border-[#E5EAF0]">
                      {tool.allowed_callers.join(', ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#657189] line-clamp-1">{tool.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Tool Details and Live Runner */}
        <div className="lg:col-span-8 space-y-4">
          {selectedTool ? (
            <div className="space-y-4">
              {/* Tool Header */}
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E5EAF0]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-mono text-[#172033]">{selectedTool.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#657189]">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Authorized callers: </span>
                    <span className="font-semibold text-[#172033]">
                      {selectedTool.allowed_callers.join(', ')}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#657189] mt-1.5 leading-relaxed">
                  {selectedTool.description}
                </p>
              </div>

              {/* JSON Parameters Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#657189]">
                    Arguments (JSON Payload)
                  </span>
                  <button
                    onClick={() => initDefaultPayload(selectedTool)}
                    className="text-[11px] text-teal-700 hover:underline font-medium"
                  >
                    Reset Defaults
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 border border-slate-800"
                />
              </div>

              {/* Execute Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleExecuteTool}
                  disabled={executing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {executing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  Execute MCP Tool
                </button>
              </div>

              {/* Execution Output */}
              {executionResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Response Payload (200 OK)</span>
                    </div>
                    {onNavigateTab && (executionResult?.result?.proposal_id || executionResult?.result?.proposal?.id) && (
                      <button
                        onClick={() => onNavigateTab('proposals', executionResult?.result?.proposal_id || executionResult?.result?.proposal?.id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>View Created Proposal</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <pre className="p-4 bg-slate-900 text-emerald-300 text-xs rounded-xl font-mono overflow-x-auto max-h-56 border border-slate-800">
                    {JSON.stringify(executionResult, null, 2)}
                  </pre>
                </div>
              )}

              {executionError && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Execution Error</span>
                  </div>
                  <div className="p-3 bg-red-50 text-red-900 text-xs rounded-xl border border-red-200">
                    {executionError}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-[#657189] text-xs">
              Select an MCP tool from the left to inspect its schema and execute test payloads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
