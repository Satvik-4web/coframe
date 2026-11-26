import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react';
import { fetchWorkspaceSetup, type WorkspaceSetup as Setup } from '../../lib/api';

export function WorkspaceSetup() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true); setError('');
    try { setSetup(await fetchWorkspaceSetup()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load setup'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center justify-between gap-4"><div><p className="workbench-eyebrow">WORKSPACE SETTINGS</p><h1 className="text-3xl font-semibold tracking-tight">Connections & setup</h1><p className="mt-3 text-sm text-[#96A6BE]">See which services are configured before relying on this workspace.</p></div><button onClick={refresh} disabled={loading} aria-label="Refresh setup status" className="rounded-xl border bg-[#1A202C] p-3 disabled:opacity-40"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button></div>
    {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
    {loading && !setup && <p role="status">Checking workspace configuration…</p>}
    <div className="grid gap-4 sm:grid-cols-2">{setup?.checks.map(check => <article key={check.id} className="dashboard-card rounded-2xl p-6"><div className="mb-4 flex items-center justify-between"><span className={check.ready ? 'text-emerald-400' : 'text-amber-400'}>{check.ready ? <CheckCircle2 size={22}/> : <CircleAlert size={22}/>}</span><span className="text-xs font-medium text-[#96A6BE]">{check.ready ? 'Configured' : 'Setup required'}</span></div><h2 className="font-semibold">{check.title}</h2><p className="mt-2 text-sm leading-6 text-[#96A6BE]">{check.detail}</p></article>)}</div>
  </section>;
}
