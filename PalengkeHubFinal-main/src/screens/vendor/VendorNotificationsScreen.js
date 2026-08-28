// src/screens/vendor/VendorNotificationsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'order': return 'receipt-outline';
    case 'payment': return 'card-outline';
    case 'price_drop': return 'trending-down-outline';
    case 'chat': return 'chatbubble-outline';
    case 'review': return 'star-outline';
    case 'announcement':
    case 'system': return 'megaphone-outline';
    case 'vendor_resubmission': return 'document-text-outline';
    default: return 'notifications-outline';
  }
};

const getNotificationColor = (type) => {
  switch (type) {
    case 'order': return vendorColors.info;
    case 'payment': return vendorColors.success;
    case 'price_drop': return vendorColors.warning;
    case 'chat': return vendorColors.purple;
    case 'review': return vendorColors.warning;
    case 'announcement':
    case 'system': return vendorColors.primary;
    case 'vendor_resubmission': return vendorColors.warning;
    default: return vendorColors.text.secondary;
  }
};

const formatRelativeTime = (dateStr) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function VendorNotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [notifRes, annRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('announcements')
          .select('*')
          // Live schema: target_audience is text[]; match rows tagged for vendors
          .contains('target_audience', ['vendors'])
          // Null expiry = still active (older rows were created without one)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (notifRes.error) throw notifRes.error;
      if (annRes.error) throw annRes.error;

      // Announcements have no per-user row — "read" is tracked locally on
      // device (see notificationService.getReadAnnouncementIds), same
      // mechanism the customer app uses, so mark-all-read here actually
      // sticks instead of the announcement reappearing unread every fetch.
      const readAnnouncementIds = await notificationService.getReadAnnouncementIds(user.id);

      // Convert announcements to notification-like items
      const announcementItems = (annRes.data || []).map(ann => ({
        id: `ann-${ann.id}`,
        title: ann.title,
        message: ann.content,
        type: 'announcement',
        is_read: readAnnouncementIds.includes(ann.id),
        created_at: ann.created_at,
        is_announcement: true,
      }));

      const allItems = [...announcementItems, ...(notifRes.data || [])];
      setNotifications(allItems);
      setUnreadCount(allItems.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
  };

  const markAsRead = async (notification) => {
    if (notification.is_read) return;
    try {
      if (notification.is_announcement) {
        const realId = Number(String(notification.id).slice(4));
        if (user?.id && Number.isFinite(realId)) {
          await notificationService.markAnnouncementsReadLocally(user.id, [realId]);
        }
      } else {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);
      }

      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    markAsRead(notification);
    if (notification.type === 'vendor_resubmission') {
      navigation.navigate('VendorApplicationStatus', { applicationId: notification.data?.vendor_application_id });
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      const unreadAnnouncementIds = notifications
        .filter(n => n.is_announcement && !n.is_read)
        .map(n => Number(String(n.id).slice(4)))
        .filter(Number.isFinite);
      if (user?.id && unreadAnnouncementIds.length) {
        await notificationService.markAnnouncementsReadLocally(user.id, unreadAnnouncementIds);
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  };

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    const color = getNotificationColor(item.type);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.is_read && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.is_read && styles.titleUnread]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        showBack
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
            style={[styles.markAllButton, unreadCount === 0 && styles.markAllButtonDisabled]}
          >
            <Text style={styles.markAllText}>{unreadCount === 0 ? 'All caught up' : 'Mark all read'}</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <VendorSkeletonList count={5} />
      ) : notifications.length === 0 ? (
        <VendorEmptyState
          icon="notifications-outline"
          title="No notifications"
          message="Updates about your orders, payments, and announcements will appear here"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[vendorColors.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: vendorColors.background,
  },
  listContent: {
    padding: vendorSpacing.lg,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    padding: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    borderWidth: 1,
    borderColor: vendorColors.border,
    ...vendorShadows.sm,
  },
  notificationUnread: {
    backgroundColor: vendorColors.accentLight,
    borderColor: vendorColors.accent,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: vendorSpacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.text.primary,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '700',
    color: vendorColors.primary,
  },
  message: {
    fontSize: 13,
    color: vendorColors.text.secondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    fontSize: 11,
    color: vendorColors.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: vendorColors.primary,
    marginLeft: 8,
    alignSelf: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: vendorBorderRadius.full || 20,
    backgroundColor: vendorColors.primary,
  },
  markAllButtonDisabled: {
    backgroundColor: vendorColors.text.tertiary,
    opacity: 0.6,
  },
  markAllText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});