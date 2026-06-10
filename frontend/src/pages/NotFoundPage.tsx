import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-[120px] font-black leading-none text-gray-100 dark:text-gray-800 select-none">
          404
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-2 mb-3">
          Страница не найдена
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Такой страницы не существует или она была удалена.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-2xl hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
          >
            <Home className="w-4 h-4" />
            На главную
          </Link>
          <Link
            to="/?search="
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Search className="w-4 h-4" />
            Найти жильё
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
