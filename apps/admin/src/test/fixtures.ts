import type { AdminBroadcasterDto, AdminRightDto, MatchSummaryDto, TournamentListItemDto } from '@cmf/shared';

export const hotstar: AdminBroadcasterDto = {
  id: 'b1', name: 'JioHotstar', type: 'OTT', logoUrl: null, appDeeplinkTemplate: null,
  webUrlTemplate: 'https://www.hotstar.com', affiliateUrl: null, isActive: true, rightsCount: 2,
};
export const fancode: AdminBroadcasterDto = { ...hotstar, id: 'b2', name: 'FanCode', webUrlTemplate: null, rightsCount: 0, isActive: false };

export const tournament: TournamentListItemDto = {
  id: 't1', name: 'T20 Quad Series', format: 'T20', season: '2026', startDate: '2026-10-01', endDate: '2026-10-10', matchCount: 2, liveCount: 0,
};

export const match: MatchSummaryDto = {
  id: 'm1', tournament: { id: 't1', name: 'T20 Quad Series', format: 'T20' },
  homeTeam: { id: 'a', name: 'India', shortCode: 'IND' }, awayTeam: { id: 'b', name: 'Australia', shortCode: 'AUS' },
  venue: { name: 'Stadium', city: 'Mohali' }, matchNo: 'Final', startTimeUtc: '2026-10-05T14:00:00Z', status: 'upcoming', resultText: null, scores: [],
};

export const right: AdminRightDto = {
  id: 'r1', broadcaster: { id: 'b1', name: 'JioHotstar' }, tournament: { id: 't1', name: 'T20 Quad Series' }, match: null,
  regionCode: 'IN', language: 'hi', isFree: false, validFrom: '2026-10-01T00:00:00Z', validTo: '2026-10-10T23:59:59Z',
};
