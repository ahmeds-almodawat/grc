import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { GovernedDocumentReviewTrigger, completeGovernedDocumentReview } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';

interface ReviewsDueTabProps {
  triggers: GovernedDocumentReviewTrigger[];
  onRefresh: () => Promise<void>;
  loading?: boolean;
}

export function ReviewsDueTab({ triggers, onRefresh, loading = false }: ReviewsDueTabProps) {
  const { t } = useI18n();
  const [selectedTrigger, setSelectedTrigger] = useState<GovernedDocumentReviewTrigger | null>(null);
  const [outcome, setOutcome] = useState<'no_change' | 'minor_revision' | 'major_revision' | 'retire'>('no_change');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompleteReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrigger) return;
    try {
      setSubmitting(true);
      setError(null);
      await completeGovernedDocumentReview(selectedTrigger.id, outcome, outcomeNote);
      setSelectedTrigger(null);
      setOutcomeNote('');
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to complete document review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            {t('policy.reviewsDue.title', 'Governed Document Reviews Due')}
          </h4>
          <p className="text-xs text-slate-500">{t('policy.reviewsDue.subtitle', 'Scheduled reviews, regulatory triggers, and audit findings.')}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">{t('policy.reviewsDue.loading', 'Loading review triggers...')}</div>
      ) : triggers.length === 0 ? (
        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center text-xs text-slate-500 shadow-sm">
          <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">{t('policy.reviewsDue.allClear', 'All document reviews are up to date')}</p>
          <p className="text-slate-400 mt-1">{t('policy.reviewsDue.noPending', 'No overdue or pending review triggers requiring action.')}</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-32">{t('policy.reviewsDue.triggerType', 'Trigger Type')}</th>
                <th className="py-3 px-4">{t('policy.reviewsDue.dueDate', 'Due Date')}</th>
                <th className="py-3 px-4 w-28">{t('common.status', 'Status')}</th>
                <th className="py-3 px-4 w-28 text-right">{t('common.actions', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {triggers.map(tr => (
                <tr key={tr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    {tr.trigger_type.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-semibold">{tr.due_date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      tr.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {tr.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tr.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrigger(tr)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-lg transition-colors"
                      >
                        {t('policy.reviewsDue.completeAction', 'Complete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Complete Review Modal */}
      {selectedTrigger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('policy.reviewsDue.completeTitle', 'Complete Document Review')}
              </h3>
              <button type="button" aria-label={t('common.close', 'Close')} onClick={() => setSelectedTrigger(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCompleteReview} className="p-5 space-y-4">
              {error && <div className="p-2 text-xs bg-rose-50 text-rose-800 rounded">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('policy.reviewsDue.outcome', 'Review Outcome')}
                </label>
                <select
                  value={outcome}
                  onChange={e => setOutcome(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="no_change">{t('policy.outcome.noChange', 'No Change — Reaffirm Current Policy')}</option>
                  <option value="minor_revision">{t('policy.outcome.minor', 'Minor Revision Required')}</option>
                  <option value="major_revision">{t('policy.outcome.major', 'Major Revision Required')}</option>
                  <option value="retire">{t('policy.outcome.retire', 'Retire Policy')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('policy.reviewsDue.outcomeNote', 'Review Note / Findings')}
                </label>
                <textarea
                  rows={3}
                  value={outcomeNote}
                  onChange={e => setOutcomeNote(e.target.value)}
                  placeholder={t('policy.reviewsDue.findingsPlaceholder', 'Summarize review findings...')}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTrigger(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? t('common.submitting', 'Submitting...') : t('common.save', 'Save Outcome')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
