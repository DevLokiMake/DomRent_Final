import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, MapPin, Clock } from 'lucide-react-native';
import { axiosInstance } from '@/api/axios';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';

type BookingStatus = 'PENDING' | 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface Booking {
  id: number;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: BookingStatus;
  property?: {
    id: number;
    title: string;
    city: string | { id: number; name: string };
    images: string[];
  };
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Ожидает подтверждения',
  UPCOMING: 'Предстоящее',
  ACTIVE: 'Активное',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING: '#F59E0B',
  UPCOMING: '#3B82F6',
  ACTIVE: '#10B981',
  COMPLETED: '#6B7280',
  CANCELLED: '#EF4444',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const calcNights = (start: string, end: string) =>
  Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);

export default function BookingsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/bookings/my');
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error('Bookings fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchBookings();
    else setLoading(false);
  }, [isAuthenticated]);

  const getCityName = (city?: string | { id: number; name: string }): string => {
    if (!city) return '';
    if (typeof city === 'object') return city.name;
    return city;
  };

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.centered}>
        <Calendar size={64} color="#ccc" strokeWidth={1} />
        <ThemedText style={styles.emptyTitle}>Войдите в аккаунт</ThemedText>
        <ThemedText style={styles.emptyDesc}>Чтобы видеть свои бронирования</ThemedText>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
          <ThemedText style={styles.loginBtnText}>Войти</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </ThemedView>
    );
  }

  if (bookings.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <Calendar size={64} color="#ccc" strokeWidth={1} />
        <ThemedText style={styles.emptyTitle}>Нет бронирований</ThemedText>
        <ThemedText style={styles.emptyDesc}>Забронируйте жильё и оно появится здесь</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Мои бронирования</ThemedText>
        <ThemedText style={styles.count}>{bookings.length}</ThemedText>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} tintColor="#007AFF" />
        }
        renderItem={({ item }) => {
          const nights = calcNights(item.startDate, item.endDate);
          const cityName = getCityName(item.property?.city);
          const statusColor = STATUS_COLOR[item.status];

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/property/${item.property?.id}`)}
            >
              {/* Status badge */}
              <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <ThemedText style={styles.cardTitle} numberOfLines={2}>
                    {item.property?.title || 'Объект'}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                    <ThemedText style={[styles.badgeText, { color: statusColor }]}>
                      {STATUS_LABEL[item.status]}
                    </ThemedText>
                  </View>
                </View>

                {cityName ? (
                  <View style={styles.row}>
                    <MapPin size={12} color="#888" />
                    <ThemedText style={styles.metaText}>{cityName}</ThemedText>
                  </View>
                ) : null}

                <View style={styles.row}>
                  <Calendar size={12} color="#888" />
                  <ThemedText style={styles.metaText}>
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </ThemedText>
                </View>

                <View style={styles.row}>
                  <Clock size={12} color="#888" />
                  <ThemedText style={styles.metaText}>{nights} ночей</ThemedText>
                </View>

                <View style={styles.priceRow}>
                  <ThemedText style={styles.priceLabel}>Итого</ThemedText>
                  <ThemedText style={styles.price}>{item.totalPrice.toLocaleString('ru-RU')} ₸</ThemedText>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 22, fontWeight: '700', flex: 1 },
  count: { fontSize: 14, color: '#888', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  statusBar: { width: 5 },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#666' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  priceLabel: { fontSize: 12, color: '#888' },
  price: { fontSize: 16, fontWeight: '700', color: '#007AFF' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#999', textAlign: 'center' },
  loginBtn: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
