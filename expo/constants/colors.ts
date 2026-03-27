export type ThemeType = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  card: string;
  cardLight: string;
  text: string;
  textLight: string;
  textMuted: string;
  border: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
}

const darkColors: ThemeColors = {
  background: '#000000',
  card: '#1A1A1A',
  cardLight: '#1A1A1A',
  text: '#FFFFFF',
  textLight: '#999999',
  textMuted: '#666666',
  border: '#2A2A2A',
  accent: '#00C853',
  success: '#00C853',
  danger: '#CC0000',
  warning: '#FF9500',
  tint: '#00C853',
  tabIconDefault: '#666666',
  tabIconSelected: '#00C853',
};

const lightColors: ThemeColors = {
  background: '#F2F4F6',
  card: '#FFFFFF',
  cardLight: '#F0F2F5',
  text: '#1A1A1A',
  textLight: '#8E8E93',
  textMuted: '#AEAEB2',
  border: '#E5E5EA',
  accent: '#00C853',
  success: '#00C853',
  danger: '#CC0000',
  warning: '#FF9500',
  tint: '#00C853',
  tabIconDefault: '#AEAEB2',
  tabIconSelected: '#00C853',
};

export const getThemeColors = (theme: ThemeType): ThemeColors => {
  return theme === 'dark' ? darkColors : lightColors;
};

export default {
  light: {
    text: lightColors.text,
    background: lightColors.background,
    tint: lightColors.tint,
    tabIconDefault: lightColors.tabIconDefault,
    tabIconSelected: lightColors.tabIconSelected,
  },
};
