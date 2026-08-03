export const RATE_LIMIT_POLICY = {
  global: 'global',
  authentication: 'authentication',
  account: 'account',
  webhook: 'webhook',
} as const;

export const RATE_LIMIT_POLICY_METADATA = 'natours:rate-limit-policy';
export const RATE_LIMIT_BYPASS_METADATA = 'natours:rate-limit-bypass';
