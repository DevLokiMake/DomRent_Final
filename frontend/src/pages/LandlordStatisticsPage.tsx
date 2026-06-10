import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, Home, Calendar, Eye, Star, Heart,
  Loader, Download, ArrowLeft, DollarSign
} from "lucide-react";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface PropertyStat {
  id: number;
  title: string;
  city: string;
  price: number;
  status: string;
  viewCount: number;
  favoritesCount: number;
  bookingsCount: number;
  reviewsCount: number;
  avgRating: number | null;
  revenue: number;
}

interface Summary {
  totalRevenue: number;
  totalBookings: number;
  totalViews: number;
  totalFavorites: number;
  overallRating: number | null;
  bestProperty: { id: number; title: string } | null;
  topCity: string | null;
}

interface MonthlyPoint { month: string; bookings: number; revenue: number; }

interface StatData {
  properties: PropertyStat[];
  summary: Summary;
  monthlyChart: MonthlyPoint[];
}

const SCard = ({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
    <p className="text-2xl font-black text-gray-900 dark:text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Активно", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
  PENDING:  { label: "На модерации", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" },
  REJECTED: { label: "Отклонено", cls: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" },
};

export default function LandlordStatisticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "LANDLORD") navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    axiosInstance.get("/landlord/statistics")
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = (url: string, filename: string) => {
    axiosInstance.get(url, { responseType: "blob" }).then(r => {
      const href = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = href; a.download = filename;
      a.click(); URL.revokeObjectURL(href);
    }).catch(() => alert("Ошибка генерации отчёта"));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 transition-colors">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)}
            className="p-2.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-rose-500" />Статистика объявлений
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Аналитика по вашим объявлениям</p>
          </div>
          {/* PDF buttons */}
          <div className="flex gap-2">
            <button onClick={() => downloadPdf("/reports/landlord/properties", "my-properties.pdf")}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-2xl hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-400 transition shadow-sm">
              <Download className="w-4 h-4" />Объявления PDF
            </button>
            <button onClick={() => downloadPdf("/reports/landlord/bookings", "my-bookings.pdf")}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-2xl hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-400 transition shadow-sm">
              <Download className="w-4 h-4" />Брон. PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !data ? (
          <div className="text-center py-32 text-gray-400">Нет данных</div>
        ) : (
          <div className="space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SCard icon={<DollarSign className="w-5 h-5 text-violet-600" />} label="Общая выручка"
                value={`${data.summary.totalRevenue.toLocaleString()} ₸`} color="bg-violet-50 dark:bg-violet-950/40" />
              <SCard icon={<Calendar className="w-5 h-5 text-blue-600" />} label="Всего бронирований"
                value={data.summary.totalBookings} color="bg-blue-50 dark:bg-blue-950/40" />
              <SCard icon={<Eye className="w-5 h-5 text-emerald-600" />} label="Всего просмотров"
                value={data.summary.totalViews} color="bg-emerald-50 dark:bg-emerald-950/40" />
              <SCard icon={<Heart className="w-5 h-5 text-rose-500" />} label="В избранном"
                value={data.summary.totalFavorites} color="bg-rose-50 dark:bg-rose-950/40" />
            </div>
            {(data.summary.overallRating || data.summary.bestProperty || data.summary.topCity) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.summary.overallRating && (
                  <SCard icon={<Star className="w-5 h-5 text-amber-500" />} label="Средний рейтинг"
                    value={`${data.summary.overallRating.toFixed(1)} / 5`} color="bg-amber-50 dark:bg-amber-950/40" />
                )}
                {data.summary.bestProperty && (
                  <SCard icon={<Home className="w-5 h-5 text-teal-600" />} label="Лучшее объявление"
                    value={data.summary.bestProperty.title} color="bg-teal-50 dark:bg-teal-950/40" />
                )}
                {data.summary.topCity && (
                  <SCard icon={<TrendingUp className="w-5 h-5 text-orange-500" />} label="Топ город"
                    value={data.summary.topCity} color="bg-orange-50 dark:bg-orange-950/40" />
                )}
              </div>
            )}

            {/* Monthly chart */}
            {data.monthlyChart.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />Бронирования по месяцам
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.monthlyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, "Бронирований"]} />
                    <Area type="monotone" dataKey="bookings" stroke="#f43f5e" fill="url(#lGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-property bar chart */}
            {data.properties.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-rose-500" />Бронирования по объявлениям
                </h2>
                <ResponsiveContainer width="100%" height={Math.max(160, data.properties.length * 36)}>
                  <BarChart
                    data={data.properties.map(p => ({
                      name: p.title.length > 20 ? p.title.slice(0, 20) + "…" : p.title,
                      bookings: p.bookingsCount,
                      views: p.viewCount,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="bookings" name="Брон." fill="#f43f5e" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="views" name="Просм." fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Properties table */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Home className="w-4 h-4 text-emerald-500" />Мои объявления
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      {["Объявление", "Статус", "Просм.", "Брон.", "Избр.", "Рейтинг", "Выручка"].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {data.properties.map(p => {
                      const sc = STATUS_LABELS[p.status] || { label: p.status, cls: "bg-gray-100 text-gray-600" };
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition cursor-pointer"
                          onClick={() => navigate(`/property/${p.id}`)}>
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">{p.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.city} · {p.price.toLocaleString()} ₸</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400">{p.viewCount.toLocaleString()}</td>
                          <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">{p.bookingsCount}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400">{p.favoritesCount}</td>
                          <td className="px-4 py-3.5">
                            {p.avgRating ? (
                              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{p.avgRating.toFixed(1)}
                              </span>
                            ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-900 dark:text-white">
                            {p.revenue.toLocaleString()} ₸
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
