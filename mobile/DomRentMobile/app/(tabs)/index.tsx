import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { axiosInstance } from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import { Property } from '@/types';

const BRAND = '#f43f5e';

function cityName(city: any): string {
  if (!city) return '';
  if (typeof city === 'string') return city;
  return city?.name ?? '';
}

interface PropertyCardProps {
  item: Property;
  isFavorited: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ item, isFavorited, onPress, onToggleFavorite }) => {
  const price = item.price.toLocaleString('ru-RU', { minimumFractionDigits: 0 });
  const priceLabel = item.contractType === 'RENT' ? `${price} ₸/сут` : `${price} ₸`;
  const badge = item.contractType === 'RENT' ? 'Аренда' : 'Продажа';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: item.coverImage || item.images?.[0] || 'https://placehold.co/400x240/f1f5f9/94a3b8?text=No+image' }}
          style={styles.image}
          contentFit="cover"
        />
        <View style={[styles.badge, item.contractType === 'RENT' ? styles.badgeRent : styles.badgeSale]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
        <TouchableOpacity style={styles.heartBtn} onPress={onToggleFavorite} hitSlop={8}>
          <Heart size={20} color={isFavorited ? BRAND : '#fff'} fill={isFavorited ? BRAND : 'transparent'} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <ThemedText style={styles.cardTitle} numberOfLines={2}>{item.title}</ThemedText>
        <View style={styles.row}>
          <MapPin size={14} color="#94a3b8" />
          <ThemedText style={styles.cardCity}>{cityName(item.city)}</ThemedText>
          <ThemedText style={styles.dot}>·</ThemedText>
          <ThemedText style={styles.cardType}>{item.type}</ThemedText>
        </View>
        <ThemedText style={styles.cardPrice}>{priceLabel}</ThemedText>
      </View>
    </TouchableOpacity>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = async () => {
    try {
      setError(null);
      const res = await axiosInstance.get('/properties');
      const data = res.data?.properties || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setProperties(data);
    } catch (err) {
      setError('Не удалось загрузить объекты');
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFavorites = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axiosInstance.get('/favorites');
      const ids = (res.data?.favorites || []).map((f: any) => f.propertyId ?? f.id);
      setFavorites(new Set<number>(ids));
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchProperties();
    fetchFavorites();
  }, [isAuthenticated]);

  const toggleFavorite = async (id: number) => {
    if (!isAuthenticated) { router.push('/login'); return; }
    try {
      await axiosInstance.post(`/favorites/toggle/${id}`);
      setFavorites(prev => {
        const s = new Set(prev);
        s.has(id) ? s.delete(id) : s.add(id);
        return s;
      });
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
        <ThemedText style={styles.loadingText}>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity onPress={() => { setLoading(true); fetchProperties(); }} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Повторить</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <View style={styles.headerBar}>
        <ThemedText style={styles.headerTitle}>DomRent</ThemedText>
        <ThemedText style={styles.headerSub}>Найдите своё жильё</ThemedText>
      </View>
      <FlatList
        data={properties}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <PropertyCard
            item={item}
            isFavorited={favorites.has(item.id)}
            onPress={() => router.push(`/property/${item.id}`)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <ThemedText style={styles.emptyText}>Объектов пока нет</ThemedText>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProperties(); fetchFavorites(); }} tintColor={BRAND} />}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: BRAND },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  list: { padding: 16, gap: 16, paddingBottom: 32 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 210, backgroundColor: '#f1f5f9' },
  badge: {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRent: { backgroundColor: '#10b981' },
  badgeSale: { backgroundColor: '#6366f1' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heartBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: 12, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardCity: { fontSize: 13, color: '#64748b' },
  dot: { fontSize: 13, color: '#cbd5e1' },
  cardType: { fontSize: 13, color: '#64748b' },
  cardPrice: { fontSize: 17, fontWeight: '700', color: BRAND, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#94a3b8' },
  errorText: { fontSize: 14, color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: BRAND, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptyText: { fontSize: 15, color: '#94a3b8' },
});
