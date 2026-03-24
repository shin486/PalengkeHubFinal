import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false); // 👈 ADD THIS

  // ========== CHECK USER ON MOUNT ==========
  useEffect(() => {
    checkUser();
  }, []);

  // ========== DEEP LINK HANDLING ==========
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const { url } = event;
      console.log('🔗 Deep link received:', url);
      
      // Check if this is an auth callback
      if (url.includes('auth/callback') || url.includes('access_token')) {
        // Let Supabase handle the session
        const { data, error } = await supabase.auth.getSession();
        
        if (data?.session) {
          Alert.alert(
            '✅ Email Verified!',
            'Your email has been verified. You can now login.',
            [{ text: 'OK' }]
          );
          await checkUser();
        } else if (error) {
          console.error('Session error:', error);
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle initial URL if app was opened from link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ========== CHECK USER FUNCTION ==========
  const checkUser = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profile);
        console.log('👤 User loaded:', user.email);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== LOGIN ==========
  const login = async (email, password) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      await checkUser();
      setIsGuest(false); // 👈 Turn off guest mode on login
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN UP ==========
  const signUp = async (email, password, fullName, role) => {
    try {
      setLoading(true);
      
      // Use your app scheme for redirect
      const redirectUrl = 'palengkehub://auth/callback';
      console.log('📧 Signup attempt for:', email);
      console.log('📧 Redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { 
            full_name: fullName, 
            role 
          }
        }
      });
      
      console.log('📧 Signup response:', data);
      
      if (error) {
        console.error('📧 Signup error:', error);
        throw error;
      }
      
      // Check if user already exists
      if (data?.user?.identities?.length === 0) {
        return { 
          success: false, 
          error: 'Email already registered. Please login instead.' 
        };
      }
      
      return { 
        success: true, 
        message: 'Verification email sent! Please check your inbox (and spam folder) and click the link.' 
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ========== LOGOUT ==========
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsGuest(false); // 👈 Turn off guest mode on logout
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== PROVIDER VALUE ==========
  const value = {
    user,
    profile,
    loading,
    isGuest,
    setIsGuest, // 👈 ADD THIS
    login,
    signUp,
    logout,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};