import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Создание экземпляра axios с baseURL
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Событие для глобального баннера соединения (см. components/ConnectionBanner.tsx).
 * Диспатчим только на смене состояния (down/up), чтобы не спамить при каждом запросе —
 * баннер сам решает, показываться ли ему.
 */
let isDown = false;
const notifyConnectivity = (down: boolean, reason?: string) => {
  if (isDown === down) return;
  isDown = down;
  window.dispatchEvent(new CustomEvent('domrent:connectivity', { detail: { down, reason } }));
};

/**
 * Интерцептор запроса
 * Добавляет JWT токен из localStorage в заголовок Authorization
 */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Интерцептор ответа
 * Обрабатывает ошибки и ошибки авторизации
 */
axiosInstance.interceptors.response.use(
  (response) => {
    notifyConnectivity(false);
    return response;
  },
  (error) => {
    // 401 только если токен был — значит он протух, логаутим и редиректим
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Переписываем сообщение на понятное и конкретное — многие места в коде
    // просто показывают err.message пользователю, дефолтные тексты axios
    // ("Network Error", "Request failed with status code 500") были не очень внятными.
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED';
      error.message = timedOut
        ? 'Сервер не отвечает: превышено время ожидания. Проверьте соединение и попробуйте снова.'
        : 'Не удаётся подключиться к серверу DomRent. Проверьте интернет-соединение.';
      notifyConnectivity(true, error.message);
    } else if (error.response.status >= 500) {
      error.message = `Сервер временно недоступен (ошибка ${error.response.status}). Попробуйте позже.`;
      notifyConnectivity(true, error.message);
    } else {
      notifyConnectivity(false);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
