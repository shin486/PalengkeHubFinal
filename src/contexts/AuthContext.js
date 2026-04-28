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

  // ========== SIGN UP WITH DOCUMENT SUPPORT ==========
  const signUp = async (email, password, fullName, role, metadata = {}) => {
  try {
    console.log('📝 Starting sign up for:', email, 'role:', role);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          phone: metadata.phone || '',
          ...(role === 'vendor' && {
            stall_name: metadata.stall_name,
            stall_section: metadata.stall_section,
            stall_number: metadata.stall_number,
            requires_approval: metadata.requires_approval,
          })
        }
      }
    });

    if (error) {
      console.error('❌ Auth signup error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('User creation failed');
    }

    console.log('✅ Auth user created:', data.user.id);

    // ❌ REMOVE THIS ENTIRE BLOCK - The database trigger creates the profile
    // const { error: profileError } = await supabase
    //   .from('profiles')
    //   .insert({
    //     id: data.user.id,
    //     email: email,
    //     full_name: fullName,
    //     phone: metadata.phone || '',
    //     role: role,
    //   });

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // If vendor, create stall record and application
    if (role === 'vendor') {
      
      // Create stall record
      const { error: stallError } = await supabase
        .from('stalls')
        .insert({
          vendor_id: data.user.id,
          stall_name: metadata.stall_name,
          stall_number: metadata.stall_number,
          section: metadata.stall_section,
          is_active: false,
        });
      
      if (stallError) {
        console.error('⚠️ Stall creation error:', stallError);
      }
      
      // Create vendor application
      const documents = [];
      if (metadata.valid_id_url) {
        documents.push({ type: 'valid_id', url: metadata.valid_id_url });
      }
      if (metadata.business_permit_url) {
        documents.push({ type: 'business_permit', url: metadata.business_permit_url });
      }
      if (metadata.barangay_clearance_url) {
        documents.push({ type: 'barangay_clearance', url: metadata.barangay_clearance_url });
      }
      
      const { error: appError } = await supabase
        .from('vendor_applications')
        .insert({
          applicant_id: data.user.id,
          business_name: metadata.stall_name,
          category: metadata.stall_section,
          address: `Stall ${metadata.stall_number}, ${metadata.stall_section}`,
          documents: documents,
          status: 'pending',
          notes: `Stall ${metadata.stall_number} in ${metadata.stall_section} - Awaiting admin approval`,
        });
      
      if (appError) {
        console.error('⚠️ Application error:', appError);
      } else {
        console.log('✅ Vendor application created');
      }
    }

    console.log('🎉 Sign up completed successfully');
    return { 
      success: true, 
      message: role === 'vendor' 
        ? 'Application submitted for review! You will receive an email once approved.' 
        : 'Account created successfully! Please check your email to verify.'
    };
    
  } catch (error) {
    console.error('❌ Sign up error:', error);
    return { success: false, error: error.message };
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