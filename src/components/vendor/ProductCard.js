import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const ProductCard = ({ product, onToggleAvailability, onEdit, onDelete }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{product.name}</Text>
        <TouchableOpacity
          style={[
            styles.badge,
            product.is_available ? styles.available : styles.unavailable
          ]}
          onPress={() => onToggleAvailability(product)}
        >
          <Text style={styles.badgeText}>
            {product.is_available ? 'In Stock' : 'Out'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.price}>₱{product.price} / {product.unit}</Text>
      {product.description && (
        <Text style={styles.description}>{product.description}</Text>
      )}
      <Text style={styles.category}>{product.category}</Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.editButton} onPress={() => onEdit(product)}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(product.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  available: {
    backgroundColor: '#E8F5E9',
  },
  unavailable: {
    backgroundColor: '#FFEBEE',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  editText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
  },
  deleteText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
});