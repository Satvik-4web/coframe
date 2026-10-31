import React, { useState } from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { editArtifactSection } from '../../lib/api';

interface ManualHeroEditModalProps {
  currentVersion: number;
  initialData: {
    headline: string;
    subheadline: string;
    cta_text: string;
    secondary_cta?: string;
    badge?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualHeroEditModal: React.FC<ManualHeroEditModalProps> = ({
  currentVersion,
  initialData,
  onClose,
  onSuccess,
}) => {
  const [headline, setHeadline] = useState(initialData.headline || '');
  const [subheadline, setSubheadline] = useState(initialData.subheadline || '');
  const [ctaText, setCtaText] = useState(initialData.cta_text || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await editArtifactSection(
        'demo-ledgerflow',
        'hero',
        currentVersion,
        {
          ...initialData,
          headline,
          subheadline,
          cta_text: ctaText,
        },
        'maya'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update section');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B1020]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#151B29] border border-[#263244] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#263244]">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center">
              M
            </span>
            <div>
              <h3 className="font-bold text-[#F4F7FB] text-sm">Direct Hero Edit (as Maya)</h3>
              <p className="text-[11px] text-[#98A5B7]">Expected base section version: v{currentVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#98A5B7] hover:text-[#F4F7FB]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#98A5B7] mb-1">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#1B2433] border border-[#263244] text-[#F4F7FB] text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#98A5B7] mb-1">Subheadline</label>
            <textarea
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              rows={2}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#1B2433] border border-[#263244] text-[#F4F7FB] text-xs focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#98A5B7] mb-1">Primary CTA Button</label>
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#1B2433] border border-[#263244] text-[#F4F7FB] text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#1B2433] border border-[#263244] text-[11px] text-[#98A5B7]">
            💡 <strong className="text-purple-300">Conflict Generation Demo:</strong> Saving this will increment hero to v{currentVersion + 1}. Any pending older proposal from PIXEL based on v{currentVersion} will automatically be detected as a conflict!
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#98A5B7] hover:bg-[#1B2433]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Manual Edit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
