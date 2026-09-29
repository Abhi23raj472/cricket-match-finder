import { SseParser, openSse } from '../sse';

describe('SseParser', () => {
  it('handles events split across chunks, comments and multi-line data', () => {
    const p = new SseParser();
    expect(p.push('event: score\nda')).toEqual([]);
    expect(p.push('ta: {"a":1}\nid: 5\n\n: keep-alive\n\ndata: line1\ndata: line2\n\n')).toEqual([
      { event: 'score', data: '{"a":1}', id: '5' },
      { event: 'message', data: 'line1\nline2', id: undefined },
    ]);
  });

  it('accepts CRLF line endings', () => {
    expect(new SseParser().push('event: ping\r\ndata: {}\r\n\r\n')).toEqual([{ event: 'ping', data: '{}', id: undefined }]);
  });
});

/** Scriptable stand-in for XMLHttpRequest. */
class FakeXhr {
  static all: FakeXhr[] = [];
  readyState = 0;
  status = 0;
  responseText = '';
  headers: Record<string, string> = {};
  onreadystatechange?: () => void;
  onprogress?: () => void;
  onload?: () => void;
  onerror?: () => void;
  aborted = false;
  constructor() {
    FakeXhr.all.push(this);
  }
  open() {}
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send() {}
  abort() {
    this.aborted = true;
  }
  // test helpers
  respond(status: number) {
    this.status = status;
    this.readyState = 2;
    this.onreadystatechange?.();
  }
  write(text: string) {
    this.responseText += text;
    this.onprogress?.();
  }
  end() {
    this.readyState = 4;
    this.onload?.();
  }
  fail() {
    this.onerror?.();
  }
}

describe('openSse', () => {
  beforeEach(() => {
    FakeXhr.all = [];
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  const start = (extra: Partial<Parameters<typeof openSse>[1]> = {}) => {
    const events: string[] = [];
    const statuses: string[] = [];
    const conn = openSse('http://api/live', {
      headers: { 'X-Region': 'IN' },
      onEvent: (e) => events.push(`${e.event}:${e.data}`),
      onStatusChange: (s) => statuses.push(s),
      createXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
      ...extra,
    });
    return { events, statuses, conn };
  };

  it('sends headers and delivers events as they stream in', () => {
    const { events, statuses } = start();
    const x = FakeXhr.all[0];
    expect(x.headers).toMatchObject({ Accept: 'text/event-stream', 'X-Region': 'IN' });
    x.respond(200);
    x.write('event: score\ndata: 1\n\n');
    x.write('event: score\ndata: 2\n\nevent: sc');
    x.write('ore\ndata: 3\n\n');
    expect(events).toEqual(['score:1', 'score:2', 'score:3']);
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('reconnects with growing delays after errors', () => {
    const { statuses } = start();
    FakeXhr.all[0].fail();
    expect(FakeXhr.all).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    expect(FakeXhr.all).toHaveLength(2);
    FakeXhr.all[1].fail();
    jest.advanceTimersByTime(1999);
    expect(FakeXhr.all).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(FakeXhr.all).toHaveLength(3);
    expect(statuses).toContain('reconnecting');
  });

  it('does not retry a 404', () => {
    const { statuses } = start();
    FakeXhr.all[0].respond(404);
    FakeXhr.all[0].end();
    jest.advanceTimersByTime(60_000);
    expect(FakeXhr.all).toHaveLength(1);
    expect(statuses.at(-1)).toBe('closed');
  });

  it('stops after the server ends the stream once the match is over', () => {
    let done = false;
    const { statuses } = start({ isDone: () => done });
    const x = FakeXhr.all[0];
    x.respond(200);
    x.write('event: score\ndata: final\n\n');
    done = true;
    x.end();
    jest.advanceTimersByTime(60_000);
    expect(FakeXhr.all).toHaveLength(1);
    expect(statuses.at(-1)).toBe('closed');
  });

  it('reconnects if the stream ends while the match is still live', () => {
    start({ isDone: () => false });
    FakeXhr.all[0].respond(200);
    FakeXhr.all[0].end();
    jest.advanceTimersByTime(1000);
    expect(FakeXhr.all).toHaveLength(2);
  });

  it('close() aborts and cancels pending reconnects', () => {
    const { conn } = start();
    FakeXhr.all[0].fail();
    conn.close();
    jest.advanceTimersByTime(60_000);
    expect(FakeXhr.all).toHaveLength(1);
    expect(FakeXhr.all[0].aborted).toBe(true);
  });
});
