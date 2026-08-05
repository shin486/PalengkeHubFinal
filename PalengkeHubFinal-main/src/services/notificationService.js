import { Platform, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

// expo-notifications is only available on native — dynamic require avoids web build errors
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
let Notifications = null;
if (isNative) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('🔕 expo-notifications could not be loaded');
  }
}

// Configure how notifications appear when app is in foreground (native only)
if (isNative && Notifications && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldVibrate: true,
    }),
  });
}

// --- Helper: Play a sound when a notification arrives while the app is open ---
export const handleForegroundSound = async () => {
  if (Platform.OS === 'android') {
    try {
      const { Audio } = require('expo-av');
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://example.com/notification.mp3' },
        { shouldPlay: true }
      );
      await sound.playAsync();
    } catch (e) {
      // expo-av not available / no sound file — silent fallback
    }
  }
};

// --- Request notification permissions ---
export const requestNotificationPermission = async () => {
  if (!isNative || !Notifications) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notifications Disabled',
        'Enable push notifications in your device settings to receive order updates, promotions, and chat messages.',
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.warn('Error requesting notification permission:', e);
    return null;
  }
};

// --- Register push token with Supabase ---
export const registerPushToken = async (userId) => {
  if (!isNative) return null;

  try {
    const token = await requestNotificationPermission();
    if (!token || !userId) return;

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, expo_push_token: token }, { onConflict: 'id' });

    if (error) console.warn('Error saving push token:', error);
    else console.log('🔔 Push token registered for user:', userId);

    return token;
  } catch (e) {
    console.warn('Push token registration failed:', e);
    return null;
  }
};

// --- Send notification to a specific user ---
export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (!profile?.expo_push_token) {
      console.log('No push token for user:', userId);
      return;
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
        priority: 'high',
      }),
    });

    // Also store in the notifications table
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message: body,
      type: data.type || 'general',
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Error sending push notification:', e);
  }
};

// --- Send order update notification to customer ---
export const notifyOrderUpdate = async (customerId, orderNumber, newStatus) => {
  const statusMessages = {
    confirmed: {
      title: '✅ Order Confirmed!',
      body: `Your order #${orderNumber} has been confirmed. The vendor is preparing your items.`,
    },
    preparing: {
      title: '👨‍🍳 Order Being Prepared',
      body: `Your order #${orderNumber} is now being prepared by the vendor.`,
    },
    ready: {
      title: '🛎️ Order Ready for Pickup!',
      body: `Your order #${orderNumber} is ready! Come pick it up at the stall.`,
    },
    completed: {
      title: '📦 Order Completed',
      body: `Your order #${orderNumber} has been marked as completed. Thank you!`,
    },
    cancelled: {
      title: '❌ Order Cancelled',
      body: `Your order #${orderNumber} has been cancelled.`,
    },
  };

  const msg = statusMessages[newStatus] || {
    title: '📋 Order Update',
    body: `Order #${orderNumber} status updated to: ${newStatus}`,
  };

  await sendPushNotification(customerId, msg.title, msg.body, {
    type: 'order_update',
    orderNumber,
    status: newStatus,
  });
};

// --- Send promotion notification ---
export const notifyNewPromotion = async (stallId, productName, discount) => {
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .filter('favorites->stalls', 'cs', JSON.stringify([{ id: stallId }]));

    if (!profiles?.length) return;

    const title = '🏷️ New Deal!';
    const body = `${productName} is now ${discount} OFF at your favorite stall!`;

    for (const profile of profiles) {
      await sendPushNotification(profile.id, title, body, {
        type: 'promotion',
        stallId,
      });
    }
  } catch (e) {
    console.warn('Error notifying promotion:', e);
  }
};

// --- Setup notification listeners ---
export const setupNotificationListeners = (onNotificationReceived, onNotificationResponse) => {
  if (!isNative || !Notifications) return () => {};

  const receivedListener = Notifications.addNotificationReceivedListener(notification => {
    if (onNotificationReceived) onNotificationReceived(notification);
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    if (onNotificationResponse) onNotificationResponse(response);
  });

  return () => {
    try {
      Notifications.removeNotificationSubscription(receivedListener);
      Notifications.removeNotificationSubscription(responseListener);
    } catch (e) {}
  };
};

export default {
  requestNotificationPermission,
  registerPushToken,
  sendPushNotification,
  notifyOrderUpdate,
  notifyNewPromotion,
  setupNotificationListeners,
};