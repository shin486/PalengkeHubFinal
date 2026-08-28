// src/screens/vendor/VendorChatListScreen.js

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { supabase } from '../../../lib/supabase';

export default function VendorChatListScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stall, setStall] = useState(null);

  //  Fetch stall info
  const fetchStall = useCallback(async () => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('id, stall_number, stall_name')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
      return data;
    } catch (error) {
      console.error('Error fetching stall:', error);
      return null;
    }
  }, [user]);

  //  Fetch chats
  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      const stallData = await fetchStall();
      if (!stallData?.id) {
        setChats([]);
        setLoading(false);
        return;
      }

      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message,
          last_message_time,
          vendor_unread_count,
          customer:customer_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('stall_id', stallData.id)
        .order('last_message_time', { ascending: false });

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      const processedChats = conversations.map((conv) => {
        const customerData = conv.customer;
        const customerName = customerData?.full_name ||
          customerData?.email?.split('@')[0] ||
          'Customer';
        
        return {
          id: conv.id,
          customer_id: conv.customer_id,
          customer_name: customerName,
          customer_avatar: customerData?.avatar_url,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: conv.last_message_time,
          unread_count: conv.vendor_unread_count || 0,
          stall: stallData,
        };
      });

      setChats(processedChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, fetchStall]);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const formatChatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return 'Now';
      if (mins < 60) return `${mins}m`;
      if (hours < 24) return `${hours}h`;
      if (days < 7) return `${days}d`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  //  Navigate to chat detail
  const handleChatPress = (chat) => {
    navigation.navigate('VendorChatDetail', {
      conversationId: chat.id,
      customer: {
        id: chat.customer_id,
        full_name: chat.customer_name,
        avatar_url: chat.customer_avatar,
      },
      stall: chat.stall,
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.customer_avatar ? (
          <Image source={{ uri: item.customer_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>
              {item.customer_name?.charAt(0)?.toUpperCase() || 'C'}
            </Text>
          </View>
        )}
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unread_count > 9 ? '9+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.customer_name}
          </Text>
          <Text style={styles.chatTime}>
            {formatChatTime(item.last_message_time)}
          </Text>
        </View>
        <Text 
          style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]}
          numberOfLines={1}
        >
          {item.last_message}
        </Text>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={COLORS.text.lighter} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar} backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {chats.length} {chats.length === 1 ? 'conversation' : 'conversations'}
        </Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color={COLORS.text.lighter} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            When customers message you, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.text.light,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.text.light,
    marginTop: 2,
  },

  // Chat List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.text.light,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: COLORS.text.dark,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
    marginTop: 4,
    textAlign: 'center',
  },
});