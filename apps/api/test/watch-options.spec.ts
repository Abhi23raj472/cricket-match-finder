import { buildWatchOptions, fillTemplate, type RightRow } from '../src/matches/watch-options';

const bc = (id: string, name: string, extra: Partial<RightRow['broadcaster']> = {}): RightRow['broadcaster'] => ({
  id, name, type: 'OTT', logoUrl: null, appDeeplinkTemplate: null, webUrlTemplate: null, affiliateUrl: null, isActive: true, ...extra,
});
const right = (b: RightRow['broadcaster'], opts: Partial<Omit<RightRow, 'broadcaster'>> = {}): RightRow => ({
  matchId: null, language: 'en', isFree: false, broadcaster: b, ...opts,
});

const match = { id: 'm-1', providerMatchId: 'prov 1' };
const hotstar = bc('b-hot', 'JioHotstar', { appDeeplinkTemplate: 'app://match/{providerMatchId}', webUrlTemplate: 'https://example.com/{matchId}' });
const dd = bc('b-dd', 'DD Sports', { type: 'FREE' });
const sony = bc('b-sony', 'SonyLIV');
const fancode = bc('b-fc', 'FanCode');

describe('fillTemplate', () => {
  it('fills known placeholders, URL-encodes them, leaves unknown ones', () => {
    expect(fillTemplate('app://m/{providerMatchId}?x={other}', { providerMatchId: 'a b' })).toBe('app://m/a%20b?x={other}');
    expect(fillTemplate(null, {})).toBeNull();
  });
});

describe('buildWatchOptions', () => {
  it('uses tournament-level rights and fills links', () => {
    const [opt] = buildWatchOptions([right(hotstar)], match, []);
    expect(opt).toMatchObject({ broadcasterId: 'b-hot', deepLink: 'app://match/prov%201', webUrl: 'https://example.com/m-1', isSubscribed: false });
  });

  it('lets match-level rights replace tournament-level ones', () => {
    const opts = buildWatchOptions([right(fancode), right(sony, { matchId: 'm-1' })], match, []);
    expect(opts.map((o) => o.name)).toEqual(['SonyLIV']);
  });

  it('ignores overrides that belong to a different match', () => {
    const opts = buildWatchOptions([right(fancode), right(sony, { matchId: 'm-2' })], match, []);
    expect(opts.map((o) => o.name)).toEqual(['FanCode']);
  });

  it('hides inactive broadcasters and duplicate broadcaster+language rows', () => {
    const opts = buildWatchOptions(
      [right(hotstar), right(hotstar), right(hotstar, { language: 'hi' }), right(bc('b-x', 'Gone', { isActive: false }))],
      match,
      [],
    );
    expect(opts.map((o) => `${o.name}/${o.language}`)).toEqual(['JioHotstar/en', 'JioHotstar/hi']);
  });

  it('orders subscribed first, then free, then by name', () => {
    const opts = buildWatchOptions([right(hotstar), right(dd, { isFree: true }), right(sony)], match, ['b-sony']);
    expect(opts.map((o) => o.name)).toEqual(['SonyLIV', 'DD Sports', 'JioHotstar']);
    expect(opts[0].isSubscribed).toBe(true);
  });

  it('returns an empty list when nothing is licensed', () => {
    expect(buildWatchOptions([], match, [])).toEqual([]);
  });
});
