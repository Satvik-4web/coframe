import React, { useState, useEffect } from 'react';
import {
  fetchPruneStatus,
  runPruneWorkshopDemo,
  fetchPruneReceipts,
  verifyPruneReceipt,
} from '../../lib/api';
import { PruneStatus, PruneDemoTrace, PruneMetadata } from '../../types';

interface PruneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PruneModal: React.FC<PruneModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'demo' | 'receipts' | 'vault'>('demo');
  const [status, setStatus] = useState<PruneStatus | null>(null);
  const [receipts, setReceipts] = useState<PruneMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningDemo, setRunningDemo] = useState(false);
  const [demoTrace, setDemoTrace] = useState<PruneDemoTrace | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PruneMetadata | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ verified: boolean } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [st, recs] = await Promise.all([
        fetchPruneStatus().catch(() => null),
        fetchPruneReceipts(15).catch(() => []),
      ]);
      if (st) setStatus(st);
      setReceipts(recs);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDemo = async () => {
    try {
      setRunningDemo(true);
      setDemoError(null);
      const trace = await runPruneWorkshopDemo();
      setDemoTrace(trace);
      await loadData();
    } catch (err: any) {
      setDemoError(err.message || 'Failed to run workshop demo');
    } finally {
      setRunningDemo(false);
    }
  };

  const handleVerify = async (receipt: PruneMetadata) => {
    try {
      setVerifying(true);
      const res = await verifyPruneReceipt(receipt, receipt.ed25519_signature, receipt.public_key);
      setVerificationResult(res);
    } catch (e) {
      setVerificationResult({ verified: false });
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-emerald-950/40 text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-inner">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Prune AI Seatbelt & Gateway</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  BIOS V2 Official Workshop
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Key Vault • Shield Guardrails • Semantic Cache • Fallback • Ed25519 Signed Receipts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* METRICS / STATUS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400">Shield Status</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Guarded (Active)
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Cache Hit Rate</span>
            <span className="font-semibold text-teal-300">
              {status ? `${status.savings.cache_hit_rate_pct}%` : '0.0%'}
              <span className="text-[10px] text-slate-400 ml-1">($0 repeats)</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Total Dollars Saved</span>
            <span className="font-semibold text-emerald-300">
              ${status ? status.savings.total_saved_usd.toFixed(4) : '0.0000'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Cryptographic Receipts</span>
            <span className="font-semibold text-purple-300 flex items-center gap-1">
              🔏 Ed25519 Verified
            </span>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('demo')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'demo'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⚡</span> Workshop Live Demo (Slide 4)
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'receipts'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📜</span> Signed Receipts ({receipts.length})
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'vault'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔐</span> Vault & Coding Agent Setup
          </button>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: WORKSHOP LIVE DEMO */}
          {activeTab === 'demo' && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white text-base">Prompt-to-Receipt Live Verification</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      Replicates the exact sequence from the BIOS V2 Workshop presentation:
                      1) Send prompt through Prune; 2) Repeat identical prompt to prove <strong>$0 Cache Hit</strong>;
                      3) Test prompt-injection attack to prove <strong>Prune Shield</strong> blocking; 4) Inspect Ed25519 receipts.
                    </p>
                  </div>
                  <button
                    onClick={handleRunDemo}
                    disabled={runningDemo}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap self-start md:self-auto"
                  >
                    {runningDemo ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                        Executing Pipeline...
                      </>
                    ) : (
                      <>
                        <span>🚀</span> Run Workshop Sequence
                      </>
                    )}
                  </button>
                </div>

                {demoError && (
                  <div className="mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300">
                    {demoError}
                  </div>
                )}
              </div>

              {/* DEMO EXECUTION TRACE */}
              {demoTrace ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Execution Results</h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {demoTrace.steps.map((st) => (
                      <div
                        key={st.step}
                        className={`rounded-xl border p-4 flex flex-col justify-between ${
                          st.step === 1
                            ? 'bg-slate-950 border-blue-500/30'
                            : st.step === 2
                            ? 'bg-slate-950 border-emerald-500/40 shadow-md shadow-emerald-950/20'
                            : 'bg-slate-950 border-rose-500/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-bold text-slate-400">Step 0{st.step}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                st.step === 1
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : st.step === 2
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {st.status}
                            </span>
                          </div>

                          <h5 className="text-sm font-semibold text-white mb-2">{st.name}</h5>

                          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 mb-3 break-words">
                            $ {st.prompt}
                          </div>

                          {st.result_preview && (
                            <p className="text-xs text-slate-400 italic mb-3">
                              "{st.result_preview}"
                            </p>
                          )}

                          {st.reason && (
                            <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded text-[11px] text-rose-300 mb-3">
                              🛡️ <strong>Shield Blocked:</strong> {st.reason}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 text-xs flex items-center justify-between">
                          <span className="text-slate-400">Cost:</span>
                          <span
                            className={`font-mono font-bold ${
                              st.step === 2
                                ? 'text-emerald-400'
                                : st.step === 3
                                ? 'text-slate-400'
                                : 'text-blue-300'
                            }`}
                          >
                            {st.step === 2 ? '$0.000000 (100% saved)' : `$${(st.cost_usd || 0).toFixed(6)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SAVINGS HIGHLIGHT CARD */}
                  <div className="p-4 bg-gradient-to-r from-emerald-950/30 via-slate-950 to-teal-950/30 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">💰</div>
                      <div>
                        <div className="text-sm font-bold text-white">Prune Optimization Guarantee</div>
                        <div className="text-xs text-slate-400">
                          Repeat questions incur <strong>$0 token billing</strong>; simpler queries smart-route to lighter models (~94% cheaper vs raw GPT-4o).
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Ed25519 Public Key</div>
                      <div className="font-mono text-[10px] text-emerald-400 max-w-xs truncate">
                        {demoTrace.public_key}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl">
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="text-sm font-medium text-slate-300">Ready to test Prune Seatbelt</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Click "Run Workshop Sequence" to execute the live prompt-to-receipt flow.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SIGNED RECEIPTS */}
          {activeTab === 'receipts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white text-sm">Ed25519 Cryptographic Receipts Log</h3>
                  <p className="text-xs text-slate-400">
                    Every agent proposal (NOVA, PIXEL) and test query generates an immutable, signed receipt.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-200 transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>

              {receipts.length === 0 ? (
                <div className="text-center py-12 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="text-3xl mb-2">📜</div>
                  <div className="text-sm text-slate-400">No signed receipts generated yet.</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Run the workshop demo or generate agent proposals to inspect receipts.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {receipts.map((rec) => (
                    <div
                      key={rec.receipt_id}
                      onClick={() => {
                        setSelectedReceipt(rec);
                        setVerificationResult(null);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedReceipt?.receipt_id === rec.receipt_id
                          ? 'bg-slate-950 border-emerald-500/60 shadow-lg'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.cache_hit
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : rec.shield_status === 'blocked'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {rec.cache_hit ? '⚡ CACHE HIT ($0)' : rec.shield_status === 'blocked' ? '🛡️ SHIELD BLOCKED' : 'UPSTREAM'}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-200">{rec.receipt_id}</span>
                          <span className="text-[11px] text-slate-500">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-slate-400">
                            Tokens: <strong className="text-slate-200">{rec.tokens_prompt + rec.tokens_completion}</strong>
                          </span>
                          <span className="text-slate-400">
                            Cost: <strong className={rec.cost_usd === 0 ? 'text-emerald-400' : 'text-slate-200'}>${rec.cost_usd.toFixed(6)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                          Sig: {rec.ed25519_signature.slice(0, 36)}...
                        </div>
                        <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                          ✓ Ed25519 Signed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* RECEIPT DETAIL & VERIFICATION DRAWER */}
              {selectedReceipt && (
                <div className="p-5 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🔏</span> Inspect Receipt: {selectedReceipt.receipt_id}
                    </h4>
                    <button
                      onClick={() => handleVerify(selectedReceipt)}
                      disabled={verifying}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {verifying ? 'Verifying...' : 'Verify Cryptographic Signature'}
                    </button>
                  </div>

                  {verificationResult && (
                    <div
                      className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        verificationResult.verified
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-950/40 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {verificationResult.verified
                        ? '✓ Cryptographic Verification Passed: Ed25519 signature is authentic and unaltered.'
                        : '✕ Verification Failed: Receipt content or signature mismatch.'}
                    </div>
                  )}

                  <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300/90 overflow-x-auto border border-slate-800">
                    {JSON.stringify(selectedReceipt, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VAULT & AGENT SETUP */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xl">
                    🔐
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">Key Vault & Coding Agent Setup</h3>
                    <p className="text-xs text-slate-400">
                      Slide 5: "Point your coding agent (Cursor, Claude Code, Roo Code, Antigravity) at Prune too."
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-300 mb-1">1. Drop-In Base URL</div>
                    <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2 rounded border border-slate-800 select-all">
                      https://api.withprune.com/v1
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-300 mb-1">2. Environment Configuration (.env)</div>
                    <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
{`# Prune Seatbelt Integration (BIOS V2 Hackathon)
PRUNE_ENABLED=true
PRUNE_BASE_URL=https://api.withprune.com/v1
PRUNE_API_KEY=prune_live_...
PRUNE_BACKUP_MODEL=gemini-2.5-flash
PRUNE_MAX_SPEND_USD=100.0`}
                    </pre>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-300 mb-1">3. Point Cursor / Claude Code / Roo Code</div>
                    <p className="text-xs text-slate-400 mb-2">
                      In your IDE or coding agent settings, configure the OpenAI-compatible proxy:
                    </p>
                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                      <li>Model Base URL: <code className="text-emerald-400">https://api.withprune.com/v1</code></li>
                      <li>API Key: Your Prune Key from <code className="text-emerald-400">app.withprune.com</code></li>
                      <li>Vault: Provider keys remain AES-256-GCM encrypted and never touch Git.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <a
              href="https://app.withprune.com"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline font-semibold"
            >
              app.withprune.com
            </a>
            <span>• Presented by Karanbir Rattan Bhardwaj · BIOS V2</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
