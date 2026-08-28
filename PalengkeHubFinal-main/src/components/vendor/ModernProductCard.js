// src/components/vendor/ModernProductCard.js
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';

const ProductCardInner = ({ product, onToggleAvailability, onEdit, onDelete, onPress }) => {
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

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={32} color={vendorColors.text.tertiary} />
          </View>
        )}
        <View style={[
          styles.availabilityBadge,
          { backgroundColor: product.is_available ? vendorColors.successLight : vendorColors.dangerLight }
        ]}>
          <View style={[styles.availabilityDot, { backgroundColor: product.is_available ? vendorColors.success : vendorColors.danger }]} />
          <Text style={[styles.availabilityText, { color: product.is_available ? vendorColors.success : vendorColors.danger }]}>
            {product.is_available ? 'Available' : 'Hidden'}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <TouchableOpacity onPress={() => onToggleAvailability(product)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Switch
              value={product.is_available}
              onValueChange={() => onToggleAvailability(product)}
              trackColor={{ false: vendorColors.borderLight, true: vendorColors.success }}
              thumbColor={vendorColors.text.white}
              size="small"
              style={styles.switch}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₱{product.price}</Text>
          <Text style={styles.unit}>/{product.unit}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{product.category}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => onEdit(product)}>
            <Ionicons name="create-outline" size={14} color={vendorColors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={14} color={vendorColors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
};

export const ModernProductCard = memo(ProductCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.md,
    borderWidth: 1,
    borderColor: vendorColors.border,
    ...vendorShadows.md,
  },
  imageContainer: {
    position: 'relative',
    marginRight: vendorSpacing.md,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: vendorBorderRadius.md,
  },
  placeholder: {
    width: 80,
    height: 80,
    borderRadius: vendorBorderRadius.md,
    backgroundColor: vendorColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availabilityBadge: {
    position: 'absolute',
    bottom: -6,
    left: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: vendorBorderRadius.sm,
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availabilityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: vendorColors.text.primary,
    marginRight: 8,
  },
  switch: {
    transform: [{ scale: 0.7 }],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontFamily: 'Baloo2_800ExtraBold',
    fontWeight: '800',
    color: vendorColors.primary,
  },
  unit: {
    fontSize: 11,
    color: vendorColors.text.secondary,
  },
  categoryBadge: {
    marginLeft: 8,
    backgroundColor: vendorColors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: vendorBorderRadius.sm,
  },
  categoryText: {
    fontSize: 9,
    color: vendorColors.text.secondary,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: vendorBorderRadius.sm,
  },
  editBtn: {
    backgroundColor: vendorColors.surfaceAlt,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  editBtnText: {
    fontSize: 11,
    color: vendorColors.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: vendorColors.dangerLight,
    borderWidth: 1,
    borderColor: vendorColors.danger,
  },
});