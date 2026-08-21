// src/screens/vendor/VendorProfileScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { uploadImageToStorage } from '../../utils/imageUpload';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorSectionHeader } from '../../components/vendor/VendorSectionHeader';

export default function VendorProfileScreen({ navigation }) {
  const { user, profile, logout, resetToLogin } = useAuth();
  const [stall, setStall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingStallImage, setUploadingStallImage] = useState(false);

  const fetchStall = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStall();
  };

  const uploadStallImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to add a stall photo');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !stall?.id) return;

    setUploadingStallImage(true);
    try {
      const asset = result.assets[0];
      const uri = asset.uri;

      const { url: imageUrl } = await uploadImageToStorage({
        uri,
        folder: 'stalls',
        mimeType: asset.mimeType,
        fileAsset: asset.file, // Web only: real File/Blob
      });

      const { error } = await supabase
        .from('stalls')
        .update({ image_url: imageUrl })
        .eq('id', stall.id);

      if (error) throw error;

      await fetchStall();
      Alert.alert('Success', 'Stall photo updated!');
    } catch (error) {
      console.error('Error uploading stall image:', error);
      Alert.alert('Error', 'Failed to upload stall photo. Please try again.');
    } finally {
      setUploadingStallImage(false);
    }
  };

  const handleLogout = async () => {
    // react-native-web does NOT implement Alert.alert — use window.confirm on web
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to logout?');
      if (!confirmLogout) return;
      console.log('🔴 Vendor logging out (web)...');
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error during logout:', err);
      }
      window.location.href = '/';
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          const result = await logout();
          if (result.success) {
            resetToLogin();
          } else {
            Alert.alert('Error', result.error || 'Failed to logout');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Profile" subtitle="Account settings" showBack onBackPress={() => navigation.goBack()} />
        <VendorSkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Profile" subtitle="Account settings" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[vendorColors.primary]} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'V'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{profile?.full_name || 'Vendor'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Vendor</Text>
          </View>
        </View>

        {/* Stall Information */}
        <View style={styles.section}>
          <VendorSectionHeader title="Stall Information" />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stall Number</Text>
            <Text style={styles.infoValue}>{stall?.stall_number || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stall Name</Text>
            <Text style={styles.infoValue}>{stall?.stall_name || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Section</Text>
            <Text style={styles.infoValue}>{stall?.section || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: stall?.is_temporarily_closed ? vendorColors.danger : vendorColors.success }]}>
              {stall?.is_temporarily_closed ? 'Closed' : 'Open'}
            </Text>
          </View>
        </View>

        {/* Stall Photo */}
        <View style={styles.section}>
          <VendorSectionHeader title="Stall Photo" />
          <TouchableOpacity
            style={styles.stallPhotoContainer}
            onPress={uploadStallImage}
            disabled={uploadingStallImage}
          >
            {stall?.image_url ? (
              <Image source={{ uri: stall.image_url }} style={styles.stallPhoto} resizeMode="cover" />
            ) : (
              <View style={styles.stallPhotoPlaceholder}>
                <Ionicons name="storefront-outline" size={40} color={vendorColors.primary} />
                <Text style={styles.stallPhotoHint}>Tap to add a photo of your stall</Text>
              </View>
            )}
            {uploadingStallImage && (
              <View style={styles.stallPhotoOverlay}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <VendorSectionHeader title="Account" />
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('VendorRatings')}>
            <Ionicons name="star-outline" size={20} color="#6B7280" />
            <Text style={styles.menuLabel}>Ratings & Reviews</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('VendorReportsList')}>
            <Ionicons name="clipboard-outline" size={20} color="#6B7280" />
            <Text style={styles.menuLabel}>My Reports</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('VendorReportIssue')}>
            <Ionicons name="flag-outline" size={20} color="#6B7280" />
            <Text style={styles.menuLabel}>Report an Issue</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: vendorColors.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: vendorSpacing.xxl,
    paddingHorizontal: vendorSpacing.lg,
  },
  avatarContainer: {
    marginBottom: vendorSpacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: vendorColors.primary,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: vendorColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: vendorColors.primaryLight,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: vendorColors.text.primary,
  },
  email: {
    fontSize: 14,
    color: vendorColors.text.secondary,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: vendorColors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: vendorBorderRadius.full,
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    color: vendorColors.primary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: vendorColors.surface,
    marginHorizontal: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.lg,
    borderRadius: vendorBorderRadius.xl,
    ...vendorShadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: vendorColors.divider,
  },
  infoLabel: {
    fontSize: 13,
    color: vendorColors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: vendorColors.text.primary,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: vendorColors.divider,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: vendorSpacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: vendorColors.text.primary,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 16,
    color: vendorColors.text.tertiary,
  },
  logoutButton: {
    backgroundColor: vendorColors.danger,
    marginHorizontal: vendorSpacing.lg,
    marginBottom: vendorSpacing.xxxl,
    paddingVertical: 14,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  stallPhotoContainer: {
    marginTop: vendorSpacing.md,
    borderRadius: vendorBorderRadius.lg,
    overflow: 'hidden',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  stallPhoto: {
    width: '100%',
    height: '100%',
  },
  stallPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stallPhotoHint: {
    fontSize: 13,
    color: vendorColors.text.secondary,
  },
  stallPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
