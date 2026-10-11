import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits by the visitor's IP. In production requests arrive via
 * Cloudflare → Caddy, so req.ip would be Caddy's container address.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
    return req.headers['cf-connecting-ip'] ?? forwarded ?? req.ip;
  }
}
