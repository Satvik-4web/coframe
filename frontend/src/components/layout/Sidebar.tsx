import React, { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Layers,
  GitPullRequest,
  Cpu,
  History,
  Radio,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { HumanIdentity } from '../../types';

export type NavigationTab =
  | 'chat'
  | 'overview'
  | 'preview'
  | 'proposals'
  | 'agents'
  | 'activity'
  | 'context'
  | 'resources'
  | 'governance'
  | 'github'
  | 'workspace'
  | 'canvas';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  pendingProposalsCount: number;
  conflictedProposalsCount: number;
  pendingApprovalsCount?: number;
  identity: HumanIdentity;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  shortcut: string;
  badge?: number;
  badgeConflict?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingProposalsCount,
  conflictedProposalsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalDecisionCount = pendingProposalsCount + conflictedProposalsCount;

  const workspaceItems: NavItem[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: '⌘1' },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: '⌘2' },
    { id: 'preview', label: 'Product Preview', icon: Layers, shortcut: '⌘3' },
    {
      id: 'proposals',
      label: 'Proposals',
      icon: GitPullRequest,
      badge: totalDecisionCount,
      badgeConflict: conflictedProposalsCount > 0,
      shortcut: '⌘4',
    },
  ];

  const systemItems: NavItem[] = [
    { id: 'agents', label: 'AI Team', icon: Cpu, shortcut: '⌘5' },
    { id: 'activity', label: 'Activity & History', icon: History, shortcut: '⌘6' },
    { id: 'context', label: 'Context Inspector', icon: Radio, shortcut: '⌘7' },
  ];

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      currentTab === item.id ||
      (item.id === 'overview' && currentTab === 'workspace') ||
      (item.id === 'preview' && currentTab === 'canvas');

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        title={isCollapsed ? `${item.label} (${item.shortcut})` : undefined}
        className={`w-full flex items-center rounded-lg text-[13px] transition-all duration-150 cursor-pointer group relative ${
          isCollapsed ? 'justify-center h-8 px-0' : 'justify-between h-8 px-2.5'
        } ${
          isActive
            ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.06)]'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/65'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            strokeWidth={1.75}
            className={`w-4 h-4 shrink-0 transition-colors ${
              isActive ? 'text-[#2563EB]' : 'text-slate-400 group-hover:text-slate-700'
            }`}
          />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-1.5 shrink-0">
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`text-[11px] font-mono font-medium px-1.5 py-0.2 rounded-md ${
                  item.badgeConflict
                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                    : isActive
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15'
                    : 'bg-slate-200/70 text-slate-700'
                }`}
              >
                {item.badge}
              </span>
            )}
            <span
              className={`text-[10px] font-mono transition-opacity ${
                isActive ? 'text-slate-400' : 'text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
            >
              {item.shortcut}
            </span>
          </div>
        )}

        {isCollapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className={`w-2 h-2 rounded-full absolute top-1.5 right-1.5 ring-2 ring-[#F1F4F8] ${
              item.badgeConflict ? 'bg-rose-500' : 'bg-[#2563EB]'
            }`}
          />
        )}
      </button>
    );
  };

  return (
    <aside
      className={`relative flex flex-col justify-between select-none shrink-0 transition-all duration-200 ease-out h-full overflow-hidden glass-sidebar border-r border-slate-900/[0.075] ${
        isCollapsed ? 'w-16 py-3' : 'w-60 py-3.5'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Wordmark */}
        <div className={`px-3.5 mb-3 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(15,23,42,0.18)]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1.2" fill="#FFFFFF" />
                <rect x="9" y="2" width="5" height="5" rx="1.2" fill="#93C5FD" />
                <rect x="2" y="9" width="5" height="5" rx="1.2" fill="#93C5FD" />
                <rect x="9" y="9" width="5" height="5" rx="1.2" fill="#FFFFFF" fillOpacity="0.45" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[13px] text-slate-900 tracking-[-0.015em] leading-none">
                  COFRAME
                </span>
                <span className="text-[11px] text-slate-500 truncate mt-1 leading-none">
                  Product workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Active Project Selector Pill */}
        {!isCollapsed ? (
          <div className="px-3 mb-3.5">
            <button
              type="button"
              onClick={() => onSelectTab('preview')}
              className="w-full text-left px-2.5 py-2 rounded-xl bg-white/90 hover:bg-white border border-slate-900/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 cursor-pointer group flex items-center justify-between"
              title="Open LedgerFlow canvas"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] font-medium text-slate-500">LedgerFlow</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">Spend Governance</div>
              </div>
              <div className="w-6 h-6 rounded-md bg-slate-50 group-hover:bg-slate-100 border border-slate-900/[0.06] flex items-center justify-center text-slate-400 group-hover:text-slate-700 transition shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        ) : (
          <div className="px-2 mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => onSelectTab('preview')}
              className="w-9 h-9 rounded-xl bg-white border border-slate-900/[0.08] flex items-center justify-center relative cursor-pointer shadow-2xs hover:border-slate-900/15 transition"
              title="LedgerFlow (Spend Governance)"
            >
              <span className="text-[11px] font-semibold text-slate-900">LF</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-2 ring-[#F1F4F8]" />
            </button>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-3 sidebar-scroll space-y-3.5">
          <div>
            {!isCollapsed && (
              <div className="px-2.5 mb-1 text-[11px] font-medium text-slate-400">
                Workspace
              </div>
            )}
            <div className="space-y-0.5">{workspaceItems.map(renderNavItem)}</div>
          </div>

          <div>
            {!isCollapsed && (
              <div className="px-2.5 mb-1 text-[11px] font-medium text-slate-400">
                Agents & State
              </div>
            )}
            <div className="space-y-0.5">{systemItems.map(renderNavItem)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 px-3 mt-auto border-t border-slate-900/[0.06] flex flex-col gap-1">
          {!isCollapsed && (
            <div className="px-2 py-1 text-[11px] text-slate-500 flex items-center justify-between">
              <span>NOVA · PIXEL</span>
              <span className="font-mono text-[10px] text-slate-400">sequential</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white/70 transition cursor-pointer text-xs"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
