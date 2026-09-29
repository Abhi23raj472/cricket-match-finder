import { Linking } from 'react-native';
import type { WatchOptionDto } from '@cmf/shared';

/** Server order plus the user's locally saved subscriptions (guests). */
export function withLocalSubscriptions(options: WatchOptionDto[], subscribed: string[]): WatchOptionDto[] {
  const mine = new Set(subscribed);
  return options
    .map((o) => ({ ...o, isSubscribed: o.isSubscribed || mine.has(o.broadcasterId) }))
    .sort(
      (a, b) =>
        Number(b.isSubscribed) - Number(a.isSubscribed) ||
        Number(b.isFree) - Number(a.isFree) ||
        a.name.localeCompare(b.name) ||
        a.language.localeCompare(b.language),
    );
}

export type OpenResult = 'app' | 'web' | 'none';

/**
 * Opens the broadcaster: its app via deep link if installed, else its
 * website. TV-only options have no link.
 */
export async function openWatchOption(o: WatchOptionDto, linking: Pick<typeof Linking, 'openURL'> = Linking): Promise<OpenResult> {
  if (o.deepLink) {
    try {
      await linking.openURL(o.deepLink);
      return 'app';
    } catch {
      // app not installed; fall back to the web link
    }
  }
  const web = o.webUrl ?? o.affiliateUrl;
  if (web) {
    await linking.openURL(web);
    return 'web';
  }
  return 'none';
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', ml: 'Malayalam',
};
export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;
