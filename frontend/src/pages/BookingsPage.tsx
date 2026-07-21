import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader, AlertCircle, Trash2, Phone, Mail,
  MapPin, Calendar, MessageSquare, Star, Home,
  ChevronLeft, ChevronRight, Lock, Unlock, Check, X, CalendarPlus,
} from "lucide-react";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { downloadBookingICS } from "../utils/ics";
type BookingStatus = "PENDING" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";

interface BookingWithProperty {
  id: number;
  startDate: string;
  endDate: string;
  totalPrice: number;
  userId: number;
  propertyId: number;
  status: BookingStatus;
  property?: {
    id: number;
    title: string;
    description?: string;
    city: string | { id: number; name: string };
    price: number;
    type?: string;
    contractType?: string;
    images: string[];
    coverImage?: string | null;
  };
  user?: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
  };
}

interface OwnerBooking extends BookingWithProperty {
  user: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
  };
}

const getCityName = (city?: string | { id: number; name: string }): string => {
  if (!city) return "Город";
  if (typeof city === "object") return city.name;
  return city;
};

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:   { label: "Ожидает подтверждения", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", dot: "bg-amber-500" },
  UPCOMING:  { label: "Предстоящая", color: "text-blue-700 dark:text-blue-400",  bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",   dot: "bg-blue-500" },
  ACTIVE:    { label: "Активная",    color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800", dot: "bg-emerald-500" },
  COMPLETED: { label: "Завершена",   color: "text-gray-600 dark:text-gray-400",  bg: "bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700",   dot: "bg-gray-400" },
  CANCELLED: { label: "Отменена",    color: "text-red-700 dark:text-red-400",   bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",     dot: "bg-red-500" },
};

const STATUS_FILTERS: { value: BookingStatus | "ALL"; label: string }[] = [
  { value: "ALL",       label: "Все" },
  { value: "UPCOMING",  label: "Предстоящие" },
  { value: "ACTIVE",    label: "Активные" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "CANCELLED", label: "Отменённые" },
];

interface MyProperty {
  id: number; title: string; type: string; status: string;
  images: string[]; coverImage: string | null;
}

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const BookingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"trips" | "rentals" | "calendar">("trips");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL");

  const [myBookings, setMyBookings] = useState<BookingWithProperty[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(true);
  const [myBookingsError, setMyBookingsError] = useState<string | null>(null);

  const [ownerBookings, setOwnerBookings] = useState<OwnerBooking[]>([]);
  const [ownerBookingsLoading, setOwnerBookingsLoading] = useState(true);
  const [ownerBookingsError, setOwnerBookingsError] = useState<string | null>(null);

  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const handleConfirmBooking = async (bookingId: number, action: "confirm" | "reject") => {
    const msg = action === "confirm" ? "Подтвердить бронирование?" : "Отклонить бронирование?";
    if (!window.confirm(msg)) return;
    try {
      setConfirmingId(bookingId);
      await axiosInstance.patch(`/bookings/${bookingId}/${action}`);
      setOwnerBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, status: action === "confirm" ? "UPCOMING" : "CANCELLED" }
          : b
      ));
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.error || "Ошибка");
    } finally {
      setConfirmingId(null);
    }
  };

  // ── Occupancy calendar state ──────────────────────────────────────────────
  const [myProperties, setMyProperties] = useState<MyProperty[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [bookingDates, setBookingDates] = useState<Record<string, number>>({});
  const [manualDates, setManualDates] = useState<string[]>([]);
  const [bookingRanges, setBookingRanges] = useState<any[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);

  const [reviewModal, setReviewModal] = useState<{ bookingId: number; propertyTitle: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewedBookings, setReviewedBookings] = useState<Set<number>>(new Set());

  useEffect(() => {
    axiosInstance.get("/bookings/my").then(res => {
      setMyBookings(res.data.bookings || []);
    }).catch(err => {
      setMyBookingsError(err.response?.data?.error || "Не удалось загрузить поездки");
    }).finally(() => setMyBookingsLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role !== "LANDLORD") { setOwnerBookingsLoading(false); return; }
    axiosInstance.get("/bookings/owner").then(res => {
      setOwnerBookings(res.data.bookings || []);
    }).catch(err => {
      setOwnerBookingsError(err.response?.data?.error || "Не удалось загрузить бронирования");
    }).finally(() => setOwnerBookingsLoading(false));
    // Мои объекты для календаря
    axiosInstance.get("/properties/my")
      .then(res => {
        const props = res.data.properties || [];
        setMyProperties(props);
        if (props.length > 0) setSelectedPropId(props[0].id);
      }).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (!selectedPropId) return;
    setCalLoading(true);
    axiosInstance.get(`/properties/${selectedPropId}/occupancy`)
      .then(res => {
        setBookingDates(res.data.bookingDates || {});
        setManualDates(res.data.manualDates || []);
        setBookingRanges(res.data.bookingRanges || []);
      }).catch(() => {})
      .finally(() => setCalLoading(false));
  }, [selectedPropId]);

  const handleToggleBlock = async (iso: string) => {
    if (!selectedPropId || togglingDate) return;
    setTogglingDate(iso);
    try {
      if (manualDates.includes(iso)) {
        await axiosInstance.delete(`/properties/${selectedPropId}/blocked-dates`, { data: { dates: [iso] } });
        setManualDates(prev => prev.filter(d => d !== iso));
      } else {
        await axiosInstance.post(`/properties/${selectedPropId}/blocked-dates`, { dates: [iso], reason: "manual" });
        setManualDates(prev => [...prev, iso]);
      }
    } catch (err: unknown) { alert((err as any)?.response?.data?.error || "Ошибка"); }
    finally { setTogglingDate(null); }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm("Вы уверены, что хотите отменить бронирование?")) return;
    try {
      setCancelingId(bookingId);
      await axiosInstance.delete(`/bookings/${bookingId}`);
      setMyBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: "CANCELLED" } : b)
      );
    } catch (err: unknown) {
      alert((err as any).response?.data?.error || "Ошибка при отмене");
    } finally {
      setCancelingId(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewModal) return;
    if (!reviewText.trim()) { alert("Напишите текст отзыва"); return; }
    try {
      setReviewLoading(true);
      await axiosInstance.post("/reviews", {
        bookingId: reviewModal.bookingId,
        rating: reviewRating,
        text: reviewText.trim(),
      });
      setReviewedBookings(prev => new Set([...prev, reviewModal.bookingId]));
      setReviewModal(null);
      setReviewText("");
      setReviewRating(5);
      alert("Отзыв успешно отправлен!");
    } catch (err: unknown) {
      alert((err as any).response?.data?.error || "Ошибка при отправке отзыва");
    } finally {
      setReviewLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calMonth]);

  const todayISO = new Date().toISOString().split("T")[0];
  const toISO = (d: Date) => d.toISOString().split("T")[0];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });

  const calcNights = (s: string, e: string) =>
    Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000);

  const filteredMyBookings = statusFilter === "ALL"
    ? myBookings
    : myBookings.filter(b => b.status === statusFilter);

  const filteredOwnerBookings = statusFilter === "ALL"
    ? ownerBookings
    : ownerBookings.filter(b => b.status === statusFilter);

  // ─── Sub-components ──────────────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: BookingStatus }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.UPCOMING;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const TripCard = ({ booking }: { booking: BookingWithProperty }) => {
    const nights = calcNights(booking.startDate, booking.endDate);
    const coverImg = booking.property?.coverImage || booking.property?.images?.[0];
    const canCancel = booking.status === "UPCOMING" || booking.status === "ACTIVE";
    const canReview = booking.status === "COMPLETED" && !reviewedBookings.has(booking.id);

    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100 dark:border-gray-800">
        {/* Photo */}
        <div className="relative h-52 bg-gray-100">
          {coverImg ? (
            <img src={coverImg} alt={booking.property?.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
              <Home className="w-10 h-10" />
              <span className="text-sm">Нет фото</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute top-4 left-4">
            <StatusBadge status={booking.status} />
          </div>
          {booking.property?.type && (
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold rounded-full">
                {booking.property.type}
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug">{booking.property?.title || "Объект"}</h3>

          <div className="flex items-center text-gray-500 dark:text-gray-400 mb-4 gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-sm">{getCityName(booking.property?.city)}</span>
          </div>

          {/* Dates row */}
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="font-medium">{formatDate(booking.startDate)}</span>
            <span className="text-gray-400">—</span>
            <span className="font-medium">{formatDate(booking.endDate)}</span>
            <span className="ml-auto text-gray-500 text-xs">{nights} н.</span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Итого оплачено</span>
            <span className="text-xl font-black text-gray-900 dark:text-white">{booking.totalPrice.toLocaleString()} ₸</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/chat/${booking.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
            >
              <MessageSquare className="w-4 h-4" />
              Чат
            </button>

            <button
              onClick={() => downloadBookingICS({
                id: booking.id,
                title: booking.property?.title || "Бронирование DomRent",
                city: getCityName(booking.property?.city),
                startDate: booking.startDate,
                endDate: booking.endDate,
              })}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition"
              title="Добавить в календарь (.ics)"
            >
              <CalendarPlus className="w-4 h-4" />
              В календарь
            </button>

            {canReview && (
              <button
                onClick={() => setReviewModal({ bookingId: booking.id, propertyTitle: booking.property?.title || "" })}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium rounded-xl transition border border-amber-200"
              >
                <Star className="w-4 h-4" />
                Отзыв
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => handleCancelBooking(booking.id)}
                disabled={cancelingId === booking.id}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition border border-red-200 ml-auto disabled:opacity-50"
              >
                {cancelingId === booking.id ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Отменить
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const RentalCard = ({ booking }: { booking: OwnerBooking }) => {
    const nights = calcNights(booking.startDate, booking.endDate);
    const coverImg = booking.property?.coverImage || booking.property?.images?.[0];

    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100 dark:border-gray-800">
        <div className="flex gap-0">
          {/* Left: photo */}
          <div className="w-36 flex-shrink-0 relative bg-gray-100">
            {coverImg ? (
              <img src={coverImg} alt={booking.property?.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Home className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Right: info */}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{booking.property?.title || "Объект"}</h3>
              <StatusBadge status={booking.status} />
            </div>

            <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
              <MapPin className="w-3 h-3" />
              <span>{getCityName(booking.property?.city)}</span>
            </div>

            {/* Dates */}
            <div className="text-xs text-gray-600 mb-3 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              {formatDate(booking.startDate)} — {formatDate(booking.endDate)} · {nights} н.
            </div>

            {/* Tenant */}
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">{booking.user?.name || "Гость"}</p>
              {booking.user?.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-gray-400" />
                  <a href={`mailto:${booking.user.email}`} className="text-xs text-blue-600 hover:underline truncate">{booking.user.email}</a>
                </div>
              )}
              {booking.user?.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <a href={`tel:${booking.user.phone}`} className="text-xs text-emerald-600 hover:underline">{booking.user.phone}</a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400">Доход</p>
                <p className="text-base font-black text-emerald-600">{booking.totalPrice.toLocaleString()} ₸</p>
              </div>
              <button
                onClick={() => navigate(`/chat/${booking.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Чат
              </button>
            </div>

            {booking.status === "PENDING" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleConfirmBooking(booking.id, "confirm")}
                  disabled={confirmingId === booking.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl transition border border-emerald-200 disabled:opacity-50"
                >
                  {confirmingId === booking.id ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Подтвердить
                </button>
                <button
                  onClick={() => handleConfirmBooking(booking.id, "reject")}
                  disabled={confirmingId === booking.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl transition border border-red-200 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Отклонить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mb-5">
        <Calendar className="w-8 h-8 text-gray-300" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Нет бронирований</h3>
      <p className="text-gray-500 max-w-xs text-sm">{message}</p>
    </div>
  );

  const ErrorState = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-red-900 text-sm mb-0.5">Ошибка загрузки</p>
        <p className="text-red-700 text-sm">{message}</p>
      </div>
    </div>
  );

  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader className="w-8 h-8 animate-spin text-gray-400 mb-3" />
      <p className="text-gray-500 text-sm font-medium">Загрузка...</p>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">Бронирования</h1>
          <p className="text-gray-500 dark:text-gray-400">Управляйте поездками и арендой</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-900 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
          <button
            onClick={() => setActiveTab("trips")}
            className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition ${
              activeTab === "trips" ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            Мои поездки
            {myBookings.length > 0 && (
              <span className={`ml-2 text-xs ${activeTab === "trips" ? "text-gray-300" : "text-gray-400"}`}>
                {myBookings.length}
              </span>
            )}
          </button>
          {user?.role === "LANDLORD" && (
            <>
              <button
                onClick={() => setActiveTab("rentals")}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition ${
                  activeTab === "rentals"
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                Управление арендой
                {ownerBookings.length > 0 && (
                  <span className={`ml-2 text-xs ${activeTab === "rentals" ? "text-gray-300 dark:text-gray-600" : "text-gray-400"}`}>
                    {ownerBookings.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("calendar")}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-semibold text-sm transition ${
                  activeTab === "calendar"
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Календарь занятости
              </button>
            </>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_FILTERS.map(f => {
            const count = f.value !== "ALL"
              ? (activeTab === "trips" ? myBookings : ownerBookings).filter(b => b.status === f.value).length
              : null;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  statusFilter === f.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                }`}
              >
                {f.label}
                {count !== null && count > 0 && (
                  <span className={`text-xs font-bold ${statusFilter === f.value ? "text-gray-300" : "text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === "trips" && (
          myBookingsLoading ? <LoadingState /> :
          myBookingsError ? <ErrorState message={myBookingsError} /> :
          filteredMyBookings.length === 0 ? (
            <EmptyState message={
              statusFilter === "ALL"
                ? "Вы ещё не бронировали жильё. Начните поиск!"
                : `Нет бронирований со статусом «${STATUS_CONFIG[statusFilter as BookingStatus]?.label}»`
            } />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMyBookings.map(b => <TripCard key={b.id} booking={b} />)}
            </div>
          )
        )}

        {activeTab === "rentals" && (
          ownerBookingsLoading ? <LoadingState /> :
          ownerBookingsError ? <ErrorState message={ownerBookingsError} /> :
          filteredOwnerBookings.length === 0 ? (
            <EmptyState message={
              statusFilter === "ALL"
                ? "У вас нет бронирований на ваше жильё."
                : `Нет бронирований со статусом «${STATUS_CONFIG[statusFilter as BookingStatus]?.label}»`
            } />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOwnerBookings.map(b => <RentalCard key={b.id} booking={b as OwnerBooking} />)}
            </div>
          )
        )}

        {/* ── Occupancy Calendar ─────────────────────────────────────────── */}
        {activeTab === "calendar" && (
          <div>
            {myProperties.length === 0 ? (
              <EmptyState message="У вас пока нет объявлений" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: calendar */}
                <div className="lg:col-span-2">
                  {/* Property selector */}
                  <div className="mb-5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Объект</label>
                    <select
                      value={selectedPropId ?? ""}
                      onChange={e => setSelectedPropId(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
                    >
                      {myProperties.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  {calLoading ? (
                    <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
                      {/* Month navigation */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {MONTHS_RU[calMonth.getMonth()]} {calMonth.getFullYear()}
                        </span>
                        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>

                      {/* Day names */}
                      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
                          <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2.5">{d}</div>
                        ))}
                      </div>

                      {/* Days grid */}
                      <div className="grid grid-cols-7 p-3 gap-1">
                        {calendarDays.map((d, i) => {
                          if (!d) return <div key={i} />;
                          const iso = toISO(d);
                          const isPast = iso < todayISO;
                          const isBooked = !!bookingDates[iso];
                          const isManual = manualDates.includes(iso);
                          const isToggling = togglingDate === iso;

                          let cls = "text-gray-300 dark:text-gray-600"; // past
                          let bg = "";
                          let title = "";

                          if (!isPast) {
                            if (isBooked) {
                              bg = "bg-red-100 dark:bg-red-950/30";
                              cls = "text-red-700 dark:text-red-300 font-semibold";
                              title = "Занято (бронирование)";
                            } else if (isManual) {
                              bg = "bg-orange-100 dark:bg-orange-950/30";
                              cls = "text-orange-700 dark:text-orange-300 font-semibold cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-950/50";
                              title = "Заблокировано вручную — нажмите чтобы разблокировать";
                            } else {
                              bg = "hover:bg-emerald-50 dark:hover:bg-emerald-950/20";
                              cls = "text-gray-700 dark:text-gray-300 cursor-pointer";
                              title = "Свободно — нажмите чтобы заблокировать";
                            }
                          }

                          return (
                            <button
                              key={i}
                              disabled={isPast || isBooked || isToggling}
                              onClick={() => !isPast && !isBooked && handleToggleBlock(iso)}
                              title={title}
                              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors ${bg} ${cls} disabled:cursor-default`}
                            >
                              {isToggling && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-gray-900/50">
                                  <Loader className="w-3 h-3 animate-spin text-gray-400" />
                                </div>
                              )}
                              <span>{d.getDate()}</span>
                              {isManual && <span className="w-1 h-1 bg-orange-500 rounded-full mt-0.5" />}
                              {isBooked && <span className="w-1 h-1 bg-red-500 rounded-full mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-4 px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-800" />
                          <span className="text-gray-600 dark:text-gray-400">Забронировано</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800" />
                          <span className="text-gray-600 dark:text-gray-400">Заблокировано вручную</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900" />
                          <span className="text-gray-600 dark:text-gray-400">Свободно (кликните чтобы закрыть)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: booking list */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Активные бронирования</h3>
                  {bookingRanges.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 text-center border border-gray-100 dark:border-gray-800">
                      <Calendar className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                      <p className="text-gray-400 dark:text-gray-500 text-sm">Нет активных бронирований</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookingRanges.map(b => (
                        <div key={b.id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === "ACTIVE"
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                            }`}>
                              {b.status === "ACTIVE" ? "Активное" : "Предстоящее"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{b.guest}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(b.startDate).toLocaleDateString("ru-RU")} — {new Date(b.endDate).toLocaleDateString("ru-RU")}
                          </p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">{b.totalPrice.toLocaleString()} ₸</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual blocks info */}
                  {manualDates.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-orange-500" />
                        Закрытые даты ({manualDates.length})
                      </h3>
                      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 max-h-40 overflow-y-auto">
                        {manualDates.sort().map(d => (
                          <div key={d} className="flex items-center justify-between py-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                            </span>
                            <button
                              onClick={() => handleToggleBlock(d)}
                              disabled={togglingDate === d}
                              className="text-xs text-orange-500 hover:text-orange-700 transition flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" /> Открыть
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-modal animate-slide-up">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Оставить отзыв</h2>
            <p className="text-gray-400 text-sm mb-5">«{reviewModal.propertyTitle}»</p>

            <div className="flex gap-2 mb-5">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setReviewRating(star)} className="transition-transform hover:scale-110">
                  <Star className={`w-9 h-9 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                </button>
              ))}
              <span className="ml-2 text-base font-bold text-gray-700 self-center">{reviewRating}/5</span>
            </div>

            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Расскажите о своём опыте проживания..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-2xl focus:ring-2 focus:ring-gray-900 focus:bg-white outline-none resize-none mb-4 text-sm transition-all"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setReviewModal(null); setReviewText(""); setReviewRating(5); }}
                className="flex-1 py-3 border border-gray-200 rounded-2xl font-semibold text-gray-700 hover:bg-gray-50 transition text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewLoading}
                className="flex-1 py-3 bg-gray-900 hover:bg-gray-700 text-white rounded-2xl font-bold transition disabled:opacity-50 text-sm"
              >
                {reviewLoading ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
