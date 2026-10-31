import React from 'react';
import {
  LayoutDashboard,
  Palette,
  Bot,
  GitPullRequest,
  History,
} from 'lucide-react';
import { GitHubIcon } from '../github/GitHubIcon';
import { HumanIdentity } from '../../types';

export type NavigationTab = 'workspace' | 'canvas' | 'proposals' | 'agents' | 'context' | 'github';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  pendingProposalsCount: number;
  conflictedProposalsCount: number;
  identity: HumanIdentity;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingProposalsCount,
  conflictedProposalsCount,
}) => {
  const navItems = [
    { id: 'workspace', label: 'Workspace', icon: LayoutDashboard },
    { id: 'canvas', label: 'Product Canvas', icon: Palette },
    {
      id: 'proposals',
      label: 'Proposals',
      icon: GitPullRequest,
      badge: pendingProposalsCount + conflictedProposalsCount,
      badgeColor:
        conflictedProposalsCount > 0
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200',
    },
    { id: 'agents', label: 'Agent Activity', icon: Bot },
    { id: 'context', label: 'Activity & History', icon: History },
    { id: 'github', label: 'GitHub', icon: GitHubIcon },
  ];

  return (
    <aside className="w-64 border-r border-[#E5EAF0] bg-white flex flex-col justify-between py-6 select-none shrink-0 shadow-[1px_0_3px_rgba(0,0,0,0.01)]">
      <div>
        <div className="px-6 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#657189]">
            Navigation
          </p>
        </div>

        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavigationTab)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-100 shadow-xs'
                    : 'text-[#657189] hover:bg-[#F8FAFC] hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-teal-600' : 'text-[#657189]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Subtle Bottom Information */}
      <div className="px-6 pt-4 border-t border-[#E5EAF0] text-xs text-[#657189] space-y-1">
        <p className="font-semibold text-[#172033]">COFRAME 1.0</p>
        <p className="text-[11px] text-[#657189]">Human + AI Shared Creation</p>
      </div>
    </aside>
  );
};
