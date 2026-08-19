import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Folder as FolderIcon,
  FolderInput,
  Pencil,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getDataRoom } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import {
  createFolder,
  deleteFolder,
  getContents,
  getFolderPath,
  getFolderSummary,
  listAllFolders,
  renameFolder,
} from '../lib/folders';
import type { BreadcrumbEntry, FileEntry, Folder, FolderContents, SubtreeSummary } from '../lib/folders';
import { deleteFile, moveFile, renameFile, uploadFile } from '../lib/files';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { UploadPanel } from '../components/UploadPanel';
import type { UploadItem } from '../components/UploadPanel';
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

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

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

  const [fileDeleteTarget, setFileDeleteTarget] = useState<FileEntry | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [fileDeleteError, setFileDeleteError] = useState<string | null>(null);

  const [fileRenameTarget, setFileRenameTarget] = useState<FileEntry | null>(null);
  const [fileRenameValue, setFileRenameValue] = useState('');
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [fileRenameError, setFileRenameError] = useState<string | null>(null);

  const [moveTarget, setMoveTarget] = useState<FileEntry | null>(null);
  const [moveFolders, setMoveFolders] = useState<Folder[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadValidationError, setUploadValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openFileRename = (file: FileEntry) => {
    setFileRenameTarget(file);
    setFileRenameValue(file.name);
    setFileRenameError(null);
  };

  const handleFileRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !id || !fileRenameTarget) return;
    setFileRenameError(null);
    setIsRenamingFile(true);
    try {
      const updated = await renameFile(accessToken, id, fileRenameTarget.id, fileRenameValue);
      setContents((prev) =>
        prev
          ? { ...prev, files: prev.files.map((f) => (f.id === updated.id ? updated : f)) }
          : prev,
      );
      setFileRenameTarget(null);
    } catch (err) {
      setFileRenameError(err instanceof ApiError ? err.message : 'Failed to rename file');
    } finally {
      setIsRenamingFile(false);
    }
  };

  const openMoveDialog = async (file: FileEntry) => {
    setMoveTarget(file);
    setMoveError(null);
    setMoveFolders([]);
    if (!accessToken || !id) return;
    try {
      setMoveFolders(await listAllFolders(accessToken, id));
    } catch {
      // Picker just falls back to "Root only" if this fails.
    }
  };

  const handleMoveFile = async (folderId: string | undefined) => {
    if (!accessToken || !id || !moveTarget) return;
    setIsMoving(true);
    setMoveError(null);
    try {
      await moveFile(accessToken, id, moveTarget.id, folderId);
      // The file leaves whatever folder is currently open, regardless of
      // which folder it moved to.
      setContents((prev) =>
        prev ? { ...prev, files: prev.files.filter((f) => f.id !== moveTarget.id) } : prev,
      );
      setMoveTarget(null);
    } catch (err) {
      setMoveError(err instanceof ApiError ? err.message : 'Failed to move file');
    } finally {
      setIsMoving(false);
    }
  };

  // Adjacency list -> indented list, root folders first then their children
  // depth-first — same shape the breadcrumb/tree already assumes elsewhere.
  const buildFolderOptions = (folders: Folder[]) => {
    const byParent = new Map<string | null, Folder[]>();
    for (const folder of folders) {
      const key = folder.parentId;
      byParent.set(key, [...(byParent.get(key) ?? []), folder]);
    }
    const options: { id: string; name: string; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of byParent.get(parentId) ?? []) {
        options.push({ id: folder.id, name: folder.name, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return options;
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

  const handleConfirmDeleteFile = async () => {
    if (!accessToken || !id || !fileDeleteTarget) return;
    setIsDeletingFile(true);
    setFileDeleteError(null);
    try {
      await deleteFile(accessToken, id, fileDeleteTarget.id);
      setContents((prev) =>
        prev
          ? { ...prev, files: prev.files.filter((f) => f.id !== fileDeleteTarget.id) }
          : prev,
      );
      setFileDeleteTarget(null);
    } catch (err) {
      setFileDeleteError(err instanceof ApiError ? err.message : 'Failed to delete file');
    } finally {
      setIsDeletingFile(false);
    }
  };

  // The browser's PUT to Blob storage finishing doesn't mean our DB row is
  // READY yet — Vercel's onUploadCompleted callback lands as a separate,
  // slightly-delayed request. Poll briefly instead of refetching once too
  // early and showing a stale list.
  const waitForFileToAppear = async (fileName: string) => {
    if (!accessToken || !id) return;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const latest = await getContents(accessToken, id, currentFolderId);
        setContents(latest);
        if (latest.files.some((file) => file.name === fileName)) return;
      } catch {
        // A transient error here just means this attempt didn't refresh the
        // list; the next attempt (or the user's own reload) will catch up.
      }
    }
  };

  const uploadOne = async (item: UploadItem) => {
    if (!accessToken || !id) return;
    try {
      await uploadFile({
        file: item.file,
        dataRoomId: id,
        folderId: currentFolderId,
        token: accessToken,
        onProgress: (percentage) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, progress: percentage } : u)),
          );
        },
      });
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'done', progress: 100 } : u)),
      );
      await waitForFileToAppear(item.file.name);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed';
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'error', error: message } : u)),
      );
    }
  };

  const startUploads = (files: FileList | File[]) => {
    const rejections: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        rejections.push(`"${file.name}" — only PDF files are supported`);
        continue;
      }
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        rejections.push(
          `"${file.name}" — exceeds the ${formatBytes(MAX_UPLOAD_SIZE_BYTES)} upload limit`,
        );
        continue;
      }
      accepted.push(file);
    }

    setUploadValidationError(rejections.length > 0 ? rejections.join('; ') : null);

    const items: UploadItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
      progress: 0,
    }));
    if (items.length === 0) return;
    setUploads((prev) => [...prev, ...items]);
    items.forEach((item) => uploadOne(item));
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) startUploads(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files.length) startUploads(event.dataTransfer.files);
  };

  const retryUpload = (uploadId: string) => {
    const item = uploads.find((u) => u.id === uploadId);
    if (!item) return;
    setUploads((prev) =>
      prev.map((u) => (u.id === uploadId ? { ...u, status: 'uploading', progress: 0 } : u)),
    );
    uploadOne(item);
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
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon className="size-3.5" />
            Upload
          </Button>
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
      </div>

      {uploadValidationError ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{uploadValidationError}</span>
          <button
            type="button"
            onClick={() => setUploadValidationError(null)}
            className="shrink-0 text-destructive/70 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div
        className="relative"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="mt-8 text-sm text-destructive">{loadError}</p>
        ) : contents && contents.folders.length === 0 && contents.files.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
            <p className="text-sm font-medium text-foreground">Folder is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag and drop PDFs here, or use the Upload button.
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
                className="group flex h-(--dr-table-row-h) items-center gap-2.5 border-b border-border px-3 last:border-b-0"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-row-primary text-foreground">
                  {file.name}
                </span>
                <span className="shrink-0 text-row-secondary tabular-nums text-muted-foreground">
                  {formatBytes(file.sizeBytes)}
                </span>
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openMoveDialog(file)}
                    className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Move"
                  >
                    <FolderInput className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openFileRename(file)}
                    className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Rename"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFileDeleteTarget(file);
                      setFileDeleteError(null);
                    }}
                    className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isDragOver ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-primary/[0.06]">
            <UploadIcon className="size-6 text-primary" />
            <p className="text-sm font-semibold text-accent-foreground">Drop PDFs to upload</p>
          </div>
        ) : null}
      </div>

      <UploadPanel
        items={uploads}
        onDismiss={() => setUploads([])}
        onRetry={retryUpload}
      />

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

      {/* File rename dialog */}
      <Dialog
        open={!!fileRenameTarget}
        onOpenChange={(open) => !open && setFileRenameTarget(null)}
      >
        <DialogContent>
          <form onSubmit={handleFileRename}>
            <DialogHeader>
              <DialogTitle>Rename file</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                autoFocus
                required
                value={fileRenameValue}
                onChange={(event) => setFileRenameValue(event.target.value)}
              />
              {fileRenameError ? (
                <p className="mt-2 text-sm text-destructive">{fileRenameError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isRenamingFile}>
                {isRenamingFile ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move &ldquo;{moveTarget?.name}&rdquo;</DialogTitle>
            <DialogDescription>Choose a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border">
            <button
              type="button"
              disabled={isMoving || moveTarget?.folderId === null}
              onClick={() => handleMoveFile(undefined)}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-row-secondary text-foreground last:border-b-0 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              Root
            </button>
            {buildFolderOptions(moveFolders).map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={isMoving || moveTarget?.folderId === option.id}
                onClick={() => handleMoveFile(option.id)}
                style={{ paddingLeft: `${12 + option.depth * 16}px` }}
                className="flex w-full items-center gap-2 border-b border-border py-2 pr-3 text-left text-row-secondary text-foreground last:border-b-0 hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                {option.name}
              </button>
            ))}
          </div>
          {moveError ? <p className="text-sm text-destructive">{moveError}</p> : null}
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

      {/* File delete confirmation */}
      <AlertDialog
        open={!!fileDeleteTarget}
        onOpenChange={(open) => !open && setFileDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{fileDeleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {fileDeleteError ? <p className="text-sm text-destructive">{fileDeleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingFile}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDeleteFile();
              }}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {isDeletingFile ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
