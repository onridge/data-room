import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy, Globe, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import {
  addGrant,
  createShare,
  listShares,
  removeGrant,
  revokeShare,
} from '../lib/shares';
import type { Share, ShareResourceType } from '../lib/shares';
import { ApiError } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ShareResourceType;
  resourceId: string;
  resourceName: string;
}

export const ShareDialog = ({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareDialogProps) => {
  const { accessToken } = useAuth();
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);

  const publicShare = shares.find((s) => s.mode === 'PUBLIC');
  const permissionedShare = shares.find((s) => s.mode === 'PERMISSIONED');

  const load = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      setShares(await listShares(accessToken, resourceType, resourceId));
    } catch {
      // Leave the dialog on its empty state; the user can retry by closing/reopening.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceType, resourceId]);

  const handleCreatePublicLink = async () => {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await createShare(accessToken, resourceType, resourceId, 'PUBLIC');
      await load();
    } finally {
      setIsBusy(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!accessToken) return;
    setIsBusy(true);
    try {
      await revokeShare(accessToken, shareId);
      await load();
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyLink = () => {
    if (!publicShare?.token) return;
    const url = `${window.location.origin}/share/${publicShare.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddGrant = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !email.trim()) return;
    setGrantError(null);
    setIsBusy(true);
    try {
      if (permissionedShare) {
        await addGrant(accessToken, permissionedShare.id, email.trim());
      } else {
        await createShare(accessToken, resourceType, resourceId, 'PERMISSIONED', [email.trim()]);
      }
      setEmail('');
      await load();
    } catch (err) {
      setGrantError(err instanceof ApiError ? err.message : 'Failed to add person');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveGrant = async (grantId: string) => {
    if (!accessToken || !permissionedShare) return;
    setIsBusy(true);
    try {
      await removeGrant(accessToken, permissionedShare.id, grantId);
      await load();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &ldquo;{resourceName}&rdquo;</DialogTitle>
          <DialogDescription>Anyone given access can only view — never edit.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 text-row-secondary font-semibold text-foreground">
                <Globe className="size-4 text-muted-foreground" />
                Public link
              </div>
              {publicShare ? (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/share/${publicShare.token}`}
                    className="text-modal-caption"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyLink}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => handleRevoke(publicShare.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isBusy}
                  onClick={handleCreatePublicLink}
                >
                  Create public link
                </Button>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-row-secondary font-semibold text-foreground">
                <Users className="size-4 text-muted-foreground" />
                People with access
              </div>
              {permissionedShare && permissionedShare.grants.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {permissionedShare.grants.map((grant) => (
                    <div key={grant.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-row-secondary text-foreground">
                        {grant.user.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGrant(grant.id)}
                        disabled={isBusy}
                        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-default"
                        aria-label="Remove access"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-modal-caption text-muted-foreground">
                  No one else has access yet.
                </p>
              )}
              <form onSubmit={handleAddGrant} className="mt-2 flex items-center gap-2">
                <Input
                  type="email"
                  required
                  placeholder="person@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Button type="submit" size="sm" disabled={isBusy}>
                  Add
                </Button>
              </form>
              {grantError ? <p className="mt-1.5 text-sm text-destructive">{grantError}</p> : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
