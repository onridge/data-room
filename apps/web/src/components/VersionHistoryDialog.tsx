import { useEffect, useState } from 'react';
import { Eye, History } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getFileVersions } from '../lib/files';
import type { FileVersion } from '../lib/files';
import type { FileEntry } from '../lib/folders';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VersionHistoryDialogProps {
  target: FileEntry;
  dataRoomId: string;
  onClose: () => void;
  onViewVersion: (versionId: string, label: string) => void;
}

// Read-only history. Restoring an older version would mean writing a new
// version that copies an old one's blob — deliberately left out, since the
// spec asks for versioning on conflict, not for revision management.
export const VersionHistoryDialog = ({
  target,
  dataRoomId,
  onClose,
  onViewVersion,
}: VersionHistoryDialogProps) => {
  const { accessToken } = useAuth();
  const [versions, setVersions] = useState<FileVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getFileVersions(accessToken, dataRoomId, target.id)
      .then(setVersions)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load version history'),
      );
  }, [accessToken, dataRoomId, target.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Version history
          </DialogTitle>
          <DialogDescription>
            Every upload of “{target.name}” to this folder, newest first.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !versions ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0"
              >
                <span className="shrink-0 text-row-primary font-medium text-foreground">
                  v{version.versionNumber}
                </span>
                {version.isCurrent ? (
                  <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-modal-caption text-muted-foreground">
                    current
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-row-secondary text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString()} · {version.uploadedBy}
                </span>
                <span className="shrink-0 text-row-secondary tabular-nums text-muted-foreground">
                  {formatBytes(version.sizeBytes)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onViewVersion(version.id, `${target.name} (v${version.versionNumber})`)
                  }
                  className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`View version ${version.versionNumber}`}
                >
                  <Eye className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
