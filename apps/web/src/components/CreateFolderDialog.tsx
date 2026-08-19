import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../lib/auth-context';
import { createFolder } from '../lib/folders';
import type { Folder } from '../lib/folders';
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
} from '@/components/ui/dialog';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataRoomId: string;
  parentId?: string;
  onCreated: (folder: Folder) => void;
}

export const CreateFolderDialog = ({
  open,
  onOpenChange,
  dataRoomId,
  parentId,
  onCreated,
}: CreateFolderDialogProps) => {
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      onCreated(await createFolder(accessToken, dataRoomId, name, parentId));
      setName('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Give the folder a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Q3 2024"
            />
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
