import { Controller, Get, Inject, MessageEvent, Param, ParseUUIDPipe, Query, Sse } from '@nestjs/common';
import { Observable, concat, interval, map, merge, of, takeWhile } from 'rxjs';
import type { LiveScoreDto, MatchDetailDto, MatchSummaryDto, Paginated } from '@cmf/shared';
import { CurrentViewer, type Viewer } from '../common/viewer';
import { LIVE_BUS, type LiveBus } from '../live/live-bus';
import { ListMatchesQuery } from './dto/list-matches.query';
import { MatchesService } from './matches.service';

export const SSE_HEARTBEAT_MS = 25_000;
const isFinal = (status: string) => status === 'completed' || status === 'abandoned';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    @Inject(LIVE_BUS) private readonly bus: LiveBus,
  ) {}

  @Get()
  list(@Query() query: ListMatchesQuery, @CurrentViewer() viewer: Viewer): Promise<Paginated<MatchSummaryDto>> {
    return this.matches.list(query, viewer);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string, @CurrentViewer() viewer: Viewer): Promise<MatchDetailDto> {
    return this.matches.detail(id, viewer);
  }

  /**
   * Server-Sent Events. Sends the current scorecard straight away ("score"),
   * then every update from the live poller. A "ping" every 25 s keeps
   * proxies from closing the connection. The stream ends once the match
   * is completed or abandoned.
   */
  @Sse(':id/live')
  async live(@Param('id', new ParseUUIDPipe()) id: string): Promise<Observable<MessageEvent>> {
    const { status, score } = await this.matches.snapshotForStream(id);
    const scoreEvent = (s: LiveScoreDto): MessageEvent => ({ type: 'score', data: s, id: s.updatedAt });
    const first = score ? of(scoreEvent(score)) : of<MessageEvent>();

    if (isFinal(status)) return first;

    const updates = this.bus.stream(id).pipe(map(scoreEvent));
    const pings = interval(SSE_HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    // Send the final update (result), then close the stream.
    const endsAfterResult = takeWhile<MessageEvent>((e) => !(e.type === 'score' && isFinal((e.data as LiveScoreDto).status)), true);

    return concat(first, merge(updates, pings).pipe(endsAfterResult));
  }
}
