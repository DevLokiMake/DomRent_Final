import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Loader, AlertCircle, X, Heart, Wifi, Car, PawPrint, BedDouble, SlidersHorizontal, Search, TrendingUp, Clock, Map, LayoutGrid } from "lucide-react";
import L from "leaflet";
import axiosInstance from "../api/axios";
import type { Property } from "../types";

interface FilterState {
  city: string;
  contractType: string;
  type: string;
  minPrice: string;
  maxPrice: string;
  rooms: string;
  hasWifi: boolean;
  hasParking: boolean;
  petsAllowed: boolean;
}

interface City { id: number; name: string; }

const EMPTY_FILTERS: FilterState = {
  city: "", contractType: "", type: "", minPrice: "", maxPrice: "",
  rooms: "", hasWifi: false, hasParking: false, petsAllowed: false,
};

interface RecentItem {
  id: number; title: string; price: number; type: string;
  contractType: string; image: string | null; city: string;
}

// ── Map View ──────────────────────────────────────────────────────────────────
const MapView = ({ properties }: { properties: Property[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([48.0, 68.0], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers when properties change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const withCoords = properties.filter(p => p.latitude && p.longitude);
    const bounds: L.LatLngTuple[] = [];

    withCoords.forEach(p => {
      const price = `${p.price.toLocaleString('ru')} ₸${p.contractType === 'RENT' ? '/н' : ''}`;
      const icon = L.divIcon({
        html: `<div style="background:#111827;color:#fff;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid #fff;cursor:pointer">${price}</div>`,
        className: '',
        iconSize: [110, 28],
        iconAnchor: [55, 28],
      });
      const img = p.coverImage || p.images?.[0];
      const city = typeof p.city === 'object' && p.city ? p.city.name : (p.city as string) || '';
      const popup = `
        <div style="min-width:200px;font-family:Inter,system-ui,sans-serif">
          ${img ? `<img src="${img}" style="width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px">` : ''}
          <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:2px">${p.title}</div>
          <div style="color:#6b7280;font-size:12px;margin-bottom:6px">${city}</div>
          <div style="font-weight:800;font-size:15px;color:#f43f5e;margin-bottom:10px">${p.price.toLocaleString('ru')} ₸${p.contractType === 'RENT' ? '/ночь' : ''}</div>
          <a href="/property/${p.id}" style="display:block;padding:8px;background:#111827;color:#fff;text-align:center;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none">Посмотреть →</a>
        </div>`;
      const marker = L.marker([p.latitude!, p.longitude!], { icon }).addTo(map);
      marker.bindPopup(popup, { maxWidth: 240 });
      markersRef.current.push(marker);
      bounds.push([p.latitude!, p.longitude!]);
    });

    if (bounds.length > 0) {
      try { map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 }); }
      catch { map.setView([48.0, 68.0], 5); }
    }
  }, [properties]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-card">
      {properties.filter(p => p.latitude && p.longitude).length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/90 dark:bg-gray-900/90 pointer-events-none">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Нет объектов с координатами</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Укажите адрес при создании объявления</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ height: 580 }} />
    </div>
  );
};

