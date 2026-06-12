import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND_PORT = 3000;
const PRODUCTION_URL = 'https://domrent-production.up.railway.app/api';

const getBaseURL = (): string => {
  if (__DEV__) {
    // Автоматически берём IP из Expo Metro — тот же хост, через который телефон
    // загрузил бандл, гарантированно доступен с устройства
    const host =
      Constants.expoGoConfig?.debuggerHost?.split(':')[0] ||
      (Constants.manifest2 as any)?.extra?.expoClient?.hostUri?.split(':')[0] ||
      (Constants.manifest as any)?.debuggerHost?.split(':')[0];

    if (host) {
      return `http://${host}:${BACKEND_PORT}/api`;
    }
  }
  return PRODUCTION_URL;
};

export const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
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
