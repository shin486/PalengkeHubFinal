// src/hooks/useChat.js
import { useState, useEffect, useCallback } from 'react';
import { chatService } from '../services/chatService';
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to access camera roll is required!');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    return result.assets[0].uri;
  }
  return null;
};

export const useChat = (conversationId, currentUser, userRole) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      setLoading(true);
      const data = await chatService.getMessages(conversationId);
      setMessages(data || []);
      await chatService.markAsRead(conversationId, userRole);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userRole]);

  const sendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || !conversationId || sending) return;
    
    setSending(true);
    try {
      const newMessage = await chatService.sendMessage(
        conversationId,
        currentUser.id,
        userRole,
        messageText.trim()
      );
      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  }, [conversationId, currentUser, userRole, sending]);

  const sendImage = useCallback(async () => {
    if (!conversationId || uploadingImage) {
      console.log('Cannot send image: no conversation or already uploading');
      return;
    }
    
    console.log('Opening image picker...');
    const imageUri = await pickImage();
    if (!imageUri) return;
    
    setUploadingImage(true);
    try {
      const imageUrl = await chatService.uploadChatImage(imageUri, conversationId);
      console.log('Upload result URL:', imageUrl);
      
      if (imageUrl) {
        const newMessage = await chatService.sendImageMessage(
          conversationId,
          currentUser.id,
          userRole,
          imageUrl
        );
        setMessages(prev => [...prev, newMessage]);
      } else {
        alert('Failed to upload image');
      }
    } catch (error) {
      console.error('Error sending image:', error);
      alert('Failed to send image');
    } finally {
      setUploadingImage(false);
    }
  }, [conversationId, currentUser, userRole, uploadingImage]);

  useEffect(() => {
    if (!conversationId) return;

    const handleNewMessage = (newMessage) => {
      if (newMessage.sender_id !== currentUser?.id) {
        setMessages(prev => [...prev, newMessage]);
        chatService.markAsRead(conversationId, userRole);
      }
    };

    const subscription = chatService.subscribeToMessages(conversationId, handleNewMessage);

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [conversationId, currentUser, userRole]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    loading,
    sending,
    uploadingImage,
    sendMessage,
    sendImage,
    refreshMessages: loadMessages,
  };
};