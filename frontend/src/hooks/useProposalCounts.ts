import { useMemo } from 'react';
import { Proposal } from '../types';

export interface ProposalCounts {
  needsDecision: number;
  pending: number;
  stale: number;
  conflict: number;
  applied: number;
  rejected: number;
  redirected: number;
  total: number;
}

export function computeProposalCounts(proposals: Proposal[] = []): ProposalCounts {
  if (!Array.isArray(proposals)) {
    return {
      needsDecision: 0,
      pending: 0,
      stale: 0,
      conflict: 0,
      applied: 0,
      rejected: 0,
      redirected: 0,
      total: 0,
    };
  }

  const pending = proposals.filter((p) => p.status === 'pending_review').length;
  const stale = proposals.filter((p) => p.status === 'stale').length;
  const conflict = proposals.filter(
    (p) => p.status === 'conflict' || Boolean((p as any).is_conflicted)
  ).length;
  const applied = proposals.filter((p) => p.status === 'approved').length;
  const redirected = proposals.filter(
    (p) =>
      (p.status as string) === 'redirected' ||
      (p.status === 'rejected' && Boolean((p as any).superseded_by)) ||
      Boolean((p as any).is_redirected)
  ).length;
  const rejected = proposals.filter(
    (p) => p.status === 'rejected' && !(p as any).superseded_by && !(p as any).is_redirected
  ).length;

  // Single authoritative definition of proposals requiring attention/decision:
  // All pending review proposals, section conflicts, and stale proposals
  const needsDecision = pending + conflict + stale;
  const total = proposals.length;

  return {
    needsDecision,
    pending,
    stale,
    conflict,
    applied,
    rejected,
    redirected,
    total,
  };
}

export function useProposalCounts(proposals: Proposal[] = []): ProposalCounts {
  return useMemo(() => computeProposalCounts(proposals), [proposals]);
}
