/**
 * Minimal Server-Sent Events client for React Native (which has no EventSource).
 * Streams over XMLHttpRequest, parses events as they arrive, and reconnects
 * with backoff if the connection drops. Stops when the server ends the stream
 * after a final event, or when close() is called.
 */

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

/** Incremental parser: feed it text chunks, get complete events back. */
export class SseParser {
  private buffer = '';

  push(chunk: string): SseEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const events: SseEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const ev = parseBlock(block);
      if (ev) events.push(ev);
    }
    return events;
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') id = value;
  }
  return data.length ? { event, data: data.join('\n'), id } : null;
}

export interface SseOptions {
  headers?: Record<string, string>;
  onEvent: (e: SseEvent) => void;
  onStatusChange?: (status: 'connecting' | 'open' | 'reconnecting' | 'closed') => void;
  /** Return true to stop reconnecting (e.g. the match is over). */
  isDone?: () => boolean;
  /** For tests. */
  createXhr?: () => XMLHttpRequest;
  maxBackoffMs?: number;
}

export function openSse(url: string, opts: SseOptions): { close: () => void } {
  let xhr: XMLHttpRequest | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const make = opts.createXhr ?? (() => new XMLHttpRequest());

  const connect = () => {
    if (closed) return;
    opts.onStatusChange?.(attempt === 0 ? 'connecting' : 'reconnecting');
    const parser = new SseParser();
    let seen = 0;
    const req = make();
    xhr = req;
    req.open('GET', url);
    req.setRequestHeader('Accept', 'text/event-stream');
    req.setRequestHeader('Cache-Control', 'no-cache');
    for (const [k, v] of Object.entries(opts.headers ?? {})) req.setRequestHeader(k, v);

    const drain = () => {
      const text = req.responseText ?? '';
      if (text.length > seen) {
        const chunk = text.slice(seen);
        seen = text.length;
        for (const ev of parser.push(chunk)) opts.onEvent(ev);
      }
    };

    req.onreadystatechange = () => {
      if (req.readyState === 2 && req.status === 200) {
        attempt = 0;
        opts.onStatusChange?.('open');
      }
    };
    req.onprogress = drain;
    req.onload = () => {
      drain();
      finished(req.status);
    };
    req.onerror = () => finished(0);
    req.send();
  };

  const finished = (status: number) => {
    if (closed) return;
    // 4xx (e.g. unknown match) or a normal end after the result: don't retry.
    if ((status >= 400 && status < 500) || (status === 200 && opts.isDone?.())) {
      closed = true;
      opts.onStatusChange?.('closed');
      return;
    }
    attempt++;
    const delay = Math.min(1000 * 2 ** (attempt - 1), opts.maxBackoffMs ?? 30_000);
    opts.onStatusChange?.('reconnecting');
    timer = setTimeout(connect, delay);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      xhr?.abort();
      opts.onStatusChange?.('closed');
    },
  };
}
