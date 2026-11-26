import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useRealtimeState } from './hooks/useRealtimeState';
import { TopBar } from './components/layout/TopBar';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { RightCollaborationPanel } from './components/layout/RightCollaborationPanel';
import { ObserverSummaryBanner } from './components/layout/ObserverSummaryBanner';
import { IdentityPicker } from './components/identity/IdentityPicker';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { DemoGuide } from './components/demo-stepper/DemoGuide';
import { resetDemo, restartAgent } from './lib/api';
import { WorkspaceSetup } from './components/workspace/WorkspaceSetup';

const LedgerFlowCanvas = lazy(() => import('./components/prototype/LedgerFlowCanvas').then((m) => ({ default: m.LedgerFlowCanvas })));
const ProposalList = lazy(() => import('./components/proposals/ProposalList').then((m) => ({ default: m.ProposalList })));
const AITeamView = lazy(() => import('./components/agents/AITeamView').then((m) => ({ default: m.AITeamView })));
const ActivityHistoryView = lazy(() => import('./components/activity/ActivityHistoryView').then((m) => ({ default: m.ActivityHistoryView })));
const ContextInspector = lazy(() => import('./components/context-inspector/ContextInspector').then((m) => ({ default: m.ContextInspector })));
const GitHubDashboard = lazy(() => import('./components/github/GitHubDashboard').then((m) => ({ default: m.GitHubDashboard })));
const GovernanceDashboard = lazy(() => import('./components/governance/GovernanceDashboard').then((m) => ({ default: m.GovernanceDashboard })));
const SharedCreationShelf = lazy(() => import('./components/resources/SharedCreationShelf').then((m) => ({ default: m.SharedCreationShelf })));
const WorkspaceChatView = lazy(() => import('./components/chat/WorkspaceChatView').then((m) => ({ default: m.WorkspaceChatView })));

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

  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => { const tab = window.location.hash.slice(1); return ['chat','overview','preview','proposals','agents','activity','context','resources','governance','github','settings'].includes(tab) ? tab as NavigationTab : 'overview'; });
  const [focusedProposalId, setFocusedProposalId] = useState<string>();
  const navigate = (tab: NavigationTab, proposalId?: string) => {
    setFocusedProposalId(proposalId);
    setCurrentTab(tab);
  };
  useEffect(() => {
    if (window.location.hash !== '#' + currentTab) window.history.pushState(null, '', '#' + currentTab);
  }, [currentTab]);
  useEffect(() => {
    const onHistory = () => {
      const tab = window.location.hash.slice(1);
      if (['chat','overview','preview','proposals','agents','activity','context','resources','governance','github','settings'].includes(tab)) {
        setCurrentTab(tab as NavigationTab);
        setFocusedProposalId(undefined);
      }
    };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    return () => { window.removeEventListener('popstate', onHistory); window.removeEventListener('hashchange', onHistory); };
  }, []);
  const [demoStep, setDemoStep] = useState(1);
  const [isResetting, setIsResetting] = useState(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);
  const [isCollaboratorsPanelOpen, setIsCollaboratorsPanelOpen] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);

  useEffect(() => {
    const tabs: NavigationTab[] = ['chat', 'overview', 'preview', 'proposals', 'agents', 'activity', 'context'];
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return;
      const index = event.code.startsWith('Digit') ? Number(event.code.slice(5)) - 1 : -1;
      if (!Number.isInteger(index) || index < 0 || index >= tabs.length) return;
      event.preventDefault();
      setCurrentTab(tabs[index]);
      setIsNavigationOpen(false);
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
      <div className="min-h-screen bg-[#101318] flex flex-col items-center justify-center gap-4 text-[#ACBAD0] font-medium text-sm">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-500/25 border-t-blue-600" />
        <span>Connecting to your workspace…</span>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-[#141A24] flex items-center justify-center p-6">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-[#303A4B] bg-[#1A202C] p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300 font-bold">!</div>
          <h1 className="text-lg font-semibold text-[#EDF2FA]">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-[#ACBAD0]">{error}. Check that the backend is running, then try again.</p>
          <button type="button" onClick={refresh} className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700">Retry connection</button>
        </div>
      </div>
    );
  }

  const proposals = state?.proposals || [];
  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const conflictedCount = proposals.filter(
    (p) => p.status === 'stale' || p.status === 'conflict'
  ).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#101318] text-[#E7EDF7] font-sans antialiased selection:bg-blue-200 selection:text-[#E7EDF7]">
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
        onToggleNavigation={() => setIsNavigationOpen((open) => !open)}
      />

      {/* 2. Observer Summary Banner */}
      <ObserverSummaryBanner summary={state?.observer_summary} />

      {error && <div role="status" className="border-b border-amber-500/25 bg-amber-500/10 px-5 py-2 text-center text-xs text-amber-300">Updates are temporarily unavailable. Showing the last loaded state. <button onClick={refresh} className="ml-2 font-semibold underline">Retry</button></div>}

      {/* 3. Main Workspace Body (Sidebar + Content Area + Right Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {isNavigationOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={() => setIsNavigationOpen(false)} />}
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => { setCurrentTab(tab); setIsNavigationOpen(false); }}
          isMobileOpen={isNavigationOpen}
          pendingProposalsCount={pendingCount}
          conflictedProposalsCount={conflictedCount}
          pendingApprovalsCount={(state?.approvals || []).filter((a) => a.status === 'pending').length}
          identity={identity}
        />

        {/* Central Content Panel */}
        <main className={`flex-1 min-w-0 relative ${currentTab === 'chat' ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-9 max-w-[1600px] mx-auto w-full'}`}>
          <Suspense fallback={<div role="status" className="p-8 text-center text-sm text-[#96A6BE]">Loading workspace view…</div>}>
          {currentTab === 'settings' && <WorkspaceSetup />}
          {currentTab === 'chat' && state && (
            <WorkspaceChatView
              projectId={projectId}
              identity={identity}
              onNavigateTab={navigate}
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
            onNavigateTab={navigate}
            isOpen={isDemoGuideOpen}
            onClose={() => setIsDemoGuideOpen(false)}
          />

          {/* Active View Tab */}
          {(currentTab === 'overview' || currentTab === 'workspace') && state && (
            <WorkspaceView
              state={state}
              identity={identity}
              onRefresh={refresh}
              onNavigateTab={navigate}
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
            <ProposalList focusedProposalId={focusedProposalId}
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
              onNavigateTab={navigate}
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
              onNavigateTab={navigate}
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
          </Suspense>
        </main>

        {/* Right Collapsible Collaboration Panel */}
        {isCollaboratorsPanelOpen && <button type="button" aria-label="Close collaborators" className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={() => setIsCollaboratorsPanelOpen(false)} />}
        <RightCollaborationPanel
          agentRuns={state?.agent_runs || []}
          onlineMembers={state?.online_members || []}
          identity={identity}
          onRestartAgent={handleRestartAgent}
          onNavigateTab={(tab) => { setCurrentTab(tab); setIsCollaboratorsPanelOpen(false); }}
          isOpen={isCollaboratorsPanelOpen}
          onClose={() => setIsCollaboratorsPanelOpen(false)}
          restartingAgent={restartingAgent}
        />
      </div>
    </div>
  );
}

export default App;
