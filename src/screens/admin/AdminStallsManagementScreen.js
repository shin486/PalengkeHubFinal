import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AdminStallsManagementScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stalls Management</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  backButton: { backgroundColor: '#DC2626', padding: 12, borderRadius: 8 },
  backText: { color: 'white', fontSize: 16, fontWeight: '600' },
});