import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Определяем baseURL в зависимости от платформы и окружения
 *
 * Android эмулятор:   http://10.0.2.2:3000/api
 * iOS эмулятор:       http://<IP адрес компьютера>:5000/api
 * Реальное устройство: http://<IP адрес компьютера>:5000/api
 *
 * ⚠️  ВАЖНО: Для iOS и реальных устройств нужно заменить localhost на реальный IP
 * вашего компьютера (например, 192.168.1.100, 10.0.0.5 и т.д.)
 *
 * Как узнать IP адрес:
 * - Windows: ipconfig (ищите "IPv4 Address" в разделе с вашей сетью)
 * - Mac/Linux: ifconfig или ip addr
 */
const getBaseURL = (): string => {
  if (Platform.OS === 'android') {
    // Для Android эмулятора используем специальный адрес 10.0.2.2
    // это резервированный адрес, который эмулятор использует для доступа к хосту
    return 'http://10.0.2.2:3000/api';
  }

  // Для реального устройства — IP компьютера в локальной сети
  return 'http://10.64.101.164:3000/api';
};

export const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor: Добавляет JWT токен к каждому запросу
 * Автоматически подставляет Authorization: Bearer <token> в заголовки
 */
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading token from SecureStore:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: Обработка ошибок ответа
 * При ошибке 401 (Unauthorized) удаляет токен и очищает хранилище
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized: токен истёк или невалиден');

      // Удаляем токен из защищённого хранилища
      try {
        await SecureStore.deleteItemAsync('authToken');
        await AsyncStorage.removeItem('user');
      } catch (err) {
        console.error('Error clearing auth data:', err);
      }

      // Здесь можно добавить редирект на экран логина, например через React Navigation
      // например: navigation.navigate('Auth', { screen: 'Login' });
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
