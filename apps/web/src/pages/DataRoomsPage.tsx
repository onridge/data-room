import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import {
  createDataRoom,
  deleteDataRoom,
  getDataRoomSummary,
  listDataRooms,
} from '../lib/data-rooms';
import type { DataRoom, DataRoomSummary } from '../lib/data-rooms';
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

export const DataRoomsPage = () => {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [dataRooms, setDataRooms] = useState<DataRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DataRoom | null>(null);
  const [deleteSummary, setDeleteSummary] = useState<DataRoomSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listDataRooms(accessToken)
      .then(setDataRooms)
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load data rooms');
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    setCreateError(null);
    setIsCreating(true);
    try {
      const dataRoom = await createDataRoom(accessToken, newName);
      setDataRooms((prev) => [dataRoom, ...prev]);
      setNewName('');
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create data room');
    } finally {
      setIsCreating(false);
    }
  };

  const openDeleteDialog = async (dataRoom: DataRoom) => {
    setDeleteTarget(dataRoom);
    setDeleteSummary(null);
    setDeleteError(null);
    if (!accessToken) return;
    try {
      setDeleteSummary(await getDataRoomSummary(accessToken, dataRoom.id));
    } catch {
      // Warning falls back to a generic message below if this fails.
    }
  };

  const handleConfirmDelete = async () => {
    if (!accessToken || !deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDataRoom(accessToken, deleteTarget.id);
      setDataRooms((prev) => prev.filter((room) => room.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete data room');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-foreground">Data Rooms</h1>
        <div className="flex items-center gap-4">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New Data Room</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>New Data Room</DialogTitle>
                  <DialogDescription>Give your data room a name.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    autoFocus
                    required
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Project Meridian"
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
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{user?.email}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="mt-8 text-sm text-destructive">{loadError}</p>
      ) : dataRooms.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
          <p className="text-sm font-medium text-foreground">No data rooms yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first data room to start uploading documents.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setIsCreateOpen(true)}>
            New Data Room
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dataRooms.map((dataRoom) => (
            <div
              key={dataRoom.id}
              className="group relative rounded-lg border border-border bg-card p-4 hover:border-input"
            >
              <button
                type="button"
                onClick={() => navigate(`/data-rooms/${dataRoom.id}`)}
                className="block w-full cursor-pointer pr-6 text-left"
              >
                <p className="truncate text-row-primary font-medium text-foreground">
                  {dataRoom.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(dataRoom.createdAt).toLocaleDateString()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => openDeleteDialog(dataRoom)}
                className="absolute top-3 right-3 grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSummary
                ? `This will permanently delete ${deleteSummary.folderCount} folder(s) and ${deleteSummary.fileCount} file(s) (${formatBytes(deleteSummary.totalSizeBytes)}). This action cannot be undone.`
                : 'Calculating what will be deleted…'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteSummary && deleteSummary.activeShareCount > 0 ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {deleteSummary.activeShareCount} active share link
              {deleteSummary.activeShareCount === 1 ? '' : 's'} will stop working.
            </p>
          ) : null}
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
