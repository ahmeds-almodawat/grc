import { useState } from 'react';
import { X, GitBranch, ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface StartRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'minor' | 'major', reason: string) => Promise<void>;
  currentVersionLabel: string;
}

export function StartRevisionModal({
  isOpen,
  onClose,
  onConfirm,
  currentVersionLabel
}: StartRevisionModalProps) {
  const { t } = useI18n();
  const [revisionType, setRevisionType] = useState<'minor' | 'major'>('minor');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t('policy.revision.reasonRequired', 'Please provide a clear revision reason.'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(revisionType, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start revision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitBranch className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('policy.revision.startTitle', 'Start Governed Policy Revision')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t(
              'policy.revision.notice',
              'Starting a revision creates a new editable draft cloned from the current version. The existing published version remains active until the new revision is formally approved and activated.'
            )}
          </p>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 rounded-lg border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Revision Type Radio Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('policy.revision.type', 'Revision Type')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  revisionType === 'minor'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">{t('policy.revision.minor', 'Minor Revision')}</span>
                  <input
                    type="radio"
                    name="revType"
                    value="minor"
                    checked={revisionType === 'minor'}
                    onChange={() => setRevisionType('minor')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('policy.revision.minorDesc', 'Small controlled amendment or clarification.')}
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  revisionType === 'major'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">{t('policy.revision.major', 'Major Revision')}</span>
                  <input
                    type="radio"
                    name="revType"
                    value="major"
                    checked={revisionType === 'major'}
                    onChange={() => setRevisionType('major')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('policy.revision.majorDesc', 'Substantial restructuring or governance change.')}
                </p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.revision.reason', 'Revision Justification / Change Summary')} *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Updated regulatory references following annual survey review..."
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
              {submitting ? t('common.processing', 'Creating Draft...') : t('policy.revision.confirm', 'Create Revision Draft')}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
