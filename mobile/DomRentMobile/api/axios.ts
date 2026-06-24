import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL обновляется автоматически скриптом `node start-tunnel.js` из корня проекта.
// Приоритет: EXPO_PUBLIC_API_URL (из .env) → hardcoded tunnel URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://machinery-oils-belle-floating.trycloudflare.com/api';

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
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
