import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/ChatDetailScreen.js

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useAnnounceActiveScreen } from '../../contexts/ActiveScreenContext';
//  REMOVED: import { Header } from '../../components/Header';

export default function ChatDetailScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { conversationId, stall, vendor, userRole = 'customer' } = route.params;
  const { user } = useAuth();

  // Tells App.js's global Header to stay hidden while this screen is
  // focused — this screen renders its own header below instead. Two
  // earlier mechanisms tried to INFER this from outside (a nested
  // navigator's onStateChange, which silently no-ops; then a
  // screenListeners guess) and neither was reliably confirmed working —
  // this announces it directly instead, via React Navigation's own
  // guaranteed "screen just focused" hook.
  const announceActiveScreen = useAnnounceActiveScreen();
  useFocusEffect(
    React.useCallback(() => {
      announceActiveScreen('ChatDetail');
    }, [announceActiveScreen])
  );
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const flatListRef = useRef(null);
  
  const { 
    messages, 
    loading, 
    sending, 
    uploadingImage, 
    sendMessage, 
    sendImage,
    refreshMessages,
  } = useChat(conversationId, user, userRole);

  // Get chat partner info for the header
  const chatPartnerName = userRole === 'admin' 
    ? vendor?.name || stall?.stall_name || 'Vendor'
    : stall?.stall_number
      ? `Stall #${stall.stall_number} - ${stall?.stall_name || 'Vendor'}`
      : stall?.stall_name || 'Vendor';

  const chatPartnerSubtitle = userRole === 'admin'
    ? `${stall?.stall_number ? `Stall #${stall.stall_number}` : ''}${stall?.section ? ` • ${stall.section}` : ''}`.trim()
    : stall?.section || 'Conversation';

  //  Hide the default header and manage route name
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });

    //  Set route to ChatDetail when focused
    const updateRoute = () => {
      console.log(' ChatDetailScreen - setting route to ChatDetail');
      if (global.updateRouteName) {
        global.updateRouteName('ChatDetail');
      }
      if (global.setActiveRouteName) {
        global.setActiveRouteName('ChatDetail');
      }
    };

    //  Reset route when leaving
    const resetRoute = () => {
      console.log(' ChatDetailScreen - resetting route to Home');
      if (global.updateRouteName) {
        global.updateRouteName('Home');
      }
      if (global.setActiveRouteName) {
        global.setActiveRouteName('Home');
      }
    };

    // Update immediately when mounted
    updateRoute();

    //  Listen for focus and blur events
    const unsubscribeFocus = navigation.addListener('focus', updateRoute);
    const unsubscribeBlur = navigation.addListener('blur', resetRoute);

    //  Also listen for beforeRemove to handle back button
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', () => {
      console.log(' ChatDetailScreen - beforeRemove, resetting route');
      resetRoute();
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      unsubscribeBeforeRemove();
      // Also reset on unmount
      resetRoute();
    };
  }, [navigation]);

  const handleSend = async () => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) return;
    if (!conversationId) {
      Alert.alert('Send failed', 'Chat conversation is not available.');
      return;
    }

    try {
      const sent = await sendMessage(trimmedMessage);
      if (sent) {
        setMessageText('');
      } else {
        Alert.alert('Send failed', 'Your message could not be delivered. Please try again.');
      }
    } catch (error) {
      console.error('handleSend error:', error);
      Alert.alert('Send failed', error?.message || 'Your message could not be delivered. Please try again.');
    }
  };

  const handleSendImage = async () => {
    if (uploadingImage) return;
    await sendImage();
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user?.id;
    const isImage = item.is_image === true || (item.image_url && item.image_url.length > 0);
    
    return (
      <View style={[
        styles.messageRow,
        isMyMessage ? styles.myMessageRow : styles.theirMessageRow
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myBubble : styles.theirBubble
        ]}>
          {isImage && item.image_url ? (
            <TouchableOpacity onPress={() => openImageModal(item.image_url)}>
              <Image 
                source={{ uri: item.image_url }} 
                style={styles.chatImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText
            ]}>
              {item.message}
            </Text>
          )}
          <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  if (!conversationId) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Loading conversation...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.surface} />
      
      {/*  CUSTOM HEADER - Replaces the global Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            {stall?.image_url ? (
              <Image source={{ uri: stall.image_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>
                {chatPartnerName?.charAt(0)?.toUpperCase() || 'S'}
              </Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {chatPartnerName}
            </Text>
            <Text style={styles.vendorStatus} numberOfLines={1}>
              {chatPartnerSubtitle}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.headerAction} activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}
      
      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.text.quaternary}
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={handleSend}
            blurOnSubmit={true}
            returnKeyType="send"
            multiline={false}
          />
          
          <TouchableOpacity 
            style={styles.imageButton}
            onPress={handleSendImage}
            disabled={uploadingImage}
          >
            <LinearGradient
              colors={[COLORS.success, COLORS.success]}
              style={styles.imageGradient}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera-outline" size={22} color={COLORS.surface} />
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending || !messageText.trim()}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primary]}
              style={styles.sendGradient}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={22} color={COLORS.surface} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={24} color={COLORS.surface} />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.modalImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Custom Header ──
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  vendorStatus: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  headerAction: {
    padding: 8,
  },

  // ── Messages ──
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    marginBottom: 12,
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  theirMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: COLORS.surfaceSecondary,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: COLORS.text.inverse,
  },
  theirMessageText: {
    color: COLORS.text.primary,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    color: COLORS.text.quaternary,
    textAlign: 'right',
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: COLORS.surfaceSecondary,
  },

  // ── Input ──
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  imageButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  imageGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Image Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
});