import React, { useState } from 'react';
import { Terminal, Cpu, Code2, Users, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
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
      color: '#A78BFA',
    },
    {
      label: 'International Travel Policy',
      text: 'Add international travel policy support with automated per diem caps and exchange rate freezing.',
      recipient: 'nova' as const,
      color: '#22D3EE',
    },
    {
      label: 'Multi-Currency Handling',
      text: 'Introduce multi-currency expense handling with live FX conversion across 12 European corridors.',
      recipient: 'nova' as const,
      color: '#60A5FA',
    },
    {
      label: 'Analytics Dashboard',
      text: 'Improve the analytics dashboard with department burn rate velocity and anomaly outlier detection.',
      recipient: 'nova' as const,
      color: '#34D399',
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
    <div
      className="overview-work-card p-5 relative overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Header & Segmented Recipient Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.2), rgba(34, 211, 238, 0.2))',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              color: '#818CF8',
              boxShadow: '0 0 15px rgba(129, 140, 248, 0.2)',
            }}
          >
            <Terminal className="w-4.5 h-4.5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Direct product work</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Share a feature requirement or refinement. NOVA prepares a structured PRD for confirmation.
            </p>
          </div>
        </div>

        {/* Recipient Selector */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl self-start sm:self-auto border"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => setRecipient('nova')}
            aria-pressed={recipient === 'nova'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            style={
              recipient === 'nova'
                ? {
                    background: 'rgba(167, 139, 250, 0.2)',
                    color: '#A78BFA',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    boxShadow: '0 0 12px rgba(167, 139, 250, 0.25)',
                  }
                : { color: '#64748B' }
            }
          >
            <Cpu className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>NOVA</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('pixel')}
            aria-pressed={recipient === 'pixel'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            style={
              recipient === 'pixel'
                ? {
                    background: 'rgba(34, 211, 238, 0.2)',
                    color: '#22D3EE',
                    border: '1px solid rgba(34, 211, 238, 0.4)',
                    boxShadow: '0 0 12px rgba(34, 211, 238, 0.25)',
                  }
                : { color: '#64748B' }
            }
          >
            <Code2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>PIXEL</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipient('team')}
            aria-pressed={recipient === 'team'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            style={
              recipient === 'team'
                ? {
                    background: 'rgba(96, 165, 250, 0.2)',
                    color: '#60A5FA',
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    boxShadow: '0 0 12px rgba(96, 165, 250, 0.25)',
                  }
                : { color: '#64748B' }
            }
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Team</span>
          </button>
        </div>
      </div>

      {/* Input Composer Box */}
      <div
          className="overview-composer relative rounded-xl transition p-3.5 border focus-within:border-indigo-400/50"
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <textarea
          aria-label="Describe a product capability or refinement"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a capability for LedgerFlow, e.g. multi-currency expense approvals with live FX rates..."
          className="w-full text-[13px] text-white placeholder-slate-500 resize-none outline-none bg-transparent leading-relaxed"
        />

        <div
          className="flex items-center justify-between pt-2.5 mt-2 border-t"
          style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
        >
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Press</span>
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
              }}
            >
              Enter ↵
            </kbd>
            <span>to send</span>
          </span>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!message.trim() || isSending}
            className="h-8 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            style={
              message.trim() && !isSending
                ? {
                    background: 'linear-gradient(135deg, #818CF8, #A78BFA)',
                    color: '#FFFFFF',
                    boxShadow: '0 0 15px rgba(129, 140, 248, 0.4)',
                  }
                : {
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#475569',
                    cursor: 'not-allowed',
                  }
            }
          >
            <span>{isSending ? 'Sending...' : 'Send to agent'}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Suggested Starter Prompts */}
      <div
        className="mt-4 pt-3.5 border-t"
        style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
            Starter scenarios
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {suggestedPrompts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSend(item.text, item.recipient)}
              className="overview-starter text-left p-3 rounded-xl border transition cursor-pointer group flex flex-col justify-between"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = `${item.color}40`;
                e.currentTarget.style.boxShadow = `0 0 15px ${item.color}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <span
                  className="font-semibold block text-xs truncate transition-colors"
                  style={{ color: item.color }}
                >
                  {item.label}
                </span>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {item.text}
                </p>
              </div>
              <div
                className="flex items-center gap-1 text-[11px] font-semibold mt-2.5 transition-colors"
                style={{ color: item.color }}
              >
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
