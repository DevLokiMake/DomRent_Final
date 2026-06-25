import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from "../api/axios";
import L from 'leaflet';
import {
  AlertCircle, CheckCircle, Loader, Plus, MapPin,
  Upload, X, Star, Wifi, Car, PawPrint, BedDouble,
} from 'lucide-react';

interface City {
  id: number;
  name: string;
}

interface CreatePropertyForm {
  title: string;
  description: string;
  city: string;
  address: string;
  type: 'квартира' | 'дом' | 'комната';
  contractType: 'RENT' | 'SALE';
  price: string;
  rooms: string;
  hasWifi: boolean;
  hasParking: boolean;
  petsAllowed: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface ValidationErrors {
  [key: string]: string;
}

const PROPERTY_TYPES = [
  { value: 'квартира', label: 'Квартира' },
  { value: 'дом',      label: 'Дом' },
  { value: 'комната',  label: 'Комната' },
] as const;

const CreatePropertyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const [form, setForm] = useState<CreatePropertyForm>({
    title: '', description: '', city: '', address: '',
    type: 'квартира', contractType: 'RENT',
    price: '', rooms: '',
    hasWifi: false, hasParking: false, petsAllowed: false,
    latitude: null, longitude: null,
  });

  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [showNewCityInput, setShowNewCityInput] = useState(false);
  const [newCityName, setNewCityName] = useState('');

  const [geocoding, setGeocoding] = useState(false);

