import React from 'react';
import { HumanIdentity } from '../../types';
import { ArrowRight, Bot, Code2, ShieldCheck, Sparkles } from 'lucide-react';

interface IdentityPickerProps { onSelect: (id: HumanIdentity) => void; }

export const IdentityPicker: React.FC<IdentityPickerProps> = ({ onSelect }) => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#111B2A] px-5 py-12 text-white">
    <div className="dashboard-hero-grid pointer-events-none absolute inset-0 opacity-40" />
    <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-blue-500/20 blur-[110px]" />
    <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-sky-400/15 blur-[110px]" />
    <div className="relative w-full max-w-[920px]">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-400 to-blue-700 text-2xl font-black shadow-[0_15px_40px_rgba(37,99,235,.35)]">C</div>
        <p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-sky-300">COFRAME / LedgerFlow</p>
        <h1 className="text-[clamp(2.3rem,5vw,4.2rem)] font-semibold leading-[1.08] tracking-[-.05em]">Build together.<br /><span className="text-[#93C5FD]">Decide with clarity.</span></h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">Choose your role to enter the shared product workspace. Your decisions and agent work stay connected.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => onSelect('alex')} className="group flex min-h-[285px] flex-col rounded-[26px] border border-white/15 bg-white/[.08] p-6 text-left backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-300/60 hover:bg-white/[.12] hover:shadow-[0_25px_60px_-25px_rgba(37,99,235,.35)] sm:p-8">
          <span className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-400/20 text-2xl font-bold text-blue-200 ring-1 ring-blue-300/30">A</span><span className="rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-200">Decision owner</span></span>
          <span className="mt-7 text-2xl font-semibold tracking-tight">Alex</span><span className="mt-1 text-sm font-medium text-blue-200">Founder & product lead</span>
          <span className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Set direction, create briefs, and approve changes to the product.</span>
          <span className="mt-auto flex items-center justify-between border-t border-white/10 pt-5 text-sm font-semibold">Enter as Alex <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></span>
        </button>
        <button type="button" onClick={() => onSelect('maya')} className="group flex min-h-[285px] flex-col rounded-[26px] border border-white/15 bg-white/[.08] p-6 text-left backdrop-blur-xl transition hover:-translate-y-1 hover:border-sky-300/60 hover:bg-white/[.12] hover:shadow-[0_25px_60px_-25px_rgba(56,189,248,.3)] sm:p-8">
          <span className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/20 text-2xl font-bold text-sky-200 ring-1 ring-sky-300/30">M</span><span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-200">Collaborator</span></span>
          <span className="mt-7 text-2xl font-semibold tracking-tight">Maya</span><span className="mt-1 text-sm font-medium text-sky-200">Product designer</span>
          <span className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Shape the experience, review proposals, and resolve design conflicts.</span>
          <span className="mt-auto flex items-center justify-between border-t border-white/10 pt-5 text-sm font-semibold">Enter as Maya <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></span>
        </button>
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Human approval</span><span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-sky-300" /> Shared context</span><span className="flex items-center gap-1.5"><Bot className="h-4 w-4 text-blue-300" /> NOVA</span><span className="flex items-center gap-1.5"><Code2 className="h-4 w-4 text-sky-300" /> PIXEL</span></div>
    </div>
  </main>
);