const HomePage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [popularProperties, setPopularProperties] = useState<Property[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentItem[]>([]);
  const [view, setView] = useState<'grid' | 'map'>('grid');

  const fetchProperties = useCallback(async (f?: FilterState) => {
    try {
      setLoading(true);
      setError(null);
      const active = f ?? filters;
      const q = new URLSearchParams();
      if (active.city)         q.set("city", active.city);
      if (active.contractType) q.set("contractType", active.contractType);
      if (active.type)         q.set("type", active.type);
      if (active.minPrice)     q.set("minPrice", active.minPrice);
      if (active.maxPrice)     q.set("maxPrice", active.maxPrice);
      if (active.rooms)        q.set("rooms", active.rooms);
      if (active.hasWifi)      q.set("hasWifi", "true");
      if (active.hasParking)   q.set("hasParking", "true");
      if (active.petsAllowed)  q.set("petsAllowed", "true");
      const res = await axiosInstance.get(`/properties${q.toString() ? `?${q}` : ""}`);
      setProperties(Array.isArray(res.data) ? res.data : res.data.properties || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить объекты");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchCities = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/cities");
      setCities(res.data.cities || []);
    } catch { /* silent */ } finally { setCitiesLoading(false); }
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await axiosInstance.get("/favorites");
      setFavorites(new Set<number>((res.data.favorites || []).map((f: any) => f.propertyId)));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchProperties(), fetchCities(), fetchFavorites()]);
    // Популярные объекты
    axiosInstance.get("/properties/popular?limit=6")
      .then(res => setPopularProperties(res.data.properties || []))
      .catch(() => {});
    // Недавно просмотренные из localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("domrent_viewed") || "[]");
      setRecentlyViewed(stored.slice(0, 6));
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  const handleToggleFavorite = async (propertyId: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await axiosInstance.post(`/favorites/toggle/${propertyId}`);
      setFavorites(prev => { const s = new Set(prev); s.has(propertyId) ? s.delete(propertyId) : s.add(propertyId); return s; });
    } catch { /* silent */ }
  };

  const handleApply = () => { fetchProperties(filters); setShowFilters(false); };
  const handleReset = () => { setFilters(EMPTY_FILTERS); fetchProperties(EMPTY_FILTERS); };

  const getPriceText = (p: Property) => p.contractType === "RENT" ? `${p.price.toLocaleString()} ₸/ночь` : `${p.price.toLocaleString()} ₸`;
  const getCityName = (p: Property) => typeof p.city === "object" && p.city?.name ? p.city.name : (p.city as string) || "";
  const hasActive = Object.entries(filters).some(([, v]) => v !== "" && v !== false);
  const activeCount = Object.entries(filters).filter(([, v]) => v !== "" && v !== false).length;

  if (error && properties.length === 0) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-card max-w-md border border-gray-100 dark:border-gray-800">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">Не удалось загрузить объявления</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">{error}</p>
        <button onClick={() => fetchProperties()} className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors text-sm font-semibold">
          Попробовать снова
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden text-white py-20 px-4" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
      }}>
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #f43f5e, transparent)', animation: 'pulse 4s ease-in-out infinite' }} />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #6366f1, transparent)', animation: 'pulse 6s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] opacity-10"
            style={{ background: 'radial-gradient(ellipse, #f43f5e, transparent)', animation: 'pulse 8s ease-in-out infinite' }} />
          {/* Grid pattern */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-300 mb-6 border border-white/10">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Более 1000 объявлений по всему Казахстану
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
            Найдите жильё своей мечты
          </h1>
          <p className="text-gray-400 text-lg mb-10">
            Аренда и продажа недвижимости — быстро, удобно, надёжно
          </p>

          {/* Quick search bar */}
          <div className="bg-white rounded-2xl p-2 flex gap-2 max-w-2xl mx-auto shadow-modal">
            <select
              value={filters.city}
              onChange={e => setFilters(p => ({ ...p, city: e.target.value }))}
              disabled={citiesLoading}
              className="flex-1 px-4 py-3 text-gray-800 text-sm font-medium outline-none bg-transparent cursor-pointer"
            >
              <option value="">Все города</option>
              {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="w-px bg-gray-100 my-1" />
            <select
              value={filters.contractType}
              onChange={e => setFilters(p => ({ ...p, contractType: e.target.value }))}
              className="px-4 py-3 text-gray-800 text-sm font-medium outline-none bg-transparent cursor-pointer"
            >
              <option value="">Все типы</option>
              <option value="RENT">Аренда</option>
              <option value="SALE">Продажа</option>
            </select>
            <button
              onClick={handleApply}
              className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Найти</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter toolbar */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
            {/* Type chips */}
            {["квартира", "дом", "комната"].map(t => (
              <button
                key={t}
                onClick={() => {
                  const next = filters.type === t ? "" : t;
                  const updated = { ...filters, type: next };
                  setFilters(updated);
                  fetchProperties(updated);
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  filters.type === t
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View toggle */}
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setView('grid')}
                title="Сетка"
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('map')}
                title="Карта"
                className={`p-2 transition-colors ${view === 'map' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <Map className="w-4 h-4" />
              </button>
            </div>

            {/* Filters button */}
            <button
              onClick={() => setShowFilters(o => !o)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-semibold transition-all ${
                hasActive
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
              {activeCount > 0 && (
                <span className="w-5 h-5 bg-brand-500 text-white text-xs rounded-full flex items-center justify-center">{activeCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 p-6 mb-6 animate-slide-up">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Тип жилья</label>
                <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400">
                  <option value="">Все</option>
                  <option value="квартира">Квартира</option>
                  <option value="дом">Дом</option>
                  <option value="комната">Комната</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  <BedDouble className="inline w-3 h-3 mr-1" />Комнат
                </label>
                <select value={filters.rooms} onChange={e => setFilters(p => ({ ...p, rooms: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400">
                  <option value="">Любое</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}{n===5?"+":""} комн.</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Цена от (₸)</label>
                <input type="number" placeholder="0" value={filters.minPrice}
                  onChange={e => setFilters(p => ({ ...p, minPrice: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Цена до (₸)</label>
                <input type="number" placeholder="∞" value={filters.maxPrice}
                  onChange={e => setFilters(p => ({ ...p, maxPrice: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-600" />
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Удобства</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { key: "hasWifi", icon: <Wifi className="w-3 h-3" />, label: "Wi-Fi" },
                    { key: "hasParking", icon: <Car className="w-3 h-3" />, label: "Парковка" },
                    { key: "petsAllowed", icon: <PawPrint className="w-3 h-3" />, label: "Животные" },
                  ] as { key: keyof FilterState; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
                    <button key={key} type="button"
                      onClick={() => setFilters(p => ({ ...p, [key]: !p[key] }))}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        filters[key]
                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                      }`}
                    >
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={handleApply} disabled={loading}
                className="flex-1 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Применить
              </button>
              <button onClick={handleReset}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 font-semibold rounded-xl text-sm transition-colors flex items-center gap-2">
                <X className="w-4 h-4" />Сбросить
              </button>
            </div>
          </div>
        )}

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            {properties.length > 0
              ? <><span className="font-semibold text-gray-900 dark:text-white">{properties.length}</span> объявлений найдено</>
              : "Объявлений не найдено"}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <Loader className="w-10 h-10 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 text-sm">Загрузка...</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && properties.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Ничего не найдено</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Попробуйте изменить параметры поиска</p>
            <button onClick={handleReset} className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
              Сбросить фильтры
            </button>
          </div>
        )}

        {/* ── Популярные объекты (если нет активных фильтров) ────────────── */}
        {!loading && !hasActive && properties.length > 0 && popularProperties.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Популярные объекты</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                по бронированиям
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {popularProperties.slice(0, 3).map(property => {
                const img = property.coverImage || property.images?.[0];
                const city = getCityName(property);
                return (
                  <Link key={property.id} to={`/property/${property.id}`}
                    className="group relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100 dark:border-gray-800 block"
                  >
                    <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {img
                        ? <img src={img} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-gray-200 dark:text-gray-700" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white font-bold text-sm line-clamp-1">{property.title}</p>
                        <p className="text-white/80 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{city}</p>
                      </div>
                      <button
                        onClick={e => handleToggleFavorite(property.id, e)}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        <Heart className={`transition-colors ${favorites.has(property.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`} style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{getPriceText(property)}</p>
                      {(property._count?.bookings ?? 0) > 0 && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                          {property._count!.bookings} брон.
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Недавно просмотренные ─────────────────────────────────────────── */}
        {recentlyViewed.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Недавно просмотренные</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentlyViewed.map(item => (
                <Link key={item.id} to={`/property/${item.id}`}
                  className="group flex-shrink-0 w-56 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 hover:shadow-card-hover transition-all duration-300"
                >
                  <div className="relative h-32 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {item.image
                      ? <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-6 h-6 text-gray-300 dark:text-gray-600" /></div>
                    }
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 dark:bg-gray-900/90 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 capitalize">
                      {item.type}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 dark:text-white text-xs line-clamp-1 mb-0.5 group-hover:text-brand-500 transition-colors">{item.title}</p>
                    <p className="text-gray-400 text-xs flex items-center gap-1 mb-1"><MapPin className="w-2.5 h-2.5" />{item.city}</p>
                    <p className="font-bold text-gray-900 dark:text-white text-xs">
                      {item.contractType === "RENT" ? `${item.price.toLocaleString()} ₸/ночь` : `${item.price.toLocaleString()} ₸`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Map view */}
        {!loading && view === 'map' && (
          <div className="relative">
            <MapView properties={properties} />
            {properties.filter(p => p.latitude && p.longitude).length === 0 && properties.length > 0 && (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-3">
                У объявлений нет координат — укажите их при создании объявления
              </p>
            )}
          </div>
        )}

        {/* Property grid */}
        {!loading && properties.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map(property => (
              <Link
                key={property.id}
                to={`/property/${property.id}`}
                className="group block bg-white dark:bg-gray-900 rounded-3xl shadow-card hover:shadow-card-hover border border-transparent dark:border-gray-800 transition-all duration-300 overflow-hidden"
              >
                {/* Image */}
                <div className="relative overflow-hidden aspect-[4/3] bg-gray-100 dark:bg-gray-800">
                  {(property.coverImage || property.images?.[0]) ? (
                    <img
                      src={property.coverImage || property.images[0]}
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                    </div>
                  )}

                  {/* Favorite */}
                  <button
                    onClick={e => handleToggleFavorite(property.id, e)}
                    className="absolute top-3 right-3 w-9 h-9 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                  >
                    <Heart
                      className={`transition-colors ${favorites.has(property.id) ? "fill-red-500 text-red-500" : "text-gray-400"}`}
                      style={{ width: 18, height: 18 }}
                    />
                  </button>

                  {/* Type badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 capitalize">
                    {property.type}
                  </div>

                  {/* Contract type */}
                  {property.contractType === "SALE" && (
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-gray-900/80 backdrop-blur-sm rounded-full text-xs font-bold text-white">
                      Продажа
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1">{property.title}</h3>

                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs mb-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="line-clamp-1">{getCityName(property)}</span>
                    {property.rooms && (
                      <span className="ml-2 flex items-center gap-0.5">
                        <BedDouble className="w-3 h-3" />{property.rooms} к.
                      </span>
                    )}
                  </div>

                  {/* Amenities */}
                  {(property.hasWifi || property.hasParking || property.petsAllowed) && (
                    <div className="flex gap-2 mb-2">
                      {property.hasWifi && <Wifi className="w-3.5 h-3.5 text-blue-400" />}
                      {property.hasParking && <Car className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
                      {property.petsAllowed && <PawPrint className="w-3.5 h-3.5 text-green-400" />}
                    </div>
                  )}

                  <p className="font-bold text-gray-900 dark:text-white text-base">{getPriceText(property)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Tag = ({ label }: { label: string }) => (
  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{label}</span>
);
void Tag; // prevent unused warning

export default HomePage;
