import { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { RequestPolicyExceptionInput } from '../../lib/policySopApi';

interface PolicyExceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: RequestPolicyExceptionInput) => Promise<void>;
  versionId: string;
  policyCode: string;
  policyTitle: string;
}

export function PolicyExceptionModal({
  isOpen,
  onClose,
  onSubmit,
  versionId,
  policyCode,
  policyTitle
}: PolicyExceptionModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [riskSummary, setRiskSummary] = useState('');
  const [compensatingControls, setCompensatingControls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !scopeDescription.trim() || !startDate || !endDate) {
      setError(t('policy.exception.missingFields', 'Please fill in all mandatory exception request fields.'));
      return;
    }
    if (endDate < startDate) {
      setError(t('policy.exception.invalidDates', 'End date must be greater than or equal to start date.'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        version_id: versionId,
        reason: reason.trim(),
        scope_description: scopeDescription.trim(),
        start_date: startDate,
        end_date: endDate,
        risk_summary: riskSummary.trim() || undefined,
        compensating_controls: compensatingControls.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit exception request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('policy.exception.modalTitle', 'Request Policy Exception / Waiver')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{policyCode}: </span>
            {policyTitle}
          </div>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 rounded-lg border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.exception.reason', 'Business Reason for Exception')} *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Detail why operational compliance cannot be achieved during this window..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.exception.scope', 'Scope Description')} *
            </label>
            <input
              type="text"
              required
              value={scopeDescription}
              onChange={e => setScopeDescription(e.target.value)}
              placeholder="e.g. Specific clinical ward, system migration phase..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('policy.exception.startDate', 'Effective Start Date')} *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('policy.exception.endDate', 'Effective End Date')} *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.exception.riskSummary', 'Risk Assessment Summary')}
            </label>
            <textarea
              rows={2}
              value={riskSummary}
              onChange={e => setRiskSummary(e.target.value)}
              placeholder="Outline any patient safety, regulatory, or operational risks..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('policy.exception.compensatingControls', 'Compensating Controls')}
            </label>
            <textarea
              rows={2}
              value={compensatingControls}
              onChange={e => setCompensatingControls(e.target.value)}
              placeholder="Describe substitute mitigating measures implemented..."
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
              {submitting ? t('common.submitting', 'Submitting...') : t('policy.exception.submit', 'Submit Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
