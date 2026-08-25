import { Ionicons } from '@expo/vector-icons';
// src/screens/customer/ChatListScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/chatService';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await chatService.getCustomerConversations(user.id);
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 7) return date.toLocaleDateString();
    if (days > 0) return `${days}d ago`;
    if (diff > 3600000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff > 60000) return `${Math.floor(diff / 60000)}m ago`;
    return 'Just now';
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => navigation.navigate('ChatDetail', {
        conversationId: item.id,
        stall: item.stall,
      })}
    >
      <View style={styles.avatarContainer}>
        <Ionicons name="storefront-outline" size={18} />
      </View>
      <View style={styles.conversationInfo}>
        <Text style={styles.stallName}>
          {item.stall?.stall_name || `Stall #${item.stall?.stall_number}`}
        </Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'Start a conversation'}
        </Text>
        <Text style={styles.time}>{formatTime(item.last_message_time)}</Text>
      </View>
      {item.vendor_unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.vendor_unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={18} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Message a stall from their profile page
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: 16, flexGrow: 1 },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: { fontSize: 24 },
  conversationInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text.primary },
  lastMessage: { fontSize: 13, color: COLORS.text.tertiary, marginTop: 2 },
  time: { fontSize: 11, color: COLORS.text.quaternary, marginTop: 2 },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: COLORS.text.inverse, fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center' },
});