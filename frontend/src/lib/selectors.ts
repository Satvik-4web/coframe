import type {FullProjectState,Proposal} from '../types';
export const selectProposalCounts=(proposals:Proposal[])=>({pending:proposals.filter(p=>p.status==='pending_review').length,attention:proposals.filter(p=>p.status==='stale'||p.status==='conflict').length,applied:proposals.filter(p=>p.status==='approved').length,history:proposals.filter(p=>['rejected','superseded'].includes(p.status)).length});
export const selectWorkspaceCounts=(state:FullProjectState)=>({...selectProposalCounts(state.proposals),presence:state.online_members.filter(m=>m==='alex'||m==='maya').length});
