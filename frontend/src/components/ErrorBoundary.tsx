import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Ловит ошибки рендера React (то, что иначе увидел бы белый экран без объяснений)
 * и показывает понятную страницу вместо краша всего приложения.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Что-то пошло не так</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Приложение столкнулось с непредвиденной ошибкой.
          </p>
          {import.meta.env.DEV && (
            <p className="text-xs font-mono text-red-500 mt-2 mb-4 break-words bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">
              {this.state.error.message}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-semibold text-sm hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Обновить страницу
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-semibold text-sm text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              <Home className="w-4 h-4" /> На главную
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
