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
  Platform,
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
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Announcements are global broadcasts, not per-account — a guest browsing
  // without signing in should still see them. Only the personal notifications
  // list and unread count need a real user.id.
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = user?.id ? await notificationService.getNotifications(user.id) : [];

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
        // Announcements have no per-user row in the DB — "read" is tracked
        // locally on-device (see notificationService.getReadAnnouncementIds)
        // so it survives navigating away and agrees with the Home bell dot.
        const readIds = user?.id ? await notificationService.getReadAnnouncementIds(user.id) : [];
        announcementItems = (anns || []).map(ann => ({
          id: `ann-${ann.id}`,
          title: ann.title,
          message: ann.content,
          type: 'announcement',
          is_read: readIds.includes(ann.id),
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

      if (user?.id) {
        const count = await notificationService.getUnreadCount(user.id);
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();

    // Guests have no user_id row to subscribe against — skip the channel
    // rather than open one with a literal "eq.undefined" filter.
    if (!user?.id) return;

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
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
    const idStr = String(notificationId);
    // Announcements aren't per-user rows — persist "read" locally instead
    // (see notificationService.markAnnouncementsReadLocally) so it survives
    // navigation and agrees with the Home screen's bell dot.
    if (idStr.startsWith('ann-')) {
      const realId = Number(idStr.slice(4));
      if (user?.id && Number.isFinite(realId)) {
        await notificationService.markAnnouncementsReadLocally(user.id, [realId]);
      }
    } else {
      await notificationService.markAsRead(notificationId);
    }
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );
    if (!idStr.startsWith('ann-')) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // unreadCount only tracks the real `notifications` table — announcements
  // are global broadcasts with no per-user is_read row, so they're always
  // stamped is_read:false locally (see loadNotifications) and never counted
  // here. That left this button permanently disabled ("All caught up")
  // whenever the only unread-looking item was an announcement, even though
  // it visibly showed as unread in the list below. Gate on the actual
  // rendered list instead of the DB-only count.
  const hasUnread = notifications.some(n => !n.is_read);

  const handleMarkAllAsRead = async () => {
    if (!hasUnread) return;

    const applyMarkAllAsRead = async () => {
      await notificationService.markAllAsRead(user.id);
      const unreadAnnouncementIds = notifications
        .filter(n => n.is_announcement && !n.is_read)
        .map(n => Number(String(n.id).slice(4)))
        .filter(Number.isFinite);
      if (user?.id && unreadAnnouncementIds.length) {
        await notificationService.markAnnouncementsReadLocally(user.id, unreadAnnouncementIds);
      }
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    };

    // react-native-web does NOT implement Alert.alert — use window.confirm on web
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to mark all notifications as read?')) {
        await applyMarkAllAsRead();
      }
      return;
    }

    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark All', onPress: applyMarkAllAsRead },
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

  // Tapping the card itself used to jump straight to the linked screen
  // (Orders/Chats/etc.) — for anything with a message longer than 2 lines,
  // that meant there was no way to ever read the rest of it: the tap always
  // navigated away before the text could expand. Now the card tap only
  // marks-as-read and expands the truncated text; navigating away is a
  // separate, explicit "View" action below the message.
  const handleNotificationPress = (notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(notification.id)) next.delete(notification.id);
      else next.add(notification.id);
      return next;
    });
  };

  const handleNotificationNavigate = (notification) => {
    if (notification.type === 'order') {
      navigation.navigate('Orders');
    } else if (notification.type === 'chat') {
      navigation.navigate('Chats');
    } else if (notification.type === 'price_drop') {
      navigation.navigate('Search');
    } else if (notification.type === 'vendor_resubmission') {
      navigation.navigate('VendorApplicationStatus', { applicationId: notification.data?.vendor_application_id });
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
      case 'vendor_resubmission':
        return 'document-text-outline';
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
    const isExpanded = expandedIds.has(item.id);

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
          <Text style={styles.notificationMessage} numberOfLines={isExpanded ? undefined : 2}>
            {item.message}
          </Text>
          <View style={styles.notificationFooterRow}>
            <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
            {!item.is_announcement && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); handleNotificationNavigate(item); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.viewLink}>View →</Text>
              </TouchableOpacity>
            )}
          </View>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.surface} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : notifications.length === 0 ? (
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
          {/* Always visible (disabled at zero) rather than vanishing —
              a button that disappears once you've caught up reads as
              "missing," not "done." */}
          <TouchableOpacity
            style={[styles.markAllButton, !hasUnread && styles.markAllButtonDisabled]}
            onPress={handleMarkAllAsRead}
            disabled={!hasUnread}
          >
            <LinearGradient
              colors={!hasUnread ? [COLORS.text.lighter, COLORS.text.lighter] : [COLORS.primary, COLORS.primary]}
              style={styles.markAllGradient}
            >
              <Text style={styles.markAllText}>{!hasUnread ? 'All caught up' : 'Mark all as read'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.wickerSoft,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
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
  markAllButtonDisabled: {
    opacity: 0.6,
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
  notificationFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: COLORS.text.quaternary,
  },
  viewLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
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