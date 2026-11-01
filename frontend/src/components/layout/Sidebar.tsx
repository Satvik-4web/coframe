import React, { useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  History,
  MessageSquare,
  GitPullRequest,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Shield,
  GitBranch,
  ChevronDown,
} from 'lucide-react';
import { HumanIdentity } from '../../types';

export type NavigationTab =
  | 'workspace'
  | 'history'
  | 'agents_context'
  | 'overview'
  | 'preview'
  | 'canvas'
  | 'proposals'
  | 'agents'
  | 'activity'
  | 'context'
  | 'chat'
  | 'resources'
  | 'governance'
  | 'github';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  pendingProposalsCount: number;
  conflictedProposalsCount: number;
  pendingApprovalsCount?: number;
  identity: HumanIdentity;
  onToggleChatDrawer?: () => void;
  isChatDrawerOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingProposalsCount,
  conflictedProposalsCount,
  onToggleChatDrawer,
  isChatDrawerOpen = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);

  const totalDecisionCount = pendingProposalsCount + conflictedProposalsCount;

  // Normalized active tab matching for the 3 primary destinations
  const isWorkspaceActive =
    currentTab === 'workspace' ||
    currentTab === 'overview' ||
    currentTab === 'preview' ||
    currentTab === 'canvas';

  const isHistoryActive = currentTab === 'history' || currentTab === 'activity';

  const isAgentsContextActive =
    currentTab === 'agents_context' || currentTab === 'agents' || currentTab === 'context';

  // 3 Primary Destinations
  const primaryNavItems = [
    {
      id: 'workspace' as NavigationTab,
      isActive: isWorkspaceActive,
      label: 'Workspace',
      description: 'Live prototype & decisions',
      icon: LayoutDashboard,
      badge: totalDecisionCount > 0 ? totalDecisionCount : undefined,
      badgeColor:
        conflictedProposalsCount > 0
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
          : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      onClick: () => onSelectTab('workspace'),
    },
    {
      id: 'history' as NavigationTab,
      isActive: isHistoryActive,
      label: 'History',
      description: 'Full audit log & changes',
      icon: History,
      onClick: () => onSelectTab('history'),
    },
    {
      id: 'agents_context' as NavigationTab,
      isActive: isAgentsContextActive,
      label: 'Agents & Context',
      description: 'NOVA, PIXEL & requirements',
      icon: Bot,
      onClick: () => onSelectTab('agents_context'),
    },
  ];

  // Secondary Tools (Preserved for backwards-compatibility)
  const secondaryNavItems = [
    {
      id: 'proposals' as NavigationTab,
      label: 'Proposals Queue',
      icon: GitPullRequest,
      badge: totalDecisionCount > 0 ? totalDecisionCount : undefined,
    },
    {
      id: 'resources' as NavigationTab,
      label: 'Shared Creation Shelf',
      icon: Layers,
    },
    {
      id: 'governance' as NavigationTab,
      label: 'Governance Matrix',
      icon: Shield,
    },
    {
      id: 'github' as NavigationTab,
      label: 'GitHub Integration',
      icon: GitBranch,
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

        {/* Quick Agent Chat Drawer Button */}
        {onToggleChatDrawer && (
          <div className="px-3 mb-4">
            <button
              type="button"
              onClick={onToggleChatDrawer}
              className={`w-full py-2 px-3 rounded-xl font-semibold text-xs transition flex items-center justify-between cursor-pointer border ${
                isChatDrawerOpen
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/40'
                  : 'bg-[#191F3B] hover:bg-[#20274B] text-violet-300 border-[#2A345E]'
              }`}
              title="Toggle Agent Chat Drawer"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-violet-400" />
                {!isCollapsed && <span>Agent Chat</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono bg-violet-900/50 px-1.5 py-0.5 rounded text-violet-200">
                  Slide
                </span>
              )}
            </button>
          </div>
        )}

        {/* 3 Primary Navigation Destinations */}
        <div className="px-3 space-y-1 mb-4">
          {!isCollapsed && (
            <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#63708E]">
              Primary Destinations
            </div>
          )}

          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer group ${
                  item.isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-900/20'
                    : 'text-[#94A3B8] hover:bg-[#1A203D] hover:text-white'
                }`}
                title={item.label}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition ${
                      item.isActive ? 'text-white' : 'text-[#64748B] group-hover:text-violet-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <div className="text-left min-w-0">
                      <div className="text-xs truncate leading-snug">{item.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          item.isActive ? 'text-violet-200' : 'text-[#64748B]'
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  )}
                </div>

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-700 text-white'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Tools Collapsible Section */}
        {!isCollapsed && (
          <div className="px-3 flex-1 overflow-y-auto space-y-1 pt-2 border-t border-[#232B4E]">
            <button
              type="button"
              onClick={() => setShowMoreTools(!showMoreTools)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#63708E] hover:text-[#94A3B8] transition cursor-pointer"
            >
              <span>Workspace Tools</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showMoreTools ? 'rotate-180' : ''}`}
              />
            </button>

            {showMoreTools && (
              <div className="space-y-1 pt-1 animate-fadeIn">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-[#1F274B] text-white font-semibold'
                          : 'text-[#8E9BAE] hover:bg-[#1A203D] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapse / Expand Toggle Button */}
      <div className="px-3 pt-3 border-t border-[#232B4E]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-[#64748B] hover:text-white hover:bg-[#1A203D] transition cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
