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
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChat';
import { Header } from '../../components/Header';

export default function VendorChatDetailScreen({ navigation, route }) {
  const { conversationId, customer } = route.params;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const flatListRef = useRef(null);
  const { messages, loading, sending, sendMessage } = useChat(
    conversationId,
    user,
    'vendor'
  );

  const handleSend = async () => {
    if (!messageText.trim()) return;
    await sendMessage(messageText);
    setMessageText('');
  };

  // Pick image from gallery
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to send images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to send photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Upload image to Supabase storage
  const uploadImage = async (uri) => {
    try {
      setSendingImage(true);
      
      // Generate unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `chat_images/${conversationId}/${fileName}`;
      
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, blob);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);
      
      // Send image message
      await sendMessage('📷 Sent an image', publicUrl, true);
      
      setSelectedImage(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setSendingImage(false);
    }
  };

  const handleSendImage = () => {
    Alert.alert(
      'Send Photo',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
      ]
    );
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id;
    
    return (
      <View style={[
        styles.messageRow,
        isMyMessage ? styles.myMessageRow : styles.theirMessageRow
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myBubble : styles.theirBubble
        ]}>
          {/* Show image if message has image_url */}
          {item.image_url && (
            <TouchableOpacity 
              onPress={() => {
                setSelectedImage(item.image_url);
                setShowImageModal(true);
              }}
            >
              <Image 
                source={{ uri: item.image_url }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          
          {/* Show text message if exists */}
          {item.message && (
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
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      
      <Header 
        title={customer?.name || 'Chat'}
        subtitle="Customer"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />
      
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
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {/* Image preview before sending */}
          {selectedImage && typeof selectedImage === 'string' && !selectedImage.startsWith('http') && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.removeImageBtn}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sendImageBtn}
                onPress={() => uploadImage(selectedImage)}
                disabled={sendingImage}
              >
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.sendImageGradient}>
                  {sendingImage ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.sendImageText}>Send Image →</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.inputRow}>
            {/* Photo/Screenshot button */}
            <TouchableOpacity 
              style={styles.attachButton}
              onPress={handleSendImage}
              disabled={sendingImage}
            >
              <Text style={styles.attachIcon}>📷</Text>
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Type a reply... or send a QR code screenshot"
              placeholderTextColor="#9CA3AF"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              editable={!sendingImage}
            />
            
            <TouchableOpacity 
              style={[styles.sendButton, (!messageText.trim() || sendingImage) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sending || !messageText.trim() || sendingImage}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.sendGradient}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.sendText}>📤</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      {/* Full screen image modal for viewing images */}
      <Modal visible={showImageModal} transparent={true} animationType="fade">
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullImage}
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
    backgroundColor: '#F9FAFB' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  messagesList: { 
    padding: 16, 
    paddingBottom: 20 
  },
  messageRow: { 
    marginBottom: 12 
  },
  myMessageRow: { 
    alignItems: 'flex-end' 
  },
  theirMessageRow: { 
    alignItems: 'flex-start' 
  },
  messageBubble: { 
    maxWidth: '80%', 
    padding: 12, 
    borderRadius: 20 
  },
  myBubble: { 
    backgroundColor: '#DC2626', 
    borderBottomRightRadius: 4 
  },
  theirBubble: { 
    backgroundColor: '#F3F4F6', 
    borderBottomLeftRadius: 4 
  },
  messageText: { 
    fontSize: 15, 
    lineHeight: 20 
  },
  myMessageText: { 
    color: 'white' 
  },
  theirMessageText: { 
    color: '#111827' 
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageTime: { 
    fontSize: 10, 
    marginTop: 4, 
    color: '#9CA3AF', 
    textAlign: 'right' 
  },
  inputContainer: { 
    backgroundColor: 'white', 
    borderTopWidth: 1, 
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  inputRow: {
    flexDirection: 'row', 
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachIcon: {
    fontSize: 24,
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
  sendButton: { 
    marginLeft: 8, 
    borderRadius: 25, 
    overflow: 'hidden' 
  },
  sendButtonDisabled: { 
    opacity: 0.5 
  },
  sendGradient: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  sendText: { 
    fontSize: 20 
  },
  imagePreviewContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendImageBtn: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  sendImageGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendImageText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});