import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';

const PUSH_TOKEN_KEY = 'push_notification_token';
const NOTIFICATIONS_ENABLED_KEY = 'push_notifications_enabled';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function getExpoPushToken(): Promise<string> {
  console.log('[PUSH] Getting Expo push token...');
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[PUSH] Current permission status:', existingStatus);
  
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    console.log('[PUSH] Requesting permission...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[PUSH] Permission result:', status);
  }
  
  if (finalStatus !== 'granted') {
    throw new Error('Push notification permission not granted');
  }
  
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId;
  console.log('[PUSH] Project ID:', projectId);
  console.log('[PUSH] App ownership:', Constants.appOwnership);
  
  if (!projectId) {
    throw new Error('No project ID configured for push notifications');
  }
  
  console.log('[PUSH] Getting token with projectId:', projectId);
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId,
  });
  
  console.log('[PUSH] Token obtained:', tokenData.data);
  return tokenData.data;
}

async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return;
  
  console.log('[PUSH] Setting up Android notification channels...');
  
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#CC0000',
  });
  
  await Notifications.setNotificationChannelAsync('weekly-recap', {
    name: 'Weekly Recap',
    description: 'Weekly driving statistics',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#CC0000',
  });
  
  console.log('[PUSH] Android channels configured');
}

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    const loadStoredState = async () => {
      try {
        const [storedToken, storedEnabled] = await Promise.all([
          AsyncStorage.getItem(PUSH_TOKEN_KEY),
          AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY),
        ]);
        
        console.log('[PUSH] Loaded stored token:', storedToken ? 'exists' : 'none');
        console.log('[PUSH] Loaded stored enabled:', storedEnabled);
        
        if (storedToken) {
          setPushToken(storedToken);
        }
        setNotificationsEnabled(storedEnabled === 'true');
      } catch (error) {
        console.error('[PUSH] Error loading stored state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const checkPermission = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
        console.log('[PUSH] Permission status on mount:', status);
      } catch (error) {
        console.error('[PUSH] Error checking permission:', error);
      }
    };

    loadStoredState();
    checkPermission();
    setupAndroidChannels();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[PUSH] Notification received:', notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[PUSH] Notification tapped:', response.notification.request.content.title);
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

  const registerForPushNotifications = useCallback(async (userId?: string): Promise<string | null> => {
    console.log('[PUSH] registerForPushNotifications called');
    
    if (Platform.OS === 'web') {
      console.log('[PUSH] Web platform - not supported');
      throw new Error('Push notifications are not supported on web');
    }

    try {
      const token = await getExpoPushToken();
      
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      
      setPushToken(token);
      setNotificationsEnabled(true);
      
      if (userId) {
        try {
          console.log('[PUSH] Syncing token to backend for user:', userId);
          await trpcClient.user.updatePushToken.mutate({ userId, pushToken: token });
          console.log('[PUSH] Token synced to backend');
        } catch (backendError) {
          console.error('[PUSH] Failed to sync token to backend:', backendError);
        }
      }
      
      console.log('[PUSH] Registration complete');
      return token;
    } catch (error: any) {
      console.error('[PUSH] Registration failed:', error);
      throw error;
    }
  }, []);

  const disableNotifications = useCallback(async (userId?: string) => {
    console.log('[PUSH] disableNotifications called');
    
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'false');
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      
      setNotificationsEnabled(false);
      
      if (userId && pushToken) {
        try {
          console.log('[PUSH] Removing token from backend');
          await trpcClient.user.updatePushToken.mutate({ userId, pushToken: null });
        } catch (error) {
          console.error('[PUSH] Failed to remove token from backend:', error);
        }
      }
      
      setPushToken(null);
      console.log('[PUSH] Notifications disabled');
    } catch (error) {
      console.error('[PUSH] Error disabling notifications:', error);
    }
  }, [pushToken]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string | null> => {
    if (Platform.OS === 'web') {
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
      console.log('[PUSH] Local notification scheduled:', id);
      return id;
    } catch (error) {
      console.error('[PUSH] Failed to schedule notification:', error);
      return null;
    }
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    if (Platform.OS === 'web') return;
    
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[PUSH] All notifications cancelled');
    } catch (error) {
      console.error('[PUSH] Failed to cancel notifications:', error);
    }
  }, []);

  return {
    pushToken,
    notificationsEnabled,
    isLoading,
    permissionStatus,
    registerForPushNotifications,
    disableNotifications,
    scheduleLocalNotification,
    cancelAllNotifications,
  };
});
