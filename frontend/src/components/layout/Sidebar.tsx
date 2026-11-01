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
  Layers,
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
      badgeColor:
        conflictedProposalsCount > 0
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : 'bg-violet-500/20 text-violet-300 border-violet-500/30',
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
      className={`relative border-r border-[#232B4E] bg-[#11152A] text-[#E2E8F0] flex flex-col justify-between select-none shrink-0 transition-all duration-300 ease-in-out h-full overflow-hidden ${
        isCollapsed ? 'w-16 py-4' : 'w-64 py-5'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Header: COFRAME Logo and Wordmark */}
        <div className={`px-4 mb-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-teal-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-violet-900/30 ring-1 ring-white/20 shrink-0">
              C
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-sm text-white font-mono">COFRAME</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    2.0
                  </span>
                </div>
                <span className="text-[10px] text-[#8E9BAE] truncate font-medium">Collaborative Dev Workspace</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Project Card */}
        {!isCollapsed ? (
          <div className="px-3 mb-5">
            <div className="p-3 rounded-xl bg-[#191F3B] border border-[#232B4E] flex items-center justify-between group hover:border-[#384373] transition cursor-pointer">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E9BAE]">Active Project</p>
                </div>
                <h3 className="text-xs font-bold text-white mt-0.5 truncate">LedgerFlow</h3>
                <p className="text-[10px] text-[#8E9BAE] truncate">Enterprise Spend Governance</p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-[#232B4E] flex items-center justify-center text-slate-400 group-hover:text-white transition shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2 mb-4 flex justify-center">
            <div
              className="w-10 h-10 rounded-xl bg-[#191F3B] border border-[#232B4E] flex items-center justify-center relative cursor-pointer"
              title="LedgerFlow (Enterprise Spend Governance)"
            >
              <span className="text-xs font-bold text-white">LF</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 border border-[#11152A]" />
            </div>
          </div>
        )}

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto dark-scroll px-2.5 space-y-1">
          {!isCollapsed && (
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8E9BAE]">
              Workspace Navigation
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
                title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-900/30'
                    : 'text-[#8E9BAE] hover:bg-[#191F3B] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-[#8E9BAE] group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="text-left min-w-0">
                      <span className="block truncate text-xs">{item.label}</span>
                    </div>
                  )}
                </div>

                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Collapsed dot badge */}
                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="w-2 h-2 rounded-full bg-violet-400 absolute top-1.5 right-1.5 border border-[#11152A]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Area: Identity / Branding & Collapse Toggle */}
        <div className="pt-3 px-3 border-t border-[#232B4E] mt-auto">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-[#191F3B]/80 border border-[#232B4E] mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Human + AI</span>
              </div>
              <p className="text-[10px] text-[#8E9BAE] leading-tight">
                Sequential Product Lifecycle · NOVA + PIXEL
              </p>
            </div>
          ) : null}

          {/* Collapse / Expand Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center justify-center p-2 rounded-xl text-[#8E9BAE] hover:text-white hover:bg-[#191F3B] transition cursor-pointer text-xs`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse Sidebar</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
