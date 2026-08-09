import { toSearchParams } from '@/api/pagination';
import type { UserListFilters } from '../users';

/** Pure query-string builder used by listUsers — keeps filters wired like admin-web. */
export function buildUsersListQuery(filters: UserListFilters): string {
  return toSearchParams(filters);
}

describe('buildUsersListQuery', () => {
  it('encodes segment staff filter as roleCode', () => {
    const qs = buildUsersListQuery({
      page: 1,
      pageSize: 20,
      roleCode: 'PRODUCTION_WORKER',
      q: 'anas',
      isActive: 'true',
    });
    expect(qs).toContain('roleCode=PRODUCTION_WORKER');
    expect(qs).toContain('q=anas');
    expect(qs).toContain('isActive=true');
    expect(qs).toContain('page=1');
  });

  it('omits empty optional filters', () => {
    const qs = buildUsersListQuery({ page: 1, pageSize: 20, q: '' });
    expect(qs).not.toContain('q=');
    expect(qs).toContain('page=1');
  });
});
