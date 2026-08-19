import { Eye, FileText } from 'lucide-react';
import type { FileSearchResult } from '../lib/files';
import { formatBytes } from '../lib/format';

interface FileSearchResultsProps {
  results: FileSearchResult[] | null;
  isSearching: boolean;
  searchError: string | null;
  query: string;
  onOpenFolder: (folderId?: string) => void;
  onViewFile: (file: FileSearchResult) => void;
}

// Search results deliberately expose fewer actions than the folder listing:
// view, and jump to the containing folder. Rename/move/delete stay where the
// file actually lives, so destructive actions are never one click away from
// a fuzzy match.
export const FileSearchResults = ({
  results,
  isSearching,
  searchError,
  query,
  onOpenFolder,
  onViewFile,
}: FileSearchResultsProps) => {
  if (searchError) {
    return <p className="mt-8 text-sm text-destructive">{searchError}</p>;
  }

  // Only show the spinner text before the first result set arrives —
  // re-searching on every keystroke otherwise makes the list flicker.
  if (isSearching && !results) {
    return <p className="mt-8 text-sm text-muted-foreground">Searching…</p>;
  }

  if (results && results.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-input p-8 text-center">
        <p className="text-sm font-medium text-foreground">No files match “{query}”</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Search looks at file names across this entire data room.
        </p>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border">
      {results.map((file) => (
        <div
          key={file.id}
          className="group flex h-(--dr-table-row-h) items-center gap-2.5 border-b border-border px-3 last:border-b-0"
        >
          <FileText className="size-4 shrink-0 text-red-500 dark:text-red-400" />
          <span className="min-w-0 shrink truncate text-row-primary text-foreground">
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => onOpenFolder(file.folderId ?? undefined)}
            className="min-w-0 flex-1 cursor-pointer truncate text-left text-row-secondary text-muted-foreground hover:text-foreground hover:underline"
            title="Open containing folder"
          >
            in {file.path.length > 0 ? file.path.map((entry) => entry.name).join(' / ') : 'root'}
          </button>
          <span className="shrink-0 text-row-secondary tabular-nums text-muted-foreground">
            {formatBytes(file.sizeBytes)}
          </span>
          <button
            type="button"
            onClick={() => onViewFile(file)}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label="View"
          >
            <Eye className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
