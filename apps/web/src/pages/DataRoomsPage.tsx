import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { listDataRooms } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import { ApiError } from '../lib/api';
import { CreateDataRoomDialog } from '../components/CreateDataRoomDialog';
import { DeleteDataRoomDialog } from '../components/DeleteDataRoomDialog';
import { Button } from '@/components/ui/button';

export const DataRoomsPage = () => {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [dataRooms, setDataRooms] = useState<DataRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataRoom | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listDataRooms(accessToken)
      .then(setDataRooms)
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load data rooms');
      })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-foreground">Data Rooms</h1>
        <div className="flex items-center gap-4">
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            New Data Room
          </Button>
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
                onClick={() => setDeleteTarget(dataRoom)}
                className="absolute top-3 right-3 grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateDataRoomDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(dataRoom) => setDataRooms((prev) => [dataRoom, ...prev])}
      />

      {deleteTarget ? (
        <DeleteDataRoomDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(dataRoomId) => {
            setDataRooms((prev) => prev.filter((room) => room.id !== dataRoomId));
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
};
