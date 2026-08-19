import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
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

interface DeleteConfirmDialogProps {
  name: string;
  description: ReactNode;
  activeShareCount: number;
  error: string | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Shared shell for deleting a data room, folder, or file — each caller
// supplies its own description and share count, since what "everything
// below this" means differs per resource type.
export const DeleteConfirmDialog = ({
  name,
  description,
  activeShareCount,
  error,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteConfirmDialogProps) => (
  <AlertDialog open onOpenChange={(open) => !open && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {activeShareCount > 0 ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {activeShareCount} active share link{activeShareCount === 1 ? '' : 's'} will stop working.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={isDeleting}
          onClick={(event) => {
            event.preventDefault();
            onConfirm();
          }}
          className={buttonVariants({ variant: 'destructive' })}
        >
          {isDeleting ? 'Deleting…' : 'Delete permanently'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
