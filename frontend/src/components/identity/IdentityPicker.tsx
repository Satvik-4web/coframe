import React from 'react';
import { HumanIdentity } from '../../types';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';

interface IdentityPickerProps {
  onSelect: (id: HumanIdentity) => void;
}

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient glow orbs */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute w-[600px] h-[600px] rounded-full -top-32 -left-32 opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.3) 0%, transparent 70%)' }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full -bottom-20 -right-20 opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-2xl w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-12">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #818CF8 0%, #22D3EE 100%)',
                boxShadow: '0 0 40px rgba(129,140,248,0.5), 0 0 80px rgba(34,211,238,0.2)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1.2" fill="#FFFFFF" />
                <rect x="9" y="2" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.7)" />
                <rect x="2" y="9" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.7)" />
                <rect x="9" y="9" width="5" height="5" rx="1.2" fill="rgba(255,255,255,0.35)" />
              </svg>
            </div>
          </div>

          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-mono font-semibold"
            style={{
              background: 'rgba(129,140,248,0.10)',
              border: '1px solid rgba(129,140,248,0.25)',
              color: '#A78BFA',
            }}
          >
            <Zap className="w-3 h-3" />
            COFRAME · LedgerFlow Workspace
          </div>

          <h1 className="text-[32px] font-bold tracking-[-0.03em] leading-tight text-white mb-3">
            Select your{' '}
            <span className="gradient-text">collaborator role</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Enter the shared workspace to review requirements, approve specifications, and guide NOVA and PIXEL.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Alex Card */}
          <div
            onClick={() => onSelect('alex')}
            className="group cursor-pointer flex flex-col justify-between rounded-2xl p-6 transition-all duration-200"
            style={{
              background: 'rgba(96,165,250,0.06)',
              border: '1px solid rgba(96,165,250,0.18)',
              boxShadow: '0 0 0 0 rgba(96,165,250,0)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.10)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(96,165,250,0.35)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px rgba(96,165,250,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.06)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(96,165,250,0.18)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 0 rgba(96,165,250,0)';
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{
                    background: 'rgba(96,165,250,0.15)',
                    border: '1px solid rgba(96,165,250,0.30)',
                    color: '#60A5FA',
                    boxShadow: '0 0 16px rgba(96,165,250,0.2)',
                  }}
                >
                  A
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.25)' }}
                >
                  Decision Owner
                </span>
              </div>

              <h2 className="text-lg font-bold text-white tracking-tight">Alex</h2>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#60A5FA' }}>Founder & Approver</p>
              <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
                Sets product direction, confirms NOVA specifications, and holds exclusive approval authority over high-impact changes.
              </p>
            </div>

            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(96,165,250,0.12)' }}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSelect('alex'); }}
                className="w-full h-10 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                style={{
                  background: 'rgba(96,165,250,0.15)',
                  color: '#60A5FA',
                  border: '1px solid rgba(96,165,250,0.30)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96,165,250,0.25)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(96,165,250,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96,165,250,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <span>Continue as Alex</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Maya Card */}
          <div
            onClick={() => onSelect('maya')}
            className="group cursor-pointer flex flex-col justify-between rounded-2xl p-6 transition-all duration-200"
            style={{
              background: 'rgba(244,114,182,0.06)',
              border: '1px solid rgba(244,114,182,0.18)',
              boxShadow: '0 0 0 0 rgba(244,114,182,0)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(244,114,182,0.10)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(244,114,182,0.35)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 30px rgba(244,114,182,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(244,114,182,0.06)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(244,114,182,0.18)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 0 rgba(244,114,182,0)';
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{
                    background: 'rgba(244,114,182,0.15)',
                    border: '1px solid rgba(244,114,182,0.30)',
                    color: '#F472B6',
                    boxShadow: '0 0 16px rgba(244,114,182,0.2)',
                  }}
                >
                  M
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(244,114,182,0.12)', color: '#F472B6', border: '1px solid rgba(244,114,182,0.25)' }}
                >
                  Collaborator
                </span>
              </div>

              <h2 className="text-lg font-bold text-white tracking-tight">Maya</h2>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#F472B6' }}>Product Designer</p>
              <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
                Refines interface sections directly on canvas, resolves concurrent conflicts, and redirects PIXEL engineering runs.
              </p>
            </div>

            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(244,114,182,0.12)' }}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSelect('maya'); }}
                className="w-full h-10 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all"
                style={{
                  background: 'rgba(244,114,182,0.15)',
                  color: '#F472B6',
                  border: '1px solid rgba(244,114,182,0.30)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,114,182,0.25)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(244,114,182,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,114,182,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <span>Continue as Maya</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer badge */}
        <div
          className="px-4 py-3 rounded-xl text-xs text-slate-500 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: '#34D399' }} strokeWidth={1.75} />
            <span>Multi-user workspace · Live WebSocket sync</span>
          </div>
          <span className="text-[11px] font-mono text-slate-600">LedgerFlow</span>
        </div>
      </div>
    </div>
  );
};
