import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader, Home, ArrowLeft, Check } from "lucide-react";
import api from "../api/axios";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Ошибка. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Home className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-card border border-gray-100 dark:border-gray-800">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">Письмо отправлено</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Если аккаунт с этим email существует, на него придёт ссылка для сброса пароля. Проверьте папку «Спам».
              </p>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">Забыли пароль?</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Введите email — пришлём ссылку для сброса.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl">
                    <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <><Loader className="w-4 h-4 animate-spin" /> Отправляем...</> : "Отправить ссылку"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          <Link to="/login" className="flex items-center justify-center gap-1.5 font-medium text-gray-700 dark:text-gray-300 hover:text-brand-500 dark:hover:text-brand-400 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
