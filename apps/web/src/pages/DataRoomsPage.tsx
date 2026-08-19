import { useAuth } from '../lib/auth-context';

export const DataRoomsPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Data Rooms</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.email}</span>
          <button
            onClick={logout}
            className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Data room list goes here — next stage.
      </p>
    </div>
  );
};
