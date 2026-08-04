export const AUDIT_ACTION = {
  userAdministered: 'user.administered',
  roleChanged: 'user.role_changed',
  accountSecurityChanged: 'account.security_changed',
  profileChanged: 'user.profile_changed',
  tourChanged: 'tour.changed',
  tourGuideTeamReplaced: 'tour.guide_team_replaced',
  tourDepartureChanged: 'tour.departure_changed',
  tourMediaChanged: 'tour.media_changed',
  bookingChanged: 'booking.changed',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const SYSTEM_ACTOR = {
  worker: 'platform-worker',
} as const;
