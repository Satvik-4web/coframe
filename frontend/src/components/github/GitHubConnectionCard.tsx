import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  Link,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { GitHubIcon } from './GitHubIcon';
import { GitHubConnectionStatus } from '../../types';

interface GitHubConnectionCardProps {
  status: GitHubConnectionStatus | null;
  onConnect: (owner: string, repo: string, defaultBranch: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
}

export const GitHubConnectionCard: React.FC<GitHubConnectionCardProps> = ({
  status,
  onConnect,
  onDisconnect,
  onRefresh,
  isLoading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [owner, setOwner] = useState(status?.owner || 'Satvik-4web');
  const [repo, setRepo] = useState(status?.repository_name || 'ledgerflow-product');
  const [branch, setBranch] = useState(status?.default_branch || 'main');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner.trim() || !repo.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConnect(owner.trim(), repo.trim(), branch.trim());
      setIsEditing(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect repository.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfigured = status?.is_configured ?? false;
  const isConnected = status?.connection_status === 'connected';

  return (
    <div className="bg-[#121826] border border-[#263244] rounded-xl p-5 shadow-lg relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-teal-500/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#212C3D]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#182234] border border-[#2B3B52] flex items-center justify-center text-teal-400">
            <GitHubIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-[#F4F7FB]">GitHub Repository Integration</h3>
              {isConnected ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span>Connected</span>
                </span>
              ) : !isConfigured ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Not Configured
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-500/10 text-[#8E9EB5] border border-gray-500/20">
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E9EB5] mt-0.5">
              Publish approved product changes to real branches and pull requests.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-[#8E9EB5] hover:text-[#F4F7FB] transition text-xs"
            title="Refresh Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          {isConnected && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-lg bg-[#182234] hover:bg-[#202E45] border border-[#2B3B52] text-xs font-medium text-[#8E9EB5] hover:text-[#F4F7FB] transition"
            >
              Configure
            </button>
          )}
        </div>
      </div>

      {/* Body States */}
      {!isConfigured ? (
        <div className="mt-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold">
            <ShieldAlert className="w-4 h-4" />
            <span>GitHub Personal Access Token Required</span>
          </div>
          <p className="text-[#8E9EB5] leading-relaxed">
            To enable real GitHub repository synchronization, configure <code className="text-amber-300 font-mono">GITHUB_TOKEN</code> in your backend <code className="text-[#F4F7FB] font-mono">.env</code> file. Tokens are stored securely on the backend only and never exposed to the browser or AI agents.
          </p>
          <div className="text-[11px] text-[#64748B] pt-1">
            Required scopes: <span className="font-mono text-teal-300">repo (contents:write, pull_requests:write)</span>
          </div>
        </div>
      ) : isEditing || !isConnected ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#8E9EB5] uppercase mb-1">
                Owner / Org
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Satvik-4web"
                className="w-full px-3 py-2 rounded-lg bg-[#0C101A] border border-[#2B3B52] text-xs text-[#F4F7FB] focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8E9EB5] uppercase mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. ledgerflow-product"
                className="w-full px-3 py-2 rounded-lg bg-[#0C101A] border border-[#2B3B52] text-xs text-[#F4F7FB] focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#8E9EB5] uppercase mb-1">
                Default Target Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 rounded-lg bg-[#0C101A] border border-[#2B3B52] text-xs text-[#F4F7FB] focus:border-teal-400 focus:outline-none"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center space-x-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            {isConnected && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-[#8E9EB5] hover:text-[#F4F7FB] transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-black font-semibold text-xs transition flex items-center space-x-1.5 shadow"
            >
              <Link className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Verifying Access...' : 'Connect Repository'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <p className="text-[10px] uppercase font-bold text-[#64748B]">Connected Repository</p>
            <a
              href={status?.repository_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 font-mono font-semibold mt-1 flex items-center space-x-1 hover:underline truncate"
            >
              <span className="truncate">{status?.repository_full_name}</span>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            </a>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <p className="text-[10px] uppercase font-bold text-[#64748B]">Authenticated Identity</p>
            <p className="text-[#F4F7FB] font-semibold mt-1">
              {status?.authenticated_user || 'GitHub Bot / PAT'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D]">
            <p className="text-[10px] uppercase font-bold text-[#64748B]">Target Base Branch</p>
            <p className="text-teal-300 font-mono font-semibold mt-1">
              {status?.default_branch || 'main'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#0C101A] border border-[#212C3D] flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Disconnect Target</p>
              <p className="text-[#8E9EB5] text-[11px] mt-0.5">Unlink safely</p>
            </div>
            <button
              onClick={onDisconnect}
              className="px-2.5 py-1 text-[11px] rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition flex items-center space-x-1"
            >
              <Unlink className="w-3 h-3" />
              <span>Unlink</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
