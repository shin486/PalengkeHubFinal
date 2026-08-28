// src/components/vendor/ProductCard.js
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';

export const ProductCard = ({ product, onToggleAvailability, onEdit, onDelete }) => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete ${product.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(product.id) }
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {/* Product Image */}
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cart-outline" size={30} color={COLORS.text.quaternary} />
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>₱{product.price} / {product.unit}</Text>
          <Text style={styles.productCategory}>{product.category}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.statusButton, product.is_available && styles.activeStatus]}
            onPress={() => onToggleAvailability(product.id)}
          >
            <Text style={styles.statusText}>
 {product.is_available ? ' Available' : ' Unavailable'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.editButton} onPress={() => onEdit(product)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (COLORS) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imageEmoji: {
    fontSize: 30,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  productPrice: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  productCategory: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
  },
  activeStatus: {
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: 11,
    color: COLORS.text.secondary,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.info,
  },
  editText: {
    fontSize: 11,
    color: COLORS.text.inverse,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.error,
  },
  deleteText: {
    fontSize: 11,
    color: COLORS.text.inverse,
  },
});
