import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import logger from '../config/logger.js';

// Конфигурация Cloudinary (ключи из .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Хранилище: файлы сразу летят в Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'domrent/properties',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1280, height: 960, crop: 'limit', quality: 'auto' }],
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB на файл
});

/**
 * POST /api/upload/images
 * Загрузка до 20 фотографий за раз
 * Возвращает массив URL
 */
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Файлы не переданы' });
    }

    const urls = req.files.map(f => f.path); // Cloudinary возвращает URL в path

    res.json({
      message: `Загружено ${urls.length} фото`,
      urls
    });
  } catch (error) {
    logger.error('uploadImages error:', error);
    res.status(500).json({ error: 'Ошибка при загрузке изображений' });
  }
};
