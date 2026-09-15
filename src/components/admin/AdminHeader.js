// src/components/admin/AdminHeader.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, shadows, gradients } from '../../theme/adminTheme';

const isWeb = Platform.OS === 'web';

export const AdminHeader = ({ 
  title, 
  onRefresh, 
  refreshing, 
  onToggleSidebar,
  isWeb,
  onSearch,
}) => {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (text) => {
    setSearchQuery(text);
    onSearch?.(text);
  };

  return (
    <LinearGradient
      colors={gradients.primary}
      style={styles.header}
    >
      <View style={styles.headerLeft}>
        {!isWeb && (
          <TouchableOpacity onPress={onToggleSidebar} style={styles.menuButton}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        {searchVisible ? (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              onBlur={() => {
                if (!searchQuery) setSearchVisible(false);
              }}
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => setSearchVisible(true)}
          >
            <Text style={styles.iconText}>🔍</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={onRefresh}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.iconText}>⟳</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconText}>🔔</Text>
          <View style={styles.badge} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconText}>💬</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadows.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    color: colors.surface.default,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.surface.default,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconText: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.danger[500],
    borderWidth: 2,
    borderColor: colors.primary[500],
  },
  searchContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minWidth: 200,
  },
  searchInput: {
    color: colors.surface.default,
    fontSize: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
});