import type {
  PaginatedResponse,
  PaginationLinks,
  PaginationPresentation,
} from './response.types.js';

const paginationPageParameter = 'page';
const paginationPerPageParameter = 'limit';
const paginatedResponseMarker = Symbol('PAGINATED_RESPONSE');

type PresentedPaginatedResponse<T> = PaginatedResponse<T> & {
  readonly [paginatedResponseMarker]: true;
};
function buildPaginationUrl(
  path: string,
  query: PaginationPresentation['query'],
  page: number,
  perPage: number,
): string {
  const parameters = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (
      rawValue === undefined ||
      key === paginationPageParameter ||
      key === paginationPerPageParameter
    ) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      parameters.append(key, String(value));
    }
  }

  parameters.set(paginationPageParameter, String(page));
  parameters.set(paginationPerPageParameter, String(perPage));
  return `${path}?${parameters.toString()}`;
}

function buildPaginationLinks(
  presentation: PaginationPresentation,
  totalPages: number,
): PaginationLinks {
  const { page, path, perPage, query } = presentation;
  const lastPage = Math.max(totalPages, 1);
  const link = (targetPage: number): string => buildPaginationUrl(path, query, targetPage, perPage);

  return {
    self: link(page),
    first: link(1),
    last: link(lastPage),
    previous: page > 1 ? link(page - 1) : null,
    next: page < totalPages ? link(page + 1) : null,
  };
}

export function presentPaginated<T>(
  data: T[],
  presentation: PaginationPresentation,
): PresentedPaginatedResponse<T> {
  const { meta = {}, page, perPage, totalItems } = presentation;
  const totalPages = Math.ceil(totalItems / perPage);
  const response = {
    data,
    meta: {
      ...meta,
      pagination: { page, perPage, totalItems, totalPages },
    },
    links: buildPaginationLinks(presentation, totalPages),
  };
  Object.defineProperty(response, paginatedResponseMarker, { value: true });
  return response as PresentedPaginatedResponse<T>;
}

export function isPaginatedResponse(value: unknown): value is PaginatedResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    paginatedResponseMarker in value &&
    value[paginatedResponseMarker] === true
  );
}
