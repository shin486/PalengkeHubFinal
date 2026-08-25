// src/services/chatService.js
import { supabase } from '../../lib/supabase';

const normalizeRoleForDb = (role) => {
  if (role === 'admin') return 'customer';
  return role;
};

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
    try {
      const dbSenderRole = normalizeRoleForDb(senderRole);
      console.log('chatService.sendMessage', {
        conversationId,
        senderId,
        senderRole,
        dbSenderRole,
        message,
      });

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          sender_role: dbSenderRole,
          message: message,
          is_image: false,
        })
        .select()
        .single();

      if (error) {
        console.error('chatService.sendMessage insert error', error);
        throw error;
      }

      console.log('chatService.sendMessage inserted message', data);

      const { error: conversationError } = await supabase
        .from('conversations')
        .update({
          last_message: message,
          last_message_time: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (conversationError) {
        console.error('chatService.sendMessage update conversation error', conversationError);
      }

      return data;
    } catch (error) {
      console.error('chatService.sendMessage failed', error);
      throw error;
    }
  },

  async uploadChatImage(uri, file) {
    try {
      console.log(' Uploading image to uguu.se:', uri);
      
      // Determine file extension from URI
      const extMatch = uri.match(/\.(\w+)(\?|$)/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      
      // Upload to uguu.se (free permanent image host — no API key needed)
      const formData = new FormData();
      // On web, `file` is a File object; on native, use the uri object
      formData.append('files[]', file || { uri, name: fileName, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      
      const response = await fetch('https://uguu.se/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (!result.success || !result.files?.length) {
        throw new Error('Image host rejected the upload');
      }
      
      const imageUrl = result.files[0].url;
      console.log(' Image uploaded:', imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  },

  async sendImageMessage(conversationId, senderId, senderRole, imageUrl) {
    const dbSenderRole = normalizeRoleForDb(senderRole);
    console.log(' Saving image message with URL:', imageUrl, {
      senderRole,
      dbSenderRole,
    });
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: dbSenderRole,
        message: 'Sent an image',
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
        last_message: 'Sent an image',
        last_message_time: new Date().toISOString(),
      })
      .eq('id', conversationId);

    console.log(' Image message saved:', data);
    return data;
  },

  async markAsRead(conversationId, readerRole) {
    const normalizedReaderRole = readerRole === 'admin' ? 'customer' : readerRole;
    const updateField = normalizedReaderRole === 'customer'
      ? { customer_unread_count: 0 }
      : normalizedReaderRole === 'vendor'
      ? { vendor_unread_count: 0 }
      : { customer_unread_count: 0, vendor_unread_count: 0 };

    await supabase
      .from('conversations')
      .update(updateField)
      .eq('id', conversationId);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_role', normalizedReaderRole);
  },

  async getAllConversations() {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        customer:customer_id (id, full_name, email),
        stall:stall_id (id, stall_number, stall_name, section, vendor_id)
      `)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
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