// src/services/chatService.js
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
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
          section,
          image_url
        )
      `)
      .eq('customer_id', customerId)
      // last_message_time is what sendMessage actually stamps on every
      // new message (updated_at only started tracking it just now, so
      // existing conversations from before that fix would still sort
      // wrong by updated_at alone). Postgres puts NULLs last on a DESC
      // sort, so a conversation with no messages yet doesn't jump to top.
      .order('last_message_time', { ascending: false, nullsFirst: false });

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
          email,
          avatar_url
        )
      `)
      .eq('stall_id', stall.id)
      .order('last_message_time', { ascending: false, nullsFirst: false });

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

      // getCustomerConversations/getVendorConversations both sort by
      // updated_at — a plain column update doesn't touch it on its own
      // (no DB trigger for that here), so the chat list would drift out
      // of sync with actual activity unless this sets it explicitly too.
      //
      // Bump the RECIPIENT's unread count too — this is what the vendor
      // bottom-nav chat badge (and the customer equivalent) reads. Without
      // this the badge UI was fully wired up but had no signal to show:
      // only markAsRead() ever touched these columns, always resetting
      // them to 0, so a new message never made the count go up.
      const recipientField = dbSenderRole === 'customer' ? 'vendor_unread_count' : 'customer_unread_count';
      const { data: convRow } = await supabase
        .from('conversations')
        .select(recipientField)
        .eq('id', conversationId)
        .single();

      const nowIso = new Date().toISOString();
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({
          last_message: message,
          last_message_time: nowIso,
          updated_at: nowIso,
          [recipientField]: (convRow?.[recipientField] || 0) + 1,
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

      // fetch(uri).blob() is unreliable on Android for the content:// URIs
      // the image picker can return — it fails silently on some
      // pickers/OS versions. expo-file-system isn't available on web
      // though, so native reads the file as base64 and decodes to an
      // ArrayBuffer, while web keeps using fetch+blob (which works fine
      // there for blob:/data: URIs).
      var blob;
      if (Platform.OS === 'web') {
        var response = await fetch(uri);
        blob = await response.blob();
      } else {
        var base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        blob = decodeBase64(base64);
      }

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

            // Read side: use a SIGNED URL so private-bucket objects display even
      // though vendor_documents is not publicly readable. Chat images are
      // part of permanent order history, so use a long (effectively
      // permanent) expiry rather than 7 days — a chat photo shouldn't turn
      // into a broken image a week after it was sent.
      var signed = await supabase.storage
        .from('vendor_documents')
        .createSignedUrl(data.path, 10 * 365 * 24 * 60 * 60);
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

    const recipientField = dbSenderRole === 'customer' ? 'vendor_unread_count' : 'customer_unread_count';
    const { data: convRow } = await supabase
      .from('conversations')
      .select(recipientField)
      .eq('id', conversationId)
      .single();

    await supabase
      .from('conversations')
      .update({
        last_message: 'Sent an image',
        last_message_time: new Date().toISOString(),
        [recipientField]: (convRow?.[recipientField] || 0) + 1,
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