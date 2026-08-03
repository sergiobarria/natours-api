export const AUDIT_RECORDER = Symbol('AUDIT_RECORDER');

export const AUDIT_ACTION = {
  userAdministered: 'user.administered',
  roleChanged: 'user.role_changed',
  accountSecurityChanged: 'account.security_changed',
  tourChanged: 'tour.changed',
  guideTeamReplaced: 'tour.guide_team_replaced',
  departureChanged: 'departure.changed',
  administrativeMediaChanged: 'media.administrative_changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const SYSTEM_ACTOR = {
  worker: 'platform-worker',
  scheduler: 'platform-scheduler',
  webhook: 'platform-webhook',
} as const;
