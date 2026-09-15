// src/components/admin/AdminDataTable.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { colors, spacing, radius, shadows } from '../../theme/adminTheme';

export const AdminDataTable = ({
  data,
  columns,
  keyExtractor,
  loading,
  emptyMessage = 'No data found',
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  renderRow,
  rowStyle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (text) => {
    setSearchQuery(text);
    onSearch?.(text);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {searchable && (
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.neutral[400]}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>{emptyMessage}</Text>
          {searchQuery && (
            <Text style={styles.emptySubtitle}>Try adjusting your search</Text>
          )}
        </View>
      ) : (
        <>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.headerCell, { width: col.width || 'auto' }]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>

          {/* Table Body */}
          <FlatList
            data={data}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => (
              <View style={[styles.tableRow, rowStyle]}>
                {renderRow(item)}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  centerContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.neutral[500],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
    color: colors.neutral[400],
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[900],
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  clearIcon: {
    fontSize: 14,
    color: colors.neutral[400],
    padding: spacing.xs,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerCell: {
    paddingHorizontal: spacing.sm,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.neutral[400],
  },
});