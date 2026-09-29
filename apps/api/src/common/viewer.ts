import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_REGION, DEFAULT_TIMEZONE } from '@cmf/shared';
import { isValidTimeZone } from './timezone';

/**
 * Who is asking. Region and time zone come from headers
 * (X-Region: IN, X-Timezone: Asia/Kolkata) with India defaults.
 * userId and subscriptions are filled in by auth in Step 7; until then
 * everyone is a guest with no subscriptions.
 */
export interface Viewer {
  region: string;
  timezone: string;
  userId: string | null;
  subscribedBroadcasterIds: string[];
}

export function viewerFromHeaders(headers: Record<string, string | string[] | undefined>): Viewer {
  const header = (name: string) => {
    const v = headers[name];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };

  const region = (header('x-region') ?? DEFAULT_REGION).toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) {
    throw new BadRequestException('X-Region must be a 2-letter country code, e.g. IN');
  }

  const timezone = header('x-timezone') ?? DEFAULT_TIMEZONE;
  if (!isValidTimeZone(timezone)) {
    throw new BadRequestException('X-Timezone must be an IANA time zone, e.g. Asia/Kolkata');
  }

  return { region, timezone, userId: null, subscribedBroadcasterIds: [] };
}

export const CurrentViewer = createParamDecorator((_data: unknown, ctx: ExecutionContext): Viewer => {
  const req = ctx.switchToHttp().getRequest();
  return req.viewer ?? viewerFromHeaders(req.headers);
});
