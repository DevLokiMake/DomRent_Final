import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';
import { axiosInstance } from '@/api/axios';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';

interface FormData {
  title: string;
  description: string;
  price: string;
  type: 'квартира' | 'дом' | 'комната';
  contractType: 'RENT' | 'SALE';
  city: string;
  rooms: string;
  hasWifi: boolean;
  hasParking: boolean;
  petsAllowed: boolean;
}

const PROPERTY_TYPES: Array<{ value: FormData['type']; label: string }> = [
  { value: 'квартира', label: 'Квартира' },
  { value: 'дом', label: 'Дом' },
  { value: 'комната', label: 'Комната' },
];

const CONTRACT_TYPES: Array<{ value: FormData['contractType']; label: string }> = [
  { value: 'RENT', label: 'Аренда' },
  { value: 'SALE', label: 'Продажа' },
];

export default function CreatePropertyScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    price: '',
    type: 'квартира',
    contractType: 'RENT',
    city: '',
    rooms: '',
    hasWifi: false,
    hasParking: false,
    petsAllowed: false,
  });

  if (!isAuthenticated || user?.role !== 'LANDLORD') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.errorText}>Только арендодатели могут создавать объявления</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ThemedText style={styles.backBtnText}>Назад</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }
    if (!form.description.trim()) { Alert.alert('Ошибка', 'Введите описание'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      Alert.alert('Ошибка', 'Введите корректную цену'); return;
    }
    if (!form.city.trim()) { Alert.alert('Ошибка', 'Введите город'); return; }

    setLoading(true);
    try {
      await axiosInstance.post('/properties', {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        type: form.type,
        contractType: form.contractType,
        city: form.city.trim(),
        rooms: form.rooms ? Number(form.rooms) : null,
        hasWifi: form.hasWifi,
        hasParking: form.hasParking,
        petsAllowed: form.petsAllowed,
        images: [],
      });
      Alert.alert(
        'Объявление отправлено',
        'Ваше объявление отправлено на модерацию. После проверки оно появится в списке.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось создать объявление');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <ChevronLeft size={28} color="#007AFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Новое объявление</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Название *</ThemedText>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={v => setField('title', v)}
            placeholder="Уютная квартира в центре"
            placeholderTextColor="#bbb"
          />
        </View>

        {/* Description */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Описание *</ThemedText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.description}
            onChangeText={v => setField('description', v)}
            placeholder="Подробное описание жилья..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* City */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Город *</ThemedText>
          <TextInput
            style={styles.input}
            value={form.city}
            onChangeText={v => setField('city', v)}
            placeholder="Алматы"
            placeholderTextColor="#bbb"
          />
        </View>

        {/* Price */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Цена (₸) *</ThemedText>
          <TextInput
            style={styles.input}
            value={form.price}
            onChangeText={v => setField('price', v)}
            placeholder="15000"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
          />
        </View>

        {/* Rooms */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Количество комнат</ThemedText>
          <TextInput
            style={styles.input}
            value={form.rooms}
            onChangeText={v => setField('rooms', v)}
            placeholder="2"
            placeholderTextColor="#bbb"
            keyboardType="numeric"
          />
        </View>

        {/* Type */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Тип жилья *</ThemedText>
          <View style={styles.chips}>
            {PROPERTY_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, form.type === t.value && styles.chipActive]}
                onPress={() => setField('type', t.value)}
              >
                <ThemedText style={[styles.chipText, form.type === t.value && styles.chipTextActive]}>
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contract type */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Тип сделки *</ThemedText>
          <View style={styles.chips}>
            {CONTRACT_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, form.contractType === t.value && styles.chipActive]}
                onPress={() => setField('contractType', t.value)}
              >
                <ThemedText style={[styles.chipText, form.contractType === t.value && styles.chipTextActive]}>
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amenities */}
        <View style={styles.group}>
          <ThemedText style={styles.label}>Удобства</ThemedText>
          {[
            { key: 'hasWifi' as const, label: 'Wi-Fi' },
            { key: 'hasParking' as const, label: 'Парковка' },
            { key: 'petsAllowed' as const, label: 'Можно с животными' },
          ].map(a => (
            <View key={a.key} style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>{a.label}</ThemedText>
              <Switch
                value={form[a.key] as boolean}
                onValueChange={v => setField(a.key, v)}
                trackColor={{ false: '#ddd', true: '#007AFF' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Note */}
        <View style={styles.note}>
          <ThemedText style={styles.noteText}>
            После создания объявление будет отправлено на модерацию администратором.
          </ThemedText>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitContent}>
              <Check size={20} color="#fff" />
              <ThemedText style={styles.submitText}>Создать объявление</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  errorText: { fontSize: 16, textAlign: 'center', color: '#666' },
  backBtn: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerBack: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  form: { padding: 16, gap: 20 },
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff', color: '#000' },
  textarea: { minHeight: 100, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  switchLabel: { fontSize: 14, color: '#333' },
  note: { backgroundColor: '#FFF9E6', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  noteText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  submitBtn: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
