import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeType, ThemeColors, getThemeColors } from '@/constants/colors';

export type SpeedUnit = 'kmh' | 'mph';
export type DistanceUnit = 'km' | 'mi';

interface Settings {
  speedUnit: SpeedUnit;
  distanceUnit: DistanceUnit;
  theme: ThemeType;
}

const SETTINGS_KEY = 'app_settings';

const DEFAULT_SETTINGS: Settings = {
  speedUnit: 'kmh',
  distanceUnit: 'km',
  theme: 'light',
};

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    const newSettings = { ...settings, speedUnit: unit };
    saveSettings(newSettings);
  }, [settings]);

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    const newSettings = { ...settings, distanceUnit: unit };
    saveSettings(newSettings);
  }, [settings]);

  const setTheme = useCallback((theme: ThemeType) => {
    const newSettings = { ...settings, theme };
    saveSettings(newSettings);
  }, [settings]);

  const colors: ThemeColors = getThemeColors(settings.theme);

  const convertSpeed = useCallback((speedKmh: number): number => {
    if (settings.speedUnit === 'mph') {
      return speedKmh * 0.621371;
    }
    return speedKmh;
  }, [settings.speedUnit]);

  const convertDistance = useCallback((distanceKm: number): number => {
    if (settings.distanceUnit === 'mi') {
      return distanceKm * 0.621371;
    }
    return distanceKm;
  }, [settings.distanceUnit]);

  const getSpeedLabel = useCallback((): string => {
    return settings.speedUnit === 'mph' ? 'mph' : 'km/h';
  }, [settings.speedUnit]);

  const getDistanceLabel = useCallback((): string => {
    return settings.distanceUnit === 'mi' ? 'mi' : 'km';
  }, [settings.distanceUnit]);

  return {
    settings,
    isLoading,
    colors,
    setSpeedUnit,
    setDistanceUnit,
    setTheme,
    convertSpeed,
    convertDistance,
    getSpeedLabel,
    getDistanceLabel,
  };
});
