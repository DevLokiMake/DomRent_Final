import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Для локальной разработки: запусти туннель командой
//   npx localtunnel --port 3000 --subdomain domrent-backend-app
// Туннельный URL обходит Windows Firewall и работает с любой сети
const TUNNEL_URL = 'https://domrent-backend-app.loca.lt/api';
const BACKEND_PORT = 3000;

const getBaseURL = (): string => {
  if (__DEV__) {
    // Пробуем автоматически взять IP из Expo Metro
    const host =
      Constants.expoGoConfig?.debuggerHost?.split(':')[0] ||
      (Constants.manifest2 as any)?.extra?.expoClient?.hostUri?.split(':')[0] ||
      (Constants.manifest as any)?.debuggerHost?.split(':')[0];

    if (host) {
      return `http://${host}:${BACKEND_PORT}/api`;
    }
    // Fallback: туннель (всегда работает)
    return TUNNEL_URL;
  }
  // Production: Railway
  return TUNNEL_URL;
};

export const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync('authToken');
        await AsyncStorage.removeItem('user');
      } catch {}
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
