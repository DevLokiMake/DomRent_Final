import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState<'USER' | 'LANDLORD'>('USER');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !passwordConfirm.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не менее 6 символов');
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    try {
      await signup(email, password, name, role);
      // После успешной регистрации переходим на главный экран
      router.replace('/(tabs)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка регистрации';
      Alert.alert('Ошибка регистрации', errorMessage);
    }
  };

  const handleLoginPress = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            DomRent
          </ThemedText>
          <ThemedText style={styles.subtitle}>Создание аккаунта</ThemedText>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name Input */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Имя</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }]}
              placeholder="Ваше имя"
              placeholderTextColor="#999"
              editable={!isLoading}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }]}
              placeholder="your@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              editable={!isLoading}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Пароль</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }]}
              placeholder="Минимум 6 символов"
              placeholderTextColor="#999"
              secureTextEntry
              editable={!isLoading}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Password Confirmation */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Подтверждение пароля</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }]}
              placeholder="Повторите пароль"
              placeholderTextColor="#999"
              secureTextEntry
              editable={!isLoading}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
            />
          </View>

          {/* Role Selection */}
          <View style={styles.roleContainer}>
            <ThemedText style={styles.label}>Роль</ThemedText>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'USER' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('USER')}
                disabled={isLoading}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    role === 'USER' && styles.roleButtonTextActive,
                  ]}>
                  Арендатор
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'LANDLORD' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('LANDLORD')}
                disabled={isLoading}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    role === 'LANDLORD' && styles.roleButtonTextActive,
                  ]}>
                  Хозяин
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Создать аккаунт</ThemedText>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <ThemedText style={styles.loginText}>Уже есть аккаунт? </ThemedText>
            <TouchableOpacity onPress={handleLoginPress} disabled={isLoading}>
              <ThemedText style={styles.loginLink}>Вход</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  roleContainer: {
    gap: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#f43f5e',
    borderColor: '#f43f5e',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#f43f5e',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f43f5e',
  },
});
