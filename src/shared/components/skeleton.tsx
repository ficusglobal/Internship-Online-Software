import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";
import "../../styles/skeleton.css";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  // Pixel radius; "full" makes a circle
  radius?: number | "full";
  className?: string;
  style?: CSSProperties;
}

// One shimmering block. Give it the size of the content it stands in for, so nothing moves when the data arrives.
export function Skeleton({ width = "100%", height = 14, radius = 6, className, style }: SkeletonProps) {
  return (
    <span
      className={cn("skeleton", className)}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius === "full" ? "50%" : radius, ...style }}
    />
  );
}

// Lines of text; the last one is shorter, like a real paragraph
export function SkeletonText({ lines = 2, lineHeight = 14, gap = 8, lastWidth = "60%" }: { lines?: number; lineHeight?: number; gap?: number; lastWidth?: string }) {
  return (
    <span className="skeleton-text" aria-hidden="true" style={{ gap }}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={lineHeight} width={index === lines - 1 && lines > 1 ? lastWidth : "100%"} />
      ))}
    </span>
  );
}

// Screen readers hear one "Loading" instead of a field of empty boxes
export function SkeletonRegion({ label = "Loading", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="skeleton-sr">{label}…</span>
      {children}
    </div>
  );
}

interface TableSkeletonProps {
  // The real column headings, so the header row looks and measures the same as the loaded table
  headers: string[];
  rows?: number;
  // Match the loaded rows (two-line cells are about 76px, single-line about 56px)
  rowHeight?: number;
  // Reserve the search box that the loaded state shows above the table
  toolbar?: boolean;
  // Reserve the pager row below the table
  pager?: boolean;
  label?: string;
}

// A table-shaped placeholder: same card, header and row heights as the loaded table, so the page does not jump
export function TableSkeleton({ headers, rows = 8, rowHeight = 76, toolbar = false, pager = true, label = "Loading" }: TableSkeletonProps) {
  return (
    <SkeletonRegion label={label} className="skeleton-table-region">
      {toolbar && <Skeleton height={40} radius={10} className="skeleton-toolbar" />}
      <div className="admin-table-wrap skeleton-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row} style={{ height: rowHeight }}>
                {headers.map((header, column) => (
                  <td key={header}>
                    {/* Vary the widths a little so the placeholder reads as data, not a grid */}
                    <Skeleton height={14} width={`${[78, 56, 68, 44, 62, 50][(row + column) % 6]}%`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager && <Skeleton height={34} radius={8} className="skeleton-pager" />}
    </SkeletonRegion>
  );
}

// Rows of avatar + two lines (people lists)
export function PersonListSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label} className="skeleton-people">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-person" key={index}>
          <Skeleton width={32} height={32} radius="full" />
          <SkeletonText lines={2} lineHeight={12} gap={6} lastWidth="45%" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