  // Interactive map picker
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const mapPickerInstanceRef = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapPickerRef.current || mapPickerInstanceRef.current) return;
    const map = L.map(mapPickerRef.current).setView([48.0, 68.0], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapPickerInstanceRef.current = map;

    const pinIcon = L.divIcon({
      html: `<div style="width:18px;height:18px;background:#f43f5e;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.setLatLng(e.latlng);
      } else {
        const marker = L.marker(e.latlng, { icon: pinIcon, draggable: true }).addTo(map);
        marker.on('dragend', (ev: any) => {
          const pos = ev.target.getLatLng();
          setForm(prev => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
        });
        pickerMarkerRef.current = marker;
      }
    });

    return () => {
      map.remove();
      mapPickerInstanceRef.current = null;
      pickerMarkerRef.current = null;
    };
  }, []);

  // Sync marker when coordinates come from geocoding
  useEffect(() => {
    const map = mapPickerInstanceRef.current;
    if (!map || form.latitude === null || form.longitude === null) return;
    const latlng: L.LatLngTuple = [form.latitude, form.longitude];
    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.setLatLng(latlng);
    } else {
      const pinIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;background:#f43f5e;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', (ev: any) => {
        const pos = ev.target.getLatLng();
        setForm(prev => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
      });
      pickerMarkerRef.current = marker;
    }
    map.setView(latlng, 14);
  }, [form.latitude, form.longitude]);

  useEffect(() => {
    axiosInstance.get('/cities')
      .then(r => setCities(r.data.cities || []))
      .catch(() => {})
      .finally(() => setCitiesLoading(false));
  }, []);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!form.title.trim())       errors.title       = 'Название обязательно';
    if (!form.description.trim()) errors.description = 'Описание обязательно';
    if (!form.city.trim())        errors.city        = 'Город обязателен';
    if (!form.price)              errors.price       = 'Цена обязательна';
    else if (parseFloat(form.price) <= 0) errors.price = 'Цена должна быть больше нуля';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Геокодирование по введённому адресу (Nominatim)
  const handleGeocode = async () => {
    const query = [form.address, form.city, 'Казахстан'].filter(Boolean).join(', ');
    if (!query.trim()) return;
    try {
      setGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kz`,
        { headers: { 'Accept-Language': 'ru' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setForm(prev => ({ ...prev, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }));
      } else {
        alert('Адрес не найден. Попробуйте ввести точнее.');
      }
    } catch {
      alert('Ошибка при поиске адреса');
    } finally {
      setGeocoding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (uploadedImages.length + files.length > 20) { alert('Максимум 20 фотографий'); return; }
    try {
      setUploading(true);
      const formData = new FormData();
      files.forEach(f => formData.append('images', f));
      const res = await axiosInstance.post('/upload/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedImages(prev => [...prev, ...(res.data.urls || [])]);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка загрузки фото');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setUploadedImages(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (coverIndex >= next.length) setCoverIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const handleAddNewCity = async () => {
    if (!newCityName.trim()) return;
    setCities(prev => [...prev, { id: Date.now(), name: newCityName }]);
    setForm(prev => ({ ...prev, city: newCityName }));
    setNewCityName('');
    setShowNewCityInput(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const coverImage = uploadedImages[coverIndex] || uploadedImages[0] || null;
      await axiosInstance.post('/properties', {
        title: form.title.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        type: form.type,
        contractType: form.contractType,
        price: parseFloat(form.price),
        images: uploadedImages,
        coverImage,
        latitude: form.latitude,
        longitude: form.longitude,
        rooms: form.rooms ? parseInt(form.rooms) : null,
        hasWifi: form.hasWifi,
        hasParking: form.hasParking,
        petsAllowed: form.petsAllowed,
      });
      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('Только арендодатели могут добавлять объекты. Измените роль в профиле.');
      } else if (err.response?.data?.details) {
        const fieldErrors: ValidationErrors = {};
        err.response.data.details.forEach((d: any) => { fieldErrors[d.path] = d.message; });
        setValidationErrors(fieldErrors);
        setError('Пожалуйста, исправьте ошибки в форме');
      } else {
        setError(err.response?.data?.error || 'Ошибка при создании объекта');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user || !token) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Разместить объявление</h1>
          <p className="text-gray-500 dark:text-gray-400">Заполните информацию о вашем жилье</p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-400">Объект успешно создан!</p>
              <p className="text-green-700 dark:text-green-500 text-sm mt-0.5">Перенаправление на главную...</p>
            </div>
          </div>
        )}

        {error && !success && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 p-8 space-y-6">

          {/* Название */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Название объекта *
            </label>
            <input
              type="text" name="title" value={form.title}
              onChange={handleInputChange}
              placeholder="Например: Уютная квартира в центре города"
              className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white ${
                validationErrors.title ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
              }`}
              disabled={loading}
            />
            {validationErrors.title && <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>}
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Описание *
            </label>
            <textarea
              name="description" value={form.description}
              onChange={handleInputChange}
              placeholder="Опишите особенности: количество комнат, удобства, инфраструктура рядом..."
              rows={4}
              className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition resize-none dark:text-white ${
                validationErrors.description ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
              }`}
              disabled={loading}
            />
            {validationErrors.description && <p className="text-red-500 text-xs mt-1">{validationErrors.description}</p>}
          </div>

          {/* Город и тип */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Город */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Город *
              </label>
              {!showNewCityInput ? (
                <div className="flex gap-2">
                  <select
                    name="city" value={form.city} onChange={handleInputChange}
                    className={`flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white ${
                      validationErrors.city ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    disabled={loading || citiesLoading}
                  >
                    <option value="">Выберите город...</option>
                    {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowNewCityInput(true)}
                    className="px-3 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text" value={newCityName}
                    onChange={e => setNewCityName(e.target.value)}
                    placeholder="Название города"
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:text-white transition"
                    disabled={loading}
                  />
                  <button type="button" onClick={handleAddNewCity} disabled={loading}
                    className="px-3 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:bg-gray-700 transition disabled:opacity-50">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => { setShowNewCityInput(false); setNewCityName(''); }}
                    className="px-3 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl hover:bg-gray-100 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {validationErrors.city && <p className="text-red-500 text-xs mt-1">{validationErrors.city}</p>}
            </div>

            {/* Тип жилья */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Тип жилья *
              </label>
              <select
                name="type" value={form.type} onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white"
                disabled={loading}
              >
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Тип сделки и цена */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Тип сделки *
              </label>
              <select
                name="contractType" value={form.contractType} onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white"
                disabled={loading}
              >
                <option value="RENT">Аренда</option>
                <option value="SALE">Продажа</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Цена {form.contractType === 'RENT' ? 'за ночь' : 'продажи'} (₸) *
              </label>
              <input
                type="number" name="price" value={form.price}
                onChange={handleInputChange}
                placeholder="50 000"
                min="0" step="0.01"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white ${
                  validationErrors.price ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
                }`}
                disabled={loading}
              />
              {validationErrors.price && <p className="text-red-500 text-xs mt-1">{validationErrors.price}</p>}
            </div>
          </div>

          {/* Комнаты */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <BedDouble className="inline w-4 h-4 mr-1 text-gray-400" />
              Количество комнат
            </label>
            <select
              value={form.rooms}
              onChange={e => setForm(p => ({ ...p, rooms: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:text-white transition"
              disabled={loading}
            >
              <option value="">Не указано</option>
              {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}{n === 5 ? '+' : ''} комн.</option>)}
            </select>
          </div>

          {/* Удобства */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Удобства</label>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'hasWifi',     label: 'Wi-Fi',    icon: <Wifi className="w-4 h-4" />      },
                { key: 'hasParking',  label: 'Парковка', icon: <Car className="w-4 h-4" />        },
                { key: 'petsAllowed', label: 'Животные', icon: <PawPrint className="w-4 h-4" />  },
              ] as { key: 'hasWifi' | 'hasParking' | 'petsAllowed'; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                <button
                  key={key} type="button"
                  onClick={() => setForm(p => ({ ...p, [key]: !p[key] }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium transition-all ${
                    form[key]
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Фотографии */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Фотографии (до 20 штук)
            </label>
            <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || uploadedImages.length >= 20}
              className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-2xl p-6 flex flex-col items-center gap-2 transition disabled:opacity-50"
            >
              {uploading
                ? <><Loader className="w-7 h-7 animate-spin text-gray-400" /><span className="text-sm text-gray-400">Загрузка...</span></>
                : <><Upload className="w-7 h-7 text-gray-300" /><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Нажмите для загрузки фото</span><span className="text-xs text-gray-400">JPG, PNG, WebP · до 10 МБ</span></>
              }
            </button>
            {uploadedImages.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">Нажмите звезду, чтобы выбрать обложку:</p>
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((url, i) => (
                    <div key={i} className={`relative rounded-xl overflow-hidden border-2 ${i === coverIndex ? 'border-brand-500' : 'border-transparent'}`}>
                      <img src={url} alt="" className="w-full h-20 object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-start justify-between p-1">
                        <button type="button" onClick={() => setCoverIndex(i)}>
                          <Star className={`w-4 h-4 ${i === coverIndex ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                        </button>
                        <button type="button" onClick={() => removeImage(i)}>
                          <X className="w-4 h-4 text-white hover:text-red-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Адрес и геопозиция */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              <MapPin className="inline w-4 h-4 mr-1 text-brand-500" />
              Адрес объекта (необязательно)
            </label>
            <div className="flex gap-2">
              <input
                type="text" name="address" value={form.address}
                onChange={handleInputChange}
                placeholder="Ул. Абая 10, Алматы"
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 transition dark:text-white"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocoding || !form.address.trim()}
                className="px-4 py-3 bg-gray-900 dark:bg-white hover:bg-gray-700 text-white dark:text-gray-900 rounded-2xl text-sm font-semibold transition disabled:opacity-40 flex items-center gap-2 flex-shrink-0"
              >
                {geocoding ? <Loader className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                <span className="hidden sm:inline">Найти</span>
              </button>
            </div>
            {form.latitude !== null && form.longitude !== null ? (
              <div className="mt-2 flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2 border border-green-200 dark:border-green-800">
                <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                  📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setForm(p => ({ ...p, latitude: null, longitude: null }));
                    if (pickerMarkerRef.current) {
                      pickerMarkerRef.current.remove();
                      pickerMarkerRef.current = null;
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
                  Сбросить
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-gray-400">Введите адрес и нажмите «Найти» или кликните на карту</p>
            )}
          </div>

          {/* Interactive map picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Отметьте на карте
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(кликните чтобы поставить метку, можно перетащить)</span>
            </label>
            <div
              ref={mapPickerRef}
              style={{ height: 280 }}
              className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 cursor-crosshair"
            />
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={loading}
              className="flex-1 py-3.5 border border-gray-200 dark:border-gray-700 rounded-2xl font-semibold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 bg-gray-900 dark:bg-white hover:bg-gray-700 disabled:opacity-50 text-white dark:text-gray-900 rounded-2xl font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" />Создание...</>
                : 'Создать объявление'
              }
            </button>
          </div>
        </form>

        {/* Tips */}
        <div className="mt-6 p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-card">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 text-sm">Советы по заполнению</h3>
          <ul className="text-gray-500 dark:text-gray-400 text-sm space-y-1.5">
            <li>Напишите подробное описание — это привлечёт больше арендаторов</li>
            <li>Добавьте качественные фотографии объекта</li>
            <li>Установите справедливую цену в соответствии с рынком</li>
            <li>После создания объявление будет отправлено на модерацию</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreatePropertyPage;
