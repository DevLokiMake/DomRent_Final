import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Loader, AlertCircle, Building2, Home as HomeIcon } from "lucide-react";
import axiosInstance from "../api/axios";

interface PriceIndexEntry {
  cityId: number;
  city: string;
  contractType: "RENT" | "SALE";
  avgPrice: number;
  count: number;
}

const formatPrice = (price: number): string => {
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} млн ₸`;
  }
  if (price >= 1000) return `${Math.round(price / 1000)} тыс ₸`;
  return `${price} ₸`;
};

const MarketStatsPage = () => {
  const [index, setIndex] = useState<PriceIndexEntry[]>([]);
  const [contractType, setContractType] = useState<"RENT" | "SALE">("RENT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/stats/price-index");
        setIndex(res.data.index || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить статистику");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = index
    .filter(e => e.contractType === contractType)
    .sort((a, b) => b.avgPrice - a.avgPrice);

  const hasSale = index.some(e => e.contractType === "SALE");
  const hasRent = index.some(e => e.contractType === "RENT");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-brand-500" />
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Ценовой индекс по городам</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Средняя цена среди объявлений, прошедших модерацию — обновляется по мере появления новых объектов.
      </p>

      {/* Contract type toggle */}
      <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 mb-6">
        {(["RENT", "SALE"] as const).map(ct => (
          <button
            key={ct}
            onClick={() => setContractType(ct)}
            disabled={ct === "RENT" ? !hasRent : !hasSale}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              contractType === ct
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {ct === "RENT" ? <HomeIcon className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            {ct === "RENT" ? "Аренда" : "Продажа"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Пока нет данных для этого типа сделки</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
          <ResponsiveContainer width="100%" height={Math.max(200, filtered.length * 56)}>
            <BarChart
              data={filtered.map(e => ({ name: e.city, avgPrice: e.avgPrice, count: e.count }))}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-800" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatPrice} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
              <Tooltip
                formatter={(value: number, key: string) =>
                  key === "avgPrice" ? [formatPrice(value), "Средняя цена"] : [value, "Объявлений"]
                }
              />
              <Bar dataKey="avgPrice" name="Средняя цена" fill="#f43f5e" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(e => (
              <div key={e.cityId} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{e.city}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(e.avgPrice)}</p>
                <p className="text-xs text-gray-400">{e.count} объявл.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 text-center">
        Историческая динамика цен копится ежедневно начиная с сегодняшнего дня — графики трендов появятся
        по мере накопления данных.
      </p>
    </div>
  );
};

export default MarketStatsPage;
