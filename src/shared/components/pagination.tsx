import { ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownSelector } from "./dropdown-selector";
import "../../styles/pagination.css";

export const PAGE_SIZES = [10, 25, 50];

export interface PaginationProps {
  // 0-based
  page: number;
  pageSize: number;
  // Total items when known; with it the range ("11–20 of 28") and page numbers are shown
  total?: number;
  // Use when the server reports pages instead of (or as well as) a total
  totalPages?: number;
  // Fallback for a server that reports neither: a full page suggests there is another
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  // "students", "colleges" … used in the range text
  noun?: string;
}

// Page numbers to show: all of them when few, otherwise 1 … current-1 current current+1 … last
function pageItems(page: number, totalPages: number): Array<number | "gap-start" | "gap-end"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index);
  const items: Array<number | "gap-start" | "gap-end"> = [0];
  const from = Math.max(1, page - 1);
  const to = Math.min(totalPages - 2, page + 1);
  if (from > 1) items.push("gap-start");
  for (let index = from; index <= to; index++) items.push(index);
  if (to < totalPages - 2) items.push("gap-end");
  items.push(totalPages - 1);
  return items;
}

// The one pager used by every list and table in the admin panel. It is controlled: the owner keeps
// `page` / `pageSize` and either slices a list (see usePagination) or sends them to the server.
// With a small total (one page at the smallest page size) it renders nothing.
export function Pagination({
  page,
  pageSize,
  total,
  totalPages: serverPages,
  hasNext: serverHasNext,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZES,
  noun = "items",
}: PaginationProps) {
  const totalPages = serverPages ?? (total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined);
  const hasNext = totalPages !== undefined ? page + 1 < totalPages : Boolean(serverHasNext);
  const smallest = Math.min(...pageSizeOptions);

  if (page === 0 && !hasNext && (total === undefined || total <= smallest)) return null;

  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = total !== undefined ? Math.min(total, (page + 1) * pageSize) : (page + 1) * pageSize;
  const summary =
    total !== undefined
      ? `${start}–${end} of ${total} ${noun}`
      : `Page ${page + 1}${totalPages !== undefined ? ` of ${totalPages}` : ""}`;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary" aria-live="polite">
        {summary}
      </span>
      <div className="pagination-controls">
        <button type="button" className="pagination-button" aria-label="Previous page" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        {totalPages !== undefined &&
          pageItems(page, totalPages).map((item) =>
            typeof item === "number" ? (
              <button
                type="button"
                key={item}
                className={`pagination-button pagination-number ${item === page ? "is-current" : ""}`}
                aria-label={`Page ${item + 1}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item + 1}
              </button>
            ) : (
              <span key={item} className="pagination-gap" aria-hidden="true">
                …
              </span>
            ),
          )}
        <button type="button" className="pagination-button" aria-label="Next page" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      {onPageSizeChange && (
        <div className="pagination-size">
          <DropdownSelector
            ariaLabel="Rows per page"
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} per page` }))}
          />
        </div>
      )}
    </nav>
  );
}
