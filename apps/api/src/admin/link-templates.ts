import { registerDecorator, type ValidationOptions } from 'class-validator';
import { LINK_PLACEHOLDERS } from '@cmf/shared';

const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'blob:']);

/**
 * Checks a broadcaster link template. Returns an error message, or null if valid.
 * - Only {matchId} and {providerMatchId} placeholders are allowed.
 * - web: must be an https:// URL.
 * - app: any app scheme (e.g. myapp://...) except dangerous ones; http(s) also allowed
 *   because many apps open via universal/app links.
 */
export function checkLinkTemplate(value: string, kind: 'web' | 'app'): string | null {
  const unknown = [...value.matchAll(/\{(\w*)\}/g)].map((m) => m[1]).filter((p) => !(LINK_PLACEHOLDERS as readonly string[]).includes(p));
  if (unknown.length) return `unknown placeholder {${unknown[0]}}; allowed: ${LINK_PLACEHOLDERS.map((p) => `{${p}}`).join(', ')}`;
  if (/[{}]/.test(value.replace(/\{\w+\}/g, ''))) return 'has an unmatched { or }';

  let url: URL;
  try {
    url = new URL(value.replace(/\{\w+\}/g, 'x'));
  } catch {
    return 'is not a valid URL';
  }
  if (kind === 'web' && url.protocol !== 'https:') return 'must start with https://';
  if (kind === 'app' && (BLOCKED_SCHEMES.has(url.protocol) || !/^[a-z][a-z0-9+.-]*:\/\//i.test(value))) {
    return 'must look like scheme://..., e.g. myapp://match/{providerMatchId}';
  }
  return null;
}

export function IsLinkTemplate(kind: 'web' | 'app', options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isLinkTemplate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => value == null || (typeof value === 'string' && checkLinkTemplate(value, kind) === null),
        defaultMessage: (args) =>
          `${args?.property} ${typeof args?.value === 'string' ? checkLinkTemplate(args.value, kind) : 'must be a string'}`,
      },
    });
}
