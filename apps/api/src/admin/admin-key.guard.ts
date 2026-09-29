import { CanActivate, Injectable, ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Temporary admin protection until sign-in arrives in Step 7:
 * requests must send `X-Admin-Key: <ADMIN_API_KEY>`.
 * If ADMIN_API_KEY is not set, every admin endpoint is disabled (503).
 * Step 7 replaces this with a JWT check for users.role = ADMIN.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!expected) throw new ServiceUnavailableException('Admin API is disabled: set ADMIN_API_KEY on the server');

    const header = ctx.switchToHttp().getRequest().headers['x-admin-key'];
    const given = Array.isArray(header) ? header[0] : header;
    if (!given || !safeEqual(given, expected)) throw new UnauthorizedException('Missing or wrong X-Admin-Key');
    return true;
  }
}

/** Constant-time comparison (hashing first makes the lengths equal). */
function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
