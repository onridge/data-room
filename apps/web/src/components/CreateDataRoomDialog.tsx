import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../lib/auth-context';
import { createDataRoom } from '../lib/data-rooms';
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
} from '@/components/ui/dialog';

interface CreateDataRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (dataRoom: DataRoom) => void;
}

export const CreateDataRoomDialog = ({
  open,
  onOpenChange,
  onCreated,
}: CreateDataRoomDialogProps) => {
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
      onCreated(await createDataRoom(accessToken, name));
      setName('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create data room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Data Room</DialogTitle>
            <DialogDescription>Give your data room a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project Meridian"
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
