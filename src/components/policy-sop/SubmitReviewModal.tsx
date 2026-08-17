import { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface SubmitReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  policyCode: string;
  policyTitle: string;
  versionLabel: string;
  ownerName?: string | null;
}

export function SubmitReviewModal({
  isOpen,
  onClose,
  onConfirm,
  policyCode,
  policyTitle,
  versionLabel,
  ownerName
}: SubmitReviewModalProps) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(note.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit policy for review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Send className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('policy.submitReview.title', 'Submit Policy for Review & Approval')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">{t('policy.code', 'Policy Code')}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{policyCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">{t('policy.version', 'Version')}:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{versionLabel}</span>
            </div>
            {ownerName && (
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">{t('policy.owner', 'Owner')}:</span>
                <span className="text-slate-900 dark:text-slate-100">{ownerName}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50 flex gap-2.5">
            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              {t(
                'policy.submitReview.notice',
                'Upon submission, this draft will enter Under Review status and will be routed to the central Approval Authority Matrix. Direct editing will be locked until review decision.'
              )}
            </p>
          </div>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 rounded-lg border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.submitReview.note', 'Submission Notes / Reviewer Instructions')}
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Prepared for Q3 policy committee review..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              {submitting ? t('common.submitting', 'Submitting...') : t('policy.submitReview.confirm', 'Submit for Review')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
