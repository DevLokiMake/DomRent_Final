import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MapPin, Loader, AlertCircle, ArrowLeft, Heart, Star, Wifi, Car,
  PawPrint, BedDouble, ChevronLeft, ChevronRight, Clock, XCircle, User, TrendingUp,
} from "lucide-react";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";
import type { PropertyWithOwner, Booking } from "../types";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerIcon2xPng from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIconPng, iconRetinaUrl: markerIcon2xPng, shadowUrl: markerShadowPng,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface Review {
  id: number; rating: number; text: string; createdAt: string; anonymous: boolean;
  author: { name: string | null; email: string };
}

// ─── Star Rating Input ────────────────────────────────────────────────────────
const StarInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s} type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              s <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
};

const PropertyPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<PropertyWithOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [checkingFavorite, setCheckingFavorite] = useState(false);
  const [bookingData, setBookingData] = useState({ startDate: "", endDate: "" });
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [calendarStep, setCalendarStep] = useState<"start" | "end">("start");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [canReview, setCanReview] = useState(true);

  const [similarProperties, setSimilarProperties] = useState<any[]>([]);

  const fetchReviews = () => {
    if (!id) return;
    axiosInstance.get(`/reviews/property/${id}`).then(res => {
      setReviews(res.data.reviews || []);
      setAvgRating(res.data.avgRating ?? null);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axiosInstance.get(`/properties/${id}`)
      .then(res => setProperty(res.data.property ?? res.data))
      .catch(err => setError(err instanceof Error ? err.message : "Не удалось загрузить объект"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    axiosInstance.get(`/favorites/check/${id}`)
      .then(res => setIsFavorited(res.data?.isFavorited || false))
      .catch(() => {});
  }, [user, id]);

  useEffect(() => { fetchReviews(); }, [id]);

  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/properties/${id}/similar`)
      .then(res => setSimilarProperties(res.data.properties || []))
      .catch(() => {});
  }, [id]);

  // Сохраняем в "недавно просмотренные"
  useEffect(() => {
    if (!property) return;
    try {
      const stored = JSON.parse(localStorage.getItem("domrent_viewed") || "[]");
      const entry = {
        id: property.id, title: property.title, price: property.price,
        type: property.type, contractType: property.contractType,
        image: property.coverImage || property.images?.[0] || null,
        city: typeof property.city === "object" && property.city !== null
          ? (property.city as any).name : property.city,
      };
      const filtered = stored.filter((p: any) => p.id !== property.id);
      localStorage.setItem("domrent_viewed", JSON.stringify([entry, ...filtered].slice(0, 6)));
    } catch { /* silent */ }
  }, [property]);

  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/properties/${id}/blocked-dates`)
      .then(res => setBlockedDates(new Set(res.data.blockedDates || [])))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    axiosInstance.get(`/reviews/can-review/${id}`)
      .then(res => setCanReview(res.data.canReview))
      .catch(() => {});
  }, [user, id]);

  // Owner bookings
  useEffect(() => {
    if (!property || !user || user.id !== property.ownerId) return;
    axiosInstance.get(`/properties/${id}`)
      .then(res => setBookings(res.data?.property?.bookings ?? res.data?.bookings ?? []))
      .catch(() => {});
  }, [property, user, id]);

  const handleToggleFavorite = async () => {
    if (!user) { navigate("/login"); return; }
    try {
      setCheckingFavorite(true);
      const res = await axiosInstance.post(`/favorites/toggle/${id}`);
      setIsFavorited(res.data?.action === "added" || !isFavorited);
    } finally { setCheckingFavorite(false); }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (!bookingData.startDate || !bookingData.endDate) {
      setBookingError("Выберите даты бронирования"); return;
    }
    if (new Date(bookingData.endDate) <= new Date(bookingData.startDate)) {
      setBookingError("Дата выезда должна быть позже заезда"); return;
    }
    setBookingLoading(true); setBookingError(null);
    try {
      await axiosInstance.post("/bookings", {
        propertyId: parseInt(id!),
        startDate: new Date(bookingData.startDate).toISOString(),
        endDate: new Date(bookingData.endDate).toISOString(),
      });
      alert("Бронирование успешно создано!");
      setBookingData({ startDate: "", endDate: "" });
    } catch (err: any) {
      setBookingError(err.response?.data?.error || "Ошибка при создании бронирования");
    } finally { setBookingLoading(false); }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (!reviewRating) { setReviewError("Выберите оценку"); return; }
    if (!reviewText.trim()) { setReviewError("Напишите отзыв"); return; }
    setReviewLoading(true); setReviewError(null);
    try {
      await axiosInstance.post("/reviews", {
        propertyId: parseInt(id!),
        rating: reviewRating,
        text: reviewText.trim(),
        anonymous: reviewAnonymous,
      });
      setReviewSuccess(true);
      setReviewRating(0); setReviewText(""); setReviewAnonymous(false);
      setCanReview(false);
      fetchReviews();
    } catch (err: any) {
      setReviewError(err.response?.data?.error || "Ошибка при отправке отзыва");
    } finally { setReviewLoading(false); }
  };

  // Calendar logic
  const toISO = (d: Date) => d.toISOString().split("T")[0];
  const today = toISO(new Date());
  const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calendarMonth]);

  const isBlocked = (d: Date) => toISO(d) < today || blockedDates.has(toISO(d));
  const isInRange = (d: Date) => {
    if (!bookingData.startDate || !bookingData.endDate) return false;
    const iso = toISO(d);
    return iso > bookingData.startDate && iso < bookingData.endDate;
  };

  const handleCalendarClick = (d: Date) => {
    const iso = toISO(d);
    if (isBlocked(d)) return;
    if (calendarStep === "start") {
      setBookingData({ startDate: iso, endDate: "" });
      setCalendarStep("end");
    } else {
      if (iso <= bookingData.startDate) { setBookingData({ startDate: iso, endDate: "" }); return; }
      setBookingData(prev => ({ ...prev, endDate: iso }));
      setCalendarStep("start");
    }
  };

  const days = bookingData.startDate && bookingData.endDate
    ? Math.max(1, Math.ceil((new Date(bookingData.endDate).getTime() - new Date(bookingData.startDate).getTime()) / 86400000))
    : 0;
  const totalPrice = days * (property?.price || 0);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <Loader className="w-10 h-10 animate-spin mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    </div>
  );

  if (error || !property) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 max-w-md shadow-card">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-gray-700 dark:text-gray-300 font-medium mb-4">{error || "Объект не найден"}</p>
        <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:bg-gray-700 transition font-semibold text-sm">
          На главную
        </button>
      </div>
    </div>
  );

  const isOwner = user?.id === property.ownerId;
  const cityName = typeof property.city === "object" && property.city !== null
    ? (property.city as { name: string }).name : (property.city as string);

  const ModerationBanner = () => {
    if ((!isOwner && user?.role !== "ADMIN") || property.status === "APPROVED") return null;
    const cfg = {
      PENDING: { cls: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800", icon: <Clock className="w-5 h-5 text-yellow-600" />, text: "Объявление на проверке и пока не видно в поиске.", tc: "text-yellow-800 dark:text-yellow-300" },
      REJECTED: { cls: "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800", icon: <XCircle className="w-5 h-5 text-red-600" />, text: `Объявление отклонено${property.rejectionReason ? `. Причина: ${property.rejectionReason}` : ""}`, tc: "text-red-800 dark:text-red-300" },
    }[property.status as "PENDING" | "REJECTED"];
    if (!cfg) return null;
    return (
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className={`flex gap-3 items-start p-4 rounded-2xl border ${cfg.cls}`}>
          {cfg.icon}
          <p className={`text-sm font-medium ${cfg.tc}`}>{cfg.text}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>
      </div>

      <ModerationBanner />

      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">

          {/* Gallery */}
          <div className="relative w-full h-80 sm:h-[420px] bg-gray-200 dark:bg-gray-800">
            {property.images && property.images.length > 0 ? (
              <>
                <img
                  src={property.images[currentImageIndex]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                {property.images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(i => i === 0 ? property.images.length - 1 : i - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-900/80 rounded-full flex items-center justify-center shadow-md hover:bg-white dark:hover:bg-gray-900 transition"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(i => (i + 1) % property.images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-900/80 rounded-full flex items-center justify-center shadow-md hover:bg-white dark:hover:bg-gray-900 transition"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {property.images.map((_, i) => (
                        <button key={i} onClick={() => setCurrentImageIndex(i)}
                          className={`rounded-full transition-all ${i === currentImageIndex ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"}`}
                        />
                      ))}
                    </div>
                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 text-white text-xs font-medium rounded-full">
                      {currentImageIndex + 1} / {property.images.length}
                    </div>
                  </>
                )}
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 dark:bg-gray-900/90 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 capitalize backdrop-blur-sm">
                  {property.type}
                </div>
                <button
                  onClick={handleToggleFavorite}
                  disabled={checkingFavorite}
                  className="absolute top-4 right-[60px] w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform disabled:opacity-50"
                >
                  <Heart className={`w-5 h-5 transition-colors ${isFavorited ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-700" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left column */}
              <div className="lg:col-span-2 space-y-8">

                {/* Title & price */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{property.title}</h1>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-3">
                    <MapPin className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span>{cityName}</span>
                  </div>
                  {avgRating !== null && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-700"}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{avgRating.toFixed(1)}</span>
                      <span className="text-sm text-gray-400">({reviews.length} отзывов)</span>
                    </div>
                  )}
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {property.price.toLocaleString()} <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                      {property.contractType === "RENT" ? "₸/ночь" : "₸"}
                    </span>
                  </p>
                </div>

                {/* Description */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Об объекте</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{property.description}</p>
                </div>

                {/* Amenities */}
                {(property.hasWifi || property.hasParking || property.petsAllowed || property.rooms) && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Удобства</h2>
                    <div className="flex flex-wrap gap-2">
                      {property.rooms && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                          <BedDouble className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{property.rooms} комнат</span>
                        </div>
                      )}
                      {property.hasWifi && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                          <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Wi-Fi</span>
                        </div>
                      )}
                      {property.hasParking && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                          <Car className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Парковка</span>
                        </div>
                      )}
                      {property.petsAllowed && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-900">
                          <PawPrint className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">Можно с животными</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Map */}
                {property.latitude != null && property.longitude != null && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-brand-500" /> Расположение
                    </h2>
                    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 260 }}>
                      <MapContainer
                        center={[property.latitude!, property.longitude!]} zoom={14}
                        style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}
                      >
                        <TileLayer
                          attribution='&copy; OpenStreetMap'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[property.latitude!, property.longitude!]}>
                          <Popup>{property.title}</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                )}

                {/* Reviews */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400" />
                    Отзывы
                    {avgRating !== null && (
                      <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                        · {avgRating.toFixed(1)} из 5
                      </span>
                    )}
                  </h2>

                  {/* Review form */}
                  {user ? (
                    canReview && !reviewSuccess ? (
                      <form onSubmit={handleSubmitReview} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 mb-6 border border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Оставить отзыв</p>

                        <div className="mb-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ваша оценка</p>
                          <StarInput value={reviewRating} onChange={setReviewRating} />
                        </div>

                        <textarea
                          value={reviewText}
                          onChange={e => setReviewText(e.target.value)}
                          placeholder="Расскажите о вашем опыте..."
                          rows={3}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 resize-none dark:text-white transition mb-3"
                        />

                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={reviewAnonymous}
                            onChange={e => setReviewAnonymous(e.target.checked)}
                            className="w-4 h-4 rounded accent-gray-900"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Опубликовать анонимно</span>
                        </label>

                        {reviewError && (
                          <p className="text-red-500 text-xs mb-3">{reviewError}</p>
                        )}

                        <button
                          type="submit" disabled={reviewLoading}
                          className="w-full py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {reviewLoading ? <><Loader className="w-4 h-4 animate-spin" />Отправка...</> : "Отправить отзыв"}
                        </button>
                      </form>
                    ) : reviewSuccess ? (
                      <div className="bg-green-50 dark:bg-green-950/20 rounded-2xl p-4 mb-5 border border-green-200 dark:border-green-900 text-sm text-green-700 dark:text-green-400 font-medium">
                        Ваш отзыв успешно опубликован!
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-5 border border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                        Вы уже оставили отзыв на этот объект.
                      </div>
                    )
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-5 border border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-3">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <button onClick={() => navigate("/login")} className="text-gray-900 dark:text-white font-semibold hover:underline">Войдите</button>
                        {" "}чтобы оставить отзыв
                      </span>
                    </div>
                  )}

                  {/* Reviews list */}
                  {reviews.length === 0 ? (
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Отзывов пока нет. Будьте первым!</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map(r => (
                        <div key={r.id} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                  {(r.author?.name || r.author?.email || "А")[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                  {r.author?.name || (r.author?.email ? r.author.email.split("@")[0] : "Аноним")}
                                </p>
                                <div className="flex gap-0.5 mt-0.5">
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-600"}`} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(r.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Owner info */}
                {property.owner && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Владелец</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
                        <span className="text-brand-600 dark:text-brand-400 font-bold text-sm">
                          {(property.owner.name || property.owner.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{property.owner.name || "Без имени"}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{property.owner.email}</p>
                        {property.owner.phone && <p className="text-gray-500 dark:text-gray-400 text-xs">{property.owner.phone}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Owner bookings */}
                {isOwner && bookings.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Текущие бронирования</h3>
                    <div className="space-y-3">
                      {bookings.map(b => (
                        <div key={b.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(b.startDate).toLocaleDateString("ru-RU")} — {new Date(b.endDate).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{b.totalPrice.toLocaleString()} ₸</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column — booking form */}
              {!isOwner && (
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 sticky top-24">
                    {property.contractType === "RENT" ? (
                      <>
                        <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                          {property.price.toLocaleString()} <span className="text-base font-normal text-gray-500 dark:text-gray-400">₸/ночь</span>
                        </p>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Забронировать</h3>

                        {!user && (
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
                            <button onClick={() => navigate("/login")} className="font-bold hover:underline">Войдите</button>
                            {" "}чтобы забронировать
                          </div>
                        )}

                        <form onSubmit={handleBooking} className="space-y-3">
                          {/* Calendar */}
                          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                              <button type="button" onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition">
                                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              </button>
                              <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">
                                {MONTHS_RU[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                              </span>
                              <button type="button" onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition">
                                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
                              {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
                                <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2">{d}</div>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 p-2 gap-0.5">
                              {calendarDays.map((d, i) => {
                                if (!d) return <div key={i} />;
                                const iso = toISO(d);
                                const blocked = isBlocked(d);
                                const isStart = iso === bookingData.startDate;
                                const isEnd = iso === bookingData.endDate;
                                const inRange = isInRange(d);
                                return (
                                  <button
                                    key={i} type="button"
                                    onClick={() => handleCalendarClick(d)}
                                    disabled={blocked}
                                    className={`w-full aspect-square flex items-center justify-center text-xs font-medium rounded-lg transition
                                      ${blocked ? "text-gray-300 dark:text-gray-600 cursor-not-allowed line-through" : "cursor-pointer hover:bg-brand-100 dark:hover:bg-brand-900/30"}
                                      ${isStart || isEnd ? "bg-brand-500 text-white hover:bg-brand-600 rounded-lg" : ""}
                                      ${inRange ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-none" : "text-gray-700 dark:text-gray-300"}
                                    `}
                                  >
                                    {d.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="px-3 pb-3 text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                              <span className={calendarStep === "start" ? "text-brand-500 font-semibold" : ""}>
                                {calendarStep === "start" ? "Выберите заезд" : bookingData.startDate ? new Date(bookingData.startDate + "T00:00:00").toLocaleDateString("ru-RU") : "—"}
                              </span>
                              <span>→</span>
                              <span className={calendarStep === "end" ? "text-brand-500 font-semibold" : ""}>
                                {calendarStep === "end" ? "Выберите выезд" : bookingData.endDate ? new Date(bookingData.endDate + "T00:00:00").toLocaleDateString("ru-RU") : "—"}
                              </span>
                            </div>
                          </div>

                          {days > 0 && (
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700 text-sm">
                              <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                                <span>{days} ночей</span>
                                <span>{(days * property.price).toLocaleString()} ₸</span>
                              </div>
                              <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-700 pt-1">
                                <span>Итого</span>
                                <span>{totalPrice.toLocaleString()} ₸</span>
                              </div>
                            </div>
                          )}

                          {bookingError && (
                            <p className="text-red-500 dark:text-red-400 text-xs">{bookingError}</p>
                          )}

                          <button
                            type="submit" disabled={bookingLoading || !user}
                            className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
                          >
                            {bookingLoading ? "Обработка..." : "Забронировать"}
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-2xl font-black text-gray-900 dark:text-white mb-1">{property.price.toLocaleString()} ₸</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Объект продаётся</p>
                        {user ? (
                          <button className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl text-sm hover:bg-gray-700 dark:hover:bg-gray-100 transition">
                            Связаться с владельцем
                          </button>
                        ) : (
                          <button onClick={() => navigate("/login")} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl text-sm hover:bg-gray-700 transition">
                            Войти для связи
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Похожие объекты (дешевле — сначала) ─────────────────────────────── */}
      {similarProperties.length > 0 && (() => {
        const currentPrice = property?.price ?? Infinity;
        const sorted = [...similarProperties].sort((a, b) => a.price - b.price);
        const cheaperCount = sorted.filter(p => p.price < currentPrice).length;

        return (
          <div className="max-w-7xl mx-auto px-4 pb-16">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-brand-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {cheaperCount > 0 ? "Похожие, но дешевле" : "Похожие объекты"}
              </h2>
            </div>
            {cheaperCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                Нашли {cheaperCount === 1 ? "1 похожий вариант" : `${cheaperCount} похожих варианта`} дешевле этого объекта
              </p>
            )}
            <div className={cheaperCount === 0 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-5" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"}>
              {sorted.map(p => {
                const img = p.coverImage || p.images?.[0];
                const city = typeof p.city === "object" && p.city ? p.city.name : p.city;
                const price = p.contractType === "RENT" ? `${p.price.toLocaleString()} ₸/ночь` : `${p.price.toLocaleString()} ₸`;
                const isCheaper = p.price < currentPrice;
                const discountPct = isCheaper ? Math.round((1 - p.price / currentPrice) * 100) : 0;
                return (
                  <Link key={p.id} to={`/property/${p.id}`}
                    className="group bg-white dark:bg-gray-900 rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-800 block"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {img
                        ? <img src={img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center"><MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600" /></div>
                      }
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 capitalize">
                        {p.type}
                      </div>
                      {isCheaper && discountPct > 0 && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500 rounded-full text-xs font-bold text-white shadow-sm">
                          -{discountPct}%
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1 group-hover:text-brand-500 transition-colors">{p.title}</h3>
                      <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
                        <MapPin className="w-3 h-3 flex-shrink-0" /><span className="line-clamp-1">{city}</span>
                      </div>
                      <p className={`font-bold text-sm ${isCheaper ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"}`}>{price}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PropertyPage;
