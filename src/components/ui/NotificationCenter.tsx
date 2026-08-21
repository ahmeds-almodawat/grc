import type { ReactNode } from 'react';
import { BellRing, CheckCheck } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  unread?: boolean;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
  onOpen?: () => void;
}

export function NotificationCenter({
  title = 'Notifications',
  items,
  onMarkAllRead,
  markAllReadLabel = 'Mark all as read',
}: {
  title?: string;
  items: NotificationItem[];
  onMarkAllRead?: () => void;
  markAllReadLabel?: string;
}) {
  const unread = items.filter((item) => item.unread).length;
  return (
    <section className="platform-notification-center">
      <header>
        <h2><BellRing size={17} aria-hidden="true" />{title}{unread > 0 ? <span>{unread}</span> : null}</h2>
        <button type="button" className="platform-text-button" onClick={onMarkAllRead} disabled={!onMarkAllRead || unread === 0} title={!onMarkAllRead ? 'Action unavailable' : markAllReadLabel}>
          <CheckCheck size={15} aria-hidden="true" />{markAllReadLabel}
        </button>
      </header>
      <ol>
        {items.map((item) => (
          <li className={`${item.unread ? 'is-unread' : ''} is-${item.tone ?? 'info'}`.trim()} key={item.id}>
            <button type="button" onClick={item.onOpen} disabled={!item.onOpen} title={item.onOpen ? item.title : 'Notification details unavailable'}>
              <span className="platform-notification-center__icon" aria-hidden="true">{item.icon ?? <BellRing size={15} />}</span>
              <span><strong>{item.title}</strong>{item.description ? <small>{item.description}</small> : null}</span>
              {item.timestamp ? <time>{item.timestamp}</time> : null}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
