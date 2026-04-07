import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../lib/supabase';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { CommonActions } from '@react-navigation/native';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuestState] = useState(false);

  // Wrapper for setIsGuest with logging
  const setIsGuest = (value) => {
    console.log('🔵 setIsGuest called with:', value, 'previous:', isGuest);
    setIsGuestState(value);
  };

  // ========== RESET GUEST MODE ON APP START ==========
  useEffect(() => {
    console.log('🔄 App started - resetting isGuest to false');
    setIsGuest(false);
  }, []);

  // ========== CHECK USER ON MOUNT ==========
  useEffect(() => {
    checkUser();
  }, []);

  // ========== DEEP LINK HANDLING ==========
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const { url } = event;
      console.log('🔗 Deep link received:', url);
      
      if (url.includes('auth/callback') || url.includes('access_token')) {
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

    const subscription = Linking.addEventListener('url', handleDeepLink);
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
      console.log('🔐 Attempting login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.log('❌ Login error:', error);
        throw error;
      }
      
      console.log('✅ Login successful:', data.user?.email);
      await checkUser();
      return { success: true };
    } catch (error) {
      console.error('Login error details:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN UP ==========
  const signUp = async (email, password, fullName, role) => {
    try {
      setLoading(true);
      
      const redirectUrl = 'palengkehub://auth/callback';
      console.log('📧 Signup attempt for:', email);
      
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
      
      if (error) throw error;
      
      if (data?.user?.identities?.length === 0) {
        return { 
          success: false, 
          error: 'Email already registered. Please login instead.' 
        };
      }
      
      return { 
        success: true, 
        message: 'Verification email sent! Please check your inbox.' 
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
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== RESET TO LOGIN ==========
  const resetToLogin = () => {
    console.log('🔄 resetToLogin called from AuthContext');
    if (global.navigationRef) {
      global.navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
      console.log('✅ Reset to Login executed');
    } else {
      console.log('❌ navigationRef not found');
    }
  };

  // ========== PROVIDER VALUE ==========
  const value = {
    user,
    profile,
    loading,
    isGuest,
    setIsGuest,
    login,
    signUp,
    logout,
    checkUser,
    resetToLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};