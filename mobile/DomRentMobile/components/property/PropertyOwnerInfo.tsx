import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface OwnerInfo {
  id: number;
  name?: string;
  email: string;
  phone?: string;
}

export interface PropertyOwnerInfoProps {
  description: string;
  owner?: OwnerInfo;
}

export function PropertyOwnerInfo({ description, owner }: PropertyOwnerInfoProps) {
  const scheme = useColorScheme() ?? 'light';
  const C = Colors[scheme];
  return (
    <ThemedView style={styles.container}>
      {/* Раздел описания */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Описание
        </ThemedText>
        <ThemedText style={styles.description}>
          {description || 'Описание отсутствует'}
        </ThemedText>
      </View>

      {/* Раздел владельца */}
      {owner && (
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Контактное лицо
          </ThemedText>

          <View style={[styles.ownerCard, { backgroundColor: C.navItemBg }]}>
            <View style={styles.ownerAvatar}>
              <ThemedText style={styles.ownerInitial}>
                {owner.name?.charAt(0) || owner.email.charAt(0).toUpperCase()}
              </ThemedText>
            </View>

            <View style={styles.ownerInfo}>
              {owner.name && <ThemedText type="defaultSemiBold">{owner.name}</ThemedText>}
              <ThemedText style={styles.ownerEmail}>{owner.email}</ThemedText>
              {owner.phone && <ThemedText style={styles.ownerPhone}>{owner.phone}</ThemedText>}
            </View>
          </View>
        </View>
      )}
    </ThemedView>
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
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    gap: 12,
  },
  ownerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0a84ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  ownerInfo: {
    flex: 1,
    gap: 4,
  },
  ownerEmail: {
    fontSize: 12,
    color: '#666',
  },
  ownerPhone: {
    fontSize: 12,
    color: '#0a84ff',
    fontWeight: '500',
  },
});
