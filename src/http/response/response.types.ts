export interface ResourceResponse<T> {
  data: T;
}

export interface CollectionResponse<T> {
  data: T[];
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationLinks {
  self: string;
  first: string;
  last: string;
  previous: string | null;
  next: string | null;
}

export interface PaginatedResponse<T> extends CollectionResponse<T> {
  meta: {
    pagination: PaginationMeta;
    [key: string]: unknown;
  };
  links: PaginationLinks;
}

export type PaginationQueryValue = string | number | boolean | readonly (string | number)[];

export interface PaginationPresentation {
  page: number;
  perPage: number;
  totalItems: number;
  path: string;
  query?: Readonly<Record<string, PaginationQueryValue | undefined>>;
  meta?: Readonly<Record<string, unknown>>;
}
