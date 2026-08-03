import type { ApplicationRole } from '../database/schema/identity.js';

export const PERMISSION = {
  usersViewAny: 'users.view-any',
  usersView: 'users.view',
  usersCreate: 'users.create',
  usersUpdateRole: 'users.update-role',
  usersDelete: 'users.delete',
  toursCreate: 'tours.create',
  toursUpdate: 'tours.update',
  toursDelete: 'tours.delete',
  toursManageImages: 'tours.manage-images',
  toursManageStartDates: 'tours.manage-start-dates',
  toursViewAnalytics: 'tours.view-analytics',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

const adminPermissions = Object.values(PERMISSION);

export const ROLE_PERMISSIONS = {
  user: [],
  guide: [],
  'lead-guide': [],
  admin: adminPermissions,
} as const satisfies Record<ApplicationRole, readonly Permission[]>;

export function roleHasPermissions(
  role: ApplicationRole,
  required: readonly Permission[],
): boolean {
  const granted: readonly Permission[] = ROLE_PERMISSIONS[role];
  return required.every(permission => granted.includes(permission));
}
