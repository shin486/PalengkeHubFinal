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
  Image,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import { chatService } from '../../services/chatService';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const { t } = useI18n();
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
    if (days > 0) return t('chat.time_days_ago', { count: days });
    if (diff > 3600000) return t('chat.time_hours_ago', { count: Math.floor(diff / 3600000) });
    if (diff > 60000) return t('chat.time_minutes_ago', { count: Math.floor(diff / 60000) });
    return t('chat.time_just_now', 'Just now');
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => navigation.navigate('ChatDetail', {
        conversationId: item.id,
        stall: item.stall,
      })}
      activeOpacity={0.7}
    >
      {item.stall?.image_url ? (
        <Image source={{ uri: item.stall.image_url }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarContainer}>
          <Ionicons name="storefront-outline" size={22} color={COLORS.primary} />
        </View>
      )}
      <View style={styles.conversationInfo}>
        <Text style={styles.stallName}>
          {item.stall?.stall_name || (item.stall?.stall_number ? t('stalls.stall_number', { number: item.stall?.stall_number }) : t('stalls.vendor_fallback', 'Market Stall'))}
        </Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || t('chat.start_conversation', 'Start a conversation')}
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
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('chat.no_messages', 'No messages yet')}</Text>
            <Text style={styles.emptyText}>
              {t('chat.empty_subtitle', 'Message a stall from their profile page')}
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
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: COLORS.surfaceSecondary,
  },
  avatarEmoji: { fontSize: 24 },
  conversationInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text.primary },
  lastMessage: { fontSize: 13, color: COLORS.text.secondary, marginTop: 2 },
  time: { fontSize: 11, color: COLORS.text.tertiary, marginTop: 2 },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center' },
});