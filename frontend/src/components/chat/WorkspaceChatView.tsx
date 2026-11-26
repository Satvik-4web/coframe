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
  const [showRightPanel, setShowRightPanel] = useState(false);
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
    <div className="flex h-full w-full overflow-hidden select-text" style={{ background: 'var(--bg-base)' }}>
      {/* 1. LEFT COLUMN: Conversations Sidebar */}
      <div
        className="w-72 border-r flex flex-col h-full shrink-0"
        style={{
          background: 'rgba(10, 13, 22, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Header */}
        <div
          className="h-14 px-4 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Conversations
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white border transition cursor-pointer"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
            title="Create new room"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 outline-none border transition"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
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
                type="button"
                key={conv.id}
                onClick={() => setActiveConversationId(conv.id)}
                className="w-full text-left p-3 rounded-xl transition cursor-pointer flex flex-col gap-1 border"
                style={
                  isActive
                    ? {
                        background: 'rgba(129, 140, 248, 0.12)',
                        borderColor: 'rgba(129, 140, 248, 0.3)',
                        boxShadow: '0 0 15px rgba(129, 140, 248, 0.15)',
                      }
                    : {
                        background: 'transparent',
                        borderColor: 'transparent',
                        color: '#94A3B8',
                      }
                }
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs truncate ${
                      isActive ? 'text-white font-bold' : 'text-slate-300 font-medium'
                    }`}
                  >
                    {conv.title}
                  </span>
                  {timeStr && (
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
                      {timeStr}
                    </span>
                  )}
                </div>

                {lastMsg && (
                  <p className="text-[11px] text-slate-400 line-clamp-1 break-words">
                    <span className="font-semibold text-slate-300">
                      {lastMsg.sender_name}:
                    </span>{' '}
                    {lastMsg.message_content || lastMsg.content}
                  </p>
                )}

                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#94A3B8',
                    }}
                  >
                    {conv.message_count} msgs
                  </span>
                  {conv.conversation_type === 'team_shared' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold border"
                      style={{
                        background: 'rgba(129, 140, 248, 0.12)',
                        borderColor: 'rgba(129, 140, 248, 0.25)',
                        color: '#A78BFA',
                      }}
                    >
                      Team room
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No conversations found.
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTRE COLUMN: Active Chat Stream */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {/* Stream Top Header */}
        <div
          className="h-14 px-6 border-b flex items-center justify-between shrink-0"
          style={{
            background: 'rgba(8, 11, 20, 0.85)',
            borderColor: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                {activeConv?.title || 'LedgerFlow Workspace Chat'}
              </h1>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                style={{
                  background: 'rgba(52, 211, 153, 0.1)',
                  borderColor: 'rgba(52, 211, 153, 0.25)',
                  color: '#34D399',
                }}
              >
                Shared space
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Alex, Maya, NOVA & PIXEL
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Participant Avatars */}
            <div className="flex items-center -space-x-1.5">
              {[
                { label: 'A', title: 'Alex', bg: 'rgba(96,165,250,0.2)', color: '#60A5FA', ring: '#60A5FA' },
                { label: 'M', title: 'Maya', bg: 'rgba(244,114,182,0.2)', color: '#F472B6', ring: '#F472B6' },
                { label: 'N', title: 'NOVA', bg: 'rgba(167,139,250,0.2)', color: '#A78BFA', ring: '#A78BFA' },
                { label: 'P', title: 'PIXEL', bg: 'rgba(34,211,238,0.2)', color: '#22D3EE', ring: '#22D3EE' },
              ].map(({ label, title, bg, color, ring }) => (
                <div
                  key={label}
                  className="w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center border"
                  title={title}
                  style={{ background: bg, color, borderColor: ring }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Context Panel Toggle */}
            <button
              type="button"
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white border transition cursor-pointer"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
              title={showRightPanel ? 'Hide context panel' : 'Show context panel'}
            >
              {showRightPanel ? (
                <PanelRightClose className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <PanelRightOpen className="w-4 h-4" strokeWidth={1.75} />
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

              // Identity avatar & colors with verified design tokens
              const avatarBg = isNova
                ? 'bg-[#7C3AED] text-white'
                : isPixel
                ? 'bg-[#0D9488] text-white'
                : msg.sender_id === 'maya'
                ? 'bg-[#D946A1] text-white'
                : 'bg-[#2563EB] text-white';

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
                ? 'rgba(167, 139, 250, 0.25)'
                : isPixel
                ? 'rgba(34, 211, 238, 0.25)'
                : msg.sender_id === 'maya'
                ? 'rgba(244, 114, 182, 0.25)'
                : 'rgba(96, 165, 250, 0.25)';

              const cardBg = isNova
                ? 'rgba(167, 139, 250, 0.05)'
                : isPixel
                ? 'rgba(34, 211, 238, 0.05)'
                : msg.sender_id === 'maya'
                ? 'rgba(244, 114, 182, 0.05)'
                : 'rgba(96, 165, 250, 0.05)';

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
                    className="flex-1 rounded-2xl p-4 space-y-2 border"
                    style={{
                      background: cardBg,
                      borderColor: cardBorder,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {msg.sender_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {roleLabel}
                        </span>
                        {!isHuman && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono border"
                            style={
                              isNova
                                ? { background: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA', borderColor: 'rgba(167, 139, 250, 0.3)' }
                                : { background: 'rgba(34, 211, 238, 0.15)', color: '#22D3EE', borderColor: 'rgba(34, 211, 238, 0.3)' }
                            }
                          >
                            AI Agent
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{timeStr}</span>
                    </div>

                    {/* Markdown Body */}
                    <ChatMessageMarkdown content={msg.message_content || msg.content || ''} />

                    {/* Delivery Status & Retry */}
                    {msg.status === 'failed' && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
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
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium italic pt-1">
                        <span className="w-2.5 h-2.5 rounded-full border border-slate-500 border-t-transparent animate-spin" />
                        <span>Sending message...</span>
                      </div>
                    )}

                    {/* Embedded Linked Proposal Card if attached */}
                    {(msg.related_proposal_id || msg.related_proposal) && (
                      <div
                        className="mt-3 p-4 rounded-2xl border space-y-2.5"
                        style={{
                          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(34, 211, 238, 0.08))',
                          borderColor: 'rgba(167, 139, 250, 0.3)',
                          boxShadow: '0 0 20px rgba(167, 139, 250, 0.15)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-violet-500/20 text-violet-300">
                              <Sparkles className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                              {msg.related_proposal?.proposal_type === 'prd_requirement'
                                ? 'Formal Product Requirements Document (PRD)'
                                : 'Actionable Engineering Proposal'}
                            </span>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono"
                            style={{
                              background: 'rgba(251, 191, 36, 0.15)',
                              borderColor: 'rgba(251, 191, 36, 0.3)',
                              color: '#FBBF24',
                            }}
                          >
                            {msg.related_proposal?.status ? msg.related_proposal.status.toUpperCase() : 'AWAITING CONFIRMATION'}
                          </span>
                        </div>

                        <p className="text-xs text-white font-semibold leading-relaxed">
                          {msg.related_proposal?.summary ||
                            `Proposal #${(msg.related_proposal_id || '').slice(-6)}`}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                          <span className="text-[11px] text-slate-400">
                            Author: <strong className="text-slate-200">{msg.related_proposal?.author || msg.sender_name}</strong>
                          </span>
                          <button
                            onClick={() =>
                              onNavigateTab('proposals', msg.related_proposal_id || msg.related_proposal?.id)
                            }
                            className="px-3.5 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            style={{
                              background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
                              boxShadow: '0 0 15px rgba(129, 140, 248, 0.4)',
                            }}
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
            <div className="flex items-center gap-3 text-xs text-slate-400 italic pl-2 py-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>{isTyping}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer Area */}
        <div
          className="p-4 shrink-0 space-y-3 border-t"
          style={{
            background: 'rgba(8, 11, 20, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Recipient Selector Toggle */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-0.5 p-1 rounded-xl border"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <span className="text-[11px] font-medium text-slate-400 px-2.5">
                To:
              </span>
              <button
                type="button"
                onClick={() => setRecipient('team')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                style={
                  recipient === 'team'
                    ? {
                        background: 'rgba(96, 165, 250, 0.2)',
                        color: '#60A5FA',
                        boxShadow: '0 0 10px rgba(96, 165, 250, 0.25)',
                      }
                    : { color: '#64748B' }
                }
              >
                <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Entire Team</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipient('nova')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                style={
                  recipient === 'nova'
                    ? {
                        background: 'rgba(167, 139, 250, 0.2)',
                        color: '#A78BFA',
                        boxShadow: '0 0 10px rgba(167, 139, 250, 0.25)',
                      }
                    : { color: '#64748B' }
                }
              >
                <Bot className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>NOVA</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipient('pixel')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                style={
                  recipient === 'pixel'
                    ? {
                        background: 'rgba(34, 211, 238, 0.2)',
                        color: '#22D3EE',
                        boxShadow: '0 0 10px rgba(34, 211, 238, 0.25)',
                      }
                    : { color: '#64748B' }
                }
              >
                <Code className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>PIXEL</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 hidden sm:block">
              Posting as <strong className="font-semibold text-white">{identity === 'alex' ? 'Alex' : 'Maya'}</strong>
            </div>
          </div>

          {/* Textarea Composer */}
          <div
            className="relative rounded-xl p-3.5 border transition focus-within:border-indigo-400/50"
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
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
              className="w-full text-[13px] text-white placeholder-slate-500 resize-none outline-none bg-transparent leading-relaxed"
            />

            <div
              className="flex items-center justify-between pt-2.5 mt-2 border-t"
              style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <span className="text-[11px] text-slate-500">
                Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono border" style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#94A3B8' }}>Enter</kbd> to send
              </span>

              <button
                type="button"
                disabled={!inputText.trim() || isSending}
                onClick={() => handleSendMessage()}
                className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
                  color: '#FFFFFF',
                  boxShadow: '0 0 15px rgba(129, 140, 248, 0.4)',
                }}
              >
                {isSending ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Send message</span>
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
