import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Filter, X, Heart } from 'lucide-react-native';
import { axiosInstance } from '@/api/axios';
import { Property, City } from '@/types';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface FilterState {
  city: string;
  contractType: '' | 'RENT' | 'SALE';
  type: 'все' | 'квартира' | 'дом' | 'комната';
  minPrice: string;
  maxPrice: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32; // с отступами

export default function ExploreScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const [filters, setFilters] = useState<FilterState>({
    city: '',
    contractType: '',
    type: 'все',
    minPrice: '',
    maxPrice: '',
  });

  const [activeFilters, setActiveFilters] = useState<FilterState>({
    city: '',
    contractType: '',
    type: 'все',
    minPrice: '',
    maxPrice: '',
  });

  /**
   * Загрузить список городов
   */
  const fetchCities = useCallback(async () => {
    try {
      setCitiesLoading(true);
      const response = await axiosInstance.get('/cities');
      const citiesData = response.data.cities || [];
      setCities(Array.isArray(citiesData) ? citiesData : []);
    } catch (err: any) {
      console.error('Error fetching cities:', err);
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  /**
   * Загрузить список избранных
   */
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/favorites');
      const favoritesData = response.data.favorites || [];
      setFavorites(new Set(favoritesData.map((fav: any) => fav.propertyId || fav.id)));
    } catch (err: any) {
      console.warn('Error fetching favorites:', err);
    }
  }, []);

  /**
   * Загрузить объекты с применёнными фильтрами
   */
  const fetchProperties = useCallback(
    async (appliedFilters: FilterState = activeFilters) => {
      try {
        setLoading(true);
        setError(null);

        // Построить query параметры
        const params = new URLSearchParams();
        if (appliedFilters.city) params.append('city', appliedFilters.city);
        if (appliedFilters.contractType) params.append('contractType', appliedFilters.contractType);
        if (appliedFilters.type && appliedFilters.type !== 'все') {
          params.append('type', appliedFilters.type);
        }
        if (appliedFilters.minPrice) {
          params.append('minPrice', appliedFilters.minPrice);
        }
        if (appliedFilters.maxPrice) {
          params.append('maxPrice', appliedFilters.maxPrice);
        }

        const queryString = params.toString();
        const url = queryString ? `/properties?${queryString}` : '/properties';

        const response = await axiosInstance.get(url);

        // Поддержать разные форматы ответа
        const propertiesData = response.data.properties || response.data.data || response.data;
        setProperties(Array.isArray(propertiesData) ? propertiesData : []);
      } catch (err: any) {
        console.error('Error fetching properties:', err);
        setError(err.response?.data?.error || 'Ошибка при загрузке объектов');
      } finally {
        setLoading(false);
      }
    },
    [activeFilters]
  );

  /**
   * Загрузить объекты при инициализации
   */
  useEffect(() => {
    fetchCities();
    fetchFavorites();
    fetchProperties();
  }, []);

  /**
   * Применить фильтры
   */
  const handleApplyFilters = async () => {
    setActiveFilters(filters);
    setShowFilters(false);
    await fetchProperties(filters);
  };

  /**
   * Сбросить фильтры
   */
  const handleResetFilters = async () => {
    const resetFilters: FilterState = {
      city: '',
      contractType: '',
      type: 'все',
      minPrice: '',
      maxPrice: '',
    };
    setFilters(resetFilters);
    setActiveFilters(resetFilters);
    setShowFilters(false);
    await fetchProperties(resetFilters);
  };

  /**
   * Обновить значение фильтра
   */
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * Перейти на экран деталей объекта
   */
  const handlePropertyPress = (propertyId: number) => {
    router.push(`/property/${propertyId}`);
  };

  /**
   * Переключить избранное
   */
  const handleToggleFavorite = async (propertyId: number, e: any) => {
    e?.stopPropagation?.();
    try {
      await axiosInstance.post(`/favorites/toggle/${propertyId}`);
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.has(propertyId) ? newSet.delete(propertyId) : newSet.add(propertyId);
        return newSet;
      });
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
    }
  };

  /**
   * Рендер карточки объекта
   */
  const renderPropertyCard = ({ item }: { item: Property }) => {
    const imageUrl = item.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image';
    const formattedPrice = item.price.toLocaleString('ru-RU');
    const isFavorited = favorites.has(item.id);
    const cityName = typeof item.city === 'object' ? item.city?.name : item.city;

    const getPriceText = () => {
      if (item.contractType === 'RENT') {
        return `${formattedPrice} ₸ / сутки`;
      }
      return `${formattedPrice} ₸`;
    };

    return (
      <TouchableOpacity
        onPress={() => handlePropertyPress(item.id)}
        style={styles.card}
        activeOpacity={0.8}
      >
        {/* Изображение */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
          
          {/* Кнопка избранного */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => handleToggleFavorite(item.id, e)}
          >
            <Heart
              size={24}
              color={isFavorited ? '#ff3b30' : '#fff'}
              fill={isFavorited ? '#ff3b30' : 'none'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {/* Информация */}
        <View style={styles.cardContent}>
          {/* Название */}
          <ThemedText style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </ThemedText>

          {/* Город и Тип */}
          <View style={styles.cardMeta}>
            <ThemedText style={styles.cardMetaText}>📍 {cityName}</ThemedText>
            <ThemedText style={styles.cardMetaText}>•</ThemedText>
            <ThemedText style={styles.cardMetaText}>{item.type}</ThemedText>
          </View>

          {/* Описание */}
          <ThemedText style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </ThemedText>

          {/* Цена */}
          <View style={styles.priceContainer}>
            <ThemedText style={styles.priceText}>
              {getPriceText()}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Рендер пустого состояния
   */
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Search size={64} color="#ccc" strokeWidth={1} />
      <ThemedText style={styles.emptyTitle}>Объектов не найдено</ThemedText>
      <ThemedText style={styles.emptyDescription}>
        Попробуйте изменить параметры поиска
      </ThemedText>
    </View>
  );

  /**
   * Рендер ошибки
   */
  const renderError = () => (
    <View style={styles.errorContainer}>
      <ThemedText style={styles.errorText}>❌ {error}</ThemedText>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => fetchProperties()}
      >
        <ThemedText style={styles.retryButtonText}>Попробовать снова</ThemedText>
      </TouchableOpacity>
    </View>
  );

  /**
   * Рендер загрузки
   */
  if (loading && properties.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Загрузка объектов...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Количество активных фильтров
  const activeFilterCount = [
    activeFilters.city,
    activeFilters.contractType,
    activeFilters.type !== 'все' && activeFilters.type,
    activeFilters.minPrice,
    activeFilters.maxPrice,
  ].filter(Boolean).length;

  return (
    <ThemedView style={styles.container}>
      {/* Заголовок и кнопка фильтров */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>🔍 Поиск объектов</ThemedText>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={styles.filterButton}
        >
          <Filter size={20} color="#fff" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Список объектов или сообщение об ошибке */}
      {error && !loading ? (
        renderError()
      ) : (
        <FlatList
          data={properties}
          renderItem={renderPropertyCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!loading ? renderEmpty() : null}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Модальное окно фильтров */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Заголовок модаля */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Фильтры</ThemedText>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {/* Содержимое фильтров */}
            <ScrollView style={styles.filterList} showsVerticalScrollIndicator={false}>
              {/* Тип сделки */}
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Тип сделки</ThemedText>
                <View style={styles.typeContainer}>
                  {(['', 'RENT', 'SALE'] as const).map((contractType) => (
                    <TouchableOpacity
                      key={contractType}
                      style={[
                        styles.typeButton,
                        filters.contractType === contractType && styles.typeButtonActive,
                      ]}
                      onPress={() => updateFilter('contractType', contractType)}
                    >
                      <ThemedText
                        style={[
                          styles.typeButtonText,
                          filters.contractType === contractType && styles.typeButtonTextActive,
                        ]}
                      >
                        {contractType === '' ? 'Все' : contractType === 'RENT' ? '🏠 Аренда' : '🏷️ Продажа'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Город */}
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Город</ThemedText>
                <View style={styles.pickerContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.citiesScroll}>
                    <TouchableOpacity
                      style={[styles.cityPill, filters.city === '' && styles.cityPillActive]}
                      onPress={() => updateFilter('city', '')}
                    >
                      <ThemedText style={[styles.cityPillText, filters.city === '' && styles.cityPillTextActive]}>Все</ThemedText>
                    </TouchableOpacity>
                    {cities.map((city) => (
                      <TouchableOpacity
                        key={city.id}
                        style={[styles.cityPill, filters.city === city.name && styles.cityPillActive]}
                        onPress={() => updateFilter('city', city.name)}
                      >
                        <ThemedText style={[styles.cityPillText, filters.city === city.name && styles.cityPillTextActive]}>{city.name}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Тип жилья */}
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Тип жилья</ThemedText>
                <View style={styles.typeContainer}>
                  {(['все', 'квартира', 'дом', 'комната'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        filters.type === type && styles.typeButtonActive,
                      ]}
                      onPress={() => updateFilter('type', type)}
                    >
                      <ThemedText
                        style={[
                          styles.typeButtonText,
                          filters.type === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type === 'все'
                          ? 'Все типы'
                          : type === 'квартира'
                            ? '🏢 Квартира'
                            : type === 'дом'
                              ? '🏡 Дом'
                              : '🛏️ Комната'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Цена */}
              <View style={styles.filterGroup}>
                <ThemedText style={styles.filterLabel}>Цена за ночь (₸)</ThemedText>
                <View style={styles.priceInputsContainer}>
                  <TextInput
                    style={[styles.textInput, styles.priceInput]}
                    placeholder="От"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={filters.minPrice}
                    onChangeText={(text) => updateFilter('minPrice', text)}
                  />
                  <ThemedText style={styles.priceSeparator}>—</ThemedText>
                  <TextInput
                    style={[styles.textInput, styles.priceInput]}
                    placeholder="До"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={filters.maxPrice}
                    onChangeText={(text) => updateFilter('maxPrice', text)}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Кнопки действий */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.resetButton]}
                onPress={handleResetFilters}
              >
                <ThemedText style={styles.resetButtonText}>Сбросить</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.applyButton]}
                onPress={handleApplyFilters}
              >
                <ThemedText style={styles.applyButtonText}>Применить</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Заголовок */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  /* Список */
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
  },

  /* Карточка объекта */
  card: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    width: CARD_WIDTH,
    height: 200,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#666',
  },
  cardDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  priceSubtext: {
    fontSize: 12,
    color: '#666',
  },

  /* Пустое состояние */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },

  /* Ошибка */
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  /* Загрузка */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  /* Модаль фильтров */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight: '70%',
  },

  /* Группа фильтра */
  filterGroup: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },

  /* Текстовое поле */
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },

  /* Выбор типа */
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    flex: 1,
    minWidth: '30%',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  /* Выбор города */
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  citiesScroll: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cityPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  cityPillActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  cityPillText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  cityPillTextActive: {
    color: '#fff',
  },

  /* Цена */
  priceInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
  },
  priceSeparator: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 8,
  },

  /* Действия модаля */
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#007AFF',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});


