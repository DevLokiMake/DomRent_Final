import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Глобальный баннер: показывается, когда API недоступен (см. api/axios.ts,
 * событие 'domrent:connectivity') или когда браузер сам сообщает об отсутствии сети.
 * Не блокирует работу с уже загруженным контентом — просто информирует о причине.
 */
const ConnectionBanner = () => {
  const [down, setDown] = useState(!navigator.onLine);
  const [reason, setReason] = useState<string>('Нет подключения к интернету.');

  useEffect(() => {
    const handleConnectivity = (e: Event) => {
      const detail = (e as CustomEvent<{ down: boolean; reason?: string }>).detail;
      setDown(detail.down);
      if (detail.reason) setReason(detail.reason);
    };
    const handleOffline = () => { setDown(true); setReason('Нет подключения к интернету.'); };
    const handleOnline = () => setDown(false);

    window.addEventListener('domrent:connectivity', handleConnectivity);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('domrent:connectivity', handleConnectivity);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!down) return null;

  return (
    <div className="sticky top-0 z-[100] bg-red-600 text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{reason}</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Повторить
        </button>
      </div>
    </div>
  );
};

export default ConnectionBanner;
