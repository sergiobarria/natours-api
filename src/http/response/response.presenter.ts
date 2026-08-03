import type {
  CollectionResponse,
  PaginatedResponse,
  PaginationLinks,
  PaginationPresentation,
  ResourceResponse,
} from './response.types.js';

const paginationPageParameter = 'page';
const paginationPerPageParameter = 'per_page';
const presentedResponseMarker = Symbol('PRESENTED_RESPONSE');

interface PresentedResponse {
  readonly [presentedResponseMarker]: true;
}

export type PresentedResourceResponse<T> = ResourceResponse<T> & PresentedResponse;
export type PresentedCollectionResponse<T> = CollectionResponse<T> & PresentedResponse;
export type PresentedPaginatedResponse<T> = PaginatedResponse<T> & PresentedResponse;

function markPresented<T extends object>(response: T): T & PresentedResponse {
  Object.defineProperty(response, presentedResponseMarker, { value: true });
  return response as T & PresentedResponse;
}

export function presentResource<T>(data: T): PresentedResourceResponse<T> {
  return markPresented({ data });
}

export function presentCollection<T>(data: T[]): PresentedCollectionResponse<T> {
  return markPresented({ data });
}

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
  return markPresented({
    data,
    meta: {
      ...meta,
      pagination: { page, perPage, totalItems, totalPages },
    },
    links: buildPaginationLinks(presentation, totalPages),
  });
}

export function isPresentedResponse(value: unknown): value is PresentedResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    presentedResponseMarker in value &&
    value[presentedResponseMarker] === true
  );
}
