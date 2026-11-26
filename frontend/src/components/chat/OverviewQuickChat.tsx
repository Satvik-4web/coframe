import React, { useState } from 'react';
import { Terminal, Cpu, Code2, Users, ArrowRight, CornerDownLeft } from 'lucide-react';
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
    <div className="coframe-card p-5 relative overflow-hidden">
      {/* Header & Apple Segmented Recipient Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-900/[0.06] flex items-center justify-center text-slate-700 shrink-0">
            <Terminal className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Direct product work
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share a feature requirement or refinement. NOVA prepares a structured PRD for confirmation.
            </p>
          </div>
        </div>

        {/* Apple Segmented Control */}
        <div className="flex items-center gap-0.5 p-1 bg-[#F1F4F8] rounded-xl self-start sm:self-auto border border-slate-900/[0.06]">
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer ${
              recipient === 'nova'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className={`w-3.5 h-3.5 ${recipient === 'nova' ? 'text-[#6D28D9]' : 'text-slate-400'}`} strokeWidth={1.75} />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer ${
              recipient === 'pixel'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className={`w-3.5 h-3.5 ${recipient === 'pixel' ? 'text-[#0F766E]' : 'text-slate-400'}`} strokeWidth={1.75} />
            <span>PIXEL</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer ${
              recipient === 'team'
                ? 'bg-white text-slate-900 font-medium shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${recipient === 'team' ? 'text-[#2563EB]' : 'text-slate-400'}`} strokeWidth={1.75} />
            <span>Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div className="relative bg-[#F8FAFC] border border-slate-900/[0.08] focus-within:border-[#2563EB]/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#2563EB]/[0.07] rounded-xl transition p-3.5">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a capability for LedgerFlow, e.g. multi-currency expense approvals with live FX rates..."
          className="w-full text-[13px] text-slate-900 placeholder-slate-400 resize-none outline-none bg-transparent leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2.5 border-t border-slate-900/[0.06] mt-2">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-white border border-slate-900/[0.08] text-slate-600 font-mono text-[10px] shadow-2xs">
              Enter ↵
            </kbd>
            <span>to send</span>
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className={`h-8 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              message.trim() && !isSending
                ? 'btn-obsidian'
                : 'bg-slate-200/70 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>{isSending ? 'Sending...' : 'Send to agent'}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggested Starter Prompts */}
      <div className="mt-4 pt-3.5 border-t border-slate-900/[0.06]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-medium text-slate-500">
            Starter scenarios
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              className="text-left p-3 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-900/[0.06] hover:border-slate-900/[0.14] hover:shadow-[0_2px_6px_rgba(15,23,42,0.04)] text-xs transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <span className="font-medium text-slate-900 group-hover:text-[#2563EB] block text-xs truncate transition-colors">
                  {item.label}
                </span>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {item.text}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-[#2563EB] font-medium mt-2.5 transition-colors">
                <span>Run prompt</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
