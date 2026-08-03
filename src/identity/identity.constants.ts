export const AUTH_ENGINE = Symbol('AUTH_ENGINE');

export const AUTH_EMAIL_JOB = 'auth.email.deliver';

export const AUTH_EMAIL_TYPE = {
  verification: 'verification',
  passwordReset: 'password-reset',
  emailChange: 'email-change',
} as const;

export type AuthEmailType = (typeof AUTH_EMAIL_TYPE)[keyof typeof AUTH_EMAIL_TYPE];
