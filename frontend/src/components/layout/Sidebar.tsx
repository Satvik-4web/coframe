import React from 'react';
import {
  LayoutDashboard,
  Palette,
  Bot,
  GitPullRequest,
  History,
  ShieldCheck,
  User,
  Sparkles,
} from 'lucide-react';
import { HumanIdentity } from '../../types';

export type NavigationTab = 'workspace' | 'canvas' | 'proposals' | 'agents' | 'context';

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
  identity,
}) => {
  const navItems = [
    { id: 'workspace', label: 'Workspace', icon: LayoutDashboard },
    { id: 'canvas', label: 'Product Canvas', icon: Palette },
    {
      id: 'proposals',
      label: 'Proposals',
      icon: GitPullRequest,
      badge: pendingProposalsCount + conflictedProposalsCount,
      badgeColor: conflictedProposalsCount > 0 ? 'bg-red-500' : 'bg-amber-500',
    },
    { id: 'agents', label: 'Agent Activity', icon: Bot },
    { id: 'context', label: 'Context & History', icon: History },
  ];

  return (
    <aside className="w-60 border-r border-[#263244] bg-[#0E1322] flex flex-col justify-between py-4 select-none">
      <div>
        <div className="px-5 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#98A5B7]">Navigation</p>
        </div>

        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as NavigationTab)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#1B2433] text-[#F4F7FB] border border-[#263244]'
                    : 'text-[#98A5B7] hover:bg-[#151B29] hover:text-[#F4F7FB]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-[#98A5B7]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full text-white ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collaborators Overview on Sidebar bottom */}
      <div className="px-4 pt-4 border-t border-[#263244] space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#98A5B7] mb-2">4 Collaborators</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between p-1.5 rounded bg-[#151B29] border border-[#263244]">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                  A
                </span>
                <span className="text-[#F4F7FB]">Alex</span>
              </div>
              <span className="text-[10px] text-[#98A5B7]">Founder</span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-[#151B29] border border-[#263244]">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px]">
                  M
                </span>
                <span className="text-[#F4F7FB]">Maya</span>
              </div>
              <span className="text-[10px] text-[#98A5B7]">Designer</span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-[#151B29] border border-[#263244]">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-[10px]">
                  N
                </span>
                <span className="text-[#F4F7FB]">NOVA</span>
              </div>
              <span className="text-[10px] text-violet-400 font-mono">Strategist</span>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-[#151B29] border border-[#263244]">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-[10px]">
                  P
                </span>
                <span className="text-[#F4F7FB]">PIXEL</span>
              </div>
              <span className="text-[10px] text-teal-400 font-mono">Engineer</span>
            </div>
          </div>
        </div>

        <div className="p-2 rounded bg-[#151B29]/60 border border-[#263244] text-[11px] text-[#98A5B7]">
          Current: <strong className="text-blue-400">{identity === 'alex' ? 'Alex' : 'Maya'}</strong>
        </div>
      </div>
    </aside>
  );
};
