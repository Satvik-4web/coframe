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
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs relative overflow-hidden">
      {/* Header with Title and Recipient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Initiate Product Work</h2>
            <p className="text-[11px] text-slate-500">
              Formulate a feature or design idea. NOVA automatically produces a structured PRD.
            </p>
          </div>
        </div>

        {/* Recipient Selector Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100/80 rounded-lg self-start sm:self-auto border border-slate-200/50">
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3 h-3 text-indigo-500" />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'pixel'
                ? 'bg-white text-teal-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3 h-3 text-teal-500" />
            <span>PIXEL</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3 h-3 text-slate-400" />
            <span>Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="relative bg-slate-50/70 border border-slate-200/80 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/5 rounded-lg transition p-3">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Introduce a multi-currency expense approval workflow into LedgerFlow..."
          className="w-full text-xs text-slate-900 placeholder-slate-400 resize-none outline-none bg-transparent"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 mt-1">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <span>Press</span>
            <kbd className="px-1 py-0.5 rounded bg-slate-200/70 text-slate-600 font-mono text-[9px]">Enter ↵</kbd>
            <span>to collaborate</span>
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              message.trim() && !isSending
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-200/70 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>{isSending ? 'Dispatching...' : 'Dispatch'}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick Prompts
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              className="text-left p-2.5 rounded-lg bg-slate-50/60 hover:bg-slate-100/80 border border-slate-200/60 hover:border-slate-300 text-xs transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <span className="font-semibold text-slate-900 group-hover:text-indigo-600 block text-xs truncate">
                  {item.label}
                </span>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {item.text}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium mt-2">
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
