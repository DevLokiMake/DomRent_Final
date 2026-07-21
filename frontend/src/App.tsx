import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Shield, Home, ChevronDown, LogOut, Calendar, Heart, Plus, User, Menu, X, Sun, Moon, Globe, TrendingUp } from "lucide-react";
import HomePage from "./pages/HomePage";
import { RegisterPage } from './pages/RegisterPage';
import LoginPage from "./pages/LoginPage";
import PropertyPage from "./pages/PropertyPage";
import BookingsPage from "./pages/BookingsPage";
import FavoritesPage from "./pages/FavoritesPage";
import CreatePropertyPage from "./pages/CreatePropertyPage";
import ChatPage from "./pages/ChatPage";
import AdminPage from "./pages/AdminPage";
import LandlordStatisticsPage from "./pages/LandlordStatisticsPage";
import MarketStatsPage from "./pages/MarketStatsPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ErrorBoundary from "./components/ErrorBoundary";
import ConnectionBanner from "./components/ConnectionBanner";
import NotFoundPage from "./pages/NotFoundPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import axiosInstance from "./api/axios";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  entityId?: number | null;
}

// ─── Language Switcher ────────────────────────────────────────────────────────
const LangSwitcher = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const langs = [
    { code: 'ru', label: 'РУС', full: 'Русский' },
    { code: 'kz', label: 'ҚАЗ', full: 'Қазақша' },
    { code: 'en', label: 'ENG', full: 'English' },
  ];

  const current = langs.find(l => l.code === i18n.language) || langs[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('domrent_lang', code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
        aria-label="Language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-36 bg-white dark:bg-gray-800 rounded-2xl shadow-modal border border-gray-100 dark:border-gray-700 py-1.5 z-50 animate-slide-up">
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-between ${
                i18n.language === l.code
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span>{l.full}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Светлый режим' : 'Тёмный режим'}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <Sun className={`w-3.5 h-3.5 transition-colors ${!isDark ? 'text-amber-500' : 'text-gray-400'}`} />
      {/* pill */}
      <div className="relative w-8 h-4 rounded-full bg-gray-200 dark:bg-brand-500 transition-colors">
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${isDark ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <Moon className={`w-3.5 h-3.5 transition-colors ${isDark ? 'text-indigo-400' : 'text-gray-400'}`} />
    </button>
  );
};

// ─── Notifications Bell ───────────────────────────────────────────────────────
const NotificationsBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await axiosInstance.get("/notifications");
      const list: Notification[] = res.data.notifications || [];
      setNotifications(list);
      setUnread(list.filter(n => !n.isRead).length);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      await axiosInstance.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* silent */ }
  };

  const markOneRead = async (id: number) => {
    try {
      await axiosInstance.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleNotifClick = (n: Notification) => {
    markOneRead(n.id);
    setOpen(false);
    if (n.entityId && ["BOOKING_NEW", "BOOKING_CONFIRMED", "BOOKING_CANCELLED"].includes(n.type)) navigate("/bookings");
    else if (n.entityId && n.type === "MESSAGE_NEW") navigate(`/chat/${n.entityId}`);
    else if (n.entityId && n.type === "REVIEW_NEW") navigate(`/property/${n.entityId}`);
  };

  const TYPE_ICON: Record<string, string> = {
    BOOKING_NEW: "Бронь", BOOKING_CONFIRMED: "OK", BOOKING_CANCELLED: "Отмена",
    MESSAGE_NEW: "Чат", REVIEW_NEW: "Отзыв", PROPERTY_APPROVED: "OK", PROPERTY_REJECTED: "Отказ",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Уведомления"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-100 dark:border-gray-700 z-50 animate-slide-up overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Уведомления</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium">
                Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Уведомлений нет</p>
            ) : (
              notifications.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3 transition flex gap-3 ${
                    !n.isRead
                      ? "bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="text-xs font-bold flex-shrink-0 mt-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">{TYPE_ICON[n.type] || "—"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString("ru-RU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // Avatar display: use uploaded avatar or initials
  const avatarUrl = (user as any)?.avatar;
  const initials = (user?.name || user?.email || "?")[0].toUpperCase();

  const roleLabel = {
    ADMIN: t('admin.users.roles.ADMIN'),
    LANDLORD: t('admin.users.roles.LANDLORD'),
    USER: t('admin.users.roles.USER'),
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center shadow-sm">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">DomRent</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive("/")
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t('nav.home')}
            </Link>
            <Link
              to="/market-stats"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive("/market-stats")
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {t('nav.marketStats')}
            </Link>
            {user && (
              <Link
                to="/bookings"
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive("/bookings")
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {t('nav.bookings')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Language switcher */}
            <LangSwitcher />

            {/* Theme toggle */}
            <ThemeToggle />

            {user ? (
              <>
                {user.role === 'LANDLORD' && (
                  <Link
                    to="/create-property"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-brand-500 hover:bg-gray-700 dark:hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden lg:inline">{t('nav.createListing')}</span>
                  </Link>
                )}

                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden lg:inline">{t('nav.admin')}</span>
                  </Link>
                )}

                <Link
                  to="/favorites"
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={t('nav.favorites')}
                >
                  <Heart className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </Link>

                <NotificationsBell />

                {/* User menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(o => !o)}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:border-gray-600 transition-all ml-1 bg-white dark:bg-gray-800"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{initials}</span>
                      </div>
                    )}
                    <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[90px] truncate">
                      {user.name || user.email.split("@")[0]}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-100 dark:border-gray-700 py-1.5 z-50 animate-slide-up">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        {avatarUrl && (
                          <img src={avatarUrl} alt="avatar" className="w-10 h-10 rounded-2xl object-cover mb-2" />
                        )}
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user.name || "Пользователь"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.role === "ADMIN" ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" :
                          user.role === "LANDLORD" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                          "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}>
                          {roleLabel[user.role as keyof typeof roleLabel] || user.role}
                        </span>
                      </div>
                      <div className="py-1">
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <User className="w-4 h-4 text-gray-400" />{t('nav.profile')}
                        </Link>
                        <Link to="/bookings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Calendar className="w-4 h-4 text-gray-400" />{t('nav.bookings')}
                        </Link>
                        <Link to="/favorites" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Heart className="w-4 h-4 text-gray-400" />{t('nav.favorites')}
                        </Link>
                        {user.role === 'LANDLORD' && (
                          <>
                            <Link to="/create-property" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <Plus className="w-4 h-4 text-gray-400" />{t('nav.createListing')}
                            </Link>
                            <Link to="/landlord/statistics" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <TrendingUp className="w-4 h-4 text-gray-400" />Статистика
                            </Link>
                          </>
                        )}
                        {user.role === 'ADMIN' && (
                          <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors font-medium">
                            <Shield className="w-4 h-4 text-violet-500" />{t('nav.admin')}
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                        <button
                          onClick={() => { logout(); navigate('/'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />{t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-1"
            >
              {menuOpen
                ? <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                : <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              }
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 py-3 space-y-1 animate-slide-up">
            <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Home className="w-4 h-4 text-gray-400" />{t('nav.home')}
            </Link>
            <Link to="/market-stats" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              <TrendingUp className="w-4 h-4 text-gray-400" />{t('nav.marketStats')}
            </Link>
            {user && (
              <>
                <Link to="/bookings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Calendar className="w-4 h-4 text-gray-400" />{t('nav.bookings')}
                </Link>
                <Link to="/favorites" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Heart className="w-4 h-4 text-gray-400" />{t('nav.favorites')}
                </Link>
                <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <User className="w-4 h-4 text-gray-400" />{t('nav.profile')}
                </Link>
                {user.role === 'LANDLORD' && (
                  <Link to="/create-property" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Plus className="w-4 h-4 text-gray-400" />{t('nav.createListing')}
                  </Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30">
                    <Shield className="w-4 h-4 text-violet-500" />{t('nav.admin')}
                  </Link>
                )}
                <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                  <LogOut className="w-4 h-4" />{t('nav.logout')}
                </button>
              </>
            )}
            {!user && (
              <>
                <Link to="/login" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <User className="w-4 h-4 text-gray-400" />{t('nav.login')}
                </Link>
                <Link to="/register" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 mx-1">
                  <Plus className="w-4 h-4" />{t('nav.register')}
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-200">
          <ConnectionBanner />
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/property/:id" element={<PropertyPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/create-property" element={<CreatePropertyPage />} />
              <Route path="/chat/:bookingId" element={<ChatPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/landlord/statistics" element={<LandlordStatisticsPage />} />
              <Route path="/market-stats" element={<MarketStatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export { RegisterPage };
export { App };
