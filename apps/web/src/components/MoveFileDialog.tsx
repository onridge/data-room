import { useEffect, useState } from 'react';
import { Folder as FolderIcon } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { listAllFolders } from '../lib/folders';
import type { FileEntry, Folder } from '../lib/folders';
import { moveFile } from '../lib/files';
import { ApiError } from '../lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MoveFileDialogProps {
  target: FileEntry;
  dataRoomId: string;
  onMoved: (fileId: string) => void;
  onClose: () => void;
}

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

export const MoveFileDialog = ({ target, dataRoomId, onMoved, onClose }: MoveFileDialogProps) => {
  const { accessToken } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listAllFolders(accessToken, dataRoomId)
      .then(setFolders)
      .catch(() => {
        // Picker just falls back to "Root only" if this fails.
      });
  }, [accessToken, dataRoomId]);

  const handleMove = async (folderId: string | undefined) => {
    if (!accessToken) return;
    setIsMoving(true);
    setError(null);
    try {
      await moveFile(accessToken, dataRoomId, target.id, folderId);
      onMoved(target.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to move file');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &ldquo;{target.name}&rdquo;</DialogTitle>
          <DialogDescription>Choose a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          <button
            type="button"
            disabled={isMoving || target.folderId === null}
            onClick={() => handleMove(undefined)}
            className="flex w-full cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-left text-row-secondary text-foreground last:border-b-0 hover:bg-muted disabled:pointer-events-none disabled:cursor-default disabled:opacity-50"
          >
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            Root
          </button>
          {buildFolderOptions(folders).map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={isMoving || target.folderId === option.id}
              onClick={() => handleMove(option.id)}
              style={{ paddingLeft: `${12 + option.depth * 16}px` }}
              className="flex w-full cursor-pointer items-center gap-2 border-b border-border py-2 pr-3 text-left text-row-secondary text-foreground last:border-b-0 hover:bg-muted disabled:pointer-events-none disabled:cursor-default disabled:opacity-50"
            >
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              {option.name}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
};
