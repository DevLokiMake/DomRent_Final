import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { MapPin, Heart, Armchair, Home, DoorOpen } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { City } from '@/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export interface PropertyHeaderProps {
  title: string;
  city?: City;
  type: string;
  price: number;
  contractType?: 'RENT' | 'SALE';
  isFavorited: boolean;
  onToggleFavorite: () => void;
}

export function PropertyHeader({
  title,
  city,
  type,
  price,
  contractType = 'RENT',
  isFavorited,
  onToggleFavorite,
}: PropertyHeaderProps) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const formattedPrice = price.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const getTypeIcon = () => {
    switch (type) {
      case 'квартира':
        return <Armchair size={20} color="#0a84ff" />;
      case 'дом':
        return <Home size={20} color="#0a84ff" />;
      case 'комната':
        return <DoorOpen size={20} color="#0a84ff" />;
      default:
        return <Home size={20} color="#0a84ff" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'квартира':
        return 'Квартира';
      case 'дом':
        return 'Дом';
      case 'комната':
        return 'Комната';
      default:
        return type;
    }
  };

  const getPriceLabel = () => {
    return contractType === 'RENT' ? 'за ночь' : 'цена';
  };

  return (
    <ThemedView style={styles.container}>
      {/* Цена и кнопка избранного */}
      <View style={styles.priceSection}>
        <View style={styles.priceContainer}>
          <ThemedText type="title" style={styles.price}>
            {formattedPrice} ₸
          </ThemedText>
          <ThemedText style={styles.priceLabel}>{getPriceLabel()}</ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.favoriteButton, { backgroundColor: C.avatarBg }, isFavorited && styles.favoriteButtonActive]}
          onPress={onToggleFavorite}>
          <Heart
            size={24}
            color={isFavorited ? '#ff3b30' : '#ccc'}
            fill={isFavorited ? '#ff3b30' : 'none'}
          />
        </TouchableOpacity>
      </View>

      {/* Название */}
      <ThemedText type="title" style={styles.title}>
        {title}
      </ThemedText>

      {/* Местоположение и тип */}
      <View style={[styles.infoRow, { borderBottomColor: C.border }]}>
        <View style={styles.infoItem}>
          <MapPin size={20} color="#0a84ff" />
          <ThemedText style={styles.infoText}>{city?.name || 'Город не указан'}</ThemedText>
        </View>

        <View style={styles.infoItem}>
          {getTypeIcon()}
          <ThemedText style={styles.infoText}>{getTypeLabel()}</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  priceContainer: {
    flex: 1,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0a84ff',
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: '#ffe0e6',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
