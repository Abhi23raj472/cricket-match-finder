import { findRightsGaps, matchLabel, type GapMatch, type GapRight } from '../src/admin/rights-gaps';

const start = new Date('2026-10-05T14:00:00Z');
const match = (id: string, tournamentId = 't1'): GapMatch => ({
  id, providerMatchId: `p-${id}`, tournamentId, tournamentName: 'Series', startTimeUtc: start, label: `${id} label`,
});
const right = (over: Partial<GapRight> = {}): GapRight => ({
  tournamentId: 't1', matchId: null, regionCode: 'IN', language: 'en', isFree: false,
  validFrom: new Date('2026-10-01'), validTo: new Date('2026-10-31'),
  broadcaster: { id: 'b1', name: 'B1', type: 'OTT', logoUrl: null, appDeeplinkTemplate: null, webUrlTemplate: null, affiliateUrl: null, isActive: true },
  ...over,
});

describe('findRightsGaps', () => {
  it('reports nothing when a tournament-level right covers the match', () => {
    expect(findRightsGaps([match('m1')], [right()], ['IN'])).toEqual([]);
  });

  it('reports each region that has no right', () => {
    const gaps = findRightsGaps([match('m1')], [right()], ['GB', 'IN']);
    expect(gaps).toEqual([{ match: { id: 'm1', label: 'm1 label', startTimeUtc: start.toISOString(), tournamentName: 'Series' }, regionCode: 'GB' }]);
  });

  it('treats rights outside their validity window as missing', () => {
    expect(findRightsGaps([match('m1')], [right({ validTo: new Date('2026-10-02') })], ['IN'])).toHaveLength(1);
  });

  it('treats an inactive broadcaster as missing', () => {
    const inactive = right();
    inactive.broadcaster = { ...inactive.broadcaster, isActive: false };
    expect(findRightsGaps([match('m1')], [inactive], ['IN'])).toHaveLength(1);
  });

  it('follows the override rule: an inactive match-level right hides the tournament default', () => {
    const override = right({ matchId: 'm1' });
    override.broadcaster = { ...override.broadcaster, id: 'b2', isActive: false };
    expect(findRightsGaps([match('m1')], [right(), override], ['IN'])).toHaveLength(1);
    // ...but only for that match
    expect(findRightsGaps([match('m2')], [right(), override], ['IN'])).toHaveLength(0);
  });

  it('ignores rights for other tournaments', () => {
    expect(findRightsGaps([match('m1', 't2')], [right()], ['IN'])).toHaveLength(1);
  });

  it('labels matches', () => {
    expect(matchLabel({ homeTeam: { shortCode: 'IND' }, awayTeam: { shortCode: 'AUS' }, matchNo: 'Final' })).toBe('IND v AUS · Final');
    expect(matchLabel({ homeTeam: { shortCode: 'IND' }, awayTeam: { shortCode: 'AUS' }, matchNo: null })).toBe('IND v AUS');
  });
});
