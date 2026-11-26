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
    <div className="bg-[#1A202C] border border-[#E5EAF0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF0]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-300">
            <GitHubIcon className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-[#E7EDF7]">GitHub Repository Integration</h3>
              {isConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/25 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <span>Connected</span>
                </span>
              ) : !isConfigured ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  Not Configured
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1D2633] text-[#A3B0C4] border border-[#303A4B]">
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-[#A3B0C4] mt-0.5">
              Publish approved product changes to real branches and pull requests.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[#1A202C] hover:bg-[#141A24] border border-[#E5EAF0] text-[#A3B0C4] hover:text-[#E7EDF7] shadow-xs transition text-xs cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
          {isConnected && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-lg bg-[#1A202C] hover:bg-[#141A24] border border-[#E5EAF0] text-xs font-semibold text-[#E7EDF7] shadow-xs transition cursor-pointer"
            >
              Configure
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!isEditing && isConnected ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-[#141A24] border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#A3B0C4] block mb-0.5">Target Repository</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#E7EDF7] truncate">
                {status?.owner}/{status?.repository_name}
              </span>
              {status?.repository_url && (
                <a
                  href={status.repository_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:text-teal-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141A24] border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#A3B0C4] block mb-0.5">Default Branch</span>
            <span className="text-xs font-bold font-mono text-[#E7EDF7]">
              {status?.default_branch || 'main'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141A24] border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#A3B0C4] block mb-0.5">Auth Status</span>
            <span className="text-xs font-bold text-teal-300 capitalize">
              {status?.authenticated_user ? `Signed in as ${status.authenticated_user}` : 'Connected'}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#E7EDF7] mb-1">Repository Owner</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
                placeholder="e.g. Satvik-4web"
                className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#E5EAF0] text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#E7EDF7] mb-1">Repository Name</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                placeholder="e.g. coframe"
                className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#E5EAF0] text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#E7EDF7] mb-1">Default Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                placeholder="main"
                className="w-full px-3 py-2 rounded-lg bg-[#1A202C] border border-[#E5EAF0] text-[#E7EDF7] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#A3B0C4] hover:bg-[#1D2633] transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Connecting...' : 'Save & Connect Repository'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
