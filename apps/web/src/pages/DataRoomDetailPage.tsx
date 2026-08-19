import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { getDataRoom } from '../lib/data-rooms';
import type { DataRoom } from '../lib/data-rooms';
import { ApiError } from '../lib/api';

export const DataRoomDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [dataRoom, setDataRoom] = useState<DataRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    getDataRoom(accessToken, id)
      .then(setDataRoom)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load data room');
      });
  }, [accessToken, id]);

  return (
    <div className="p-8">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Data Rooms
      </Link>

      {error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : (
        <>
          <h1 className="mt-2 text-page-title font-semibold text-foreground">
            {dataRoom?.name ?? 'Loading…'}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Folders and files go here — next stage.
          </p>
        </>
      )}
    </div>
  );
};
