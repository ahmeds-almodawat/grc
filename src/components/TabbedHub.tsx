import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export interface HubTab {
  id: string;
  label: string;
  description?: string;
  badge?: string | number;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabbedHubProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tabs: HubTab[];
  defaultTabId?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export function TabbedHub({ eyebrow, title, subtitle, tabs, defaultTabId, actions, compact = false }: TabbedHubProps) {
  const { direction } = useI18n();
  const firstTab = tabs[0]?.id ?? '';
  const [activeId, setActiveId] = useState(defaultTabId ?? firstTab);
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeId) ?? tabs[0], [activeId, tabs]);

  return (
    <section className={`page-section hub-page ${compact ? 'hub-page-compact' : ''}`} dir={direction}>
      <div className="hub-hero panel">
        <div className="hub-hero-copy">
          <p className="eyebrow">{eyebrow ?? 'Control workspace'}</p>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="hub-hero-actions">
          {actions}
          <div className="hub-tab-count"><LayoutGrid size={17} /> {tabs.length}</div>
        </div>
      </div>

      <div className="hub-tab-layout">
        <div className="hub-tab-rail panel" role="tablist" aria-label={title}>
          {tabs.map(tab => {
            const isActive = activeTab?.id === tab.id;
            return (
              <button
                key={tab.id}
                className={`hub-tab-button ${isActive ? 'active' : ''}`}
                onClick={() => setActiveId(tab.id)}
                type="button"
                role="tab"
                aria-selected={isActive}
              >
                <span className="hub-tab-icon">{tab.icon ?? <ChevronRight size={16} />}</span>
                <span className="hub-tab-text">
                  <strong>{tab.label}</strong>
                  {tab.description ? <small>{tab.description}</small> : null}
                </span>
                {tab.badge !== undefined ? <span className="hub-tab-badge">{tab.badge}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="hub-tab-content" role="tabpanel">
          <div className="hub-active-strip panel">
            <div className="hub-active-strip__title">
              <span className="hub-active-icon">{activeTab?.icon ?? <LayoutGrid size={17} />}</span>
              <div>
                <strong>{activeTab?.label}</strong>
                {activeTab?.description ? <small>{activeTab.description}</small> : null}
              </div>
            </div>
          </div>
          {activeTab?.content}
        </div>
      </div>
    </section>
  );
}
