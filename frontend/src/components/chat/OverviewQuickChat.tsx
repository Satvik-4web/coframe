import React, { useState } from 'react';
import { Sparkles, Bot, Code2, Users, ArrowRight, CornerDownLeft } from 'lucide-react';
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
  const [recipient, setRecipient] = useState<'team' | 'nova' | 'pixel'>('nova');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const suggestedPrompts = [
    {
      label: 'Expense Approvals',
      text: 'Improve the expense approval experience with tiered manager thresholds and SLA timers.',
      recipient: 'nova' as const,
    },
    {
      label: 'International Travel Policy',
      text: 'Add international travel policy support with automated per diem caps and exchange rate freezing.',
      recipient: 'nova' as const,
    },
    {
      label: 'Multi-Currency Handling',
      text: 'Introduce multi-currency expense handling with live FX conversion across 12 European corridors.',
      recipient: 'nova' as const,
    },
    {
      label: 'Analytics Dashboard',
      text: 'Improve the analytics dashboard with department burn rate velocity and anomaly outlier detection.',
      recipient: 'nova' as const,
    },
  ];

  const handleSend = async (contentToSend?: string, recipientOverride?: 'team' | 'nova' | 'pixel') => {
    const text = (contentToSend || message).trim();
    if (!text || isSending) return;

    const targetRecipient = recipientOverride || recipient;
    setIsSending(true);
    setSendError(null);
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
      setSendError(err instanceof Error ? err.message : 'Could not send this message. Please try again.');
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
    <section className="dashboard-card relative overflow-hidden rounded-[22px] p-5 sm:p-7">
      {/* Header with Title and Recipient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#EDF2FA] tracking-tight">Start a conversation</h2>
            <p className="text-xs sm:text-sm text-[#96A6BE]">
              Share a product idea with NOVA, PIXEL, or the whole team.
            </p>
          </div>
        </div>

        {/* Recipient Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#121923] rounded-xl self-start sm:self-auto border border-[#303A4B]/50">
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-[#1A202C] text-blue-300 font-semibold shadow-xs'
                : 'text-[#ACBAD0] hover:text-[#EDF2FA]'
            }`}
          >
            <Bot className="w-3 h-3 text-blue-500" />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'pixel'
                ? 'bg-[#1A202C] text-sky-300 font-semibold shadow-xs'
                : 'text-[#ACBAD0] hover:text-[#EDF2FA]'
            }`}
          >
            <Code2 className="w-3 h-3 text-sky-400" />
            <span>PIXEL</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-[#1A202C] text-[#EDF2FA] font-semibold shadow-xs'
                : 'text-[#ACBAD0] hover:text-[#EDF2FA]'
            }`}
          >
            <Users className="w-3 h-3 text-[#8495AD]" />
            <span>Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      {sendError && <p role="alert" className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-300">{sendError}</p>}
      <div className="relative bg-[#141A24] border border-[#303A4B] focus-within:border-blue-400 focus-within:bg-[#1A202C] focus-within:ring-4 focus-within:ring-blue-100 rounded-2xl transition p-4">
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What should the team work on next?"
          className="w-full text-sm leading-6 text-[#EDF2FA] placeholder-slate-400 resize-none outline-none bg-transparent"
        />

        <div className="flex items-center justify-between pt-3 border-t border-[#303A4B]/60 mt-1">
          <span className="text-[10px] text-[#8495AD] flex items-center gap-1">
            <span>Press</span>
            <kbd className="px-1 py-0.5 rounded bg-[#303D50]/70 text-[#ACBAD0] font-mono text-[9px]">Enter ↵</kbd>
            <span>to collaborate</span>
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              message.trim() && !isSending
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                : 'bg-[#303D50]/70 text-[#8495AD] cursor-not-allowed'
            }`}
          >
            <span>{isSending ? 'Dispatching...' : 'Dispatch'}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="mt-5 pt-4 border-t border-[#303A4B]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-[#8495AD] uppercase tracking-wider">
            Quick Prompts
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              title={item.text}
              className="inline-flex items-center gap-2 rounded-full border border-[#303A4B] bg-[#1A202C] px-3.5 py-2 text-xs font-semibold text-[#ACBAD0] transition hover:border-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <span>{item.label}</span><ArrowRight className="h-3 w-3" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
