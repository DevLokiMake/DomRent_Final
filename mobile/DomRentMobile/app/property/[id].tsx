import React from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import PropertyMap from '@/components/PropertyMap';
import { ChevronLeft, Share2 } from 'lucide-react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { usePropertyDetails } from '@/hooks/usePropertyDetails';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import {
  PropertyImageCarousel,
  PropertyHeader,
  PropertyOwnerInfo,
  BookingForm,
  BookingFormAction,
} from '@/components/property';

export default function PropertyDetailScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const {
    property,
    isLoading,
    error,
    isFavorited,
    currentImageIndex,
    startDate,
    endDate,
    totalNights,
    totalPrice,
    setCurrentImageIndex,
    handleToggleFavorite,
    handleBooking,
    setStartDate,
    setEndDate,
  } = usePropertyDetails();

  // Состояние загрузки
  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <ThemedText style={styles.loadingText}>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  // Состояние ошибки
  if (error || !property) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.errorText}>❌ {error || 'Объект не найден'}</ThemedText>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={styles.retryText}>Вернуться</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color="#0a84ff" />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Детали объекта
        </ThemedText>
        <TouchableOpacity style={styles.shareButton}>
          <Share2 size={24} color="#0a84ff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <PropertyImageCarousel
          images={property.images || []}
          currentIndex={currentImageIndex}
          onPrevImage={() =>
            setCurrentImageIndex(
              currentImageIndex === 0 ? (property.images?.length || 1) - 1 : currentImageIndex - 1
            )
          }
          onNextImage={() =>
            setCurrentImageIndex(
              currentImageIndex === (property.images?.length || 1) - 1 ? 0 : currentImageIndex + 1
            )
          }
          onDotPress={setCurrentImageIndex}
        />

        {/* Header Info */}
        <PropertyHeader
          title={property.title}
          city={property.city}
          type={property.type}
          price={property.price}
          contractType={property.contractType}
          isFavorited={isFavorited}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Description & Owner */}
        <PropertyOwnerInfo description={property.description} owner={property.owner} />

        {/* Карта расположения */}
        {property.latitude != null && property.longitude != null && (
          <PropertyMap
            latitude={property.latitude}
            longitude={property.longitude}
            title={property.title}
            city={typeof property.city === 'object' ? property.city?.name : property.city}
          />
        )}

        {/* Booking Form */}
        <BookingForm
          startDate={startDate}
          endDate={endDate}
          totalNights={totalNights}
          totalPrice={totalPrice}
          contractType={property.contractType}
          owner={property.owner}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onBooking={handleBooking}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Booking Action Button */}
      <BookingFormAction
        totalNights={totalNights}
        totalPrice={totalPrice}
        contractType={property.contractType}
        owner={property.owner}
        onBooking={handleBooking}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    marginBottom: 12,
  },
  retryText: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
    marginTop: 8,
  },
  bottomSpacer: {
    height: 20,
  },
});
