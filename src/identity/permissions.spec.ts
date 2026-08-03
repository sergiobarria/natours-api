import { PERMISSION, ROLE_PERMISSIONS, roleHasPermissions } from './permissions.js';

describe('application permission policy', () => {
  it('keeps non-administrative roles least privileged', () => {
    expect(ROLE_PERMISSIONS.user).toEqual([]);
    expect(ROLE_PERMISSIONS.guide).toEqual([]);
    expect(ROLE_PERMISSIONS['lead-guide']).toEqual([]);
    expect(roleHasPermissions('guide', [PERMISSION.usersView])).toBe(false);
  });

  it('grants the canonical permission set to administrators', () => {
    expect(roleHasPermissions('admin', Object.values(PERMISSION))).toBe(true);
  });
});
