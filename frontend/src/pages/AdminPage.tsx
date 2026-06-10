import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Users, Home, Calendar, TrendingUp, ShieldOff, Shield,
  CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight,
  AlertTriangle, Loader, BarChart3, ArrowUpRight, ClipboardList, Star, Trash2,
  Download, Activity
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number; totalProperties: number; approvedProperties: number;
  totalBookings: number; completedBookings: number;
  pendingProperties: number; totalRevenue: number;
  bannedUsers: number; newUsers7d: number; newBookings7d: number;
}
interface Top5Property {
  id: number; title: string; city: string; price: number;
  coverImage?: string | null; bookingsCount: number; reviewsCount: number; owner: string;
}
interface BookingChart { date: string; count: number; revenue: number; }
interface AdminUser {
  id: number; email: string; name: string | null; phone: string | null;
  avatar?: string | null; role: string; isBanned: boolean; createdAt: string;
  _count: { bookings: number; properties: number };
}
interface AdminProperty {
  id: number; title: string; status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null; price: number; type: string; createdAt: string;
  city: { name: string }; owner: { id: number; name: string | null; email: string };
  images: string[]; coverImage: string | null;
  _count: { bookings: number; reviews: number };
}
interface AuditEntry {
  id: number; action: string; targetId: number | null; targetType: string | null;
  details: Record<string, unknown> | null; createdAt: string;
  admin: { id: number; name: string | null; email: string; avatar?: string | null };
}
interface AdminBooking {
  id: number; startDate: string; endDate: string; totalPrice: number;
  status: string; createdAt: string;
  user: { id: number; name: string | null; email: string };
  property: { id: number; title: string; city: { name: string } };
}
interface AdminReview {
  id: number; rating: number; text: string; anonymous: boolean; createdAt: string;
  author: { id: number; name: string | null; email: string };
  property: { id: number; title: string };
}

