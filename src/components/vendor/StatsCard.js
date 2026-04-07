import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const StatsCard = ({ products, pending, active }) => {
  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.number}>{products}</Text>
        <Text style={styles.label}>Products</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.number}>{pending}</Text>
        <Text style={styles.label}>Pending</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.number}>{active}</Text>
        <Text style={styles.label}>Active</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stat: {
    alignItems: 'center',
  },
  number: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});