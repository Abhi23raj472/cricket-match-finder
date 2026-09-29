import { BadRequestException } from '@nestjs/common';
import { isValidTimeZone, zonedDayRange } from '../src/common/timezone';
import { viewerFromHeaders } from '../src/common/viewer';

describe('zonedDayRange', () => {
  it('handles India (UTC+5:30)', () => {
    const { start, end } = zonedDayRange('2026-10-01', 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T18:30:00.000Z');
  });

  it('handles UTC', () => {
    const { start, end } = zonedDayRange('2026-10-01', 'UTC');
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });

  it('handles a daylight-saving change (London, clocks go back 25 Oct 2026)', () => {
    const { start, end } = zonedDayRange('2026-10-25', 'Europe/London');
    expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z'); // BST midnight
    expect(end.toISOString()).toBe('2026-10-26T00:00:00.000Z'); // GMT midnight
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('handles a zone behind UTC (Sydney is ahead, Los Angeles behind)', () => {
    expect(zonedDayRange('2026-10-01', 'America/Los_Angeles').start.toISOString()).toBe('2026-10-01T07:00:00.000Z');
    expect(zonedDayRange('2026-10-01', 'Australia/Sydney').start.toISOString()).toBe('2026-09-30T14:00:00.000Z');
  });

  it('validates time zone names', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('viewerFromHeaders', () => {
  it('defaults to India', () => {
    expect(viewerFromHeaders({})).toEqual({ region: 'IN', timezone: 'Asia/Kolkata', userId: null, subscribedBroadcasterIds: [] });
  });

  it('reads and normalises headers', () => {
    const v = viewerFromHeaders({ 'x-region': 'gb', 'x-timezone': 'Europe/London' });
    expect(v.region).toBe('GB');
    expect(v.timezone).toBe('Europe/London');
  });

  it('rejects bad values', () => {
    expect(() => viewerFromHeaders({ 'x-region': 'IND' })).toThrow(BadRequestException);
    expect(() => viewerFromHeaders({ 'x-timezone': 'Mars/Olympus' })).toThrow(BadRequestException);
  });
});
