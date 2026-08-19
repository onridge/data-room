import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadItem {
  id: string;
  file: File;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface UploadPanelProps {
  items: UploadItem[];
  onDismiss: () => void;
  onRetry: (id: string) => void;
}

export const UploadPanel = ({ items, onDismiss, onRetry }: UploadPanelProps) => {
  if (items.length === 0) return null;

  const uploadingCount = items.filter((item) => item.status === 'uploading').length;

  return (
    <div className="fixed right-5 bottom-5 w-(--dr-upload-panel-w) overflow-hidden rounded-lg border border-input bg-card shadow-lg">
      <div className="flex h-10 items-center gap-2 border-b border-border bg-muted px-3">
        <span className="text-row-secondary font-semibold text-foreground">Uploads</span>
        <span className="text-modal-caption text-muted-foreground">
          {uploadingCount > 0
            ? `${uploadingCount} uploading`
            : `${items.length} file${items.length === 1 ? '' : 's'}`}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-secondary"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 ${
              item.status === 'error' ? 'bg-destructive/5' : ''
            }`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="truncate text-row-secondary text-foreground">{item.file.name}</div>
              {item.status === 'uploading' ? (
                <div className="h-[3px] overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              ) : null}
              {item.status === 'error' ? (
                <div className="text-modal-caption text-destructive">{item.error}</div>
              ) : null}
            </div>
            {item.status === 'done' ? <Check className="size-4 shrink-0 text-success" /> : null}
            {item.status === 'error' ? (
              <Button size="sm" variant="outline" onClick={() => onRetry(item.id)}>
                Retry
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};
