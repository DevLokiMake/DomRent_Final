import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, Loader, User, Send, CalendarCheck, Moon, Wallet, MapPin, Star, Heart } from "lucide-react";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface MyStats {
  totalBookings: number;
  totalNights: number;
  totalSpent: number;
  favoriteCity: string | null;
  reviewsWritten: number;
  favoritesCount: number;
}

const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, login } = useAuth();

  const [stats, setStats] = useState<MyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get("/stats/my");
        setStats(res.data);
      } catch {
        // тихо игнорируем — статистика необязательный виджет
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);

  const [tgCode, setTgCode] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);

  const handleGenerateTgCode = async () => {
    setTgLoading(true);
    setTgCode(null);
    try {
      const res = await axiosInstance.get("/telegram/generate-code");
      setTgCode(res.data.code);
    } catch {
      alert("Ошибка генерации кода");
    } finally {
      setTgLoading(false);
    }
  };
  const [avatarUrl, setAvatarUrl] = useState<string | null>((user as any)?.avatar || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("images", file);
      const uploadRes = await axiosInstance.post("/upload/images", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url: string = uploadRes.data.urls?.[0];
      if (!url) throw new Error("No URL returned");
      // Save avatar to profile
      const res = await axiosInstance.patch("/auth/me", { avatar: url });
      setAvatarUrl(url);
      // Update auth context
      if (res.data.user) {
        const token = localStorage.getItem("token") || "";
        login(res.data.user, token);
      }
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.error || "Ошибка загрузки фото");
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await axiosInstance.patch("/auth/me", { name: name.trim(), phone: phone.trim() });
      if (res.data.user) {
        const token = localStorage.getItem("token") || "";
        login(res.data.user, token);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || user?.email || "?")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">{t('profile.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">{t('profile.subtitle')}</p>

        {/* Avatar */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.avatar')}</p>
          <div className="flex items-center gap-5">
            {/* Avatar preview */}
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-3xl object-cover" />
              ) : (
                <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{initials}</span>
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center">
                  <Loader className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {user?.name || user?.email}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {avatarUploading ? t('common.loading') : t('profile.changeAvatar')}
              </button>
            </div>
          </div>
        </div>

        {/* My stats */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800 mb-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{t('profile.stats.title')}</p>

          {statsLoading ? (
            <div className="flex justify-center py-6"><Loader className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : !stats || stats.totalBookings === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">{t('profile.stats.empty')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                <CalendarCheck className="w-4 h-4 text-brand-500 mb-1.5" />
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.totalBookings}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.totalBookings')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                <Moon className="w-4 h-4 text-indigo-500 mb-1.5" />
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.totalNights}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.totalNights')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                <Wallet className="w-4 h-4 text-emerald-500 mb-1.5" />
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.totalSpent.toLocaleString()} ₸</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.totalSpent')}</p>
              </div>
              {stats.favoriteCity && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                  <MapPin className="w-4 h-4 text-rose-500 mb-1.5" />
                  <p className="text-lg font-black text-gray-900 dark:text-white">{stats.favoriteCity}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.favoriteCity')}</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                <Star className="w-4 h-4 text-amber-500 mb-1.5" />
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.reviewsWritten}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.reviewsWritten')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3.5">
                <Heart className="w-4 h-4 text-pink-500 mb-1.5" />
                <p className="text-lg font-black text-gray-900 dark:text-white">{stats.favoritesCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.stats.favoritesCount')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Telegram linking */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <Send className="w-5 h-5 text-[#2AABEE]" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Telegram</p>
          </div>

          {(user as any)?.telegramId ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Аккаунт привязан (ID: {(user as any).telegramId})
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Привяжите Telegram для получения уведомлений о бронированиях и статусах объявлений.
              </p>

              {tgCode ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ваш код привязки:</p>
                  <p className="text-2xl font-black tracking-[0.2em] text-gray-900 dark:text-white mb-2">
                    {tgCode}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Отправьте боту: <span className="font-mono">/link {tgCode}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Код действителен 10 минут.</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerateTgCode}
                  disabled={tgLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#2AABEE] hover:bg-[#1a9adb] text-white text-sm font-semibold rounded-2xl transition disabled:opacity-50"
                >
                  {tgLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Привязать Telegram
                </button>
              )}
            </div>
          )}
        </div>

        {/* Profile form */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-card border border-gray-100 dark:border-gray-800">
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('profile.name')}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ваше имя"
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Email (readonly) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('profile.email')}
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-4 py-3.5 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-500 dark:text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('profile.phone')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+7 (777) 000-00-00"
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent transition-all"
              />
            </div>

            {/* Member since */}
            <div className="pt-1 pb-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t('profile.memberSince')}: {new Date((user as any)?.createdAt || Date.now()).toLocaleDateString("ru-RU", {
                  year: "numeric", month: "long", day: "numeric"
                })}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
              }`}
            >
              {saving
                ? <><Loader className="w-4 h-4 animate-spin" />{t('profile.saving')}</>
                : saved
                  ? <><Check className="w-4 h-4" />{t('profile.saved')}</>
                  : t('profile.save')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
