import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { searchFiles } from '../lib/files';
import type { FileSearchResult } from '../lib/files';
import { ApiError } from '../lib/api';

const DEBOUNCE_MS = 300;

interface UseFileSearchParams {
  dataRoomId?: string;
}

// Results are stored together with the query that produced them. That one
// pairing replaces what would otherwise be several pieces of bookkeeping
// state: "is a search in flight" and "are these results stale" both become
// comparisons against the current query, so nothing has to be reset by hand
// when the box is cleared or retyped.
interface SearchState {
  query: string;
  results: FileSearchResult[] | null;
  error: string | null;
}

export const useFileSearch = ({ dataRoomId }: UseFileSearchParams) => {
  const { accessToken } = useAuth();

  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState | null>(null);

  const trimmedQuery = query.trim();
  // Drives the page's "show results instead of the folder listing" switch.
  // Keyed off the query rather than the response, so the folder listing
  // doesn't flash back in between keystrokes.
  const isSearchActive = trimmedQuery.length > 0;
  const isCurrent = state?.query === trimmedQuery;

  useEffect(() => {
    if (!accessToken || !dataRoomId || !trimmedQuery) return;

    // `cancelled` guards against out-of-order responses: typing quickly
    // fires overlapping requests, and a slow earlier one must not overwrite
    // the results of a later, more specific query.
    let cancelled = false;

    const timer = setTimeout(() => {
      searchFiles(accessToken, dataRoomId, trimmedQuery)
        .then((results) => {
          if (!cancelled) setState({ query: trimmedQuery, results, error: null });
        })
        .catch((err) => {
          if (cancelled) return;
          setState({
            query: trimmedQuery,
            results: null,
            error: err instanceof ApiError ? err.message : 'Search failed',
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, dataRoomId, trimmedQuery]);

  return {
    query,
    setQuery,
    clearQuery: () => setQuery(''),
    // Results from a previous query are deliberately kept on screen while
    // the next one is in flight — replacing them with a spinner on every
    // keystroke is what makes debounced search feel like it flickers.
    results: state?.results ?? null,
    searchError: isCurrent ? state.error : null,
    isSearching: isSearchActive && !isCurrent,
    isSearchActive,
  };
};
