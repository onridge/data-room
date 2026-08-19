import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { deleteDataRoom, getDataRoomSummary } from '../lib/data-rooms';
import type { DataRoom, DataRoomSummary } from '../lib/data-rooms';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface DeleteDataRoomDialogProps {
  target: DataRoom;
  onDeleted: (dataRoomId: string) => void;
  onClose: () => void;
}

export const DeleteDataRoomDialog = ({
  target,
  onDeleted,
  onClose,
}: DeleteDataRoomDialogProps) => {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<DataRoomSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getDataRoomSummary(accessToken, target.id)
      .then(setSummary)
      .catch(() => {
        // Warning falls back to the generic message below if this fails.
      });
  }, [accessToken, target.id]);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteDataRoom(accessToken, target.id);
      onDeleted(target.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete data room');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DeleteConfirmDialog
      name={target.name}
      description={
        summary
          ? `This will permanently delete ${summary.folderCount} folder(s) and ${summary.fileCount} file(s) (${formatBytes(summary.totalSizeBytes)}). This action cannot be undone.`
          : 'Calculating what will be deleted…'
      }
      activeShareCount={summary?.activeShareCount ?? 0}
      error={error}
      isDeleting={isDeleting}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
};
