import type { ReactNode } from 'react';
import { Download, FileText, Paperclip } from 'lucide-react';

export interface AttachmentItem {
  id: string;
  name: string;
  metadata?: string;
  onOpen?: () => void;
  onDownload?: () => void;
  downloadDisabledReason?: string;
}

export function AttachmentPanel({ title = 'Attachments', items, action }: { title?: string; items: AttachmentItem[]; action?: ReactNode }) {
  return (
    <section className="platform-attachment-panel">
      <header>
        <h3><Paperclip size={16} aria-hidden="true" />{title}<span>{items.length}</span></h3>
        {action ? <div>{action}</div> : null}
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="platform-attachment-panel__file" onClick={item.onOpen} disabled={!item.onOpen} title={item.onOpen ? item.name : 'Preview unavailable'}>
              <FileText size={17} aria-hidden="true" />
              <span><strong>{item.name}</strong>{item.metadata ? <small>{item.metadata}</small> : null}</span>
            </button>
            <button type="button" className="platform-icon-button" onClick={item.onDownload} disabled={!item.onDownload} title={item.onDownload ? `Download ${item.name}` : item.downloadDisabledReason ?? 'Download unavailable'} aria-label={`Download ${item.name}`}>
              <Download size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
