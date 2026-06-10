import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { axiosInstance } from '@/api/axios';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  signup: (email: string, password: string, name: string, role?: 'USER' | 'LANDLORD') => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Восстановление сессии при загрузке приложения
   * Проверяет сохраненный токен в SecureStore и получает данные пользователя
   */
  const restoreSession = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');

      if (storedToken) {
        setToken(storedToken);

        // Проверяем токен и получаем данные пользователя
        try {
          const response = await axiosInstance.get('/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.data?.user) {
            setUser(response.data.user);
          }
        } catch (error) {
          console.warn('Failed to restore session:', error);
          // Если токен невалиден, очищаем его
          await SecureStore.deleteItemAsync('authToken');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error restoring session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Восстановить сессию при инициализации приложения
   */
  useEffect(() => {
    restoreSession();
  }, []);

  /**
   * Регистрация нового пользователя
   */
  const signup = async (
    email: string,
    password: string,
    name: string,
    role: 'USER' | 'LANDLORD' = 'USER'
  ) => {
    try {
      setIsLoading(true);

      const response = await axiosInstance.post('/auth/register', {
        email,
        password,
        name,
        role,
      });

      if (response.data?.token && response.data?.user) {
        // Сохраняем токен в защищённое хранилище
        await SecureStore.setItemAsync('authToken', response.data.token);
        // Сохраняем информацию о пользователе в AsyncStorage для быстрого доступа
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

        setToken(response.data.token);
        setUser(response.data.user);

        // Обновляем заголовок по умолчанию для axios
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Вход пользователя
   */
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await axiosInstance.post('/auth/login', {
        email,
        password,
      });

      if (response.data?.token && response.data?.user) {
        // Сохраняем токен в защищённое хранилище
        await SecureStore.setItemAsync('authToken', response.data.token);
        // Сохраняем информацию о пользователе в AsyncStorage для быстрого доступа
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

        setToken(response.data.token);
        setUser(response.data.user);

        // Обновляем заголовок по умолчанию для axios
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Выход пользователя
   */
  const logout = async () => {
    try {
      setIsLoading(true);

      // Удаляем токен из защищённого хранилища
      await SecureStore.deleteItemAsync('authToken');
      // Удаляем данные пользователя из AsyncStorage
      await AsyncStorage.removeItem('user');

      // Очищаем заголовок авторизации
      delete axiosInstance.defaults.headers.common['Authorization'];

      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    isSignedIn: !!user && !!token,
    signOut: logout,
    signup,
    login,
    logout,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook для использования Auth контекста
 * @throws Error если используется вне AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
