import { checkLinkTemplate } from '../src/admin/link-templates';

describe('checkLinkTemplate', () => {
  it.each([
    ['https://www.example.com/cricket/{providerMatchId}', 'web'],
    ['https://example.com/m/{matchId}?ref=cmf', 'web'],
    ['myapp://match/{providerMatchId}', 'app'],
    ['https://app.example.com/open/{matchId}', 'app'], // universal links are fine for apps
  ] as const)('accepts %s (%s)', (value, kind) => {
    expect(checkLinkTemplate(value, kind)).toBeNull();
  });

  it.each([
    ['http://example.com/x', 'web', /https/],
    ['https://example.com/{id}', 'web', /unknown placeholder \{id\}/],
    ['https://example.com/{matchId', 'web', /unmatched/],
    ['not a url', 'web', /not a valid URL/],
    ['javascript:alert(1)', 'app', /scheme/],
    ['data://text', 'app', /scheme/],
    ['myapp:/missing-slash', 'app', /scheme/],
  ] as const)('rejects %s (%s)', (value, kind, message) => {
    expect(checkLinkTemplate(value, kind)).toMatch(message);
  });
});
