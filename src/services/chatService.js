// src/services/chatService.js
import { supabase } from '../../lib/supabase';
import axios from 'axios';

// ✅ PUT YOUR API KEY HERE
const IMGBB_API_KEY = '0f4823dff292c1d4c4a6fdcc7d0037c9';

export const chatService = {
  async getOrCreateConversation(customerId, stallId) {
    let { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_id', customerId)
      .eq('stall_id', stallId)
      .maybeSingle();

    if (existing) return existing;

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        customer_id: customerId,
        stall_id: stallId,
      })
      .select()
      .single();

    if (error) throw error;
    return newConv;
  },

  async getCustomerConversations(customerId) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        stall:stall_id (
          id,
          stall_number,
          stall_name,
          section
        )
      `)
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getVendorConversations(vendorId) {
    const { data: stall } = await supabase
      .from('stalls')
      .select('id')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (!stall) return [];

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        customer:customer_id (
          id,
          full_name,
          email
        )
      `)
      .eq('stall_id', stall.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async sendMessage(conversationId, senderId, senderRole, message) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        message: message,
        is_image: false,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('conversations')
      .update({
        last_message: message,
        last_message_time: new Date().toISOString(),
      })
      .eq('id', conversationId);

    return data;
  },

  async uploadChatImage(uri) {
    try {
      console.log('📸 Uploading image to ImgBB:', uri);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const formData = new FormData();
      formData.append('image', base64);
      
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: {
          key: IMGBB_API_KEY
        },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const imageUrl = uploadResponse.data.data.url;
      console.log('📸 Image uploaded to ImgBB:', imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  },

  async sendImageMessage(conversationId, senderId, senderRole, imageUrl) {
    console.log('📸 Saving image message with URL:', imageUrl);
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        message: '📷 Sent an image',
        image_url: imageUrl,
        is_image: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving image message:', error);
      throw error;
    }

    await supabase
      .from('conversations')
      .update({
        last_message: '📷 Sent an image',
        last_message_time: new Date().toISOString(),
      })
      .eq('id', conversationId);

    console.log('📸 Image message saved:', data);
    return data;
  },

  async markAsRead(conversationId, readerRole) {
    const updateField = readerRole === 'customer' 
      ? { customer_unread_count: 0 }
      : { vendor_unread_count: 0 };

    await supabase
      .from('conversations')
      .update(updateField)
      .eq('id', conversationId);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_role', readerRole);
  },

  subscribeToMessages(conversationId, onNewMessage) {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onNewMessage(payload.new);
        }
      )
      .subscribe();
    
    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },
};