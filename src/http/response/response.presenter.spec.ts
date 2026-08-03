import { presentPaginated } from './response.presenter.js';

describe('response presenters', () => {
  it('builds deterministic pagination metadata and links while preserving query parameters', () => {
    const response = presentPaginated([{ id: 'tour-id' }], {
      page: 2,
      perPage: 20,
      totalItems: 74,
      path: '/api/v1/tours',
      query: {
        sort: 'price,-rating_avg',
        'filter[difficulty]': 'moderate',
      },
      meta: { source: 'catalog' },
    });

    expect(response).toEqual({
      data: [{ id: 'tour-id' }],
      meta: {
        source: 'catalog',
        pagination: { page: 2, perPage: 20, totalItems: 74, totalPages: 4 },
      },
      links: {
        self: '/api/v1/tours?filter%5Bdifficulty%5D=moderate&sort=price%2C-rating_avg&page=2&per_page=20',
        first:
          '/api/v1/tours?filter%5Bdifficulty%5D=moderate&sort=price%2C-rating_avg&page=1&per_page=20',
        last: '/api/v1/tours?filter%5Bdifficulty%5D=moderate&sort=price%2C-rating_avg&page=4&per_page=20',
        previous:
          '/api/v1/tours?filter%5Bdifficulty%5D=moderate&sort=price%2C-rating_avg&page=1&per_page=20',
        next: '/api/v1/tours?filter%5Bdifficulty%5D=moderate&sort=price%2C-rating_avg&page=3&per_page=20',
      },
    });
  });

  it('uses null boundary links for an empty first page', () => {
    const response = presentPaginated([], {
      page: 1,
      perPage: 20,
      totalItems: 0,
      path: '/api/v1/tours',
    });

    expect(response.meta.pagination.totalPages).toBe(0);
    expect(response.links.last).toBe('/api/v1/tours?page=1&per_page=20');
    expect(response.links.previous).toBeNull();
    expect(response.links.next).toBeNull();
  });
});
