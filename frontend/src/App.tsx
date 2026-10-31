import React, { useState } from 'react';
import { useRealtimeState } from './hooks/useRealtimeState';
import { TopBar } from './components/layout/TopBar';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { ObserverSummaryBanner } from './components/layout/ObserverSummaryBanner';
import { IdentityPicker } from './components/identity/IdentityPicker';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { LedgerFlowCanvas } from './components/prototype/LedgerFlowCanvas';
import { ProposalList } from './components/proposals/ProposalList';
import { ContextInspector } from './components/context-inspector/ContextInspector';
import { EventTimeline } from './components/event-timeline/EventTimeline';
import { DemoGuide } from './components/demo-stepper/DemoGuide';
import { GitHubDashboard } from './components/github/GitHubDashboard';
import { resetDemo } from './lib/api';

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

  const [currentTab, setCurrentTab] = useState<NavigationTab>('workspace');
  const [demoStep, setDemoStep] = useState(1);
  const [isResetting, setIsResetting] = useState(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(true);

  const handleReset = async () => {
    if (window.confirm('Reset demo project and LedgerFlow artifact to baseline seed state?')) {
      setIsResetting(true);
      try {
        await resetDemo();
        await refresh();
        setDemoStep(1);
        setCurrentTab('workspace');
      } catch (err) {
        alert('Failed to reset demo');
      } finally {
        setIsResetting(false);
      }
    }
  };

  if (!identity) {
    return <IdentityPicker onSelect={selectIdentity} />;
  }

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center text-teal-600 font-medium text-sm">
        Initializing COFRAME Multiplayer Engine...
      </div>
    );
  }

  const proposals = state?.proposals || [];
  const pendingCount = proposals.filter((p) => p.status === 'pending_review').length;
  const conflictedCount = proposals.filter(
    (p) => p.status === 'stale' || p.status === 'conflict'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-[#172033] font-sans antialiased selection:bg-teal-500 selection:text-white">
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
      />

      {/* 2. Observer Summary Banner */}
      <ObserverSummaryBanner summary={state?.observer_summary} />

      {/* 3. Main Workspace Body (Sidebar + Content Area) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingProposalsCount={pendingCount}
          conflictedProposalsCount={conflictedCount}
          identity={identity}
        />

        {/* Central Content Panel */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full relative">
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
          {currentTab === 'workspace' && state && (
            <WorkspaceView
              state={state}
              identity={identity}
              onRefresh={refresh}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'canvas' && state && (
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
            <ContextInspector agentRuns={state.agent_runs} onRefresh={refresh} />
          )}

          {currentTab === 'context' && state && (
            <EventTimeline events={state.events} />
          )}

          {currentTab === 'github' && state && (
            <GitHubDashboard
              proposals={state.proposals}
              onRefreshProject={refresh}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
