import React, { useState } from 'react';
import { Sparkles, Send, Bot, Code, Users, ArrowRight } from 'lucide-react';
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
    <div className="bg-white border border-[#E8EAF2] rounded-2xl p-6 shadow-sm relative overflow-hidden">
      {/* Subtle violet/indigo glow in corner */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-violet-50 border border-violet-200">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </span>
            <h2 className="text-base font-bold text-[#172033]">What would you like to build today?</h2>
          </div>
          <p className="text-xs text-[#657189] mt-1">
            Describe a product idea or improvement. NOVA will help turn it into a clear product specification.
          </p>
        </div>

        {/* Recipient Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F8FC] border border-[#E8EAF2] rounded-xl self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>NOVA (Product)</span>
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
            <Code className="w-3.5 h-3.5" />
            <span>PIXEL (Eng)</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'text-[#657189] hover:text-[#172033] hover:bg-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Entire Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="relative bg-[#F7F8FC] border border-[#E8EAF2] focus-within:border-violet-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 rounded-xl transition shadow-2xs p-3">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Introduce a multi-currency expense approval workflow into LedgerFlow..."
          className="w-full text-xs text-[#172033] placeholder-[#94A3B8] resize-none outline-hidden bg-transparent"
        />

        <div className="flex items-center justify-between pt-2 border-t border-[#E8EAF2] mt-2">
          <span className="text-[11px] text-[#94A3B8]">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd> to start collaboration
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer ${
              message.trim() && !isSending
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>{isSending ? 'Dispatching...' : 'Start Collaboration'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Suggested Prompts */}
      <div className="mt-4 pt-3 border-t border-[#E8EAF2]">
        <span className="text-[11px] font-bold text-[#657189] uppercase tracking-wider block mb-2">
          Suggested Features & Prompts:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              className="text-left p-2.5 rounded-xl bg-[#F7F8FC] hover:bg-violet-50/60 border border-[#E8EAF2] hover:border-violet-200 text-xs transition cursor-pointer group flex flex-col justify-between"
            >
              <span className="font-bold text-[#172033] group-hover:text-violet-900 block truncate">
                {item.label}
              </span>
              <p className="text-[11px] text-[#657189] group-hover:text-[#475569] line-clamp-2 mt-1">
                {item.text}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-violet-600 font-semibold mt-2 group-hover:translate-x-0.5 transition-transform">
                <span>Dispatch to NOVA</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
