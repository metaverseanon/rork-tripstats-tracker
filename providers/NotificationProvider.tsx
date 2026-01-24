import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';

const PUSH_TOKEN_KEY = 'push_token';
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    loadNotificationSettings();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      console.log('Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const [storedToken, storedEnabled] = await Promise.all([
        AsyncStorage.getItem(PUSH_TOKEN_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY),
      ]);
      
      if (storedToken) {
        setPushToken(storedToken);
      }
      setNotificationsEnabled(storedEnabled === 'true');
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const registerForPushNotifications = useCallback(async (userId?: string): Promise<string | null> => {
    console.log('registerForPushNotifications called, Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web');
      throw new Error('Push notifications not supported on web');
    }

    console.log('Device.isDevice:', Device.isDevice);
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      throw new Error('Push notifications require a physical device');
    }

    try {
      console.log('Checking existing permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Existing permission status:', existingStatus);
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('Requesting permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('New permission status:', status);
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        throw new Error('Permission denied');
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('Getting push token with projectId:', projectId);
      
      if (!projectId) {
        console.log('No EAS project ID found, using experienceId fallback');
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        console.log('Push token obtained (fallback):', token);
        
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
        setPushToken(token);
        setNotificationsEnabled(true);

        if (userId) {
          try {
            await trpcClient.user.updatePushToken.mutate({ userId, pushToken: token });
            console.log('Push token synced to backend');
          } catch (error) {
            console.error('Failed to sync push token to backend:', error);
          }
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#CC0000',
          });

          await Notifications.setNotificationChannelAsync('weekly-recap', {
            name: 'Weekly Recap',
            description: 'Weekly driving statistics and highlights',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#CC0000',
          });
        }

        return token;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      console.log('Push token obtained:', token);

      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      setPushToken(token);
      setNotificationsEnabled(true);

      if (userId) {
        try {
          await trpcClient.user.updatePushToken.mutate({ userId, pushToken: token });
          console.log('Push token synced to backend');
        } catch (error) {
          console.error('Failed to sync push token to backend:', error);
        }
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#CC0000',
        });

        await Notifications.setNotificationChannelAsync('weekly-recap', {
          name: 'Weekly Recap',
          description: 'Weekly driving statistics and highlights',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#CC0000',
        });
      }

      return token;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      throw error;
    }
  }, []);

  const disableNotifications = useCallback(async (userId?: string) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      setNotificationsEnabled(false);
      setPushToken(null);

      if (userId && pushToken) {
        try {
          await trpcClient.user.updatePushToken.mutate({ userId, pushToken: null });
          console.log('Push token removed from backend');
        } catch (error) {
          console.error('Failed to remove push token from backend:', error);
        }
      }
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
  }, [pushToken]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput
  ) => {
    if (Platform.OS === 'web') {
      console.log('Local notifications not supported on web');
      return null;
    }

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: trigger || null,
      });
      console.log('Local notification scheduled:', id);
      return id;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      return null;
    }
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    if (Platform.OS === 'web') return;
    
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All scheduled notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }, []);

  return {
    pushToken,
    notificationsEnabled,
    isLoading,
    registerForPushNotifications,
    disableNotifications,
    scheduleLocalNotification,
    cancelAllNotifications,
  };
});
