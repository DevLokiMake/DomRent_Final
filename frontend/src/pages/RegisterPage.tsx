import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Home, Loader, Users, Building2 } from 'lucide-react';
import api from '../api/axios';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'USER' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        ...(formData.name.trim() ? { name: formData.name.trim() } : {}),
      };
      await api.post('/auth/register', payload);
      navigate('/login', { state: { message: 'Регистрация успешна! Теперь войдите.' } });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; details?: { message: string }[] } } };
      const details = axiosError.response?.data?.details;
      setError(
        details?.map(d => d.message).join(', ') ||
        axiosError.response?.data?.error ||
        'Ошибка регистрации'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-white dark:bg-gray-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">DomRent</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Создать аккаунт</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Присоединяйтесь к тысячам пользователей</p>

        {error && (
          <div className="mb-5 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Ваше имя <span className="text-gray-400 dark:text-gray-500 font-normal">(необязательно)</span>
            </label>
            <input
              type="text"
              placeholder="Иван Иванов"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Минимум 6 символов"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Кто вы?</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'USER',     label: 'Арендатор',    sub: 'Ищу жильё',    icon: <Users className="w-5 h-5" /> },
                { value: 'LANDLORD', label: 'Арендодатель', sub: 'Сдаю жильё',   icon: <Building2 className="w-5 h-5" /> },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: opt.value })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    formData.role === opt.value
                      ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  {opt.icon}
                  <div className="text-center">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className={`text-xs mt-0.5 ${formData.role === opt.value ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-500'}`}>
                      {opt.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <><Loader className="w-4 h-4 animate-spin" />Создание...</> : "Создать аккаунт"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-semibold text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
};

export { RegisterPage };
