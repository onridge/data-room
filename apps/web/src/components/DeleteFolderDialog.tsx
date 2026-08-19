import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { deleteFolder, getFolderSummary } from '../lib/folders';
import type { Folder, SubtreeSummary } from '../lib/folders';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface DeleteFolderDialogProps {
  target: Folder;
  dataRoomId: string;
  onDeleted: (folderId: string) => void;
  onClose: () => void;
}

export const DeleteFolderDialog = ({
  target,
  dataRoomId,
  onDeleted,
  onClose,
}: DeleteFolderDialogProps) => {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<SubtreeSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    getFolderSummary(accessToken, dataRoomId, target.id)
      .then(setSummary)
      .catch(() => {
        // Warning falls back to the generic message below if this fails.
      });
  }, [accessToken, dataRoomId, target.id]);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteFolder(accessToken, dataRoomId, target.id);
      onDeleted(target.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete folder');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DeleteConfirmDialog
      name={target.name}
      description={
        summary
          ? `This will permanently delete ${summary.subfolderCount} subfolder(s) and ${summary.fileCount} file(s) (${formatBytes(summary.totalSizeBytes)}). This action cannot be undone.`
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
