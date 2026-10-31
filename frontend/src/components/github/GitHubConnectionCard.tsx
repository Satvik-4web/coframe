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
    <div className="bg-white border border-[#E5EAF0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF0]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <GitHubIcon className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-[#172033]">GitHub Repository Integration</h3>
              {isConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <span>Connected</span>
                </span>
              ) : !isConfigured ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[#657189] border border-slate-200">
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-[#657189] mt-0.5">
              Publish approved product changes to real branches and pull requests.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-[#E5EAF0] text-[#657189] hover:text-[#172033] shadow-xs transition text-xs cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
          {isConnected && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E5EAF0] text-xs font-semibold text-[#172033] shadow-xs transition cursor-pointer"
            >
              Configure
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!isEditing && isConnected ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#657189] block mb-0.5">Target Repository</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#172033] truncate">
                {status?.owner}/{status?.repository_name}
              </span>
              {status?.repository_url && (
                <a
                  href={status.repository_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 hover:text-teal-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#657189] block mb-0.5">Default Branch</span>
            <span className="text-xs font-bold font-mono text-[#172033]">
              {status?.default_branch || 'main'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E5EAF0]">
            <span className="text-[11px] font-medium text-[#657189] block mb-0.5">Auth Status</span>
            <span className="text-xs font-bold text-teal-700 capitalize">
              {status?.authenticated_user ? `Signed in as ${status.authenticated_user}` : 'Connected'}
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">Repository Owner</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
                placeholder="e.g. Satvik-4web"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5EAF0] text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">Repository Name</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                placeholder="e.g. coframe"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5EAF0] text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">Default Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                required
                placeholder="main"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5EAF0] text-[#172033] text-xs focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#657189] hover:bg-slate-100 transition cursor-pointer"
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
