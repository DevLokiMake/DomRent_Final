import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Home, Loader, Check, X } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import type { AuthResponse } from "../types";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get("token") || "";
  const calledRef = useRef(false);

  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>(token ? 'verifying' : 'error');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        const res = await api.post<AuthResponse>('/auth/verify-email', { token });
        login(res.data.user, res.data.token);
        setStatus('done');
        setTimeout(() => navigate('/'), 2000);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        setError(e.response?.data?.error || 'Ссылка недействительна или истекла.');
        setStatus('error');
      }
    })();
  }, [token, login, navigate]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Home className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-card border border-gray-100 dark:border-gray-800 text-center">
          {status === 'verifying' && (
            <>
              <Loader className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-black text-gray-900 dark:text-white mb-1">Подтверждаем email...</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Пожалуйста, подождите.</p>
            </>
          )}

          {status === 'done' && (
            <>
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">Email подтверждён</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Переходим на главную...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">Не удалось подтвердить</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error || 'Ссылка недействительна.'}</p>
              <Link to="/login" className="text-brand-500 font-semibold hover:underline text-sm">
                Вернуться ко входу
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