interface MonthlyUsers    { month: string; users: number; }
interface MonthlyBookings { month: string; bookings: number; revenue: number; }
interface TopProperty     { id: number; title: string; city: string; bookings: number; viewCount: number; }
interface TopCity         { city: string; bookings: number; revenue: number; }
interface AnalyticsData {
  monthlyUsers: MonthlyUsers[];
  monthlyBookings: MonthlyBookings[];
  top10: TopProperty[];
  topCities: TopCity[];
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, trend, iconBg }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; trend?: string; iconBg: string;
}) => (
  <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-card border border-gray-100 dark:border-gray-800 hover:shadow-card-hover transition-all">
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-2xl ${iconBg}`}>{icon}</div>
      {trend && (
        <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full">
          <ArrowUpRight className="w-3 h-3" />{trend}
        </span>
      )}
    </div>
    <p className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
      {typeof value === "number" ? value.toLocaleString() : value}
    </p>
    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
type Tab = "stats" | "users" | "moderation" | "bookings" | "reviews" | "audit" | "analytics";

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    if (user && user.role !== "ADMIN") navigate("/");
  }, [user, navigate]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<Stats | null>(null);
  const [top5, setTop5] = useState<Top5Property[]>([]);
  const [chart, setChart] = useState<BookingChart[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (tab !== "stats") return;
    axiosInstance.get("/admin/stats")
      .then(r => {
        setStats(r.data.stats);
        setTop5(r.data.top5Properties || []);
        setChart(r.data.bookingsChart || []);
      })
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [tab]);

  // ─── Users ────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [banningId, setBanningId] = useState<number | null>(null);

  const fetchUsers = useCallback(async (page = 1, search = "") => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      const r = await axiosInstance.get(`/admin/users?${params}`);
      setUsers(r.data.users); setUsersTotal(r.data.total);
    } catch (err) { console.error(err); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "users") fetchUsers(usersPage, usersSearch);
  }, [tab, usersPage, fetchUsers]);

  const handleBan = async (userId: number, banned: boolean) => {
    if (!window.confirm(banned ? t('admin.users.banConfirm') : t('admin.users.unbanConfirm'))) return;
    setBanningId(userId);
    try {
      await axiosInstance.patch(`/admin/users/${userId}/ban`, { banned });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: banned } : u));
    } catch (err: unknown) { alert((err as any).response?.data?.error || t('common.error')); }
    finally { setBanningId(null); }
  };

  // ─── Moderation ───────────────────────────────────────────────────────────
  const [modFilter, setModFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [modProps, setModProps] = useState<AdminProperty[]>([]);
  const [modTotal, setModTotal] = useState(0);
  const [modPage, setModPage] = useState(1);
  const [modLoading, setModLoading] = useState(false);
  const [moderatingId, setModeratingId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: number; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchMod = useCallback(async (page = 1, status = "PENDING") => {
    setModLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10", status });
      const r = await axiosInstance.get(`/admin/properties?${params}`);
      setModProps(r.data.properties); setModTotal(r.data.total);
    } catch (err) { console.error(err); }
    finally { setModLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "moderation") fetchMod(modPage, modFilter);
  }, [tab, modPage, modFilter, fetchMod]);

  const handleApprove = async (id: number) => {
    setModeratingId(id);
    try {
      await axiosInstance.patch(`/admin/properties/${id}/approve`);
      setModProps(prev => prev.filter(p => p.id !== id)); setModTotal(t2 => t2 - 1);
    } catch (err: unknown) { alert((err as any).response?.data?.error || t('common.error')); }
    finally { setModeratingId(null); }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) { alert(t('admin.moderation.rejectModal.placeholder')); return; }
    setModeratingId(rejectModal.id);
    try {
      await axiosInstance.patch(`/admin/properties/${rejectModal.id}/reject`, { reason: rejectReason });
      setModProps(prev => prev.filter(p => p.id !== rejectModal.id)); setModTotal(t2 => t2 - 1);
      setRejectModal(null); setRejectReason("");
    } catch (err: unknown) { alert((err as any).response?.data?.error || t('common.error')); }
    finally { setModeratingId(null); }
  };

  // ─── Admin Bookings ───────────────────────────────────────────────────────
  const [adminBookings, setAdminBookings] = useState<AdminBooking[]>([]);
  const [adminBookingsTotal, setAdminBookingsTotal] = useState(0);
  const [adminBookingsPage, setAdminBookingsPage] = useState(1);
  const [adminBookingsLoading, setAdminBookingsLoading] = useState(false);
  const [adminBookingsStatus, setAdminBookingsStatus] = useState("");

  const fetchAdminBookings = useCallback(async (page = 1, status = "") => {
    setAdminBookingsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) params.set("status", status);
      const r = await axiosInstance.get(`/admin/bookings?${params}`);
      setAdminBookings(r.data.bookings); setAdminBookingsTotal(r.data.total);
    } catch (err) { console.error(err); }
    finally { setAdminBookingsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "bookings") fetchAdminBookings(adminBookingsPage, adminBookingsStatus);
  }, [tab, adminBookingsPage, adminBookingsStatus, fetchAdminBookings]);

  // ─── Admin Reviews ────────────────────────────────────────────────────────
  const [adminReviews, setAdminReviews] = useState<AdminReview[]>([]);
  const [adminReviewsTotal, setAdminReviewsTotal] = useState(0);
  const [adminReviewsPage, setAdminReviewsPage] = useState(1);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const fetchAdminReviews = useCallback(async (page = 1) => {
    setAdminReviewsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      const r = await axiosInstance.get(`/admin/reviews?${params}`);
      setAdminReviews(r.data.reviews); setAdminReviewsTotal(r.data.total);
    } catch (err) { console.error(err); }
    finally { setAdminReviewsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "reviews") fetchAdminReviews(adminReviewsPage);
  }, [tab, adminReviewsPage, fetchAdminReviews]);

  const handleDeleteReview = async (id: number) => {
    if (!window.confirm("Удалить этот отзыв?")) return;
    setDeletingReviewId(id);
    try {
      await axiosInstance.delete(`/admin/reviews/${id}`);
      setAdminReviews(prev => prev.filter(r => r.id !== id));
      setAdminReviewsTotal(t => t - 1);
    } catch (err: unknown) { alert((err as any).response?.data?.error || "Ошибка"); }
    finally { setDeletingReviewId(null); }
  };

  // ─── Audit ────────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAudit = useCallback(async (page = 1) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      const r = await axiosInstance.get(`/admin/audit?${params}`);
      setAuditLogs(r.data.logs); setAuditTotal(r.data.total);
    } catch (err) { console.error(err); }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "audit") fetchAudit(auditPage);
  }, [tab, auditPage, fetchAudit]);

  // ─── Analytics ────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "analytics") return;
    setAnalyticsLoading(true);
    axiosInstance.get("/admin/analytics")
      .then(r => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [tab]);

  const downloadPdf = (url: string, filename: string) => {
    axiosInstance.get(url, { responseType: "blob" }).then(r => {
      const href = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = href; a.download = filename;
      a.click(); URL.revokeObjectURL(href);
    }).catch(() => alert("Ошибка генерации отчёта"));
  };

  // ─── Configs ──────────────────────────────────────────────────────────────
  const ROLE_CFG: Record<string, { label: string; cls: string }> = {
    USER:     { label: t('admin.users.roles.USER'),     cls: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
    LANDLORD: { label: t('admin.users.roles.LANDLORD'), cls: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
    ADMIN:    { label: t('admin.users.roles.ADMIN'),    cls: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
  };

  const STATUS_CFG = {
    PENDING:  { label: t('admin.moderation.statuses.PENDING'),  bg: "bg-amber-50 dark:bg-amber-950/40",   text: "text-amber-700 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800",   icon: <Clock className="w-3.5 h-3.5" /> },
    APPROVED: { label: t('admin.moderation.statuses.APPROVED'), bg: "bg-emerald-50 dark:bg-emerald-950/40",text: "text-emerald-700 dark:text-emerald-300",border: "border-emerald-200 dark:border-emerald-800",icon: <CheckCircle className="w-3.5 h-3.5" /> },
    REJECTED: { label: t('admin.moderation.statuses.REJECTED'), bg: "bg-red-50 dark:bg-red-950/40",       text: "text-red-700 dark:text-red-300",       border: "border-red-200 dark:border-red-800",        icon: <XCircle className="w-3.5 h-3.5" /> },
  };

  const ACTION_ICONS: Record<string, string> = {
    BAN_USER: "🔒", UNBAN_USER: "🔓",
    APPROVE_PROPERTY: "✅", REJECT_PROPERTY: "❌", CHANGE_ROLE: "🔄",
  };

  const totalUsersPages = Math.ceil(usersTotal / 15);
  const totalModPages = Math.ceil(modTotal / 10);
  const totalAuditPages = Math.ceil(auditTotal / 20);

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "stats",      label: t('admin.tabs.stats'),      icon: <BarChart3 className="w-4 h-4" /> },
    { id: "users",      label: t('admin.tabs.users'),      icon: <Users className="w-4 h-4" /> },
    { id: "moderation", label: t('admin.tabs.moderation'), icon: <Home className="w-4 h-4" />, badge: stats?.pendingProperties },
    { id: "bookings",   label: "Бронирования",             icon: <Calendar className="w-4 h-4" /> },
    { id: "reviews",    label: "Отзывы",                   icon: <Star className="w-4 h-4" /> },
    { id: "audit",      label: t('admin.tabs.audit'),      icon: <ClipboardList className="w-4 h-4" /> },
    { id: "analytics",  label: "Аналитика",                icon: <Activity className="w-4 h-4" /> },
  ];

  // ─── Pagination helper ────────────────────────────────────────────────────
  const Pagination = ({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) =>
    total > 1 ? (
      <div className="flex items-center justify-center gap-3 mt-5">
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{page} / {total}</span>
        <button onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t('admin.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('admin.subtitle')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white dark:bg-gray-900 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-800 w-fit overflow-x-auto">
          {TABS.map(tItem => (
            <button
              key={tItem.id}
              onClick={() => setTab(tItem.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition whitespace-nowrap ${
                tab === tItem.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {tItem.icon}{tItem.label}
              {tItem.badge != null && tItem.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {tItem.badge > 9 ? "9+" : tItem.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── STATS ──────────────────────────────────────────────────────── */}
        {tab === "stats" && (
          statsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Main stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label={t('admin.stats.users')} value={stats.totalUsers} trend={`+${stats.newUsers7d} ${t('admin.stats.per7d')}`} iconBg="bg-blue-50 dark:bg-blue-950/40" />
                <StatCard icon={<Home className="w-5 h-5 text-emerald-600" />} label={t('admin.stats.properties')} value={stats.approvedProperties} sub={`${stats.pendingProperties} ${t('admin.stats.pending')}`} iconBg="bg-emerald-50 dark:bg-emerald-950/40" />
                <StatCard icon={<Calendar className="w-5 h-5 text-orange-600" />} label={t('admin.stats.bookings')} value={stats.totalBookings} trend={`+${stats.newBookings7d} ${t('admin.stats.per7d')}`} iconBg="bg-orange-50 dark:bg-orange-950/40" />
                <StatCard icon={<TrendingUp className="w-5 h-5 text-violet-600" />} label={t('admin.stats.revenue')} value={`${stats.totalRevenue.toLocaleString()} ₸`} iconBg="bg-violet-50 dark:bg-violet-950/40" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
                <StatCard icon={<ShieldOff className="w-5 h-5 text-red-500" />} label={t('admin.stats.banned')} value={stats.bannedUsers} iconBg="bg-red-50 dark:bg-red-950/40" />
                <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label={t('admin.stats.pending')} value={stats.pendingProperties} iconBg="bg-amber-50 dark:bg-amber-950/40" />
              </div>

              {/* Top 5 properties */}
              {top5.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Топ-5 объявлений по бронированиям
                  </h2>
                  <div className="space-y-3">
                    {top5.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          i === 0 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                          i === 1 ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" :
                          i === 2 ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" :
                          "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-500"
                        }`}>{i + 1}</span>
                        {p.coverImage && <img src={p.coverImage} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.title}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{p.city} · {p.price.toLocaleString()} ₸</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{p.bookingsCount}</p>
                          <p className="text-xs text-gray-400">брон.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mini chart — bookings last 30 days */}
              {chart.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-500" />
                    Бронирования за последние 30 дней
                  </h2>
                  <div className="flex items-end gap-1 h-24">
                    {chart.slice(-30).map((d, i) => {
                      const max = Math.max(...chart.map(c => c.count), 1);
                      const h = Math.max(4, (d.count / max) * 96);
                      return (
                        <div key={i} className="flex-1 group relative flex items-end">
                          <div
                            style={{ height: `${h}px` }}
                            className="w-full rounded-t-sm bg-violet-400 dark:bg-violet-600 group-hover:bg-violet-600 dark:group-hover:bg-violet-400 transition-colors"
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                            {d.count} · {new Date(d.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-gray-400 dark:text-gray-500 py-10 text-center">{t('common.noData')}</p>
        )}

        {/* ─── USERS ──────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div>
            <div className="flex gap-3 mb-5">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setUsersPage(1); fetchUsers(1, usersSearch); } }}
                  placeholder={t('admin.users.search')}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 text-sm transition-all placeholder:text-gray-400"
                />
              </div>
              <button
                onClick={() => { setUsersPage(1); fetchUsers(1, usersSearch); }}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-2xl font-semibold text-sm transition"
              >
                {t('admin.users.find')}
              </button>
            </div>

            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
              {t('admin.users.total')}: <strong className="text-gray-700 dark:text-gray-300">{usersTotal}</strong>
            </p>

            {usersLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        {[t('admin.users.id'), t('admin.users.user'), t('admin.users.role'), t('admin.users.properties'), t('admin.users.bookings'), t('admin.users.status'), ""].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {users.map(u => {
                        const rCfg = ROLE_CFG[u.role] || ROLE_CFG.USER;
                        return (
                          <tr key={u.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition ${u.isBanned ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3.5 text-gray-400 dark:text-gray-500 font-mono text-xs">#{u.id}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                {u.avatar
                                  ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                                  : <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{(u.name || u.email)[0].toUpperCase()}</div>
                                }
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{u.name || "—"}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${rCfg.cls}`}>{rCfg.label}</span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-semibold text-gray-700 dark:text-gray-300">{u._count.properties}</td>
                            <td className="px-4 py-3.5 text-center font-semibold text-gray-700 dark:text-gray-300">{u._count.bookings}</td>
                            <td className="px-4 py-3.5">
                              {u.isBanned
                                ? <span className="px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full text-xs font-semibold border border-red-200 dark:border-red-800">{t('admin.users.banned')}</span>
                                : <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">{t('admin.users.active')}</span>
                              }
                            </td>
                            <td className="px-4 py-3.5">
                              {u.role !== "ADMIN" && (
                                <button
                                  onClick={() => handleBan(u.id, !u.isBanned)}
                                  disabled={banningId === u.id}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-40 ${
                                    u.isBanned
                                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                                      : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60"
                                  }`}
                                >
                                  {banningId === u.id ? <Loader className="w-3 h-3 animate-spin" /> :
                                    u.isBanned ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                                  {u.isBanned ? t('admin.users.unban') : t('admin.users.ban')}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pagination page={usersPage} total={totalUsersPages} onPage={setUsersPage} />
          </div>
        )}

        {/* ─── MODERATION ─────────────────────────────────────────────────── */}
        {tab === "moderation" && (
          <div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {(["PENDING", "APPROVED", "REJECTED"] as const).map(s => {
                const cfg = STATUS_CFG[s];
                return (
                  <button
                    key={s}
                    onClick={() => { setModFilter(s); setModPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition border ${
                      modFilter === s
                        ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                        : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {cfg.icon}{cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{t('admin.moderation.found')}: <strong className="text-gray-700 dark:text-gray-300">{modTotal}</strong></p>

            {modLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : modProps.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-gray-400 dark:text-gray-500 font-medium">{t('admin.moderation.empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {modProps.map(p => {
                  const cfg = STATUS_CFG[p.status];
                  const cover = p.coverImage || p.images?.[0];
                  return (
                    <div key={p.id} className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-card-hover transition-all">
                      <div className="flex">
                        <div className="w-36 flex-shrink-0 bg-gray-100 dark:bg-gray-800 min-h-[130px]">
                          {cover
                            ? <img src={cover} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600"><Home className="w-8 h-8" /></div>
                          }
                        </div>
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2 flex-1">{p.title}</h3>
                            <span className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                              {cfg.icon}{cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{p.city?.name} · {p.type}</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{p.price.toLocaleString()} ₸</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            <span className="font-medium text-gray-600 dark:text-gray-400">{p.owner?.name || p.owner?.email}</span>
                            {" · "}{new Date(p.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                          {p.rejectionReason && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-xl px-2.5 py-2 border border-red-100 dark:border-red-900">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{p.rejectionReason}</span>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {p.status === "PENDING" && (
                              <>
                                <button onClick={() => handleApprove(p.id)} disabled={moderatingId === p.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50">
                                  {moderatingId === p.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  {t('admin.moderation.approve')}
                                </button>
                                <button onClick={() => setRejectModal({ id: p.id, title: p.title })} disabled={moderatingId === p.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl transition disabled:opacity-50">
                                  <XCircle className="w-3.5 h-3.5" />{t('admin.moderation.reject')}
                                </button>
                              </>
                            )}
                            {p.status === "REJECTED" && (
                              <button onClick={() => handleApprove(p.id)} disabled={moderatingId === p.id}
                                className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl transition">
                                <CheckCircle className="w-3.5 h-3.5" />{t('admin.moderation.approveAnyway')}
                              </button>
                            )}
                            {p.status === "APPROVED" && (
                              <button onClick={() => setRejectModal({ id: p.id, title: p.title })} disabled={moderatingId === p.id}
                                className="flex items-center gap-1.5 py-1.5 px-3 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl transition">
                                <XCircle className="w-3.5 h-3.5" />{t('admin.moderation.removeFromPublication')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination page={modPage} total={totalModPages} onPage={setModPage} />
          </div>
        )}

        {/* ─── BOOKINGS ───────────────────────────────────────────────────── */}
        {tab === "bookings" && (
          <div>
            {/* Status filter */}
            <div className="flex gap-2 flex-wrap mb-5">
              {[
                { value: "", label: "Все" },
                { value: "UPCOMING",  label: "Предстоящие" },
                { value: "ACTIVE",    label: "Активные" },
                { value: "COMPLETED", label: "Завершённые" },
                { value: "CANCELLED", label: "Отменённые" },
              ].map(s => (
                <button key={s.value} onClick={() => { setAdminBookingsStatus(s.value); setAdminBookingsPage(1); }}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition ${
                    adminBookingsStatus === s.value
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Всего: <strong className="text-gray-700 dark:text-gray-300">{adminBookingsTotal}</strong></p>

            {adminBookingsLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : adminBookings.length === 0 ? (
              <div className="text-center py-20">
                <Calendar className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 font-medium">Бронирований нет</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        {["ID", "Объект", "Гость", "Даты", "Сумма", "Статус"].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {adminBookings.map(b => {
                        const STATUS_B: Record<string, string> = {
                          UPCOMING: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
                          ACTIVE: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
                          COMPLETED: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
                          CANCELLED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                        };
                        const STATUS_LABEL: Record<string, string> = { UPCOMING: "Предстоящее", ACTIVE: "Активное", COMPLETED: "Завершено", CANCELLED: "Отменено" };
                        return (
                          <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                            <td className="px-4 py-3.5 text-gray-400 dark:text-gray-500 font-mono text-xs">#{b.id}</td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">{b.property?.title}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{b.property?.city?.name}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{b.user?.name || "—"}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{b.user?.email}</p>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {new Date(b.startDate).toLocaleDateString("ru-RU")} — {new Date(b.endDate).toLocaleDateString("ru-RU")}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">
                              {b.totalPrice.toLocaleString()} ₸
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_B[b.status] || ""}`}>
                                {STATUS_LABEL[b.status] || b.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pagination page={adminBookingsPage} total={Math.ceil(adminBookingsTotal / 15)} onPage={setAdminBookingsPage} />
          </div>
        )}

        {/* ─── REVIEWS ────────────────────────────────────────────────────── */}
        {tab === "reviews" && (
          <div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Всего отзывов: <strong className="text-gray-700 dark:text-gray-300">{adminReviewsTotal}</strong></p>

            {adminReviewsLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : adminReviews.length === 0 ? (
              <div className="text-center py-20">
                <Star className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 font-medium">Отзывов нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminReviews.map(r => (
                  <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-card flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {r.anonymous ? "Аноним" : (r.author?.name || r.author?.email)}
                            {r.anonymous && <span className="ml-2 text-xs text-gray-400">(анонимно)</span>}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{r.property?.title}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-700"}`} />
                          ))}
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 ml-1">{r.rating}/5</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{r.text}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.createdAt).toLocaleString("ru-RU")}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteReview(r.id)}
                      disabled={deletingReviewId === r.id}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 rounded-xl transition disabled:opacity-40"
                      title="Удалить отзыв"
                    >
                      {deletingReviewId === r.id ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Pagination page={adminReviewsPage} total={Math.ceil(adminReviewsTotal / 15)} onPage={setAdminReviewsPage} />
          </div>
        )}

        {/* ─── AUDIT ──────────────────────────────────────────────────────── */}
        {tab === "audit" && (
          <div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">{t('admin.audit.title')}</p>
            {auditLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-20">
                <ClipboardList className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 font-medium">{t('admin.audit.empty')}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <tr>
                        {[t('admin.audit.time'), t('admin.audit.admin'), t('admin.audit.action'), t('admin.audit.target')].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition">
                          <td className="px-4 py-3.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("ru-RU")}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {log.admin.avatar
                                ? <img src={log.admin.avatar} alt="" className="w-6 h-6 rounded-lg object-cover" />
                                : <div className="w-6 h-6 bg-violet-500 rounded-lg flex items-center justify-center text-white text-[10px] font-bold">{(log.admin.name || log.admin.email)[0].toUpperCase()}</div>
                              }
                              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{log.admin.name || log.admin.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
                              <span>{ACTION_ICONS[log.action] || "⚙️"}</span>
                              <span>{(t as any)(`admin.audit.actions.${log.action}`, log.action)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {log.targetType && log.targetId && (
                              <span className="font-mono">{log.targetType} #{log.targetId}</span>
                            )}
                            {log.details && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-[200px] truncate">
                                {(log.details as any).email || (log.details as any).reason || ""}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pagination page={auditPage} total={totalAuditPages} onPage={setAuditPage} />
          </div>
        )}

        {/* ─── ANALYTICS ──────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          analyticsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">

              {/* PDF Downloads */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Отчёт: Пользователи", url: "/reports/admin/users", file: "users.pdf" },
                  { label: "Отчёт: Бронирования", url: "/reports/admin/bookings", file: "bookings.pdf" },
                  { label: "Отчёт: Объявления", url: "/reports/admin/properties", file: "properties.pdf" },
                  { label: "Отчёт: Выручка", url: "/reports/admin/revenue", file: "revenue.pdf" },
                ].map(r => (
                  <button key={r.url} onClick={() => downloadPdf(r.url, r.file)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-2xl hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-400 transition shadow-sm">
                    <Download className="w-4 h-4" />{r.label}
                  </button>
                ))}
              </div>

              {/* Users per month */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />Регистрации пользователей по месяцам
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics.monthlyUsers} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, "Пользователи"]} />
                    <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="url(#gUsers)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bookings + Revenue per month */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-500" />Бронирования и доход по месяцам
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics.monthlyBookings} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number, name: string) => name === "revenue" ? [`${v.toLocaleString()} ₸`, "Доход"] : [v, "Бронирований"]} />
                    <Legend formatter={(v) => v === "bookings" ? "Бронирований" : "Доход (₸)"} />
                    <Area yAxisId="left" type="monotone" dataKey="bookings" stroke="#8b5cf6" fill="url(#gBook)" strokeWidth={2} dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#f43f5e" fill="url(#gRev)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top cities */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <Home className="w-4 h-4 text-emerald-500" />Топ городов по бронированиям
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.topCities} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => [v, "Бронирований"]} />
                    <Bar dataKey="bookings" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top 10 properties table */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />Топ-10 объявлений
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <th className="pb-3 font-semibold w-8">#</th>
                        <th className="pb-3 font-semibold">Объявление</th>
                        <th className="pb-3 font-semibold">Город</th>
                        <th className="pb-3 font-semibold text-right">Просмотры</th>
                        <th className="pb-3 font-semibold text-right">Брон.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {analytics.top10.map((p, i) => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="py-3 pr-3">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                              i === 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" :
                              i === 1 ? "bg-gray-100 dark:bg-gray-800 text-gray-500" :
                              i === 2 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600" :
                              "bg-gray-50 dark:bg-gray-800/50 text-gray-400"
                            }`}>{i + 1}</span>
                          </td>
                          <td className="py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{p.title}</td>
                          <td className="py-3 text-gray-500 dark:text-gray-400">{p.city}</td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-400">{p.viewCount.toLocaleString()}</td>
                          <td className="py-3 text-right font-bold text-gray-900 dark:text-white">{p.bookings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-24 text-gray-400">Нет данных</div>
          )
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-modal animate-slide-up border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('admin.moderation.rejectModal.title')}</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">«{rejectModal.title}»</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('admin.moderation.rejectModal.placeholder')}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 resize-none mb-4 text-sm transition-all placeholder:text-gray-400"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                {t('admin.moderation.rejectModal.cancel')}
              </button>
              <button onClick={handleReject} disabled={moderatingId === rejectModal.id}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-sm transition disabled:opacity-50">
                {moderatingId === rejectModal.id ? t('common.loading') : t('admin.moderation.rejectModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
