import axios from 'axios';
import logger from '../config/logger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Отправить push-уведомление через Expo Push API
 * @param {string} expoPushToken - токен устройства
 * @param {string} title - заголовок уведомления
 * @param {string} body - текст уведомления
 * @param {object} data - доп. данные (навигация и т.д.)
 */
export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken) return;
  if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
    logger.warn('[push] invalid token format:', expoPushToken);
    return;
  }

  try {
    await axios.post(EXPO_PUSH_URL, {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      badge: 1,
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    logger.warn('[push] send failed:', err.message);
  }
};

/**
 * Уведомление арендодателю: новая бронь
 */
export const pushNewBooking = async (token, propertyTitle, guestName) => {
  await sendPushNotification(
    token,
    'Новая заявка на бронирование',
    `${guestName || 'Гость'} хочет забронировать «${propertyTitle}»`,
    { type: 'BOOKING_NEW', screen: 'bookings' }
  );
};

/**
 * Уведомление арендатору: бронь подтверждена
 */
export const pushBookingConfirmed = async (token, propertyTitle) => {
  await sendPushNotification(
    token,
    'Бронирование подтверждено!',
    `Ваше бронирование «${propertyTitle}» подтверждено арендодателем`,
    { type: 'BOOKING_CONFIRMED', screen: 'bookings' }
  );
};

/**
 * Уведомление арендатору: бронь отклонена
 */
export const pushBookingRejected = async (token, propertyTitle) => {
  await sendPushNotification(
    token,
    'Бронирование отклонено',
    `Арендодатель отклонил вашу заявку на «${propertyTitle}»`,
    { type: 'BOOKING_CANCELLED', screen: 'bookings' }
  );
};

/**
 * Уведомление о новом сообщении
 */
export const pushNewMessage = async (token, senderName, propertyTitle) => {
  await sendPushNotification(
    token,
    `Новое сообщение от ${senderName || 'пользователя'}`,
    `По объекту «${propertyTitle}»`,
    { type: 'MESSAGE_NEW', screen: 'chat' }
  );
};

/**
 * Уведомление арендодателю: новый отзыв
 */
export const pushNewReview = async (token, propertyTitle, rating) => {
  await sendPushNotification(
    token,
    'Новый отзыв',
    `На объект «${propertyTitle}» — оценка ${rating}/5`,
    { type: 'REVIEW_NEW', screen: 'bookings' }
  );
};

/**
 * Напоминание арендатору за 1 день до заезда
 */
export const pushCheckinReminder = async (token, propertyTitle, dateStr) => {
  await sendPushNotification(
    token,
    'Напоминание о заезде',
    `Завтра заезд в «${propertyTitle}» — ${dateStr}`,
    { type: 'CHECKIN_REMINDER', screen: 'bookings' }
  );
};
