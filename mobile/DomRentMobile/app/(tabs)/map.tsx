import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { axiosInstance } from '@/api/axios';
import { Property } from '@/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MapPin, Navigation, X } from 'lucide-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

// Казахстан по центру
const KZ_INITIAL_REGION: Region = {
  latitude: 48.0196,
  longitude: 66.9237,
  latitudeDelta: 15,
  longitudeDelta: 20,
};

interface PropertyPreview {
  property: Property;
  cityName: string;
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [preview, setPreview] = useState<PropertyPreview | null>(null);

  /**
   * Загружаем все объекты с координатами
   */
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/properties');
      const all: Property[] = res.data.properties || res.data.data || [];
      setProperties(all.filter(p => p.latitude != null && p.longitude != null));
    } catch (err) {
      console.error('Map: fetch properties error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  /**
   * Запрашиваем разрешение и получаем геолокацию пользователя
   */
  const handleMyLocation = async () => {
    try {
      setLocationLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Нет доступа',
          'Разрешите доступ к геолокации в настройках устройства, чтобы найти жилье рядом с вами.',
          [{ text: 'OK' }]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;
      setUserLocation({ lat: latitude, lng: longitude });

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        },
        800
      );
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось получить вашу геолокацию.');
    } finally {
      setLocationLoading(false);
    }
  };

  const getCityName = (city: Property['city']): string => {
    if (!city) return '';
    if (typeof city === 'object') return city.name;
    return city;
  };

  const handleMarkerPress = (property: Property) => {
    setPreview({ property, cityName: getCityName(property.city) });
  };

  const handleOpenProperty = () => {
    if (preview) {
      router.push(`/property/${preview.property.id}`);
      setPreview(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Заголовок */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <ThemedText style={styles.title}>🗺️ Карта объектов</ThemedText>
        <ThemedText style={styles.subtitle}>
          {properties.length > 0 ? `${properties.length} объект(ов) на карте` : 'Загрузка...'}
        </ThemedText>
      </View>

      {/* Карта */}
      <View style={styles.mapWrapper}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Загрузка объектов...</ThemedText>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={KZ_INITIAL_REGION}
            showsUserLocation={userLocation !== null}
            showsMyLocationButton={false}
          >
            {properties.map(p => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
                onPress={() => handleMarkerPress(p)}
                pinColor="#007AFF"
              />
            ))}
          </MapView>
        )}

        {/* Кнопка "Моё местоположение" */}
        <TouchableOpacity
          style={[styles.myLocationBtn, { backgroundColor: C.card }]}
          onPress={handleMyLocation}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Navigation size={22} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Превью выбранного объекта */}
      {preview && (
        <View style={[styles.previewCard, { backgroundColor: C.card }]}>
          {/* Закрыть */}
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreview(null)}>
            <X size={20} color="#666" />
          </TouchableOpacity>

          <View style={styles.previewInner}>
            {/* Картинка */}
            <View style={styles.previewImageBox}>
              {preview.property.images?.[0] ? (
                <Image
                  source={{ uri: preview.property.images[0] }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
                  <MapPin size={28} color="#ccc" />
                </View>
              )}
            </View>

            {/* Инфо */}
            <View style={styles.previewInfo}>
              <ThemedText style={styles.previewTitle} numberOfLines={2}>
                {preview.property.title}
              </ThemedText>
              <ThemedText style={styles.previewCity}>📍 {preview.cityName}</ThemedText>
              <ThemedText style={styles.previewType}>{preview.property.type}</ThemedText>
              <ThemedText style={styles.previewPrice}>
                {preview.property.price.toLocaleString('ru-RU')} ₸
                {preview.property.contractType === 'RENT' ? ' / сутки' : ''}
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity style={styles.previewBtn} onPress={handleOpenProperty}>
            <ThemedText style={styles.previewBtnText}>Открыть объект →</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },

  myLocationBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  /* Превью карточки */
  previewCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  previewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 1,
  },
  previewInner: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  previewImageBox: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  previewImage: {
    width: 90,
    height: 90,
  },
  previewImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  previewCity: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  previewType: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  previewBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
