import React, { useState } from 'react';
import { useRealtimeState } from './hooks/useRealtimeState';
import { TopBar } from './components/layout/TopBar';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { computeProposalCounts } from './hooks/useProposalCounts';
import { RightCollaborationPanel } from './components/layout/RightCollaborationPanel';
import { ObserverSummaryBanner } from './components/layout/ObserverSummaryBanner';
import { IdentityPicker } from './components/identity/IdentityPicker';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { ProposalList } from './components/proposals/ProposalList';
import { AgentsAndContextView } from './components/agents/AgentsAndContextView';
import { ActivityHistoryView } from './components/activity/ActivityHistoryView';
import { DemoGuide } from './components/demo-stepper/DemoGuide';
import { GitHubDashboard } from './components/github/GitHubDashboard';
import { GovernanceDashboard } from './components/governance/GovernanceDashboard';
import { SharedCreationShelf } from './components/resources/SharedCreationShelf';
import { resetDemo, restartAgent } from './lib/api';
import { WorkspaceChatView } from './components/chat/WorkspaceChatView';
import { X, MessageSquare } from 'lucide-react';

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
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);
  const [isCollaboratorsPanelOpen, setIsCollaboratorsPanelOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [previewProposalId, setPreviewProposalId] = useState<string | null>(null);
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDemo();
      await refresh();
      setDemoStep(1);
      setCurrentTab('workspace');
      setPreviewProposalId(null);
    } catch (err) {
      alert('Failed to reset demo');
    } finally {
      setIsResetting(false);
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

  const handleTogglePreviewProposal = (proposalId: string) => {
    setPreviewProposalId((prev) => (prev === proposalId ? null : proposalId));
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
  const proposalCounts = computeProposalCounts(proposals);
  const pendingCount = proposalCounts.pending;
  const conflictedCount = proposalCounts.conflict + proposalCounts.stale;

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
        onToggleCollaboratorsPanel={() => setIsCollaboratorsPanelOpen(!isCollaboratorsPanelOpen)}
        isCollaboratorsPanelOpen={isCollaboratorsPanelOpen}
        isCleanBaseline={state?.is_clean_baseline ?? false}
        onRefresh={refresh}
        pendingProposalsCount={proposalCounts.needsDecision}
      />

      {/* 2. Observer Summary Banner with Plain / Technical Toggle */}
      <ObserverSummaryBanner
        summary={state?.observer_summary}
        latestProposal={state?.proposals[0]}
        artifactVersion={state?.project.artifact_version}
        contextVersion={state?.project.context_version}
        eventsCount={state?.events?.length}
        isSynchronized={isConnected}
      />

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
          onToggleChatDrawer={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
          isChatDrawerOpen={isChatDrawerOpen}
        />

        {/* Central Content Panel */}
        <main
          className={`flex-1 relative ${
            currentTab === 'chat' ? 'overflow-hidden p-0' : 'overflow-y-auto p-5 lg:p-7 max-w-7xl mx-auto w-full'
          }`}
        >
          {currentTab === 'chat' && state && (
            <WorkspaceChatView
              projectId={projectId}
              identity={identity}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              proposals={state.proposals}
              onRefresh={refresh}
            />
          )}

          {/* Interactive Demo Walkthrough Stepper */}
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

          {/* Primary View: Workspace (Live Prototype on Left + Right Decision Rail) */}
          {(currentTab === 'workspace' ||
            currentTab === 'overview' ||
            currentTab === 'preview' ||
            currentTab === 'canvas') &&
            state && (
              <WorkspaceView
                state={state}
                identity={identity}
                onRefresh={refresh}
                onNavigateTab={setCurrentTab}
                previewProposalId={previewProposalId}
                onTogglePreviewProposal={handleTogglePreviewProposal}
                onExitPreview={() => setPreviewProposalId(null)}
                onOpenChatDrawer={() => setIsChatDrawerOpen(true)}
              />
            )}

          {/* Proposals Queue View */}
          {currentTab === 'proposals' && state && (
            <ProposalList
              proposals={state.proposals}
              sections={state.sections}
              identity={identity}
              onRefresh={refresh}
              previewProposalId={previewProposalId}
              onTogglePreviewProposal={handleTogglePreviewProposal}
            />
          )}

          {/* Unified Agents & Context View */}
          {(currentTab === 'agents_context' || currentTab === 'agents' || currentTab === 'context') &&
            state && (
              <AgentsAndContextView
                agentRuns={state.agent_runs}
                delegations={state.delegations || []}
                identity={identity}
                onRefresh={refresh}
                onNavigateTab={setCurrentTab}
                requirements={state.requirements}
                events={state.events || []}
              />
            )}

          {/* History View */}
          {(currentTab === 'history' || currentTab === 'activity') && state && (
            <ActivityHistoryView events={state.events || []} />
          )}

          {/* Shared Creation Shelf */}
          {currentTab === 'resources' && state && (
            <SharedCreationShelf
              initialResources={state.resources || []}
              identity={identity}
              onRefreshProject={refresh}
            />
          )}

          {/* Governance Dashboard */}
          {currentTab === 'governance' && state && (
            <GovernanceDashboard
              approvals={state.approvals || []}
              delegations={state.delegations || []}
              identity={identity}
              onRefresh={refresh}
            />
          )}

          {/* GitHub Integration */}
          {currentTab === 'github' && state && (
            <GitHubDashboard proposals={state.proposals} onRefreshProject={refresh} />
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

        {/* Collapsible Slide-over Agent Chat Drawer */}
        {isChatDrawerOpen && state && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-fadeIn">
            <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-[#E2E8F0] animate-slideLeft">
              {/* Drawer Header */}
              <div className="p-4 border-b border-[#E7ECF2] flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-2xs">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#172033]">Workspace Agent Chat</h3>
                    <p className="text-[11px] text-[#657189]">Collaborate with NOVA & PIXEL</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChatDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  title="Close Chat Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-hidden">
                <WorkspaceChatView
                  projectId={projectId}
                  identity={identity}
                  onNavigateTab={(tab) => {
                    setIsChatDrawerOpen(false);
                    setCurrentTab(tab);
                  }}
                  proposals={state.proposals}
                  onRefresh={refresh}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
