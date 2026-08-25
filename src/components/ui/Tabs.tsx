import type { ReactNode } from 'react';

export interface PlatformTab {
  id: string;
  label: string;
  badge?: string | number;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  label,
}: {
  tabs: PlatformTab[];
  activeId: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="platform-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${tab.id}-panel`}
            className={active ? 'is-active' : ''}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            key={tab.id}
          >
            {tab.icon ? <span aria-hidden="true">{tab.icon}</span> : null}
            <span>{tab.label}</span>
            {tab.badge !== undefined ? <strong>{tab.badge}</strong> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeId, children }: { id: string; activeId: string; children: ReactNode }) {
  if (id !== activeId) return null;
  return <div id={`${id}-panel`} role="tabpanel" className="platform-tab-panel">{children}</div>;
}
