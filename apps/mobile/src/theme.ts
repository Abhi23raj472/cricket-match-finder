import { useColorScheme } from 'react-native';

const light = {
  bg: '#f4f5f7',
  card: '#ffffff',
  text: '#15181d',
  muted: '#5e6672',
  border: '#e1e4e9',
  accent: '#1662d9',
  accentText: '#ffffff',
  live: '#d32f2f',
  liveBg: '#fdecec',
  ok: '#1b6b35',
  okBg: '#e5f4ea',
  chip: '#eceef2',
  wicket: '#d32f2f',
  boundary: '#1662d9',
};

const dark: typeof light = {
  bg: '#0f1216',
  card: '#191d23',
  text: '#e8eaed',
  muted: '#9aa3ae',
  border: '#2b3139',
  accent: '#5a9bff',
  accentText: '#0b0e12',
  live: '#ff6b6b',
  liveBg: '#3b1a1a',
  ok: '#7fd69b',
  okBg: '#173724',
  chip: '#252a31',
  wicket: '#ff6b6b',
  boundary: '#5a9bff',
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);
