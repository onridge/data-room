import { useAuth } from '../lib/auth-context';
import { Button } from '@/components/ui/button';

export const DataRoomsPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title font-semibold text-foreground">Data Rooms</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{user?.email}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Data room list goes here — next stage.
      </p>
    </div>
  );
};
