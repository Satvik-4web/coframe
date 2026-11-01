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
    },
    {
      id: 'overview',
      label: 'Overview',
      description: 'Product command centre',
      icon: LayoutDashboard,
    },
    {
      id: 'preview',
      label: 'Product Preview',
      description: 'LedgerFlow live canvas',
      icon: Palette,
    },
    {
      id: 'proposals',
      label: 'Proposals',
      description: 'Requirements & code reviews',
      icon: GitPullRequest,
      badge: totalDecisionCount,
      badgeConflict: conflictedProposalsCount > 0,
    },
    {
      id: 'agents',
      label: 'AI Team',
      description: 'NOVA & PIXEL management',
      icon: Bot,
    },
    {
      id: 'activity',
      label: 'Activity & History',
      description: 'Event audit trail',
      icon: History,
    },
    {
      id: 'context',
      label: 'Context Inspector',
      description: 'Immutable context pack',
      icon: Radio,
    },
  ];

  return (
    <aside
      className={`relative flex flex-col select-none shrink-0 transition-all duration-300 ease-in-out h-full overflow-hidden ${
        isCollapsed ? 'w-16 py-4' : 'w-60 py-5'
      }`}
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid #E8EAF2',
        color: '#172033',
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Logo ─────────────────────────────────────────── */}
        <div className={`px-4 mb-5 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          {/* Logo mark: indigo → violet */}
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center font-black text-white text-sm shrink-0"
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
            }}
          >
            C
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-sm text-[#172033] font-mono">COFRAME</span>
                <span
                  className="text-[9px] font-bold px-1.5 rounded"
                  style={{
                    background: 'rgba(79,70,229,0.09)',
                    color: '#4F46E5',
                    border: '1px solid rgba(79,70,229,0.2)',
                    paddingTop: '1px',
                    paddingBottom: '1px',
                  }}
                >
                  2.0
                </span>
              </div>
              <span className="text-[10px] truncate font-medium text-[#94A3B8]">
                Collaborative Dev Workspace
              </span>
            </div>
          )}
        </div>

        {/* ── Active Project Card ──────────────────────────── */}
        {!isCollapsed ? (
          <div className="px-3 mb-5">
            <div
              className="p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150 group"
              style={{ background: '#F7F8FC', border: '1px solid #E8EAF2' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#C7D2FE';
                (e.currentTarget as HTMLDivElement).style.background = '#EEF2FF';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = '#E8EAF2';
                (e.currentTarget as HTMLDivElement).style.background = '#F7F8FC';
              }}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                    Active Project
                  </p>
                </div>
                <h3 className="text-xs font-bold text-[#172033] mt-0.5 truncate">LedgerFlow</h3>
                <p className="text-[10px] text-[#94A3B8] truncate">Enterprise Spend Governance</p>
              </div>
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 text-[#94A3B8] group-hover:text-[#4F46E5]"
                style={{ background: '#E8EAF2' }}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2 mb-4 flex justify-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative cursor-pointer"
              style={{ background: '#F7F8FC', border: '1px solid #E8EAF2' }}
              title="LedgerFlow (Enterprise Spend Governance)"
            >
              <span className="text-xs font-bold text-[#172033]">LF</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 border-2 border-white" />
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2.5 space-y-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E8EAF2 transparent' }}>
          {!isCollapsed && (
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest mb-1 text-[#CBD5E1]">
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
                title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                className={`w-full flex items-center rounded-[10px] text-xs font-medium transition-all duration-150 cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                }`}
                style={
                  isActive
                    ? {
                        background: '#EEF2FF',
                        color: '#4338CA',
                        fontWeight: 600,
                        borderLeft: '2px solid #6366F1',
                        paddingLeft: isCollapsed ? undefined : '10px',
                      }
                    : {
                        color: '#64748B',
                      }
                }
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FC';
                    (e.currentTarget as HTMLButtonElement).style.color = '#172033';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = '';
                    (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: isActive ? '#6366F1' : undefined }}
                  />
                  {!isCollapsed && (
                    <span className="block truncate text-xs">{item.label}</span>
                  )}
                </div>

                {'badge' in item && !isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      ('badgeConflict' in item && item.badgeConflict)
                        ? { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }
                        : { background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }
                    }
                  >
                    {item.badge}
                  </span>
                )}

                {'badge' in item && isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1.5 right-1.5 border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div
          className="pt-3 px-3 mt-auto"
          style={{ borderTop: '1px solid #E8EAF2' }}
        >
          {!isCollapsed && (
            <div
              className="p-2.5 rounded-xl mb-2"
              style={{ background: '#F7F8FC', border: '1px solid #E8EAF2' }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-bold text-[#172033] uppercase tracking-wider">Human + AI</span>
              </div>
              <p className="text-[10px] text-[#94A3B8] leading-tight">
                Sequential Product Lifecycle · NOVA + PIXEL
              </p>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-[10px] transition-all duration-150 cursor-pointer text-xs text-[#94A3B8] hover:bg-[#F7F8FC] hover:text-[#172033]"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-medium">
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
