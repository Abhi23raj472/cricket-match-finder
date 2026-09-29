import { Linking } from 'react-native';
import { sortWatchOptions, type WatchOptionDto } from '@cmf/shared';

/** Server order plus the user's locally saved subscriptions (guests). */
export const withLocalSubscriptions = (options: WatchOptionDto[], subscribed: string[]) => sortWatchOptions(options, subscribed);

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

export { LANGUAGE_NAMES, languageName } from '@cmf/shared';
