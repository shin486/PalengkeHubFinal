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

  async uploadChatImage(uri, conversationId, mimeType) {
    try {
      if (!uri) {
        return { url: null, error: 'No image selected' };
      }

      console.log(' Uploading chat image to Supabase storage:', uri);

      // Determine content type from the picker’s MIME when available (handles
      // JPG, PNG, HEIC/HEIF, WebP, GIF safely). Otherwise fall back to a guess
      // from the file extension; default to jpeg.
      var extMatch = uri.match(/\.(\w+)(\?|$)/);
      var ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      var contentType = 'image/jpeg';
      if (mimeType && mimeType.indexOf('/') !== -1) {
        contentType = mimeType;
      } else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'heic' || ext === 'heif') contentType = 'image/heic';
      else if (ext === 'webp') contentType = 'image/webp';
      else if (ext === 'gif') contentType = 'image/gif';

      // Read the image as a binary blob. Works on native (file:// paths) and on
      // web (blob:/data: URIs) alike.
      var response = await fetch(uri);
      var blob = await response.blob();

      // Permanent path under a per-conversation folder for easy management.
      var fileName = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) + '.' + ext;
      var folder = 'chat_images/' + conversationId;

      var res = await supabase.storage
        .from('vendor_documents')
        .upload(folder + '/' + fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType,
        });
      var data = res.data;
      var error = res.error;

      if (error) {
        console.error('Chat upload storage error:', error);
        return { url: null, error: error && error.message ? error.message : 'Storage upload failed' };
      }

            // Read side: use a SIGNED URL (valid 7 days) so private-bucket objects
      // display even though vendor_documents is not publicly readable.
      var signed = await supabase.storage
        .from('vendor_documents')
        .createSignedUrl(data.path, 7 * 24 * 60 * 60);
      var url = signed && signed.data && signed.data.signedUrl ? signed.data.signedUrl : null;
      if (!url) {
        return { url: null, error: (signed && signed.error ? signed.error.message : 'Could not build a signed URL') };
      }

            console.log(' Chat image uploaded:', url);
      return { url: url, error: null };
    } catch (error) {
      console.error('Error uploading chat image:', error);
      return { url: null, error: error && error.message ? error.message : 'Upload failed' };
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