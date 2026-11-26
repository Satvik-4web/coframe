import React, { useEffect, useState } from 'react';
import { useRealtimeState } from './hooks/useRealtimeState';
import { TopBar } from './components/layout/TopBar';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { RightCollaborationPanel } from './components/layout/RightCollaborationPanel';
import { ObserverSummaryBanner } from './components/layout/ObserverSummaryBanner';
import { IdentityPicker } from './components/identity/IdentityPicker';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { LedgerFlowCanvas } from './components/prototype/LedgerFlowCanvas';
import { ProposalList } from './components/proposals/ProposalList';
import { AITeamView } from './components/agents/AITeamView';
import { ActivityHistoryView } from './components/activity/ActivityHistoryView';
import { ContextInspector } from './components/context-inspector/ContextInspector';
import { DemoGuide } from './components/demo-stepper/DemoGuide';
import { GitHubDashboard } from './components/github/GitHubDashboard';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { SharedCreationShelf } from './components/resources/SharedCreationShelf';
import { resetDemo, restartAgent } from './lib/api';
import { WorkspaceChatView } from './components/chat/WorkspaceChatView';

const ROUTE_TABS: NavigationTab[] = ['chat', 'overview', 'preview', 'proposals', 'agents', 'activity', 'context'];

const TAB_LABELS: Record<string, string> = {
  chat: 'Chat',
  overview: 'Overview',
  preview: 'Product Preview',
  proposals: 'Proposals',
  agents: 'AI Team',
  activity: 'Activity',
  context: 'Context Inspector',
};

