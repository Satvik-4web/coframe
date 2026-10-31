import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Bot,
  Code,
  Search,
  Plus,
  ArrowRight,
  GitPullRequest,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Info,
  Shield,
  Layers,
  ExternalLink,
} from 'lucide-react';
import {
  HumanIdentity,
  Conversation,
  ChatMessage,
  Proposal,
  WorkflowStageInfo,
} from '../../types';
import {
  fetchConversations,
  createConversation,
  fetchConversationMessages,
  sendChatMessage,
  markConversationRead,
  fetchChatWorkflowStage,
} from '../../lib/api';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';
import { WorkflowStageBanner } from './WorkflowStageBanner';

interface WorkspaceChatViewProps {
  projectId?: string;
  identity: HumanIdentity;
  onNavigateTab: (tab: any, proposalId?: string) => void;
  proposals?: Proposal[];
  onRefresh?: () => void;
}

export const WorkspaceChatView: React.FC<WorkspaceChatViewProps> = ({
  projectId = 'demo-ledgerflow',
  identity,
  onNavigateTab,
  proposals = [],
  onRefresh,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv_team_ledgerflow');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [recipient, setRecipient] = useState<'team' | 'nova' | 'pixel'>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [stageInfo, setStageInfo] = useState<WorkflowStageInfo | null>(null);

  const loadWorkflowStage = async () => {
    try {
      const data = await fetchChatWorkflowStage(projectId);
      setStageInfo(data);
    } catch (err) {
      console.error('Failed to load workflow stage:', err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount
  const loadConversations = async () => {
    try {
      const data = await fetchConversations(projectId);
      setConversations(data);
      if (data.length > 0 && !data.some((c) => c.id === activeConversationId)) {
        setActiveConversationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
    loadWorkflowStage();
  }, [projectId]);

  // Load messages whenever active conversation changes
  const loadMessages = async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await fetchConversationMessages(projectId, convId, 100);
      setMessages(msgs);
      if (identity) {
        markConversationRead(projectId, convId, identity).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, projectId]);

  // Real-time WebSocket synchronization for chat messages
  useEffect(() => {
    const handleWs = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const data = customEvt.detail;
      if (!data) return;

      if (data.type === 'WORKFLOW_STAGE_UPDATED') {
        if (data.stage) setStageInfo(data.stage);
        else loadWorkflowStage();
      }

      if (['PROPOSAL_APPROVED', 'PROPOSAL_CREATED', 'DELEGATION_CREATED', 'DELEGATION_COMPLETED', 'PROPOSAL_REJECTED'].includes(data.type)) {
        loadWorkflowStage();
        if (onRefresh) onRefresh();
      }

      if (data.type === 'CHAT_MESSAGE_CREATED' && data.conversation_id === activeConversationId && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const isReplacingOptimistic = prev.some(
            (m) => m.id.startsWith('temp_') && m.sender_id === data.message.sender_id && m.message_content === data.message.message_content
          );
          if (isReplacingOptimistic) {
            return prev.map((m) =>
              m.id.startsWith('temp_') && m.sender_id === data.message.sender_id && m.message_content === data.message.message_content
                ? data.message
                : m
            );
          }
          return [...prev, data.message];
        });
        loadWorkflowStage();
      }
    };

    window.addEventListener('coframe:ws_message', handleWs);
    return () => window.removeEventListener('coframe:ws_message', handleWs);
  }, [activeConversationId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const handleSendMessage = async (textToSend?: string, recipientOverride?: 'team' | 'nova' | 'pixel') => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !activeConversationId) return;

    const targetRecipient = recipientOverride || recipient;
    const sender = identity || 'alex';

    // Optimistically show user's message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: sender,
      sender_key: sender,
      sender_name: sender === 'alex' ? 'Alex' : 'Maya',
      sender_role: sender === 'alex' ? 'Founder / Decision Owner' : 'Product Designer',
      sender_type: 'human',
      recipient_id: targetRecipient,
      recipient_type: targetRecipient === 'team' ? 'team' : 'agent',
      message_content: text,
      content: text,
      message_type: 'human_message',
      status: 'sending',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setIsSending(true);

    if (targetRecipient === 'nova') {
      setIsTyping('NOVA is analyzing product strategy and requirements...');
    } else if (targetRecipient === 'pixel') {
      setIsTyping('PIXEL is preparing architecture and UI changes...');
    } else {
      setIsTyping('NOVA and PIXEL are collaborating on your request...');
    }

    try {
      const res = await sendChatMessage(projectId, activeConversationId, {
        sender_id: sender,
        message_content: text,
        recipient: targetRecipient,
      });

      // Replace optimistic message and append agent responses without duplication
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        const existingIds = new Set(filtered.map((m) => m.id));
        const toAdd: ChatMessage[] = [];
        if (!existingIds.has(res.human_message.id)) {
          toAdd.push(res.human_message);
          existingIds.add(res.human_message.id);
        }
        for (const resp of res.agent_responses) {
          if (!existingIds.has(resp.id)) {
            toAdd.push(resp);
            existingIds.add(resp.id);
          }
        }
        return [...filtered, ...toAdd];
      });

      // Refresh conversations list to update last_message preview
      loadConversations();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to send chat message:', err);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsSending(false);
      setIsTyping(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const conv = await createConversation(projectId, {
        title: newTitle.trim(),
        created_by: identity || 'alex',
        conversation_type: 'custom',
        participants: ['alex', 'maya', 'nova', 'pixel'],
      });
      setShowNewModal(false);
      setNewTitle('');
      await loadConversations();
      setActiveConversationId(conv.id);
    } catch (err) {
      console.error('Failed to create conversation room:', err);
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-[#FAFBFD] overflow-hidden select-text">
      {/* 1. LEFT COLUMN: Conversations Sidebar */}
      <div className="w-72 border-r border-[#E7ECF2] bg-white flex flex-col h-full shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-[#E7ECF2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-teal-50 border border-teal-200">
              <MessageSquare className="w-4 h-4 text-teal-700" />
            </span>
            <h2 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
              Conversations
            </h2>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="Create new conversation room"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#F0F3F7]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E7ECF2] rounded-xl text-xs text-[#172033] placeholder-[#94A3B8] focus:bg-white focus:border-teal-500 outline-hidden transition"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const lastMsg = conv.last_message;
            const timeStr = lastMsg?.created_at
              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full text-left p-3 rounded-xl transition cursor-pointer flex flex-col gap-1 border ${
                  isActive
                    ? 'bg-teal-50/60 border-teal-200 text-[#172033] shadow-2xs'
                    : 'bg-transparent border-transparent hover:bg-[#F8FAFC] text-[#657189]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isActive ? 'text-teal-950 font-bold' : 'text-[#172033]'
                    }`}
                  >
                    {conv.title}
                  </span>
                  {timeStr && (
                    <span className="text-[10px] text-[#94A3B8] font-mono shrink-0 ml-1">
                      {timeStr}
                    </span>
                  )}
                </div>

                {lastMsg && (
                  <p className="text-[11px] text-[#657189] line-clamp-1 break-words">
                    <span className="font-semibold text-[#475569]">
                      {lastMsg.sender_name}:
                    </span>{' '}
                    {lastMsg.message_content || lastMsg.content}
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {conv.message_count} msgs
                  </span>
                  {conv.conversation_type === 'team_shared' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      Team Room
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-6 text-center text-xs text-[#94A3B8]">
              No conversations found.
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTRE COLUMN: Active Chat Stream */}
      <div className="flex-1 flex flex-col h-full bg-[#FAFBFD] overflow-hidden">
        {/* Stream Top Header */}
        <div className="h-14 px-6 border-b border-[#E7ECF2] bg-white flex items-center justify-between shrink-0 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#172033]">
                {activeConv?.title || 'LedgerFlow Workspace Chat'}
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                Shared Space
              </span>
            </div>
            <p className="text-[10px] text-[#657189] mt-0.5">
              Humans (Alex, Maya) + AI Collaborators (NOVA, PIXEL)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Participant Avatars */}
            <div className="flex items-center -space-x-1.5">
              <div
                className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white"
                title="Alex (Founder / Decision Owner)"
              >
                A
              </div>
              <div
                className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white"
                title="Maya (Product Designer)"
              >
                M
              </div>
              <div
                className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white"
                title="NOVA (AI Product Strategist)"
              >
                N
              </div>
              <div
                className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white"
                title="PIXEL (AI Software Engineer)"
              >
                P
              </div>
            </div>

            {/* Context Panel Toggle */}
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-1.5 rounded-lg border border-[#E7ECF2] hover:bg-[#F8FAFC] text-[#657189] hover:text-[#172033] transition cursor-pointer"
              title={showRightPanel ? 'Hide context panel' : 'Show context panel'}
            >
              {showRightPanel ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Sequential Collaboration Stage Banner */}
        <WorkflowStageBanner
          stageInfo={stageInfo}
          onNavigateTab={onNavigateTab}
          onRefresh={loadWorkflowStage}
        />

        {/* Scrollable Messages Stream */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-48 text-xs text-[#94A3B8]">
              <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-2" />
              Loading messages...
            </div>
          ) : (
            messages.map((msg) => {
              const isHuman = msg.sender_type === 'human';
              const isNova = msg.sender_id === 'nova';
              const isPixel = msg.sender_id === 'pixel';
              const isSystem = msg.sender_type === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                      {msg.message_content || msg.content}
                    </span>
                  </div>
                );
              }

              // Identity avatar & colors
              const avatarBg = isNova
                ? 'bg-violet-600 text-white'
                : isPixel
                ? 'bg-teal-600 text-white'
                : msg.sender_id === 'maya'
                ? 'bg-indigo-600 text-white'
                : 'bg-blue-600 text-white';

              const roleLabel =
                msg.sender_role ||
                (isNova
                  ? 'AI Product Strategist'
                  : isPixel
                  ? 'AI Software Engineer'
                  : msg.sender_id === 'alex'
                  ? 'Founder / Decision Owner'
                  : 'Product Designer');

              const cardBorder = isNova
                ? 'border-violet-100 bg-white'
                : isPixel
                ? 'border-teal-100 bg-white'
                : isHuman
                ? 'border-blue-100 bg-white'
                : 'border-[#E7ECF2] bg-white';

              const timeStr = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div key={msg.id} className="flex items-start gap-3.5 max-w-3xl">
                  {/* Sender Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl ${avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs mt-0.5`}
                  >
                    {isNova ? (
                      <Bot className="w-4 h-4" />
                    ) : isPixel ? (
                      <Code className="w-4 h-4" />
                    ) : (
                      msg.sender_name?.[0] || 'U'
                    )}
                  </div>

                  {/* Message Bubble Card */}
                  <div
                    className={`flex-1 border ${cardBorder} rounded-2xl p-4 shadow-xs space-y-2`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#F0F3F7]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#172033]">
                          {msg.sender_name}
                        </span>
                        <span className="text-[10px] text-[#657189] font-medium">
                          {roleLabel}
                        </span>
                        {!isHuman && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                              isNova
                                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            AI Agent
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#94A3B8] font-mono">{timeStr}</span>
                    </div>

                    {/* Markdown Body */}
                    <ChatMessageMarkdown content={msg.message_content || msg.content || ''} />

                    {/* Delivery Status & Retry */}
                    {msg.status === 'failed' && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-700">
                        <span className="font-medium">
                          Failed to deliver message to agent. Check network or model quota.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(msg.message_content, msg.recipient_id as any)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition shadow-2xs cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {msg.status === 'sending' && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium italic pt-1">
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-400 border-t-transparent animate-spin" />
                        <span>Sending message...</span>
                      </div>
                    )}

                    {/* Embedded Linked Proposal Card if attached */}
                    {(msg.related_proposal_id || msg.related_proposal) && (
                      <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-teal-950/40 via-[#0B1E28]/50 to-[#0A1626]/60 border border-teal-500/30 shadow-lg space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 animate-pulse">
                              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                            </span>
                            <span className="text-xs font-bold text-teal-200 tracking-wide uppercase">
                              {msg.related_proposal?.proposal_type === 'prd_requirement'
                                ? 'Formal Product Requirements Document (PRD)'
                                : 'Actionable Proposal'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {msg.related_proposal?.status || 'AWAITING CONFIRMATION'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                          {msg.related_proposal?.summary ||
                            `Proposal #${(msg.related_proposal_id || '').slice(-6)}`}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                          <span className="text-[11px] text-slate-400">
                            Author: <strong className="text-slate-200">{msg.related_proposal?.author || msg.sender_name}</strong>
                          </span>
                          <button
                            onClick={() =>
                              onNavigateTab('proposals', msg.related_proposal_id || msg.related_proposal?.id)
                            }
                            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                          >
                            <span>View PRD in Proposals</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-3 text-xs text-[#657189] italic pl-2 py-2">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
              <span>{isTyping}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer Area */}
        <div className="p-4 bg-white border-t border-[#E7ECF2] shadow-sm shrink-0 space-y-3">
          {/* Recipient Selector Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] border border-[#E7ECF2] rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#657189] px-2">
                Send to:
              </span>
              <button
                type="button"
                onClick={() => setRecipient('team')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  recipient === 'team'
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'text-[#657189] hover:text-[#172033] hover:bg-white'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Entire Team</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipient('nova')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  recipient === 'nova'
                    ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                    : 'text-[#657189] hover:text-[#172033] hover:bg-white'
                }`}
              >
                <Bot className="w-3 h-3 text-violet-300" />
                <span>NOVA</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipient('pixel')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  recipient === 'pixel'
                    ? 'bg-teal-600 text-white font-semibold shadow-2xs'
                    : 'text-[#657189] hover:text-[#172033] hover:bg-white'
                }`}
              >
                <Code className="w-3 h-3 text-teal-300" />
                <span>PIXEL</span>
              </button>
            </div>

            <div className="text-[11px] text-[#94A3B8] hidden sm:block">
              Posting as <strong className="text-[#172033]">{identity === 'alex' ? 'Alex' : 'Maya'}</strong>
            </div>
          </div>

          {/* Textarea Composer */}
          <div className="relative bg-[#F8FAFC] border border-[#D9E1EC] focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100 rounded-xl transition shadow-2xs p-3">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                recipient === 'nova'
                  ? 'Message NOVA: "Can we formulate an updated PRD for automated receipt processing?"'
                  : recipient === 'pixel'
                  ? 'Message PIXEL: "Please update the hero headline and add spend trends to dashboard"'
                  : 'Message entire team: "How should we adjust manager approval thresholds?"'
              }
              className="w-full text-xs text-[#172033] placeholder-[#94A3B8] resize-none outline-hidden bg-transparent"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#E7ECF2] mt-2">
              <span className="text-[11px] text-[#94A3B8]">
                Press <kbd className="px-1 py-0.5 rounded bg-slate-200/70 border border-slate-300 text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-200/70 border border-slate-300 text-[10px] font-mono">Shift+Enter</kbd> for newline
              </span>

              <button
                type="button"
                disabled={!inputText.trim() || isSending}
                onClick={() => handleSendMessage()}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer ${
                  !inputText.trim() || isSending
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : recipient === 'nova'
                    ? 'bg-violet-600 hover:bg-violet-700 text-white'
                    : recipient === 'pixel'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {isSending ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT COLUMN: Live Collaboration Context Panel */}
      {showRightPanel && (
        <div className="w-80 border-l border-[#E7ECF2] bg-white flex flex-col h-full shrink-0 overflow-y-auto p-4 space-y-5 shadow-2xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-teal-50 border border-teal-200">
                <Info className="w-4 h-4 text-teal-700" />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                Collaboration Context
              </h3>
            </div>
          </div>

          {/* Active Collaborators Status */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
              Team Presence
            </p>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    A
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033]">Alex</p>
                    <p className="text-[10px] text-[#657189]">Founder / Decision Owner</p>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active" />
              </div>

              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033]">Maya</p>
                    <p className="text-[10px] text-[#657189]">Product Designer</p>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
              </div>

              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033]">NOVA</p>
                    <p className="text-[10px] text-[#657189]">AI Product Strategist</p>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold border border-violet-200">
                  Ready
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E7ECF2] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                    <Code className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033]">PIXEL</p>
                    <p className="text-[10px] text-[#657189]">AI Software Engineer</p>
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                  Ready
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
              Quick Prompts
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setRecipient('nova');
                  setInputText('NOVA, how should we structure the international travel expense approval policy?');
                  textareaRef.current?.focus();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E7ECF2] text-xs text-[#334155] transition cursor-pointer flex items-center justify-between group"
              >
                <span>Define Travel Policy</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-teal-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipient('pixel');
                  setInputText('PIXEL, please update the metrics cards to include multi-currency tracking.');
                  textareaRef.current?.focus();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E7ECF2] text-xs text-[#334155] transition cursor-pointer flex items-center justify-between group"
              >
                <span>Add Multi-Currency Cards</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-teal-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecipient('team');
                  setInputText('Team, how should we handle automatic receipts OCR extraction?');
                  textareaRef.current?.focus();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E7ECF2] text-xs text-[#334155] transition cursor-pointer flex items-center justify-between group"
              >
                <span>Receipt OCR Flow</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-teal-600" />
              </button>
            </div>
          </div>

          {/* Recent Proposals */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#657189]">
                Recent Proposals
              </p>
              <button
                onClick={() => onNavigateTab('proposals')}
                className="text-[10px] font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                View all ({proposals.length})
              </button>
            </div>

            <div className="space-y-2">
              {proposals.slice(0, 3).map((p) => (
                <button
                  key={p.proposal_id}
                  onClick={() => onNavigateTab('proposals', p.proposal_id)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-teal-50/50 border border-[#E7ECF2] hover:border-teal-200 transition cursor-pointer space-y-1 block"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#172033] line-clamp-1">
                      {p.summary}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#657189]">
                    Author: {p.created_by || p.agent_id || 'System'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Conversation Room Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E7ECF2] shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F3F7]">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-teal-50 border border-teal-200">
                  <MessageSquare className="w-4 h-4 text-teal-700" />
                </span>
                <h3 className="text-sm font-bold text-[#172033]">New Conversation Room</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Room Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Audit Logging Policy, Currency Conversion"
                  className="w-full px-3 py-2 border border-[#D9E1EC] rounded-xl text-xs text-[#172033] focus:border-teal-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Default Room Members
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#475569]">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Alex (Decision Owner)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Maya (Designer)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    <span>NOVA (AI Strategist)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span>PIXEL (AI Engineer)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0F3F7]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#657189] hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
