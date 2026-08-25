import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  actor?: string;
  icon?: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function ActivityTimeline({ items, label = 'Activity timeline' }: { items: TimelineItem[]; label?: string }) {
  return (
    <ol className="platform-activity-timeline" aria-label={label}>
      {items.map((item, index) => (
        <li className={`is-${item.tone ?? 'neutral'}`} key={item.id}>
          <span className="platform-activity-timeline__marker" aria-hidden="true">
            {item.icon ?? (index === 0 ? <CheckCircle2 size={16} /> : <Circle size={13} />)}
          </span>
          <div>
            <header><strong>{item.title}</strong>{item.timestamp ? <time>{item.timestamp}</time> : null}</header>
            {item.description ? <p>{item.description}</p> : null}
            {item.actor ? <small>{item.actor}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
