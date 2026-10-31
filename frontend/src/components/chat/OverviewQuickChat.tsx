import React, { useState } from 'react';
import { Sparkles, Send, Bot, Code, Users } from 'lucide-react';
import { HumanIdentity } from '../../types';
import { sendChatMessage } from '../../lib/api';

interface OverviewQuickChatProps {
  identity: HumanIdentity;
  onNavigateTab: (tab: any) => void;
  defaultConversationId?: string;
}

export const OverviewQuickChat: React.FC<OverviewQuickChatProps> = ({
  identity,
  onNavigateTab,
  defaultConversationId = 'conv_team_ledgerflow',
}) => {
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState<'team' | 'nova' | 'pixel'>('team');
  const [isSending, setIsSending] = useState(false);

  const suggestedPrompts = [
    {
      label: 'Define Travel Policy',
      text: 'Ask NOVA to define international travel expense policies and approval rules',
      recipient: 'nova' as const,
    },
    {
      label: 'Multi-Currency Cards',
      text: 'Ask PIXEL to add multi-currency cards and exchange rates to the dashboard',
      recipient: 'pixel' as const,
    },
    {
      label: 'Receipt OCR Workflow',
      text: 'Team, how should we structure the automated receipt OCR scanning workflow?',
      recipient: 'team' as const,
    },
    {
      label: 'Approval Thresholds',
      text: 'Ask NOVA how to streamline manager approval thresholds for enterprise tier',
      recipient: 'nova' as const,
    },
  ];

  const handleSend = async (contentToSend?: string, recipientOverride?: 'team' | 'nova' | 'pixel') => {
    const text = (contentToSend || message).trim();
    if (!text || isSending) return;

    const targetRecipient = recipientOverride || recipient;
    setIsSending(true);
    try {
      const sender = identity || 'alex';
      await sendChatMessage('demo-ledgerflow', defaultConversationId, {
        sender_id: sender,
        message_content: text,
        recipient: targetRecipient,
      });
      setMessage('');
      onNavigateTab('chat');
    } catch (err) {
      console.error('Failed to dispatch quick chat message:', err);
      // Even if network blips, navigate to chat so user sees live room
      onNavigateTab('chat');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-gradient-to-br from-white via-[#FAFBFD] to-[#F0FDF4] border border-[#E7ECF2] rounded-2xl p-6 shadow-sm relative overflow-hidden">
      {/* Background subtle decoration */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-teal-50 border border-teal-200">
              <Sparkles className="w-4 h-4 text-teal-700" />
            </span>
            <h2 className="text-sm font-bold text-[#172033]">What would you like to build today?</h2>
          </div>
          <p className="text-xs text-[#657189] mt-1">
            Share an idea, ask NOVA for product guidance, or collaborate with your AI engineering team.
          </p>
        </div>

        {/* Recipient Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E7ECF2] rounded-xl self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Entire Team</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-violet-300" />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              recipient === 'pixel'
                ? 'bg-teal-600 text-white font-semibold shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-[#F8FAFC]'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-teal-300" />
            <span>PIXEL</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="relative bg-white border border-[#D9E1EC] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100 rounded-xl transition shadow-2xs p-3">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            recipient === 'nova'
              ? 'Ask NOVA: "Can we define policy rules for international business travel?"'
              : recipient === 'pixel'
              ? 'Ask PIXEL: "Add multi-currency spend tracking cards to the dashboard"'
              : 'Collaborate with Team: "How should we structure automated expense audit logging?"'
          }
          className="w-full text-xs text-[#172033] placeholder-[#94A3B8] resize-none outline-hidden bg-transparent"
        />

        <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] mt-2">
          <span className="text-[11px] text-[#94A3B8]">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono">Shift+Enter</kbd> for newline
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('chat')}
              className="text-xs text-[#657189] hover:text-teal-700 font-medium px-2 py-1 rounded cursor-pointer"
            >
              Open Full Chat
            </button>
            <button
              type="button"
              disabled={!message.trim() || isSending}
              onClick={() => handleSend()}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer ${
                !message.trim() || isSending
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Prompts Pills */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-[#657189] uppercase tracking-wider">
          Suggested:
        </span>
        {suggestedPrompts.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setRecipient(s.recipient);
              setMessage(s.text);
            }}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7ECF2] hover:border-slate-300 text-[11px] text-[#475569] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                s.recipient === 'nova'
                  ? 'bg-violet-500'
                  : s.recipient === 'pixel'
                  ? 'bg-teal-500'
                  : 'bg-slate-700'
              }`}
            />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
