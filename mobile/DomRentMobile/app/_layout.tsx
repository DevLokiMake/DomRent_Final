import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
