import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { deleteFile } from '../lib/files';
import type { FileEntry } from '../lib/folders';
import { listShares } from '../lib/shares';
import { ApiError } from '../lib/api';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface DeleteFileDialogProps {
  target: FileEntry;
  dataRoomId: string;
  onDeleted: (fileId: string) => void;
  onClose: () => void;
}

export const DeleteFileDialog = ({
  target,
  dataRoomId,
  onDeleted,
  onClose,
}: DeleteFileDialogProps) => {
  const { accessToken } = useAuth();
  const [activeShareCount, setActiveShareCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listShares(accessToken, 'FILE', target.id)
      .then((shares) => setActiveShareCount(shares.length))
      .catch(() => {
        // Warning just doesn't show if this fails.
      });
  }, [accessToken, target.id]);

  const handleConfirm = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteFile(accessToken, dataRoomId, target.id);
      onDeleted(target.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DeleteConfirmDialog
      name={target.name}
      description="This action cannot be undone."
      activeShareCount={activeShareCount}
      error={error}
      isDeleting={isDeleting}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
};
