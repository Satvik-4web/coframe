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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1528] border border-[#1A223D] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in-50 duration-200">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#1A223D]">
          <div className="flex items-center space-x-2.5">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">
              M
            </span>
            <div>
              <h3 className="font-bold text-white text-sm">Direct Hero Edit (as Maya)</h3>
              <p className="text-xs text-[#8695B7]">Expected base section version: v{currentVersion}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8695B7] hover:text-white p-1 rounded-lg hover:bg-[#1A223D] transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#0F1528] border border-[#1A223D] text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">Subheadline</label>
            <textarea
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              rows={2}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#0F1528] border border-[#1A223D] text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">Primary CTA Button</label>
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#0F1528] border border-[#1A223D] text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-violet-50/70 border border-violet-100 text-xs text-violet-900 leading-relaxed">
            💡 <strong className="text-violet-800">Human vs. Agent Conflict Demonstration:</strong> Saving this directly advances the Hero section to v{currentVersion + 1}. Any older pending proposal from PIXEL based on v{currentVersion} will automatically trigger a section conflict.
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#1A223D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#8695B7] hover:text-white hover:bg-[#1A223D] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Manual Edit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
