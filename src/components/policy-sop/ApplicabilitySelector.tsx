import { useState } from 'react';
import { Building2, Users, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { RoleScope } from '../../lib/policySopApi';
import { useI18n } from '../../i18n/I18nContext';

interface ApplicabilitySelectorProps {
  selectedDepartments: string[];
  onChangeDepartments: (deptIds: string[]) => void;
  selectedRoles: RoleScope[];
  onChangeRoles: (roles: RoleScope[]) => void;
  departments?: Array<{ id: string; name: string; code: string }>;
  readOnly?: boolean;
}

export function ApplicabilitySelector({
  selectedDepartments,
  onChangeDepartments,
  selectedRoles,
  onChangeRoles,
  departments = [],
  readOnly = false
}: ApplicabilitySelectorProps) {
  const { t } = useI18n();
  const [newRoleName, setNewRoleName] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');

  const toggleDepartment = (deptId: string) => {
    if (readOnly) return;
    if (selectedDepartments.includes(deptId)) {
      onChangeDepartments(selectedDepartments.filter(id => id !== deptId));
    } else {
      onChangeDepartments([...selectedDepartments, deptId]);
    }
  };

  const handleSelectAllDepartments = () => {
    if (readOnly) return;
    if (selectedDepartments.length === departments.length) {
      onChangeDepartments([]);
    } else {
      onChangeDepartments(departments.map(d => d.id));
    }
  };

  const handleAddRole = () => {
    if (!newRoleName.trim() || readOnly) return;
    onChangeRoles([...selectedRoles, { role_name: newRoleName.trim(), job_title: newJobTitle.trim() || null }]);
    setNewRoleName('');
    setNewJobTitle('');
  };

  const handleRemoveRole = (index: number) => {
    if (readOnly) return;
    onChangeRoles(selectedRoles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* 1. Department Applicability */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('policy.applicability.departments', 'Applicable Departments')}
            </h4>
            <span className="text-xs text-slate-500">
              ({selectedDepartments.length} / {departments.length})
            </span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleSelectAllDepartments}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              {selectedDepartments.length === departments.length
                ? t('common.deselectAll', 'Deselect All')
                : t('common.selectAll', 'Select All Departments')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
          {departments.map(dept => {
            const isSelected = selectedDepartments.includes(dept.id);
            return (
              <label
                key={dept.id}
                className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={readOnly}
                  onChange={() => toggleDepartment(dept.id)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                />
                <span className="font-medium truncate">{dept.name}</span>
                {dept.code && <span className="text-[10px] text-slate-400 font-mono">({dept.code})</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Role & Job Title Applicability */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('policy.applicability.roles', 'Target Roles & Job Titles')}
          </h4>
          <span className="text-xs text-slate-500">({selectedRoles.length})</span>
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder={t('policy.applicability.rolePlaceholder', 'e.g. Registered Nurse, Department Head')}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input
              type="text"
              value={newJobTitle}
              onChange={e => setNewJobTitle(e.target.value)}
              placeholder={t('policy.applicability.jobTitlePlaceholder', 'Optional job title filter...')}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={handleAddRole}
              disabled={!newRoleName.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <Plus size={14} />
              {t('common.add', 'Add')}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {selectedRoles.length === 0 ? (
            <span className="text-xs text-slate-500 italic">
              {t('policy.applicability.allRoles', 'All organizational roles (no specific role restrictions applied)')}
            </span>
          ) : (
            selectedRoles.map((role, idx) => (
              <span
                key={role.id || idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
              >
                <strong>{role.role_name}</strong>
                {role.job_title && <span className="text-slate-500 font-normal">({role.job_title})</span>}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(idx)}
                    className="text-slate-400 hover:text-rose-500 ml-1"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      {/* 3. Facility Applicability (Explicit Governed Deferred Callout) */}
      <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/50 flex items-start gap-2.5">
        <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h5 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {t('policy.facilityDeferred.title', 'Facility Applicability Notice')}
          </h5>
          <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
            {t(
              'policy.facilityDeferred.desc',
              'Facility applicability will be enabled after the authoritative facility master is established.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
