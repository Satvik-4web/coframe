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
  Zap,
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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  shortcut: string;
  badge?: number;
  badgeConflict?: boolean;
  accentColor?: string;
  glowColor?: string;
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
    { id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: '⌘1', accentColor: '#818CF8', glowColor: 'rgba(129,140,248,0.3)' },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: '⌘2', accentColor: '#60A5FA', glowColor: 'rgba(96,165,250,0.3)' },
    { id: 'preview', label: 'Product Preview', icon: Layers, shortcut: '⌘3', accentColor: '#22D3EE', glowColor: 'rgba(34,211,238,0.3)' },
    {
      id: 'proposals',
      label: 'Proposals',
      icon: GitPullRequest,
      badge: totalDecisionCount,
      badgeConflict: conflictedProposalsCount > 0,
      shortcut: '⌘4',
      accentColor: '#A78BFA',
      glowColor: 'rgba(167,139,250,0.3)',
    },
  ];

  const systemItems: NavItem[] = [
    { id: 'agents', label: 'AI Team', icon: Cpu, shortcut: '⌘5', accentColor: '#F472B6', glowColor: 'rgba(244,114,182,0.3)' },
    { id: 'activity', label: 'Activity & History', icon: History, shortcut: '⌘6', accentColor: '#34D399', glowColor: 'rgba(52,211,153,0.3)' },
    { id: 'context', label: 'Context Inspector', icon: Radio, shortcut: '⌘7', accentColor: '#FBBF24', glowColor: 'rgba(251,191,36,0.3)' },
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
        className={`w-full flex items-center rounded-xl text-[13px] transition-all duration-200 cursor-pointer group relative ${
          isCollapsed ? 'justify-center h-9 px-0' : 'justify-between h-9 px-3'
        }`}
        style={isActive ? {
          background: `${item.accentColor}18`,
          boxShadow: `inset 0 0 0 1px ${item.accentColor}30`,
        } : {}}
      >
        {/* Active left accent bar */}
        {isActive && !isCollapsed && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
            style={{ background: item.accentColor, boxShadow: `0 0 8px ${item.glowColor}` }}
          />
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            strokeWidth={isActive ? 2 : 1.75}
            className={`w-4 h-4 shrink-0 transition-all duration-200 ${
              isActive ? '' : 'text-slate-500 group-hover:text-slate-300'
            }`}
            style={isActive ? { color: item.accentColor, filter: `drop-shadow(0 0 6px ${item.glowColor})` } : {}}
          />
          {!isCollapsed && (
            <span
              className={`truncate font-medium transition-colors ${
                isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              {item.label}
            </span>
          )}
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-1.5 shrink-0">
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                  item.badgeConflict
                    ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30'
                    : 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                }`}
              >
                {item.badge}
              </span>
            )}
            <span
              className={`text-[10px] font-mono text-slate-600 transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              {item.shortcut}
            </span>
          </div>
        )}

        {isCollapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className={`w-2 h-2 rounded-full absolute top-1.5 right-1.5 ${
              item.badgeConflict ? 'bg-rose-500' : 'bg-violet-400'
            }`}
            style={{ boxShadow: item.badgeConflict ? '0 0 6px rgba(239,68,68,0.6)' : '0 0 6px rgba(167,139,250,0.6)' }}
          />
        )}
      </button>
    );
  };

  return (
    <aside
      className={`relative flex flex-col justify-between select-none shrink-0 transition-all duration-200 ease-out h-full overflow-hidden glass-sidebar ${
        isCollapsed ? 'w-16 py-3' : 'w-60 py-4'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Wordmark */}
        <div className={`px-3.5 mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #818CF8 0%, #22D3EE 100%)',
                boxShadow: '0 0 16px rgba(129,140,248,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1.2" fill="#FFFFFF" />
                <rect x="9" y="2" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.65)" />
                <rect x="2" y="9" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.65)" />
                <rect x="9" y="9" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.3)" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[13px] text-white tracking-[-0.02em] leading-none gradient-text">
                  COFRAME
                </span>
                <span className="text-[10px] text-slate-500 truncate mt-0.5 leading-none font-mono">
                  AI workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Active Project Pill */}
        {!isCollapsed ? (
          <div className="px-3 mb-4">
            <button
              type="button"
              onClick={() => onSelectTab('preview')}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group flex items-center justify-between"
              style={{
                background: 'rgba(34, 211, 238, 0.07)',
                border: '1px solid rgba(34, 211, 238, 0.18)',
              }}
              title="Open LedgerFlow canvas"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
                  />
                  <span className="text-[11px] font-semibold text-cyan-300">LedgerFlow</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Spend Governance</div>
              </div>
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition"
                style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}
              >
                <Zap className="w-3 h-3" />
              </div>
            </button>
          </div>
        ) : (
          <div className="px-2 mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => onSelectTab('preview')}
              className="w-9 h-9 rounded-xl flex items-center justify-center relative cursor-pointer transition"
              style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.20)' }}
              title="LedgerFlow"
            >
              <span className="text-[11px] font-bold text-cyan-300">LF</span>
              <span
                className="w-2 h-2 rounded-full absolute -top-0.5 -right-0.5"
                style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
              />
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="mx-3 mb-3 divider" />

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2.5 sidebar-scroll space-y-4">
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                Workspace
              </div>
            )}
            <div className="space-y-0.5">{workspaceItems.map(renderNavItem)}</div>
          </div>

          <div>
            {!isCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                System
              </div>
            )}
            <div className="space-y-0.5">{systemItems.map(renderNavItem)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 px-2.5 mt-auto border-t border-white/[0.05] flex flex-col gap-1">
          {!isCollapsed && (
            <div className="px-3 py-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold" style={{ color: '#A78BFA' }}>NOVA</span>
                <span className="text-slate-700 text-[10px]">·</span>
                <span className="text-[10px] font-mono font-semibold" style={{ color: '#22D3EE' }}>PIXEL</span>
              </div>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                live
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center h-8 rounded-xl transition-all cursor-pointer text-slate-600 hover:text-slate-300"
            style={{ background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
