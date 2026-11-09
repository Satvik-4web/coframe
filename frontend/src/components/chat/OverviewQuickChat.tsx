import React, { useState } from 'react';
import { Sparkles, Send, Bot, Code2, Users, ArrowRight, CornerDownLeft } from 'lucide-react';
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
    <div className="bg-[#0F1528] border border-[#1A223D] rounded-xl p-5 shadow-md relative overflow-hidden">
      {/* Header with Title and Recipient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Initiate Product Work</h2>
            <p className="text-[11px] text-[#7888AB]">
              Formulate a feature or design idea. NOVA automatically produces a structured PRD.
            </p>
          </div>
        </div>

        {/* Recipient Selector Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-[#141A33] rounded-lg self-start sm:self-auto border border-[#222C52]">
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bot className="w-3 h-3 text-indigo-400" />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'pixel'
                ? 'bg-teal-600/30 text-teal-300 font-semibold border border-teal-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3 h-3 text-teal-400" />
            <span>PIXEL</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-[#1E274A] text-white font-semibold border border-[#2E3C6E] shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3 text-slate-400" />
            <span>Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="relative bg-[#141A33] border border-[#222C52] focus-within:border-indigo-500/60 focus-within:bg-[#161E3B] focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-lg transition p-3">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Introduce a multi-currency expense approval workflow into LedgerFlow..."
          className="w-full text-xs text-white placeholder-slate-500 resize-none outline-none bg-transparent"
        />

        <div className="flex items-center justify-between pt-2 border-t border-[#1F294D] mt-1">
          <span className="text-[10px] text-[#7888AB] flex items-center gap-1">
            <span>Press</span>
            <kbd className="px-1 py-0.5 rounded bg-[#1C2442] text-slate-300 font-mono text-[9px] border border-[#2A3660]">Enter ↵</kbd>
            <span>to collaborate</span>
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              message.trim() && !isSending
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md'
                : 'bg-[#1C2442] text-slate-500 cursor-not-allowed border border-[#253055]'
            }`}
          >
            <span>{isSending ? 'Dispatching...' : 'Dispatch'}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="mt-3.5 pt-3 border-t border-[#1A223D]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#7888AB] uppercase tracking-wider">
            Quick Prompts
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              className="text-left p-2.5 rounded-lg bg-[#141A33] hover:bg-[#182142] border border-[#222C52] hover:border-[#334273] text-xs transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <span className="font-semibold text-white group-hover:text-indigo-300 block text-xs truncate">
                  {item.label}
                </span>
                <p className="text-[11px] text-[#8695B7] line-clamp-2 mt-0.5 leading-snug">
                  {item.text}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium mt-2">
                <span>Start</span>
                <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
