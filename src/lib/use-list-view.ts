import { useEffect, useMemo, useRef, useState } from "react";
import type { PaginationProps } from "../shared/components/pagination";

export const DEFAULT_PAGE_SIZE = 10;

export interface ListView<T> {
  // The rows of the current page; null while the list is still loading
  rows: T[] | null;
  query: string;
  setQuery: (query: string) => void;
  // Number of items after searching (before paging)
  matches: number;
  // Number of items before searching
  total: number;
  // Spread into <Pagination />
  pagination: Pick<PaginationProps, "page" | "pageSize" | "total" | "onPageChange" | "onPageSizeChange">;
}

// Search + paging for a list that is already in memory (every admin table except the server-paged student list).
// `searchText` returns the text a row can be found by. The view goes back to page 1 when the search text or
// `resetKey` (e.g. the active filters) changes, and steps back when the last page empties (after a delete).
export function useListView<T>(items: T[] | null, searchText: (item: T) => string, resetKey: unknown = "", initialSize = DEFAULT_PAGE_SIZE): ListView<T> {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const searchRef = useRef(searchText);
  searchRef.current = searchText;

  const needle = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () => (items === null ? null : needle ? items.filter((item) => searchRef.current(item).toLocaleLowerCase().includes(needle)) : items),
    [items, needle],
  );

  useEffect(() => {
    setPage(0);
  }, [needle, resetKey]);

  const matches = filtered?.length ?? 0;
  const lastPage = Math.max(0, Math.ceil(matches / pageSize) - 1);
  const safePage = Math.min(page, lastPage);
  const rows = useMemo(() => (filtered === null ? null : filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)), [filtered, safePage, pageSize]);

  return {
    rows,
    query,
    setQuery,
    matches,
    total: items?.length ?? 0,
    pagination: {
      page: safePage,
      pageSize,
      total: matches,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => {
        setPageSize(size);
        setPage(0);
      },
    },
  };
}
