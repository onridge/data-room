import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Eye,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  History,
  Pencil,
  Search,
  Share2,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getDataRoom } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import { getContents, getFolderPath, renameFolder } from '../lib/folders';
import type { BreadcrumbEntry, FileEntry, Folder, FolderContents } from '../lib/folders';
import { renameFile, viewFile } from '../lib/files';
import { useFileSearch } from '../hooks/useFileSearch';
import { FileSearchResults } from '../components/FileSearchResults';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { useFileUpload } from '../hooks/useFileUpload';
import { UploadPanel } from '../components/UploadPanel';
import { ShareDialog } from '../components/ShareDialog';
import type { ShareResourceType } from '../lib/shares';
import { PdfViewerDialog } from '../components/PdfViewerDialog';
import { VersionHistoryDialog } from '../components/VersionHistoryDialog';
import { CreateFolderDialog } from '../components/CreateFolderDialog';
import { RenameDialog } from '../components/RenameDialog';
import { DeleteFolderDialog } from '../components/DeleteFolderDialog';
import { DeleteFileDialog } from '../components/DeleteFileDialog';
import { MoveFileDialog } from '../components/MoveFileDialog';
import { Button } from '@/components/ui/button';

export const DataRoomDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folder') ?? undefined;
  const { accessToken } = useAuth();

  const [dataRoom, setDataRoom] = useState<DataRoom | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<Folder | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [renameFileTarget, setRenameFileTarget] = useState<FileEntry | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileEntry | null>(null);
  const [moveFileTarget, setMoveFileTarget] = useState<FileEntry | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<FileEntry | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    resourceType: ShareResourceType;
    resourceId: string;
    name: string;
  } | null>(null);
  const [pdfViewerTarget, setPdfViewerTarget] = useState<{ url: string; name: string } | null>(
    null,
  );

  const search = useFileSearch({ dataRoomId: id });

  const upload = useFileUpload({
    dataRoomId: id,
    folderId: currentFolderId,
    onContentsRefreshed: setContents,
  });

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [room, folderContents, path] = await Promise.all([
        getDataRoom(accessToken, id),
        getContents(accessToken, id, currentFolderId),
        currentFolderId ? getFolderPath(accessToken, id, currentFolderId) : Promise.resolve([]),
      ]);
      setDataRoom(room);
      setContents(folderContents);
      setBreadcrumb(path);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, currentFolderId]);

  useEffect(() => {
    load();
  }, [load]);

  const navigateToFolder = (folderId?: string) => {
    setSearchParams(folderId ? { folder: folderId } : {});
  };

  // Jumping to a search result's folder leaves search mode — otherwise the
  // results list would stay up over the folder the user just asked to see.
  const openFolderFromSearch = (folderId?: string) => {
    search.clearQuery();
    navigateToFolder(folderId);
  };

  // Structurally typed rather than tied to FileEntry, so a search result
  // (which carries a path instead of a folder object) works unchanged.
  const handleViewFile = async (file: { id: string; name: string }) => {
    if (!accessToken || !id) return;
    try {
      const objectUrl = await viewFile(accessToken, id, file.id);
      setPdfViewerTarget({ url: objectUrl, name: file.name });
    } catch {
      // The eye button just does nothing on failure — no dedicated error UI
      // for this yet.
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Data Rooms
        </Link>
        <span>/</span>
        <button
          type="button"
          onClick={() => navigateToFolder(undefined)}
          className="cursor-pointer hover:text-foreground"
        >
          {dataRoom?.name ?? '…'}
        </button>
        {breadcrumb.map((entry) => (
          <span key={entry.id} className="flex items-center gap-2">
            <span>/</span>
            <button
              type="button"
              onClick={() => navigateToFolder(entry.id)}
              className="cursor-pointer hover:text-foreground"
            >
              {entry.name}
            </button>
          </span>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-foreground">
          {breadcrumb.at(-1)?.name ?? dataRoom?.name ?? 'Loading…'}
        </h1>
        <div className="flex items-center gap-2">
          <input
            ref={upload.fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={upload.handleFileInputChange}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            {/* The native WebKit clear button is suppressed in favour of the
                styled one below — otherwise the field shows two crosses. */}
            <input
              type="search"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              placeholder="Search files…"
              aria-label="Search files"
              className="h-8 w-56 rounded-lg border border-input bg-background pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search.query ? (
              <button
                type="button"
                onClick={search.clearQuery}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setShareTarget(
                currentFolderId
                  ? {
                      resourceType: 'FOLDER',
                      resourceId: currentFolderId,
                      name: breadcrumb.at(-1)?.name ?? '',
                    }
                  : {
                      resourceType: 'DATA_ROOM',
                      resourceId: id ?? '',
                      name: dataRoom?.name ?? '',
                    },
              )
            }
          >
            <Share2 className="size-3.5" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={upload.openFilePicker}>
            <UploadIcon className="size-3.5" />
            Upload
          </Button>
          <Button size="sm" onClick={() => setIsCreateFolderOpen(true)}>
            New Folder
          </Button>
        </div>
      </div>

      {upload.validationError ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{upload.validationError}</span>
          <button
            type="button"
            onClick={upload.dismissValidationError}
            className="shrink-0 cursor-pointer text-destructive/70 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {search.isSearchActive ? (
        <FileSearchResults
          results={search.results}
          isSearching={search.isSearching}
          searchError={search.searchError}
          query={search.query.trim()}
          onOpenFolder={openFolderFromSearch}
          onViewFile={handleViewFile}
        />
      ) : (
        <div className="relative" {...upload.dragHandlers}>
          {isLoading ? (
            <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
          ) : loadError ? (
            <p className="mt-8 text-sm text-destructive">{loadError}</p>
          ) : contents && contents.folders.length === 0 && contents.files.length === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
              <p className="text-sm font-medium text-foreground">Folder is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag and drop PDFs here, or use the buttons below.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button size="sm" onClick={upload.openFilePicker}>
                  <UploadIcon className="size-3.5" />
                  Upload
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsCreateFolderOpen(true)}>
                  New Folder
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-lg border border-border">
              {contents?.folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group flex h-(--dr-table-row-h) items-center justify-between border-b border-border px-3 last:border-b-0 hover:bg-muted/60"
                >
                  <button
                    type="button"
                    onClick={() => navigateToFolder(folder.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                  >
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-row-primary text-foreground">{folder.name}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() =>
                        setShareTarget({
                          resourceType: 'FOLDER',
                          resourceId: folder.id,
                          name: folder.name,
                        })
                      }
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Share"
                    >
                      <Share2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameFolderTarget(folder)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteFolderTarget(folder)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {contents?.files.map((file) => (
                <div
                  key={file.id}
                  className="group flex h-(--dr-table-row-h) items-center gap-2.5 border-b border-border px-3 last:border-b-0"
                >
                  <FileText className="size-4 shrink-0 text-red-500 dark:text-red-400" />
                  <span className="min-w-0 flex-1 truncate text-row-primary text-foreground">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-row-secondary tabular-nums text-muted-foreground">
                    {formatBytes(file.sizeBytes)}
                  </span>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() =>
                        setShareTarget({
                          resourceType: 'FILE',
                          resourceId: file.id,
                          name: file.name,
                        })
                      }
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Share"
                    >
                      <Share2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewFile(file)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="View"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    {file.versionNumber > 1 ? (
                      <button
                        type="button"
                        onClick={() => setVersionsTarget(file)}
                        className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Version history"
                        title={`${file.versionNumber} versions`}
                      >
                        <History className="size-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setMoveFileTarget(file)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Move"
                    >
                      <FolderInput className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenameFileTarget(file)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteFileTarget(file)}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {upload.isDragOver ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-primary/[0.06]">
              <UploadIcon className="size-6 text-primary" />
              <p className="text-sm font-semibold text-accent-foreground">Drop PDFs to upload</p>
            </div>
          ) : null}
        </div>
      )}

      <UploadPanel
        items={upload.uploads}
        onDismiss={upload.dismissUploads}
        onRetry={upload.retryUpload}
      />

      {id ? (
        <CreateFolderDialog
          open={isCreateFolderOpen}
          onOpenChange={setIsCreateFolderOpen}
          dataRoomId={id}
          parentId={currentFolderId}
          onCreated={(folder) =>
            setContents((prev) => (prev ? { ...prev, folders: [...prev.folders, folder] } : prev))
          }
        />
      ) : null}

      {renameFolderTarget && id && accessToken ? (
        <RenameDialog
          title="Rename folder"
          currentName={renameFolderTarget.name}
          errorFallback="Failed to rename folder"
          onClose={() => setRenameFolderTarget(null)}
          onRename={async (name) => {
            const updated = await renameFolder(accessToken, id, renameFolderTarget.id, name);
            setContents((prev) =>
              prev
                ? {
                    ...prev,
                    folders: prev.folders.map((f) => (f.id === updated.id ? updated : f)),
                  }
                : prev,
            );
            setRenameFolderTarget(null);
          }}
        />
      ) : null}

      {renameFileTarget && id && accessToken ? (
        <RenameDialog
          title="Rename file"
          currentName={renameFileTarget.name}
          errorFallback="Failed to rename file"
          onClose={() => setRenameFileTarget(null)}
          onRename={async (name) => {
            const updated = await renameFile(accessToken, id, renameFileTarget.id, name);
            setContents((prev) =>
              prev
                ? {
                    ...prev,
                    files: prev.files.map((f) => (f.id === updated.id ? updated : f)),
                  }
                : prev,
            );
            setRenameFileTarget(null);
          }}
        />
      ) : null}

      {deleteFolderTarget && id ? (
        <DeleteFolderDialog
          target={deleteFolderTarget}
          dataRoomId={id}
          onClose={() => setDeleteFolderTarget(null)}
          onDeleted={(folderId) => {
            setContents((prev) =>
              prev
                ? {
                    ...prev,
                    folders: prev.folders.filter((f) => f.id !== folderId),
                  }
                : prev,
            );
            setDeleteFolderTarget(null);
          }}
        />
      ) : null}

      {deleteFileTarget && id ? (
        <DeleteFileDialog
          target={deleteFileTarget}
          dataRoomId={id}
          onClose={() => setDeleteFileTarget(null)}
          onDeleted={(fileId) => {
            setContents((prev) =>
              prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev,
            );
            setDeleteFileTarget(null);
          }}
        />
      ) : null}

      {versionsTarget && id ? (
        <VersionHistoryDialog
          target={versionsTarget}
          dataRoomId={id}
          onClose={() => setVersionsTarget(null)}
          onViewVersion={async (versionId, label) => {
            if (!accessToken) return;
            try {
              const objectUrl = await viewFile(accessToken, id, versionsTarget.id, versionId);
              setPdfViewerTarget({ url: objectUrl, name: label });
            } catch {
              // Same as the main view button: failing to open is silent.
            }
          }}
        />
      ) : null}

      {moveFileTarget && id ? (
        <MoveFileDialog
          target={moveFileTarget}
          dataRoomId={id}
          onClose={() => setMoveFileTarget(null)}
          onMoved={(fileId) => {
            // The file leaves whatever folder is currently open, regardless
            // of which folder it moved to.
            setContents((prev) =>
              prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev,
            );
            setMoveFileTarget(null);
          }}
        />
      ) : null}

      {shareTarget ? (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          resourceType={shareTarget.resourceType}
          resourceId={shareTarget.resourceId}
          resourceName={shareTarget.name}
        />
      ) : null}

      <PdfViewerDialog
        open={!!pdfViewerTarget}
        onOpenChange={(open) => !open && setPdfViewerTarget(null)}
        fileUrl={pdfViewerTarget?.url ?? null}
        fileName={pdfViewerTarget?.name ?? ''}
      />
    </div>
  );
};
