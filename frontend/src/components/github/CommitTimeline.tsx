import React from 'react';
import { GitCommit, Sparkles, User, ExternalLink, Bot } from 'lucide-react';
import { GitHubCommit } from '../../types';

interface CommitTimelineProps {
  commits: GitHubCommit[];
  isLoading?: boolean;
}

export const CommitTimeline: React.FC<CommitTimelineProps> = ({
  commits,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
        Loading commit history...
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="p-8 text-center bg-[#121826] border border-[#263244] rounded-xl text-[#8E9EB5] text-xs">
        No commits found for this repository.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F4F7FB]">Commit Timeline</h3>
          <p className="text-xs text-[#8E9EB5]">
            Engineering commit logs showing automated COFRAME exports and human contributions.
          </p>
        </div>
        <span className="text-xs text-[#8E9EB5] font-mono bg-[#182234] px-2.5 py-1 rounded-lg border border-[#2B3B52]">
          {commits.length} commits
        </span>
      </div>

      <div className="relative border-l border-[#263244] ml-4 pl-6 space-y-6">
        {commits.map((c) => {
          const isCoframe = c.is_coframe_commit;

          return (
            <div key={c.sha} className="relative group">
              {/* Dot on Timeline */}
              <div
                className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 ${
                  isCoframe
                    ? 'bg-teal-400 border-[#0E1322] shadow-[0_0_8px_rgba(45,212,191,0.5)]'
                    : 'bg-[#64748B] border-[#0E1322]'
                }`}
              />

              {/* Commit Card */}
              <div className="p-4 rounded-xl bg-[#121826] border border-[#263244] hover:border-[#384860] transition shadow-sm space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-[#F4F7FB]">{c.message}</span>
                    {isCoframe && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>COFRAME Export</span>
                      </span>
                    )}
                  </div>

                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs font-mono text-teal-400 hover:underline bg-[#0C101A] px-2 py-0.5 rounded border border-[#212C3D] w-fit"
                  >
                    <span>{c.sha.slice(0, 7)}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8E9EB5] pt-1">
                  <div className="flex items-center space-x-1">
                    {isCoframe && c.actor_identity ? (
                      <span className="flex items-center space-x-1 text-purple-300 font-medium">
                        <Bot className="w-3 h-3 text-purple-400" />
                        <span>Agent {c.actor_identity.toUpperCase()}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-[#64748B]" />
                        <span>{c.author_name}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[#475569]">•</span>

                  <span>{new Date(c.author_date).toLocaleString()}</span>

                  {c.related_proposal_id && (
                    <>
                      <span className="text-[#475569]">•</span>
                      <span className="text-teal-300">
                        Proposal #{c.related_proposal_id}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
