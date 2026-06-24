import React from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { Calendar } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PropertyOwner } from '@/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export interface BookingFormProps {
  startDate: string;
  endDate: string;
  totalNights: number;
  totalPrice: number;
  contractType?: 'RENT' | 'SALE';
  owner?: PropertyOwner;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onBooking: () => void;
  isLoading?: boolean;
}

export interface BookingFormActionProps {
  totalNights: number;
  totalPrice: number;
  contractType?: 'RENT' | 'SALE';
  owner?: PropertyOwner;
  onBooking: () => void;
  onContactSeller?: () => void;
  isLoading?: boolean;
}

export function BookingForm({
  startDate,
  endDate,
  totalNights,
  totalPrice,
  contractType = 'RENT',
  owner,
  onStartDateChange,
  onEndDateChange,
  onBooking,
  isLoading = false,
}: BookingFormProps) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const formattedTotalPrice = totalPrice.toLocaleString('ru-RU');

  // Для продажи не показываем форму бронирования
  if (contractType === 'SALE') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Контакты продавца
          </ThemedText>
          
          <View style={styles.ownerInfo}>
            {owner?.name && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Имя:</ThemedText>
                <ThemedText style={styles.infoValue}>{owner.name}</ThemedText>
              </View>
            )}
            {owner?.phone && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Телефон:</ThemedText>
                <ThemedText style={styles.infoValue}>{owner.phone}</ThemedText>
              </View>
            )}
            {owner?.email && (
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Email:</ThemedText>
                <ThemedText style={styles.infoValue}>{owner.email}</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.infoBox}>
            ℹ️ Свяжитесь с продавцом напрямую для обсуждения условий покупки
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Форма для аренды
  return (
    <ThemedView style={styles.container}>
      {/* Раздел выбора дат */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Выберите даты
        </ThemedText>

        {/* Дата заезда */}
        <View style={[styles.dateInputContainer, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
          <View style={styles.dateInputWrapper}>
            <Calendar size={18} color="#0a84ff" />
            <ThemedText style={styles.dateLabel}>Заезд</ThemedText>
          </View>
          <TextInput
            style={[styles.dateInput, { color: C.inputText }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={startDate}
            onChangeText={onStartDateChange}
            keyboardType="default"
          />
        </View>

        {/* Дата выезда */}
        <View style={[styles.dateInputContainer, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
          <View style={styles.dateInputWrapper}>
            <Calendar size={18} color="#0a84ff" />
            <ThemedText style={styles.dateLabel}>Выезд</ThemedText>
          </View>
          <TextInput
            style={[styles.dateInput, { color: C.inputText }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={endDate}
            onChangeText={onEndDateChange}
            keyboardType="default"
          />
        </View>
      </View>

      {/* Информация о стоимости */}
      {startDate && endDate && totalNights > 0 && (
        <View style={[styles.priceBreakdown, { backgroundColor: scheme === 'dark' ? '#1a2a3a' : '#f0f7ff' }]}>
          <View style={styles.priceRow}>
            <ThemedText style={styles.priceRowLabel}>
              {totalNights} {totalNights === 1 ? 'ночь' : 'ночей'}
            </ThemedText>
          </View>

          <View
            style={[
              styles.priceRow,
              styles.totalPriceRow,
              styles.borderTopPrice,
              { borderTopColor: C.inputBorder },
            ]}>
            <ThemedText style={styles.totalLabel}>Итого</ThemedText>
            <ThemedText style={styles.totalPrice}>{formattedTotalPrice} ₸</ThemedText>
          </View>
        </View>
      )}

      {/* Информационное сообщение */}
      <View style={[styles.infoBox, { backgroundColor: scheme === 'dark' ? '#1a2535' : '#e3f2fd' }]}>
        <ThemedText style={[styles.infoText, { color: scheme === 'dark' ? '#90caf9' : '#1976d2' }]}>
          ℹ️ Выберите даты заезда и выезда, чтобы увидеть итоговую стоимость
        </ThemedText>
      </View>
    </ThemedView>
  );
}

export function BookingFormAction({
  totalNights,
  totalPrice,
  contractType = 'RENT',
  owner,
  onBooking,
  onContactSeller,
  isLoading = false,
}: BookingFormActionProps) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const formattedTotalPrice = totalPrice.toLocaleString('ru-RU');

  // Для продажи показываем кнопку связи с продавцом
  if (contractType === 'SALE') {
    const handleContactSeller = () => {
      if (owner?.phone) {
        Alert.alert(
          'Телефон продавца',
          owner.phone,
          [
            { text: 'Закрыть', onPress: () => {} },
          ]
        );
      } else if (owner?.email) {
        Alert.alert(
          'Email продавца',
          owner.email,
          [
            { text: 'Закрыть', onPress: () => {} },
          ]
        );
      } else {
        Alert.alert('Информация', 'Контактная информация продавца недоступна');
      }
      onContactSeller?.();
    };

    return (
      <View style={[styles.actionButtons, { borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[styles.bookingButton, styles.contactButton]}
          onPress={handleContactSeller}
        >
          <ThemedText style={styles.bookingButtonText}>
            📞 Связаться с продавцом
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  // Для аренды показываем кнопку бронирования

  return (
    <View style={[styles.actionButtons, { borderTopColor: C.border }]}>
      <TouchableOpacity
        style={[
          styles.bookingButton,
          (isLoading || totalNights === 0) && styles.bookingButtonDisabled,
        ]}
        onPress={onBooking}
        disabled={isLoading || totalNights === 0}>
        <ThemedText
          style={[
            styles.bookingButtonText,
            (isLoading || totalNights === 0) && styles.bookingButtonTextDisabled,
          ]}>
          {isLoading
            ? 'Загрузка...'
            : totalNights > 0
              ? `Забронировать • ${formattedTotalPrice} ₸`
              : 'Выберите даты'}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateInputContainer: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateInput: {
    fontSize: 14,
    color: '#333',
    minWidth: 120,
    textAlign: 'right',
  },
  priceBreakdown: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  borderTopPrice: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 8,
    paddingTop: 12,
  },
  priceRowLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalPriceRow: {
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a84ff',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#1976d2',
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bookingButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0a84ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookingButtonTextDisabled: {
    color: '#999',
  },
  /* Информация о владельце */
  ownerInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    minWidth: 80,
  },
  infoValue: {
    fontSize: 13,
    color: '#0a84ff',
    flex: 1,
  },
  contactButton: {
    backgroundColor: '#34C759',
  },
});
