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

  // Sidebar base: near-black with very subtle warm-blue undertone (Linear/Raycast style)
  const sidebarBg = 'linear-gradient(180deg, #080B18 0%, #0A0D1C 60%, #090C1A 100%)';
  const sidebarBorder = '1px solid rgba(255,255,255,0.055)';

  return (
    <aside
      className={`relative flex flex-col justify-between select-none shrink-0 transition-all duration-300 ease-in-out h-full overflow-hidden ${
        isCollapsed ? 'w-16 py-4' : 'w-64 py-5'
      }`}
      style={{ background: sidebarBg, borderRight: sidebarBorder, color: '#C8D0E0' }}
    >
      <div className="flex flex-col h-full overflow-hidden">

        {/* ── Logo ─────────────────────────────────────────── */}
        <div className={`px-4 mb-5 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            {/* Electric indigo → cyan logo mark */}
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center font-black text-white text-base shrink-0"
              style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.10), 0 4px 16px rgba(79,70,229,0.35)',
              }}
            >
              C
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-sm text-white font-mono">COFRAME</span>
                  <span
                    className="text-[9px] font-bold px-1.5 rounded"
                    style={{
                      background: 'rgba(79,70,229,0.18)',
                      color: '#A5B4FC',
                      border: '1px solid rgba(99,102,241,0.28)',
                      paddingTop: '1px',
                      paddingBottom: '1px',
                    }}
                  >
                    2.0
                  </span>
                </div>
                <span className="text-[10px] truncate font-medium" style={{ color: '#364259' }}>
                  Collaborative Dev Workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Project Card ──────────────────────────── */}
        {!isCollapsed ? (
          <div className="px-3 mb-5">
            <div
              className="p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-150"
              style={{
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.055)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.32)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.035)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#364259' }}>
                    Active Project
                  </p>
                </div>
                <h3 className="text-xs font-bold text-white mt-0.5 truncate">LedgerFlow</h3>
                <p className="text-[10px] truncate" style={{ color: '#364259' }}>Enterprise Spend Governance</p>
              </div>
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#5B6E8C' }}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : (
          <div className="px-2 mb-4 flex justify-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              title="LedgerFlow (Enterprise Spend Governance)"
            >
              <span className="text-xs font-bold text-white">LF</span>
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5"
                style={{ border: '1.5px solid #080B18' }}
              />
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto dark-scroll px-2.5 space-y-0.5">
          {!isCollapsed && (
            <div
              className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: '#252E45', letterSpacing: '0.12em' }}
            >
              Workspace
            </div>
          )}

          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'overview' && currentTab === 'workspace') ||
              (item.id === 'preview' && currentTab === 'canvas');

            const activeStyle: React.CSSProperties = {
              background: 'linear-gradient(90deg, rgba(79,70,229,0.20) 0%, rgba(6,182,212,0.10) 100%)',
              borderLeft: '2px solid #6366F1',
              color: '#E0E7FF',
              fontWeight: 600,
              paddingLeft: isCollapsed ? undefined : '10px',
            };

            const inactiveStyle: React.CSSProperties = { color: '#3D4F6B' };

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavigationTab)}
                title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                className={`w-full flex items-center rounded-[10px] text-xs font-medium transition-all duration-150 cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                }`}
                style={isActive ? activeStyle : inactiveStyle}
                onMouseEnter={e => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = 'rgba(255,255,255,0.04)';
                    el.style.color = '#C8D0E0';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = '';
                    el.style.color = '#3D4F6B';
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105"
                    style={{ color: isActive ? '#A5B4FC' : undefined }}
                  />
                  {!isCollapsed && (
                    <div className="text-left min-w-0">
                      <span className="block truncate text-xs">{item.label}</span>
                    </div>
                  )}
                </div>

                {'badge' in item && !isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      ('badgeConflict' in item && item.badgeConflict)
                        ? { background: 'rgba(220,38,38,0.14)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.24)' }
                        : { background: 'rgba(99,102,241,0.16)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.28)' }
                    }
                  >
                    {item.badge}
                  </span>
                )}

                {'badge' in item && isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="w-2 h-2 rounded-full bg-indigo-400 absolute top-1.5 right-1.5"
                    style={{ border: '1.5px solid #080B18' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div
          className="pt-3 px-3 mt-auto"
          style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
        >
          {!isCollapsed && (
            <div
              className="p-2.5 rounded-xl mb-2"
              style={{
                background: 'rgba(79,70,229,0.07)',
                border: '1px solid rgba(99,102,241,0.16)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3 h-3" style={{ color: '#818CF8' }} />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Human + AI</span>
              </div>
              <p className="text-[10px] leading-tight" style={{ color: '#364259' }}>
                Sequential Product Lifecycle · NOVA + PIXEL
              </p>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-[10px] transition-all duration-150 cursor-pointer text-xs"
            style={{ color: '#283244' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLButtonElement).style.color = '#C8D0E0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '';
              (e.currentTarget as HTMLButtonElement).style.color = '#283244';
            }}
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
