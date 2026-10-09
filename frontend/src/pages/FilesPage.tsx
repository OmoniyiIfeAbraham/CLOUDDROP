import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, UploadCloud, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FileTable } from "../features/files/components/FileTable";
import { useFilesRepository } from "../features/files/api/files-context";
import { DEFAULT_PAGE_SIZE } from "../features/files/api/files-repository";
import { useFileActions } from "../features/files/hooks/useFileActions";
import { FILE_CATEGORIES } from "../features/files/model/file.types";
import type { Category } from "../features/files/model/file.types";
import { LoadingRows, StatusView } from "../components/ui/StatusView";
import { userMessage } from "../lib/messages";

export const FilesPage = () => {
  const repository = useFilesRepository();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [page, setPage] = useState(1);
  const actions = useFileActions();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useQuery({
    queryKey: ["files", "list", debouncedSearch, category, page],
    queryFn: () => repository.listFiles({
      search: debouncedSearch,
      category: category === "All" ? undefined : category,
      page,
      limit: DEFAULT_PAGE_SIZE,
    }),
    // Keep the current page on screen while the next one loads, but never across a new search or filter.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === debouncedSearch && previousQuery.queryKey[3] === category ? previous : undefined,
  });

  const totalPages = Math.max(1, data?.totalPages ?? 1);
  // Deleting the only file on the last page leaves it empty, so step back to the new last page.
  if (data && !isPlaceholderData && page > totalPages) setPage(totalPages);
  const pageFiles = data?.files ?? [];
  const total = data?.total ?? 0;
  const isSearchSettling = search.trim() !== debouncedSearch;
  const showLoading = isPending || isSearchSettling;
  const noFilters = !debouncedSearch && category === "All";

  return (
    <div className="page-content">
      <div className="page-heading">
        <div><span className="eyebrow">LIBRARY</span><h1>My files</h1><p>Find, manage, and share what you have stored.</p></div>
      </div>
      <section aria-label="File library">
        <div className="library-toolbar">
          <label className="search-field"><Search size={19} /><span className="sr-only">Search files</span><input type="search" placeholder="Search by file name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />{search && <button type="button" className="icon-button" aria-label="Clear search" title="Clear search" onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }}><X size={16} /></button>}</label>
          <label className="filter-field"><SlidersHorizontal size={18} /><span className="sr-only">Category</span><select value={category} onChange={(event) => { setCategory(event.target.value as Category | "All"); setPage(1); }}><option value="All">All categories</option>{FILE_CATEGORIES.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        </div>
        <div className="library-summary"><span>{isSearchSettling ? "Searching..." : isPending ? "Loading files..." : isError ? "File count unavailable" : `${total} ${total === 1 ? "file" : "files"}`}{isFetching && !showLoading && !isError && <span className="refresh-label"> Updating...</span>}</span><span>Sorted by newest</span></div>
        {showLoading ? <LoadingRows /> : isError ? (
          <StatusView kind="error" title="Files unavailable" description={userMessage(error)} onRetry={() => refetch()} />
        ) : total === 0 ? (
          noFilters ? <StatusView kind="empty" title="Your library is empty" description="Your files will appear here after your first upload." action={<Link className="button button--primary" to="/upload"><UploadCloud size={17} /> Upload a file</Link>} /> : <StatusView kind="empty" title="No matching files" description="Try a different search or category." action={<button type="button" className="button button--secondary" onClick={() => { setSearch(""); setDebouncedSearch(""); setCategory("All"); setPage(1); }}>Clear filters</button>} />
        ) : (
          <>
            <FileTable files={pageFiles} onDownload={actions.download} onShare={actions.share} onDelete={actions.requestDelete} busyFileId={actions.busyFileId} />
            {totalPages > 1 && <div className="pagination"><span>Page {page} of {totalPages}</span><div><button className="icon-button" title="Previous page" aria-label="Previous page" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button><button className="icon-button" title="Next page" aria-label="Next page" type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button></div></div>}
          </>
        )}
      </section>
      {actions.dialogs}
    </div>
  );
};
