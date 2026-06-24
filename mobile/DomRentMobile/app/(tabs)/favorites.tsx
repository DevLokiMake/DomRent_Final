import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MapPin, Trash2 } from 'lucide-react-native';
import { axiosInstance } from '@/api/axios';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface FavoriteProperty {
  id: number;
  propertyId: number;
  property: {
    id: number;
    title: string;
    description: string;
    price: number;
    type: string;
    contractType: string;
    images: string[];
    city: string | { id: number; name: string };
  };
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/favorites');
      setFavorites(res.data.favorites || []);
    } catch (err) {
      console.error('Favorites fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchFavorites();
    else setLoading(false);
  }, [isAuthenticated]);

  const handleRemove = async (propertyId: number) => {
    setRemovingId(propertyId);
    try {
      await axiosInstance.post(`/favorites/toggle/${propertyId}`);
      setFavorites(prev => prev.filter(f => f.property.id !== propertyId));
    } catch (err) {
      console.error('Remove favorite error:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const getCityName = (city: string | { id: number; name: string }): string => {
    if (!city) return '';
    if (typeof city === 'object') return city.name;
    return city;
  };

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.centered}>
        <Heart size={64} color="#ccc" strokeWidth={1} />
        <ThemedText style={styles.emptyTitle}>Войдите в аккаунт</ThemedText>
        <ThemedText style={styles.emptyDesc}>Чтобы просматривать избранное</ThemedText>
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

  if (favorites.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <Heart size={64} color="#ccc" strokeWidth={1} />
        <ThemedText style={styles.emptyTitle}>Избранное пусто</ThemedText>
        <ThemedText style={styles.emptyDesc}>Добавляйте объекты нажатием на сердечко</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <ThemedText style={styles.title}>Избранное</ThemedText>
        <ThemedText style={styles.count}>{favorites.length}</ThemedText>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFavorites(); }} tintColor="#007AFF" />
        }
        renderItem={({ item }) => {
          const p = item.property;
          const imageUrl = p.images?.[0];
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: C.card }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/property/${p.id}`)}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]} />
              )}
              <View style={styles.info}>
                <ThemedText style={styles.cardTitle} numberOfLines={2}>{p.title}</ThemedText>
                <View style={styles.cityRow}>
                  <MapPin size={12} color="#888" />
                  <ThemedText style={styles.cityText}>{getCityName(p.city)}</ThemedText>
                </View>
                <ThemedText style={styles.price}>
                  {p.price.toLocaleString('ru-RU')} ₸{p.contractType === 'RENT' ? ' / сут.' : ''}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(p.id)}
                disabled={removingId === p.id}
              >
                {removingId === p.id
                  ? <ActivityIndicator size="small" color="#FF3B30" />
                  : <Trash2 size={18} color="#FF3B30" />
                }
              </TouchableOpacity>
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
  image: { width: 100, height: 100 },
  imagePlaceholder: { backgroundColor: '#f0f0f0' },
  info: { flex: 1, padding: 10, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { fontSize: 12, color: '#888' },
  price: { fontSize: 15, fontWeight: '700', color: '#007AFF', marginTop: 4 },
  removeBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#999', textAlign: 'center' },
  loginBtn: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  loginBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
