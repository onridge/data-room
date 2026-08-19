import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, FileText, Folder as FolderIcon, Lock, User } from 'lucide-react';
import { getPublicContents, getPublicShareInfo, viewPublicFile } from '../lib/public';
import type { PublicShareInfo } from '../lib/public';
import type { FolderContents } from '../lib/folders';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { PdfViewerDialog } from '../components/PdfViewerDialog';

interface BreadcrumbEntry {
  id: string;
  name: string;
}

const Badge = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-modal-caption text-muted-foreground">
    {icon}
    {children}
  </span>
);

// A public link is rooted at whatever the owner shared, not the data
// room's actual root — so the breadcrumb trail is built client-side as
// the visitor navigates in, rather than fetched from the (owner-only)
// folder path endpoint.
export const PublicSharePage = () => {
  const { token } = useParams<{ token: string }>();

  const [shareInfo, setShareInfo] = useState<PublicShareInfo | null>(null);
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfViewerTarget, setPdfViewerTarget] = useState<{ url: string; name: string } | null>(null);

  const currentFolderId = breadcrumb.at(-1)?.id;

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    setLoadError(null);
    getPublicShareInfo(token)
      .then(setShareInfo)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Link not available'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !shareInfo || shareInfo.resourceType === 'FILE') return;
    setIsLoading(true);
    setLoadError(null);
    getPublicContents(token, currentFolderId)
      .then(setContents)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shareInfo, currentFolderId]);

  const navigateToFolder = (id: string, name: string) => {
    setBreadcrumb((prev) => [...prev, { id, name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const handleViewFile = async (fileId: string, fileName: string) => {
    if (!token) return;
    try {
      const objectUrl = await viewPublicFile(token, fileId);
      setPdfViewerTarget({ url: objectUrl, name: fileName });
    } catch {
      // The eye button just does nothing on failure — no dedicated error UI
      // for this yet.
    }
  };

  if (isLoading && !shareInfo) {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (loadError && !shareInfo) {
    return <p className="p-8 text-sm text-destructive">{loadError}</p>;
  }

  if (!shareInfo) return null;

  if (shareInfo.resourceType === 'FILE') {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2">
          <Badge icon={<User className="size-3" />}>Shared by {shareInfo.ownerName}</Badge>
          <Badge icon={<Lock className="size-3" />}>Read-only</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <FileText className="size-5 shrink-0 text-red-500 dark:text-red-400" />
          <h1 className="text-page-title font-semibold text-foreground">{shareInfo.name}</h1>
        </div>
        <button
          type="button"
          onClick={() => handleViewFile(shareInfo.resourceId, shareInfo.name)}
          className="mt-4 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:brightness-90"
        >
          <Eye className="size-3.5" />
          View PDF
        </button>
        <PdfViewerDialog
          open={!!pdfViewerTarget}
          onOpenChange={(open) => !open && setPdfViewerTarget(null)}
          fileUrl={pdfViewerTarget?.url ?? null}
          fileName={pdfViewerTarget?.name ?? ''}
        />
      </div>
    );
  }

  const totalSizeBytes = contents?.files.reduce((sum, file) => sum + Number(file.sizeBytes), 0) ?? 0;

  return (
    <div className="p-8">
      <div className="flex items-center gap-2">
        <Badge icon={<User className="size-3" />}>Shared by {shareInfo.ownerName}</Badge>
        <Badge icon={<Lock className="size-3" />}>Read-only</Badge>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => navigateToBreadcrumb(-1)}
          className="cursor-pointer hover:text-foreground"
        >
          {shareInfo.name}
        </button>
        {breadcrumb.map((entry, index) => (
          <span key={entry.id} className="flex items-center gap-2">
            <span>/</span>
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(index)}
              className="cursor-pointer hover:text-foreground"
            >
              {entry.name}
            </button>
          </span>
        ))}
      </div>

      <h1 className="mt-2 text-page-title font-semibold text-foreground">
        {breadcrumb.at(-1)?.name ?? shareInfo.name}
      </h1>
      {contents ? (
        <p className="mt-1 text-modal-caption text-muted-foreground">
          {contents.folders.length} folder{contents.folders.length === 1 ? '' : 's'} ·{' '}
          {contents.files.length} file{contents.files.length === 1 ? '' : 's'} ·{' '}
          {formatBytes(totalSizeBytes)}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="mt-8 text-sm text-destructive">{loadError}</p>
      ) : contents && contents.folders.length === 0 && contents.files.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
          <p className="text-sm font-medium text-foreground">Folder is empty</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          {contents?.folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => navigateToFolder(folder.id, folder.name)}
              className="flex h-(--dr-table-row-h) w-full cursor-pointer items-center gap-2.5 border-b border-border px-3 text-left last:border-b-0 hover:bg-muted/60"
            >
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-row-primary text-foreground">{folder.name}</span>
            </button>
          ))}
          {contents?.files.map((file) => (
            <div
              key={file.id}
              className="flex h-(--dr-table-row-h) items-center gap-2.5 border-b border-border px-3 last:border-b-0"
            >
              <FileText className="size-4 shrink-0 text-red-500 dark:text-red-400" />
              <span className="min-w-0 flex-1 truncate text-row-primary text-foreground">
                {file.name}
              </span>
              <span className="shrink-0 text-row-secondary tabular-nums text-muted-foreground">
                {formatBytes(file.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => handleViewFile(file.id, file.name)}
                className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="View"
              >
                <Eye className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PdfViewerDialog
        open={!!pdfViewerTarget}
        onOpenChange={(open) => !open && setPdfViewerTarget(null)}
        fileUrl={pdfViewerTarget?.url ?? null}
        fileName={pdfViewerTarget?.name ?? ''}
      />
    </div>
  );
};
