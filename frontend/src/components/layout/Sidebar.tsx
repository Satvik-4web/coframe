import React, { useState } from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  Palette,
  GitPullRequest,
  Bot,
  History,
  Radio,
  ChevronLeft,
  ChevronRight,
  Sparkles,
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

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingProposalsCount,
  conflictedProposalsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalDecisionCount = pendingProposalsCount + conflictedProposalsCount;

  const mainNavItems = [
    {
      id: 'chat',
      label: 'Chat',
      description: 'Workspace conversation',
      icon: MessageSquare,
      shortcut: '⌘1',
    },
    {
      id: 'overview',
      label: 'Overview',
      description: 'Product command centre',
      icon: LayoutDashboard,
      shortcut: '⌘2',
    },
    {
      id: 'preview',
      label: 'Product Preview',
      description: 'LedgerFlow live canvas',
      icon: Palette,
      shortcut: '⌘3',
    },
    {
      id: 'proposals',
      label: 'Proposals',
      description: 'Requirements & code reviews',
      icon: GitPullRequest,
      badge: totalDecisionCount,
      badgeConflict: conflictedProposalsCount > 0,
      shortcut: '⌘4',
    },
    {
      id: 'agents',
      label: 'AI Team',
      description: 'NOVA & PIXEL management',
      icon: Bot,
      shortcut: '⌘5',
    },
    {
      id: 'activity',
      label: 'Activity & History',
      description: 'Event audit trail',
      icon: History,
      shortcut: '⌘6',
    },
    {
      id: 'context',
      label: 'Context Inspector',
      description: 'Immutable context pack',
      icon: Radio,
      shortcut: '⌘7',
    },
  ];

  return (
    <aside
      className={`relative flex flex-col justify-between select-none shrink-0 transition-all duration-200 ease-out h-full overflow-hidden bg-[#0C1021] border-r border-[#1A223D] ${
        isCollapsed ? 'w-16 py-3' : 'w-60 py-4'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Brand Header ─────────────────────────────────── */}
        <div className={`px-3.5 mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0 ring-1 ring-white/10">
              C
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white tracking-tight">COFRAME</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-[#1C2442] text-indigo-300 border border-[#2B365F]">
                    2.0
                  </span>
                </div>
                <span className="text-[10px] text-[#7888AB] truncate">
                  Collaborative Dev Workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Project Card ──────────────────────────── */}
        {!isCollapsed ? (
          <div className="px-2.5 mb-4">
            <div
              onClick={() => onSelectTab('preview')}
              className="p-3 rounded-xl bg-[#141A33] hover:bg-[#19213F] border border-[#222C52] transition-colors duration-150 cursor-pointer group flex items-center justify-between"
              title="Current project: LedgerFlow (click to open canvas)"
            >
              <div className="min-w-0 pr-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                    ACTIVE PROJECT
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white truncate mt-1">
                  LedgerFlow
                </h3>
                <p className="text-[10px] text-[#8695B7] truncate mt-0.5">
                  Enterprise Spend Governance
                </p>
              </div>
              <div className="w-6 h-6 rounded-md bg-[#1F284B] flex items-center justify-center text-[#8695B7] group-hover:text-white transition shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2 mb-3 flex justify-center">
            <div
              onClick={() => onSelectTab('preview')}
              className="w-9 h-9 rounded-lg bg-[#141A33] border border-[#222C52] flex items-center justify-center relative cursor-pointer hover:bg-[#19213F] transition"
              title="LedgerFlow (Spend Governance)"
            >
              <span className="text-[11px] font-bold text-white">LF</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-[#0C1021]" />
            </div>
          </div>
        )}

        {/* ── Navigation List ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 dark-scroll">
          {!isCollapsed && (
            <div className="px-2 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#57688F]">
              Workspace
            </div>
          )}

          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'overview' && currentTab === 'workspace') ||
              (item.id === 'preview' && currentTab === 'canvas');

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavigationTab)}
                title={isCollapsed ? `${item.label} (${item.shortcut})` : undefined}
                className={`w-full flex items-center rounded-lg text-xs transition-colors duration-150 cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/35 to-blue-600/15 text-white font-medium border-l-2 border-indigo-400 shadow-sm'
                    : 'text-[#8C9BBF] hover:text-white hover:bg-[#141A33]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-[#62739B] group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate text-xs">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-indigo-500 text-white'
                            : item.badgeConflict
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono transition-opacity ${
                        isActive ? 'text-white/40' : 'text-[#506085] opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  </div>
                )}

                {/* Collapsed dot badge */}
                {isCollapsed && 'badge' in item && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`w-2 h-2 rounded-full absolute top-1 right-1 ring-2 ring-[#0C1021] ${
                      item.badgeConflict ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Footer / Collapse ───────────────────────────── */}
        <div className="pt-2 px-2 mt-auto border-t border-[#1A223D]">
          {!isCollapsed && (
            <div className="p-2.5 mb-2 rounded-xl bg-[#141A33] border border-[#222C52]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>HUMAN + AI</span>
              </div>
              <p className="text-[10px] text-[#7888AB] mt-0.5 leading-snug">
                Sequential Product Lifecycle · NOVA + PIXEL
              </p>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-1.5 rounded-lg text-[#62739B] hover:text-white hover:bg-[#141A33] transition cursor-pointer text-xs"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#7888AB]">
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