function getInitialTab(): NavigationTab {
  if (typeof window === 'undefined') return 'overview';
  const seg = window.location.pathname.replace(/^\//, '').split('/')[0] as NavigationTab;
  if (ROUTE_TABS.includes(seg)) return seg;
  const hash = window.location.hash.replace('#', '') as NavigationTab;
  if (ROUTE_TABS.includes(hash)) return hash;
  return 'overview';
}

export function App() {
  const {
    projectId,
    identity,
    selectIdentity,
    state,
    loading,
    error,
    isConnected,
    refresh,
  } = useRealtimeState();

  const [currentTab, setCurrentTab] = useState<NavigationTab>(getInitialTab);
  const [demoStep, setDemoStep] = useState(1);
  const [isResetting, setIsResetting] = useState(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);
  const [isCollaboratorsPanelOpen, setIsCollaboratorsPanelOpen] = useState(false);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);

  useEffect(() => {
    const label = TAB_LABELS[currentTab] || 'Workspace';
    document.title = `LedgerFlow · ${label} · COFRAME`;
  }, [currentTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const num = Number(event.key);
      if (Number.isInteger(num) && num >= 1 && num <= ROUTE_TABS.length) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        event.preventDefault();
        setCurrentTab(ROUTE_TABS[num - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleReset = async () => {
    if (window.confirm('Reset demo project and LedgerFlow artifact to baseline seed state?')) {
      setIsResetting(true);
      try {
        await resetDemo();
        await refresh();
        setDemoStep(1);
        setCurrentTab('overview');
      } catch (err) {
        alert('Failed to reset demo');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleRestartAgent = async (agentId: string) => {
    setRestartingAgent(agentId);
    try {
      await restartAgent('demo-ledgerflow', agentId);
      await refresh();
    } catch (err) {
      alert(`Failed to restart agent ${agentId}`);
    } finally {
      setRestartingAgent(null);
    }
  };

  if (!identity) {
    return <IdentityPicker onSelect={selectIdentity} />;
  }

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center gap-3 text-slate-600 font-medium text-xs">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563EB]" />
        <span>Loading LedgerFlow workspace...</span>
      </div>
    );
  }

  const proposals = state?.proposals || [];
  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const conflictedCount = proposals.filter(
    (p) => p.status === 'stale' || p.status === 'conflict'
  ).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F6F8FB] text-[#0F172A] font-sans antialiased selection:bg-[#2563EB] selection:text-white">
      {/* 1. Global Top Navigation */}
      <TopBar
        project={state?.project}
        identity={identity}
        onlineMembers={state?.online_members || []}
        isConnected={isConnected}
        onResetDemo={handleReset}
        onSwitchIdentity={() => selectIdentity(null)}
        isResetting={isResetting}
        onToggleDemoGuide={() => setIsDemoGuideOpen(!isDemoGuideOpen)}
        isDemoGuideOpen={isDemoGuideOpen}
        onToggleCollaboratorsPanel={() => setIsCollaboratorsPanelOpen(!isCollaboratorsPanelOpen)}
        isCollaboratorsPanelOpen={isCollaboratorsPanelOpen}
        isCleanBaseline={state?.is_clean_baseline ?? false}
        onRefresh={refresh}
      />

      {/* 2. Observer Summary Banner */}
      <ObserverSummaryBanner summary={state?.observer_summary} />

      {error && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
          Live sync temporarily interrupted.{' '}
          <button type="button" onClick={refresh} className="font-semibold underline cursor-pointer ml-1">
            Retry
          </button>
        </div>
      )}

      {/* 3. Main Workspace Body (Sidebar + Content Area + Right Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingProposalsCount={pendingCount}
          conflictedProposalsCount={conflictedCount}
          pendingApprovalsCount={(state?.approvals || []).filter((a) => a.status === 'pending').length}
          identity={identity}
        />

        {/* Central Content Panel */}
        <main className={`flex-1 relative ${currentTab === 'chat' ? 'overflow-hidden p-0' : 'overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full'}`}>
          {currentTab === 'chat' && state && (
            <WorkspaceChatView
              projectId={projectId}
              identity={identity}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              proposals={state.proposals}
              onRefresh={refresh}
            />
          )}
          {/* Interactive Demo Walkthrough Stepper (Slide-over drawer) */}
          <DemoGuide
            currentStep={demoStep}
            onSetStep={setDemoStep}
            identity={identity}
            proposals={proposals}
            onRefresh={refresh}
            onNavigateTab={setCurrentTab}
            isOpen={isDemoGuideOpen}
            onClose={() => setIsDemoGuideOpen(false)}
          />

          {/* Active View Tab */}
          {(currentTab === 'overview' || currentTab === 'workspace') && state && (
            <WorkspaceView
              state={state}
              identity={identity}
              onRefresh={refresh}
              onNavigateTab={setCurrentTab}
            />
          )}

          {(currentTab === 'preview' || currentTab === 'canvas') && state && (
            <LedgerFlowCanvas
              sections={state.sections}
              requirements={state.requirements}
              artifactVersion={state.project.artifact_version}
              identity={identity}
              onRefresh={refresh}
            />
          )}

          {currentTab === 'proposals' && state && (
            <ProposalList
              proposals={state.proposals}
              sections={state.sections}
              identity={identity}
              onRefresh={refresh}
            />
          )}

          {currentTab === 'agents' && state && (
            <AITeamView
              agentRuns={state.agent_runs}
              delegations={state.delegations || []}
              identity={identity}
              onRefresh={refresh}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'activity' && state && (
            <ActivityHistoryView events={state.events || []} />
          )}

          {currentTab === 'context' && state && (
            <ContextInspector
              agentRuns={state.agent_runs}
              identity={identity}
              onRefresh={refresh}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'resources' && state && (
            <SharedCreationShelf
              initialResources={state.resources || []}
              identity={identity}
              onRefreshProject={refresh}
            />
          )}

          {currentTab === 'governance' && state && (
            <GovernanceDashboard
              approvals={state.approvals || []}
              delegations={state.delegations || []}
              identity={identity}
              onRefresh={refresh}
            />
          )}

          {currentTab === 'github' && state && (
            <GitHubDashboard
              proposals={state.proposals}
              onRefreshProject={refresh}
            />
          )}
        </main>

        {/* Right Collapsible Collaboration Panel */}
        <RightCollaborationPanel
          agentRuns={state?.agent_runs || []}
          onlineMembers={state?.online_members || []}
          identity={identity}
          onRestartAgent={handleRestartAgent}
          onNavigateTab={setCurrentTab}
          isOpen={isCollaboratorsPanelOpen}
          onClose={() => setIsCollaboratorsPanelOpen(false)}
          restartingAgent={restartingAgent}
        />
      </div>
    </div>
  );
}

export default App;
