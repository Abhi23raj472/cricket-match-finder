import Constants from 'expo-constants';

/**
 * API base URL. Set EXPO_PUBLIC_API_URL to override, e.g.
 *   Android emulator:  http://10.0.2.2:3000/v1
 *   Physical phone:    http://<your computer's LAN IP>:3000/v1
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000/v1';
