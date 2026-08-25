import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { speak } from '../services/voiceService';
import { PriceTrendBadge } from './PriceTrendBadge';

export const ProductCard = ({ product, onPress, onAddToCart, priceTrend }) => {
  const readAloud = () => {
    speak(
      `${product.name}. Presyo, ${product.price} pesos, bawat ${product.unit || 'unit'}.`,
      { language: 'fil-PH' },
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(product)}>
      <View style={styles.imagePlaceholder}>
        <Ionicons name="cart-outline" size={32} color="#C4C4C4" />
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <TouchableOpacity
          style={styles.speakButton}
          onPress={readAloud}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="volume-medium-outline" size={16} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      <Text style={styles.price}>₱{product.price}</Text>
      {priceTrend && (
        <PriceTrendBadge
          currentPrice={product.price}
          previousPrice={priceTrend.previous_price}
        />
      )}
      <Text style={styles.unit}>per {product.unit}</Text>
      <Text style={styles.stall}>Stall {product.stall?.stall_number}</Text>
      <TouchableOpacity style={styles.addButton} onPress={() => onAddToCart(product)}>
        <Text style={styles.addButtonText}>Add to Cart</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePlaceholder: {
    height: 100,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emoji: {
    fontSize: 32,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  speakButton: {
    padding: 2,
    marginLeft: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  unit: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  stall: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});