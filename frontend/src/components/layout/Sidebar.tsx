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
  FolderOpen,
  ShieldCheck,
  GitBranch,
  Settings,
} from 'lucide-react';
import { HumanIdentity } from '../../types';

export type NavigationTab =
  | 'settings'
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
  isMobileOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingProposalsCount,
  conflictedProposalsCount,
  isMobileOpen = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalDecisionCount = pendingProposalsCount + conflictedProposalsCount;

  const mainNavItems = [
    {
      id: 'chat',
      label: 'Chat',
      description: 'Workspace conversation',
      icon: MessageSquare,
      shortcut: 'Ctrl+Shift+1',
    },
    {
      id: 'overview',
      label: 'Overview',
      description: 'Product command centre',
      icon: LayoutDashboard,
      shortcut: 'Ctrl+Shift+2',
    },
    {
      id: 'preview',
      label: 'Product Preview',
      description: 'LedgerFlow live canvas',
      icon: Palette,
      shortcut: 'Ctrl+Shift+3',
    },
    {
      id: 'proposals',
      label: 'Proposals',
      description: 'Requirements & code reviews',
      icon: GitPullRequest,
      badge: totalDecisionCount,
      badgeConflict: conflictedProposalsCount > 0,
      shortcut: 'Ctrl+Shift+4',
    },
    {
      id: 'agents',
      label: 'AI Team',
      description: 'NOVA & PIXEL management',
      icon: Bot,
      shortcut: 'Ctrl+Shift+5',
    },
    {
      id: 'activity',
      label: 'Activity & History',
      description: 'Event audit trail',
      icon: History,
      shortcut: 'Ctrl+Shift+6',
    },
    {
      id: 'context',
      label: 'Context Inspector',
      description: 'Immutable context pack',
      icon: Radio,
      shortcut: 'Ctrl+Shift+7',
    },
    { id: 'settings', label: 'Workspace settings', description: 'Connections and setup', icon: Settings, shortcut: '' },
    { id: 'resources', label: 'Files & knowledge', description: 'Shared project resources', icon: FolderOpen, shortcut: '' },
    { id: 'governance', label: 'Approvals', description: 'Review team decisions', icon: ShieldCheck, shortcut: '' },
    { id: 'github', label: 'Repository', description: 'Branches and pull requests', icon: GitBranch, shortcut: '' },
  ];

  return (
    <aside
      className={`fixed left-0 top-[68px] bottom-0 z-50 md:relative md:top-auto md:bottom-auto md:z-auto flex flex-col justify-between select-none shrink-0 transition-all duration-200 ease-out md:h-full overflow-hidden bg-[radial-gradient(ellipse_at_20%_0%,rgba(54,113,190,.18),transparent_42%),linear-gradient(180deg,#101b2e_0%,#0e192b_100%)] border-r border-[#293c58] shadow-[8px_0_26px_rgba(10,22,40,.12)] ${isMobileOpen ? 'flex' : 'hidden md:flex'} ${
        isCollapsed ? 'w-[72px] py-4' : 'w-[260px] py-5'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Brand Header ─────────────────────────────────── */}
        <div className={`px-4 mb-7 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[13px] bg-gradient-to-br from-[#60A5FA] to-[#0E7490] flex items-center justify-center font-black text-white text-lg shadow-[0_8px_22px_rgba(37,99,235,.25)] shrink-0 ring-1 ring-white/15">
              C
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[15px] text-white tracking-[-.03em]">COFRAME</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-[#22354F] text-sky-200 border border-[#334B6B]">
                    2.0
                  </span>
                </div>
                <span className="text-[11px] text-[#91A4BE] truncate">
                  Human + AI workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Project Card ──────────────────────────── */}
        {!isCollapsed ? (
          <div className="px-3 mb-7">
            <button type="button"
              onClick={() => onSelectTab('preview')}
              className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-[#202C3D] to-[#182331] hover:from-[#284466] hover:to-[#203652] border border-[#37506C] transition-colors duration-150 cursor-pointer group flex items-center justify-between shadow-[0_12px_28px_-18px_#000]"
              title="Current project: LedgerFlow (click to open canvas)"
            >
              <div className="min-w-0 pr-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A7CFFF]">
                    Current project
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white truncate mt-2">
                  LedgerFlow
                </h3>
                <p className="text-[11px] text-[#9BAFC7] truncate mt-0.5">
                  Open product canvas
                </p>
              </div>
              <div className="w-6 h-6 rounded-md bg-[#2A4360] flex items-center justify-center text-[#A8C7EB] group-hover:text-white transition shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        ) : (
          <div className="px-2 mb-3 flex justify-center">
            <button type="button"
              onClick={() => onSelectTab('preview')}
              className="w-9 h-9 rounded-lg bg-[#1C3049] border border-[#334B68] flex items-center justify-center relative cursor-pointer hover:bg-[#27415D] transition"
              title="LedgerFlow (Spend Governance)"
            >
              <span className="text-[11px] font-bold text-white">LF</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-[#111720]" />
            </button>
          </div>
        )}

        {/* ── Navigation List ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 dark-scroll">
          {!isCollapsed && (
            <div className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#8499B5]">
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
                aria-current={isActive ? 'page' : undefined}
                title={item.description}
                className={`w-full flex items-center rounded-xl text-sm transition-all duration-150 cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#24476d] to-[#203c5c] text-white font-semibold shadow-[inset_3px_0_0_#67a5ff,0_5px_16px_rgba(3,12,25,.18)] ring-1 ring-white/[.06]'
                    : 'text-[#A7B7CB] hover:text-white hover:bg-[#1A202C]/[.055]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-[#9bc4ff]' : 'text-[#8AA2BD] group-hover:text-[#dceaff]'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate text-[13px]">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : item.badgeConflict
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}

                {/* Collapsed dot badge */}
                {isCollapsed && 'badge' in item && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`w-2 h-2 rounded-full absolute top-1 right-1 ring-2 ring-[#111720] ${
                      item.badgeConflict ? 'bg-rose-500' : 'bg-blue-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Footer / Collapse ───────────────────────────── */}
        <div className="pt-2 px-2 mt-auto border-t border-[#25344A]">
          {!isCollapsed && (
            <div className="p-2.5 mb-2 rounded-xl bg-[#1B2B40] border border-[#30445E]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span>HUMAN + AI</span>
              </div>
              <p className="text-[10px] text-[#A0B0C7] mt-0.5 leading-snug">
                Sequential Product Lifecycle · NOVA + PIXEL
              </p>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-1.5 rounded-lg text-[#8DA3BE] hover:text-white hover:bg-[#20334B] transition cursor-pointer text-xs"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#9BAEC8]">
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
