import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User, Mail, Smartphone, Heart, Calendar, Plus } from 'lucide-react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isSignedIn, signOut, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleLogin = () => {
    router.push('/login');
  };

  // Если пользователь не авторизован
  if (!isSignedIn) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.emptyContainer}>
          <User size={64} color="#ccc" strokeWidth={1} />
          <ThemedText style={styles.emptyTitle}>Требуется вход</ThemedText>
          <ThemedText style={styles.emptyDescription}>
            Пожалуйста, войдите в свой аккаунт, чтобы просмотреть профиль
          </ThemedText>

          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleLogin}>
            <ThemedText style={styles.buttonText}>Войти</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  // Если пользователь авторизован
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#f43f5e" />
          </View>
          <ThemedText type="title" style={styles.title}>
            Мой профиль
          </ThemedText>
        </View>

        {/* User Info Section */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>Информация профиля</ThemedText>

          {/* Name */}
          <View style={styles.infoItem}>
            <View style={styles.infoItemLabel}>
              <User size={20} color="#f43f5e" />
              <ThemedText style={styles.infoLabel}>Имя</ThemedText>
            </View>
            <ThemedText style={styles.infoValue}>{user?.name || 'Не указано'}</ThemedText>
          </View>

          {/* Email */}
          <View style={styles.infoItem}>
            <View style={styles.infoItemLabel}>
              <Mail size={20} color="#f43f5e" />
              <ThemedText style={styles.infoLabel}>Email</ThemedText>
            </View>
            <ThemedText style={styles.infoValue}>{user?.email}</ThemedText>
          </View>

          {/* Role */}
          <View style={styles.infoItem}>
            <View style={styles.infoItemLabel}>
              <User size={20} color="#f43f5e" />
              <ThemedText style={styles.infoLabel}>Роль</ThemedText>
            </View>
            <ThemedText style={styles.infoValue}>
              {user?.role === 'LANDLORD' ? 'Хозяин' : 'Арендатор'}
            </ThemedText>
          </View>

          {/* Telegram ID */}
          <View style={styles.infoItem}>
            <View style={styles.infoItemLabel}>
              <Smartphone size={20} color="#f43f5e" />
              <ThemedText style={styles.infoLabel}>Telegram ID</ThemedText>
            </View>
            <ThemedText style={styles.infoValue}>
              {user?.telegramId ? `@${user.telegramId}` : 'Не подключено'}
            </ThemedText>
          </View>
        </View>

        {/* Quick nav */}
        <View style={styles.quickNav}>
          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(tabs)/favorites')}>
            <Heart size={22} color="#f43f5e" />
            <ThemedText style={styles.quickNavText}>Избранное</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/(tabs)/bookings')}>
            <Calendar size={22} color="#f43f5e" />
            <ThemedText style={styles.quickNavText}>Бронирования</ThemedText>
          </TouchableOpacity>
          {user?.role === 'LANDLORD' && (
            <TouchableOpacity style={styles.quickNavItem} onPress={() => router.push('/create-property')}>
              <Plus size={22} color="#f43f5e" />
              <ThemedText style={styles.quickNavText}>Добавить</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.button, styles.dangerButton, isLoading && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              <LogOut size={20} color="#fff" />
              <ThemedText style={styles.buttonText}>Выйти из аккаунта</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoItem: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  infoItemLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f43f5e',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 28,
    color: '#000',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#f43f5e',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  quickNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  quickNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f43f5e',
  },
});
