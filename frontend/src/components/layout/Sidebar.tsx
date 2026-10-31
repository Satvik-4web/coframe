import React from 'react';
import {
  LayoutDashboard,
  Palette,
  GitPullRequest,
  Bot,
  History,
  Radio,
  Layers,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';
import { HumanIdentity } from '../../types';

export type NavigationTab =
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
  pendingApprovalsCount = 0,
}) => {
  const mainNavItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'preview',
      label: 'Product Preview',
      altText: 'Product Canvas',
      icon: Palette,
    },
    {
      id: 'proposals',
      label: 'Proposals',
      icon: GitPullRequest,
      badge: pendingProposalsCount + conflictedProposalsCount,
      badgeColor:
        conflictedProposalsCount > 0
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-amber-50 text-amber-800 border border-amber-200',
    },
    {
      id: 'agents',
      label: 'AI Team',
      altText: 'Agent Activity',
      icon: Bot,
    },
    {
      id: 'activity',
      label: 'Activity & History',
      icon: History,
    },
    {
      id: 'context',
      label: 'Context Inspector',
      icon: Radio,
    },
  ];

  const secondaryNavItems = [
    {
      id: 'resources',
      label: 'Shared Resources',
      icon: FolderOpen,
    },
    {
      id: 'governance',
      label: 'Decisions & Governance',
      icon: ShieldCheck,
      badge: pendingApprovalsCount,
      badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
    },
  ];

  return (
    <aside className="w-64 border-r border-[#E7ECF2] bg-white flex flex-col justify-between py-6 select-none shrink-0 shadow-[1px_0_3px_rgba(0,0,0,0.01)] h-full overflow-hidden">
      <div className="space-y-6">
        {/* Project Branding Pill */}
        <div className="px-5">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
                Active Project
              </p>
              <h3 className="text-xs font-bold text-[#172033] mt-0.5">LedgerFlow</h3>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live shared workspace" />
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1 px-3">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#657189]">
            Workspace
          </p>
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-100 shadow-2xs'
                    : 'text-[#657189] hover:bg-[#F8FAFC] hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-teal-600' : 'text-[#657189]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.altText && <span className="sr-only">{item.altText}</span>}
                </div>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Supporting Workspace Repositories & Governance */}
        <div className="space-y-1 px-3 pt-3 border-t border-[#F0F3F7]">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#657189]">
            Collaborative Assets
          </p>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavigationTab)}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-100 shadow-2xs'
                    : 'text-[#657189] hover:bg-[#F8FAFC] hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-teal-600' : 'text-[#657189]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtle Bottom Footer */}
      <div className="px-6 pt-4 border-t border-[#E7ECF2] text-xs text-[#657189] space-y-0.5">
        <p className="font-bold text-[#172033] text-[11px] tracking-wide">COFRAME 1.0</p>
        <p className="text-[10px] text-[#657189]">Human + AI Shared Creation</p>
      </div>
    </aside>
  );
};
