export interface RosterPageRequest {
  page?: unknown;
  page_size?: unknown;
}

export interface NormalizedRosterPage {
  paged: boolean;
  page: number;
  pageSize: number;
  offset: number;
}

export function normalizeRosterPageRequest(filters: RosterPageRequest): NormalizedRosterPage {
  const requestedPageSize = Number(filters.page_size);
  const paged = Number.isInteger(requestedPageSize) && requestedPageSize > 0;
  const pageSize = paged ? Math.min(requestedPageSize, 50) : 5000;
  const requestedPage = Number(filters.page);
  const page = Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1);
  return { paged, page, pageSize, offset: (page - 1) * pageSize };
}
