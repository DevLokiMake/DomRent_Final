import React, { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Save } from 'lucide-react-native';
import { axiosInstance } from '@/api/axios';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface FormData {
  title: string;
  description: string;
  price: string;
  type: string;
  contractType: 'RENT' | 'SALE';
  city: string;
  rooms: string;
  hasWifi: boolean;
  hasParking: boolean;
  petsAllowed: boolean;
}

const PROPERTY_TYPES = [
  { value: 'квартира', label: 'Квартира' },
  { value: 'дом', label: 'Дом' },
  { value: 'комната', label: 'Комната' },
];

const CONTRACT_TYPES = [
  { value: 'RENT' as const, label: 'Аренда' },
  { value: 'SALE' as const, label: 'Продажа' },
];

const DEFAULT_FORM: FormData = {
  title: '', description: '', price: '', type: 'квартира',
  contractType: 'RENT', city: '', rooms: '',
  hasWifi: false, hasParking: false, petsAllowed: false,
};

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  const dynInput = [styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }];
  const dynChip = [styles.chip, { backgroundColor: C.inputBg, borderColor: C.inputBorder }];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);

  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/properties/${id}`)
      .then(r => {
        const p = r.data.property || r.data;
        setForm({
          title: p.title || '',
          description: p.description || '',
          price: String(p.price || ''),
          type: p.type || 'квартира',
          contractType: p.contractType || 'RENT',
          city: p.city?.name || p.city || '',
          rooms: p.rooms ? String(p.rooms) : '',
          hasWifi: !!p.hasWifi,
          hasParking: !!p.hasParking,
          petsAllowed: !!p.petsAllowed,
        });
      })
      .catch(() => Alert.alert('Ошибка', 'Не удалось загрузить объявление'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!isAuthenticated || user?.role !== 'LANDLORD') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.errorText}>Нет доступа</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ThemedText style={styles.backBtnText}>Назад</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }
    if (!form.description.trim()) { Alert.alert('Ошибка', 'Введите описание'); return; }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) {
      Alert.alert('Ошибка', 'Введите корректную цену'); return;
    }
    if (!form.city.trim()) { Alert.alert('Ошибка', 'Введите город'); return; }

    setSaving(true);
    try {
      await axiosInstance.put(`/properties/${id}`, {
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
      });
      Alert.alert('Сохранено', 'Объявление обновлено', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <ChevronLeft size={28} color="#007AFF" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Редактировать</ThemedText>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#007AFF" /> : <Save size={22} color="#007AFF" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <ThemedText style={styles.label}>Название *</ThemedText>
          <TextInput style={dynInput} value={form.title} onChangeText={v => setField('title', v)}
            placeholder="Название объявления" placeholderTextColor="#bbb" />
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Описание *</ThemedText>
          <TextInput style={[dynInput, styles.textarea]} value={form.description}
            onChangeText={v => setField('description', v)} placeholder="Описание..."
            placeholderTextColor="#bbb" multiline numberOfLines={4} textAlignVertical="top" />
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Город *</ThemedText>
          <TextInput style={dynInput} value={form.city} onChangeText={v => setField('city', v)}
            placeholder="Алматы" placeholderTextColor="#bbb" />
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Цена (₸) *</ThemedText>
          <TextInput style={dynInput} value={form.price} onChangeText={v => setField('price', v)}
            placeholder="15000" placeholderTextColor="#bbb" keyboardType="numeric" />
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Количество комнат</ThemedText>
          <TextInput style={dynInput} value={form.rooms} onChangeText={v => setField('rooms', v)}
            placeholder="2" placeholderTextColor="#bbb" keyboardType="numeric" />
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Тип жилья</ThemedText>
          <View style={styles.chips}>
            {PROPERTY_TYPES.map(t => (
              <TouchableOpacity key={t.value}
                style={[dynChip, form.type === t.value && styles.chipActive]}
                onPress={() => setField('type', t.value)}>
                <ThemedText style={[styles.chipText, form.type === t.value && styles.chipTextActive]}>
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Тип сделки</ThemedText>
          <View style={styles.chips}>
            {CONTRACT_TYPES.map(t => (
              <TouchableOpacity key={t.value}
                style={[dynChip, form.contractType === t.value && styles.chipActive]}
                onPress={() => setField('contractType', t.value)}>
                <ThemedText style={[styles.chipText, form.contractType === t.value && styles.chipTextActive]}>
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <ThemedText style={styles.label}>Удобства</ThemedText>
          {[
            { key: 'hasWifi' as const, label: 'Wi-Fi' },
            { key: 'hasParking' as const, label: 'Парковка' },
            { key: 'petsAllowed' as const, label: 'Можно с животными' },
          ].map(a => (
            <View key={a.key} style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>{a.label}</ThemedText>
              <Switch value={form[a.key] as boolean} onValueChange={v => setField(a.key, v)}
                trackColor={{ false: '#ddd', true: '#007AFF' }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <View style={styles.submitContent}>
              <Save size={20} color="#fff" />
              <ThemedText style={styles.submitText}>Сохранить изменения</ThemedText>
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
  saveBtn: { padding: 4 },
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
  submitBtn: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
