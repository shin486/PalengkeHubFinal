// src/screens/vendor/VendorChatDetailScreen.js

import React, { useState, useRef, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChat';
import { supabase } from '../../../lib/supabase';

export default function VendorChatDetailScreen({ navigation, route }) {
  // ✅ Get conversationId from route params
  const conversationId = route.params?.conversationId;
  const customer = route.params?.customer || {};
  const stall = route.params?.stall || null;
  
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState(customer?.full_name || customer?.name || 'Customer');
  const [stallInfo, setStallInfo] = useState(stall || null);
  const flatListRef = useRef(null);
  
  const { 
    messages, 
    loading, 
    sending, 
    uploadingImage, 
    sendMessage, 
    sendImage,
  } = useChat(conversationId, user, 'vendor');

  // Get chat partner info for the header
  const chatPartnerName = customerName;
  const chatPartnerSubtitle = stallInfo?.stall_number 
    ? `Stall #${stallInfo.stall_number}${stallInfo?.stall_name ? ` - ${stallInfo.stall_name}` : ''}`
    : stallInfo?.stall_name || 'Vendor';

  // Fetch stall info if not provided
  useEffect(() => {
    const fetchStallInfo = async () => {
      if (!stall && conversationId) {
        try {
          const { data, error } = await supabase
            .from('conversations')
            .select('stall:stall_id (id, stall_number, stall_name)')
            .eq('id', conversationId)
            .single();
          
          if (error) throw error;
          if (data?.stall) {
            setStallInfo(data.stall);
          }
        } catch (error) {
          console.error('Error fetching stall info:', error);
        }
      }
    };
    fetchStallInfo();
  }, [conversationId, stall]);

  // ✅ Hide the default header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // ✅ Suggested quick reply messages for vendors
  const suggestedMessages = [
    { id: 1, text: "Confirm Payment" },
    { id: 2, text: "Confirm Pickup Time" },
    { id: 3, text: "Ask for Feedback" },
    { id: 4, text: "Check Availability" },
    { id: 5, text: "Total Amount" },
    { id: 6, text: "Order Ready" },
  ];

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

  const handleSuggestedMessage = async (suggestedText) => {
    await sendMessage(suggestedText);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* CUSTOM HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {chatPartnerName?.charAt(0)?.toUpperCase() || 'C'}
            </Text>
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
          <Ionicons name="ellipsis-vertical" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}
      
      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Suggested Messages Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.suggestedContainer}
          contentContainerStyle={styles.suggestedContent}
        >
          {suggestedMessages.map((suggested) => (
            <TouchableOpacity
              key={suggested.id}
              style={styles.suggestedButton}
              onPress={() => handleSuggestedMessage(suggested.text)}
            >
              <Text style={styles.suggestedText}>{suggested.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
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
              colors={['#10B981', '#059669']}
              style={styles.imageGradient}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending || !messageText.trim()}
          >
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.sendGradient}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={22} color="#FFFFFF" />
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
            <Ionicons name="close" size={24} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  vendorStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerAction: {
    padding: 8,
    width: 38,
    alignItems: 'center',
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
    backgroundColor: '#DC2626',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
  },

  // ── Suggested Messages ──
  suggestedContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 8,
  },
  suggestedContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  suggestedButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  suggestedText: {
    fontSize: 13,
    color: '#374151',
  },

  // ── Input ──
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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