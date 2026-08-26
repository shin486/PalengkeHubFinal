import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';

export default function NotificationScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await notificationService.getNotifications(user.id);
      
      // Announcements targeted at customers.
      // Live schema: target_audience is text[]; null expires_at = still active.
      let announcementItems = [];
      try {
        const nowIso = new Date().toISOString();
        const { data: anns } = await supabase
          .from('announcements')
          .select('*')
          .contains('target_audience', ['customers'])
          .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(20);
        announcementItems = (anns || []).map(ann => ({
          id: `ann-${ann.id}`,
          title: ann.title,
          message: ann.content,
          type: 'announcement',
          is_read: false,
          created_at: ann.created_at,
          is_announcement: true,
        }));
      } catch (annError) {
        console.warn('Error loading announcements:', annError?.message);
      }

      const all = [...announcementItems, ...(data || [])].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setNotifications(all);
      
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadNotifications, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId) => {
    // Announcements aren't per-user rows — mark locally only
    if (!String(notificationId).startsWith('ann-')) {
      await notificationService.markAsRead(notificationId);
    }
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );
    if (!String(notificationId).startsWith('ann-')) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            await notificationService.markAllAsRead(user.id);
            setNotifications(prev =>
              prev.map(notif => ({ ...notif, is_read: true }))
            );
            setUnreadCount(0);
          },
        },
      ]
    );
  };

  const handleDelete = async (notification) => {
    // Announcements are global — just remove locally for this user
    if (notification.is_announcement) {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      return;
    }
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await notificationService.deleteNotification(notification.id);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    // Announcements are read-only broadcasts — no deep navigation
    if (notification.is_announcement) {
      handleMarkAsRead(notification.id);
      return;
    }
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    if (notification.type === 'order') {
      navigation.navigate('Orders');
    } else if (notification.type === 'chat') {
      navigation.navigate('ChatList');
    } else if (notification.type === 'price_drop') {
      navigation.navigate('Search');
    } else {
      navigation.navigate('Orders');
    }
  };

  const getIconForType = (type, title, message) => {
    const isCancellation = title?.toLowerCase().includes('cancelled') || 
                          message?.toLowerCase().includes('cancelled');
    
    if (isCancellation) return 'close-circle';
    
    switch (type) {
      case 'order':
        return 'cube-outline';
      case 'price_drop':
        return 'cash-outline';
      case 'announcement':
        return 'megaphone-outline';
      case 'chat':
        return 'chatbubble-outline';
      default:
        return 'notifications-outline';
    }
  };

  const formatTime = (dateString) => {
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

  const renderNotification = ({ item }) => {
    const isCancellation = item.title?.toLowerCase().includes('cancelled') || 
                          item.message?.toLowerCase().includes('cancelled');
    
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationIcon, isCancellation && styles.cancellationIcon]}>
          <Ionicons
            name={getIconForType(item.type, item.title, item.message)}
            size={24}
            color={isCancellation ? COLORS.error : COLORS.primary}
          />
        </View>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, !item.is_read && styles.unreadText]}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
        </View>
        {!item.is_announcement && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.text.lighter} />
          </TouchableOpacity>
        )}
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[COLORS.accentSoft, COLORS.surface]}
            style={styles.emptyCard}
          >
            <Ionicons name="notifications-outline" size={18} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              When you receive notifications, they will appear here
            </Text>
          </LinearGradient>
        </View>
      ) : (
        <>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary]}
                style={styles.markAllGradient}
              >
                <Text style={styles.markAllText}>Mark all as read</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotification}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
            showsVerticalScrollIndicator={false}
          />
        </>
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
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backText: {
    fontSize: 24,
    color: COLORS.text.inverse,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accentSoft,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  markAllButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },
  markAllGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  markAllText: {
    fontSize: 12,
    color: COLORS.text.inverse,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.surfaceSecondary,
  },
  unreadCard: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentSoft,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cancellationIcon: {
    backgroundColor: COLORS.accentSoft,
  },
  iconText: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  unreadText: {
    color: COLORS.primary,
  },
  notificationMessage: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: COLORS.text.quaternary,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    fontSize: 16,
    color: COLORS.text.quaternary,
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});