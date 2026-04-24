import { useMemo } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { api } from '~/convex/_generated/api';

export const FEED_PAGE_SIZE = 10;

export type FeedFilters = {
  t4tOnly?: boolean;
  intentions?: (
    | 'hookup'
    | 'dating'
    | 'serious'
    | 'friendship'
    | 'community'
    | 'figuring-it-out'
  )[];
  ageMin?: number;
  ageMax?: number;
  verifiedOnly?: boolean;
};

/**
 * Wrapper around Convex's usePaginatedQuery for the browse feed. `filters`
 * should already be memoized by the caller — passing a fresh object on every
 * render will force a new subscription each time. `refreshKey` is a nonce:
 * bumping it resets the paginated cursor to page 1 (used by pull-to-refresh).
 */
export function useFeedPagination(
  filters: FeedFilters,
  refreshKey: number,
) {
  const args = useMemo(
    () => ({ filters, refreshKey }),
    [filters, refreshKey],
  );
  return usePaginatedQuery(api.profiles.listFeed, args, {
    initialNumItems: FEED_PAGE_SIZE,
  });
}
