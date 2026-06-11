import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { axiosInstance } from '@/api/axios';

export const unstable_settings = {
  anchor: '(tabs)',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens не поддерживаются в Expo Go начиная с SDK 53
  if (Constants.appOwnership === 'expo') return null;
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

function PushRegistrar() {
  const { token } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!token || registered.current) return;
    registered.current = true;

    registerForPushNotificationsAsync().then(pushToken => {
      if (pushToken) {
        axiosInstance.post('/notifications/push-token', { token: pushToken }).catch(() => {});
      }
    }).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => sub.remove();
  }, [token]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PushRegistrar />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="login"
            options={{ headerShown: false, animationEnabled: true, presentation: 'card' }}
          />
          <Stack.Screen
            name="register"
            options={{ headerShown: false, animationEnabled: true, presentation: 'card' }}
          />
          <Stack.Screen
            name="create-property"
            options={{ headerShown: false, animationEnabled: true, presentation: 'card' }}
          />
          <Stack.Screen
            name="edit-property/[id]"
            options={{ headerShown: false, animationEnabled: true, presentation: 'card' }}
          />
          <Stack.Screen name="property/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
