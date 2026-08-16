import type { AuthUser } from '@maher/types';
import { filterAdminOverflowModules } from '../adminOverflowModules';

const baseUser = {
  id: 'u1',
  username: 'admin',
  email: 'a@b.c',
  name: 'Admin',
  roles: ['ADMIN'],
  permissions: [] as string[],
  preferredLanguage: 'en' as const,
};

function withPerms(...permissions: string[]): AuthUser {
  return { ...baseUser, permissions };
}

describe('filterAdminOverflowModules', () => {
  it('hides AI chat from home and shows it on more when permitted', () => {
    const user = withPerms('ai-chat.read', 'catalog.read');
    const home = filterAdminOverflowModules(user, 'home');
    const more = filterAdminOverflowModules(user, 'more');
    expect(home.some((m) => m.key === 'ai-chat')).toBe(false);
    expect(more.some((m) => m.key === 'ai-chat')).toBe(true);
    expect(home.some((m) => m.key === 'products')).toBe(true);
  });

  it('respects permission gates', () => {
    const user = withPerms('catalog.read');
    const more = filterAdminOverflowModules(user, 'more');
    expect(more.map((m) => m.key)).toEqual(['products']);
  });

  it('shows scheduling when staff has schedule.capacity.read', () => {
    const user = withPerms('schedule.capacity.read');
    const more = filterAdminOverflowModules(user, 'more');
    expect(more.some((m) => m.key === 'scheduling')).toBe(true);
  });

  it('hides scheduling from users without schedule.read or schedule.capacity.read', () => {
    const dealer = withPerms('schedule.read.own', 'schedule.availability.own');
    const worker = withPerms('production-task.update-own');
    expect(filterAdminOverflowModules(dealer, 'more').some((m) => m.key === 'scheduling')).toBe(false);
    expect(filterAdminOverflowModules(worker, 'more').some((m) => m.key === 'scheduling')).toBe(false);
  });
});
