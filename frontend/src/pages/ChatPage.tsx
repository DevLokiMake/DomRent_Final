import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Loader, AlertCircle, Check, CheckCheck } from "lucide-react";
import axiosInstance from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface Message {
  id: number;
  text: string;
  senderId: number;
  bookingId: number;
  isRead: boolean;
  createdAt: string;
  sender: { id: number; name: string | null; email: string };
}

interface BookingInfo {
  id: number;
  property: {
    id: number; title: string; coverImage?: string | null; images: string[];
  };
  user: { id: number; name: string | null; email: string };
  userId: number;
}

const ChatPage = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await axiosInstance.get(`/messages/${bookingId}`);
      setMessages(res.data.messages || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [msgRes, bookRes] = await Promise.all([
          axiosInstance.get(`/messages/${bookingId}`),
          axiosInstance.get(`/bookings/${bookingId}`),
        ]);
        setMessages(msgRes.data.messages || []);
        setBooking(bookRes.data.booking || null);
      } catch (err: unknown) {
        setError((err as any).response?.data?.error || "Не удалось загрузить чат");
      } finally {
        setLoading(false);
      }
    };
    init();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const trimmed = text.trim();
    setText("");
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "44px";
    try {
      const res = await axiosInstance.post(`/messages/${bookingId}`, { text: trimmed });
      setMessages(prev => [...prev, res.data.message]);
    } catch (err: unknown) {
      alert((err as any).response?.data?.error || "Ошибка отправки");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Сегодня";
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach(msg => {
    const d = new Date(msg.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  });

  if (loading) return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-white dark:bg-gray-950">
      <Loader className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (error) return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-white dark:bg-gray-950">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Ошибка загрузки</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Назад</button>
      </div>
    </div>
  );

  const interlocutorName = booking
    ? (booking.userId === user?.id ? "Арендодатель" : (booking.user?.name || booking.user?.email))
    : "Чат";
  const coverImg = booking?.property?.coverImage || booking?.property?.images?.[0];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#f8fafc] dark:bg-gray-950 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-nav flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          {coverImg && (
            <img src={coverImg} alt="" className="w-10 h-10 rounded-2xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{booking?.property?.title || "Объект"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{interlocutorName}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-1">
          {grouped.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-5 h-5 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">Сообщений пока нет</p>
              <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Начните переписку!</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium flex-shrink-0">
                    {formatDate(group.msgs[0].createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {group.msgs.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  const prevMsg = group.msgs[i - 1];
                  const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
                      {!isMe && (
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 mr-2 self-end mb-0.5 ${showAvatar ? "bg-gray-200 flex items-center justify-center" : "opacity-0"}`}>
                          {showAvatar && (
                            <span className="text-xs font-bold text-gray-500">
                              {(msg.sender?.name || msg.sender?.email || "?")[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}

                      <div className={`max-w-[72%] group`}>
                        {!isMe && showAvatar && (
                          <p className="text-xs text-gray-400 mb-1 ml-1">{msg.sender?.name || msg.sender?.email}</p>
                        )}
                        <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                          isMe
                            ? "bg-gray-900 text-white rounded-2xl rounded-br-sm"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700"
                        }`}>
                          {msg.text}
                        </div>
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            msg.isRead
                              ? <CheckCheck className="w-3 h-3 text-blue-400" />
                              : <Check className="w-3 h-3 text-gray-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 focus:bg-white dark:focus:bg-gray-700 transition-all resize-none leading-relaxed placeholder:text-gray-400"
              style={{ height: "44px", maxHeight: "120px" }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-11 h-11 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-30 text-white dark:text-gray-900 rounded-2xl flex items-center justify-center transition-all flex-shrink-0"
            >
              {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
