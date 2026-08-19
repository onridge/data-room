import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { createDataRoom, listDataRooms } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import { ApiError } from '../lib/api';
import { Button } from '@/components/ui/button';
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
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dataRooms.map((dataRoom) => (
            <button
              key={dataRoom.id}
              type="button"
              onClick={() => navigate(`/data-rooms/${dataRoom.id}`)}
              className="rounded-lg border border-border bg-card p-4 text-left hover:border-input"
            >
              <p className="text-row-primary font-medium text-foreground">{dataRoom.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {new Date(dataRoom.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
