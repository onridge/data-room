import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Folder as FolderIcon, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getDataRoom } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import {
  createFolder,
  deleteFolder,
  getContents,
  getFolderPath,
  getFolderSummary,
  renameFolder,
} from '../lib/folders';
import type { BreadcrumbEntry, Folder, FolderContents, SubtreeSummary } from '../lib/folders';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<SubtreeSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleCreateFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !id) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const folder = await createFolder(accessToken, id, newFolderName, currentFolderId);
      setContents((prev) => (prev ? { ...prev, folders: [...prev.folders, folder] } : prev));
      setNewFolderName('');
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  const openRename = (folder: Folder) => {
    setRenameTarget(folder);
    setRenameValue(folder.name);
    setRenameError(null);
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !id || !renameTarget) return;
    setRenameError(null);
    setIsRenaming(true);
    try {
      const updated = await renameFolder(accessToken, id, renameTarget.id, renameValue);
      setContents((prev) =>
        prev
          ? { ...prev, folders: prev.folders.map((f) => (f.id === updated.id ? updated : f)) }
          : prev,
      );
      setRenameTarget(null);
    } catch (err) {
      setRenameError(err instanceof ApiError ? err.message : 'Failed to rename folder');
    } finally {
      setIsRenaming(false);
    }
  };

  const openDeleteDialog = async (folder: Folder) => {
    setDeleteTarget(folder);
    setDeleteSummary(null);
    setDeleteError(null);
    if (!accessToken || !id) return;
    try {
      const summary = await getFolderSummary(accessToken, id, folder.id);
      setDeleteSummary(summary);
    } catch {
      // Warning falls back to a generic message below if this fails.
    }
  };

  const handleConfirmDelete = async () => {
    if (!accessToken || !id || !deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteFolder(accessToken, id, deleteTarget.id);
      setContents((prev) =>
        prev
          ? { ...prev, folders: prev.folders.filter((f) => f.id !== deleteTarget.id) }
          : prev,
      );
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete folder');
    } finally {
      setIsDeleting(false);
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
          className="hover:text-foreground"
        >
          {dataRoom?.name ?? '…'}
        </button>
        {breadcrumb.map((entry) => (
          <span key={entry.id} className="flex items-center gap-2">
            <span>/</span>
            <button
              type="button"
              onClick={() => navigateToFolder(entry.id)}
              className="hover:text-foreground"
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New Folder</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateFolder}>
              <DialogHeader>
                <DialogTitle>New Folder</DialogTitle>
                <DialogDescription>Give the folder a name.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  autoFocus
                  required
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="Q3 2024"
                />
                {createError ? (
                  <p className="mt-2 text-sm text-destructive">{createError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="mt-8 text-sm text-destructive">{loadError}</p>
      ) : contents && contents.folders.length === 0 && contents.files.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
          <p className="text-sm font-medium text-foreground">Folder is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a subfolder to start organizing documents.
          </p>
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
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-row-primary text-foreground">{folder.name}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openRename(folder)}
                  className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Rename"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteDialog(folder)}
                  className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
              className="flex h-(--dr-table-row-h) items-center gap-2.5 border-b border-border px-3 last:border-b-0"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-row-primary text-foreground">{file.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename folder</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                autoFocus
                required
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
              {renameError ? (
                <p className="mt-2 text-sm text-destructive">{renameError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isRenaming}>
                {isRenaming ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSummary
                ? `This will permanently delete ${deleteSummary.subfolderCount} subfolder(s) and ${deleteSummary.fileCount} file(s) (${formatBytes(deleteSummary.totalSizeBytes)}). This action cannot be undone.`
                : 'Calculating what will be deleted…'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {isDeleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
