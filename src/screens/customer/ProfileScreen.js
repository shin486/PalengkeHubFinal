// src/screens/customer/ProfileScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from '../../components/Header';
import { supabase } from '../../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const IMGBB_API_KEY = '0f4823dff292c1d4c4a6fdcc7d0037c9';

export default function ProfileScreen({ navigation }) {
  const { user, profile, logout, setIsGuest, isGuest, checkUser } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const uploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to upload profile picture');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadingAvatar(true);
      try {
        const uri = result.assets[0].uri;
        
        // Fetch the image
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Convert to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Upload to ImgBB
        const formData = new FormData();
        formData.append('image', base64);
        
        const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
          params: { key: IMGBB_API_KEY },
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const avatarUrl = uploadResponse.data.data.url;
        console.log('✅ Avatar uploaded:', avatarUrl);
        
        // Update profile in Supabase
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);
        
        if (error) throw error;
        
        // Refresh user profile
        await checkUser();
        setAvatarError(false);
        Alert.alert('Success', 'Profile picture updated!');
        
      } catch (error) {
        console.error('Upload error:', error);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleLogout = async () => {
    // For web, use browser confirm
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to logout?');
      if (confirmLogout) {
        console.log('🔴 Logging out...');
        await supabase.auth.signOut();
        window.location.href = '/';
      }
      return;
    }
    
    // For mobile, use Alert
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  const handleSwitchToGuest = () => {
    if (Platform.OS === 'web') {
      const confirmSwitch = window.confirm('Switch to Guest Mode? You will be logged out.');
      if (confirmSwitch) {
        supabase.auth.signOut();
        setIsGuest(true);
        window.location.href = '/';
      }
      return;
    }
    
    Alert.alert(
      'Switch to Guest Mode',
      'You will be logged out and continue as guest. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            if (setIsGuest) {
              setIsGuest(true);
            }
          }
        }
      ]
    );
  };

  const handleSignIn = () => {
    if (setIsGuest) {
      setIsGuest(false);
    }
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleSignUp = () => {
    if (setIsGuest) {
      setIsGuest(false);
    }
    navigation.navigate('SignUp');
  };

  // ========== GUEST MODE ==========
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
      

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Guest Avatar Section */}
          <View style={styles.avatarSection}>
            <LinearGradient
              colors={['#DC2626', '#EF4444', '#F87171']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarEmoji}>👤</Text>
            </LinearGradient>
            <Text style={styles.guestName}>Guest User</Text>
            <Text style={styles.guestEmail}>browsing without account</Text>
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>👋 Guest Mode</Text>
            </View>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>✨ Sign in to unlock</Text>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>🛒</Text>
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Save your cart items</Text>
                <Text style={styles.benefitSubtext}>Items stay even after closing the app</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>📦</Text>
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Place orders</Text>
                <Text style={styles.benefitSubtext}>Order from any stall in the market</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>📋</Text>
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>View order history</Text>
                <Text style={styles.benefitSubtext}>Track all your past purchases</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>⭐</Text>
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Rate stalls</Text>
                <Text style={styles.benefitSubtext}>Share your experience with others</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>❤️</Text>
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Save favorite stalls</Text>
                <Text style={styles.benefitSubtext}>Quick access to your preferred vendors</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.signUpButton}
              onPress={handleSignUp}
              activeOpacity={0.7}
            >
              <Text style={styles.signUpButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========== LOGGED IN USER ==========
  return (
    <SafeAreaView style={styles.container}>


      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Avatar Section with Upload */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={uploadAvatar} disabled={uploadingAvatar} style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <View style={styles.avatarGradient}>
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : profile?.avatar_url && !avatarError ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <LinearGradient
                colors={['#DC2626', '#EF4444', '#F87171']}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarEmoji}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || '👤'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.userName}>{profile?.full_name || user?.email?.split('@')[0]}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.role === 'vendor' ? '🛍️ Vendor' : '🛒 Shopper'}
            </Text>
          </View>
          <TouchableOpacity onPress={uploadAvatar} disabled={uploadingAvatar} style={styles.changePhotoBtn}>
            <Text style={styles.changePhotoBtnText}>
              {uploadingAvatar ? 'Uploading...' : 'Change Profile Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Ratings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{profile?.full_name || 'Not set'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at 
                ? new Date(profile.created_at).toLocaleDateString() 
                : 'Recently'}
            </Text>
          </View>
        </View>

        {/* Vendor Dashboard Button (only for vendors) */}
        {profile?.role === 'vendor' && (
          <TouchableOpacity 
            style={styles.vendorButton}
            onPress={() => navigation.navigate('VendorDashboard')}
          >
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.vendorGradient}
            >
              <Text style={styles.vendorButtonText}>Open Vendor Dashboard →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Switch to Guest Button */}
        <TouchableOpacity style={styles.switchGuestButton} onPress={handleSwitchToGuest}>
          <Text style={styles.switchGuestText}>Switch to Guest Mode</Text>
        </TouchableOpacity>

        {/* LOGOUT BUTTON - Works on both web and mobile */}
        {Platform.OS === 'web' ? (
          <button
            onClick={async () => {
              console.log('🔴 Logout button clicked on web');
              const confirmLogout = window.confirm('Are you sure you want to logout?');
              if (confirmLogout) {
                console.log('🔴 User confirmed, signing out...');
                try {
                  const { error } = await supabase.auth.signOut();
                  if (error) console.error('SignOut error:', error);
                  console.log('🔴 SignOut complete, redirecting to login...');
                  window.location.href = '/';
                } catch (err) {
                  console.error('Error during logout:', err);
                  window.location.href = '/';
                }
              }
            }}
            style={{
              backgroundColor: '#DC2626',
              color: 'white',
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '16px',
              marginBottom: '30px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Logout
          </button>
        ) : (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.logoutGradient}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#DC2626',
  },
  avatarEmoji: {
    fontSize: 48,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#DC2626',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  editAvatarBadgeText: {
    fontSize: 16,
  },
  changePhotoBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  changePhotoBtnText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  guestName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  guestEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  guestBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  guestBadgeText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  benefitsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#FEF3F2',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitIcon: {
    fontSize: 22,
  },
  benefitContent: {
    flex: 1,
  },
  benefitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  benefitSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionSection: {
    marginHorizontal: 16,
    marginBottom: 30,
  },
  signInButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signUpButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: 'white',
  },
  signUpButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  infoCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  vendorButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  vendorGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  vendorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchGuestButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: 'white',
  },
  switchGuestText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 30,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});