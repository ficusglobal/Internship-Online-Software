import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  itemCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, itemCount, pageSize, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
  const firstItem = itemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, itemCount);

  return <footer className="table-pagination"><span>Showing {firstItem}-{lastItem} of {itemCount}</span><div><button className="plain-button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={17}/></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(page => <button className={`page-button ${page === currentPage ? "active" : ""}`} key={page} onClick={() => onPageChange(page)}>{page}</button>)}<button className="plain-button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={17}/></button></div></footer>;
}
