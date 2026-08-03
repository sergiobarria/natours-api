import { sanitizeOperationalText } from './sensitive-data.js';

describe('sanitizeOperationalText', () => {
  it('redacts bearer tokens, credential URLs, and sensitive assignments', () => {
    const sanitized = sanitizeOperationalText(
      'Bearer abc.def password=hunter2 url=postgresql://user:secret@host/db token: value',
    );
    expect(sanitized).not.toContain('abc.def');
    expect(sanitized).not.toContain('hunter2');
    expect(sanitized).not.toContain('user:secret@');
    expect(sanitized).not.toContain('token: value');
  });
});
