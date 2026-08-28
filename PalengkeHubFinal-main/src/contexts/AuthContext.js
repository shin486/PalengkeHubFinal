// src/contexts/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { CommonActions } from '@react-navigation/native';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// ── Multi-account per email support ───────────────────────────────────────────
const MAX_ACCOUNTS_PER_EMAIL = 5;

const normalizeEmail = (e) => (e || '').trim().toLowerCase();

// Uploads a vendor's ID/permit photo to storage and returns its public URL.
// Must run AFTER supabase.auth.signUp() has established a session — the
// vendor_documents bucket's RLS requires an authenticated uploader, and
// this function used to be called from SignUpScreen.js before any account
// existed, so every real vendor application's documents ended up empty
// (every upload failed with "new row violates row-level security policy",
// silently swallowed by the caller's own try/catch).
// vendor_documents is a private bucket — getPublicUrl() builds a URL that
// only resolves for an authenticated request, so it 400s for anyone (any
// admin, any <Image> tag, any plain link click) that isn't attaching a
// bearer token, which a browser navigation or RN <Image> never does. A
// long-lived signed URL is a real URL that works with zero auth headers,
// same as a genuinely public one — 10 years is effectively permanent for
// documents/photos that should stay viewable indefinitely.
export const SIGNED_URL_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;

export const uploadVendorDocument = async (file, folder) => {
  if (!file) return null;
  try {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const contentType = file.mimeType || file.type || 'image/jpeg';
    const { data, error } = await supabase.storage
      .from('vendor_documents')
      .upload(`${folder}/${Date.now()}_${file.name}`, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      });
    if (error) throw error;
    const { data: urlData, error: signError } = await supabase.storage
      .from('vendor_documents')
      .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);
    if (signError) throw signError;
    return urlData.signedUrl;
  } catch (error) {
    console.error('Vendor document upload error:', error);
    return null;
  }
};

// Generates a deterministic auth email for the nth account using a real email.
// Account #1 uses the real email; accounts #2–#5 use RFC 5233 "+" aliases that
// still deliver to the same inbox (e.g. juan@gmail.com  juan+ph2@gmail.com).
const generateAuthEmail = (realEmail, index) => {
  const normalized = normalizeEmail(realEmail);
  if (index <= 1) return normalized;
  const atIndex = normalized.indexOf('@');
  if (atIndex === -1) return normalized;
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  return `${local}+ph${index}@${domain}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuestState] = useState(false);

  // Wrapper for setIsGuest with logging
  const setIsGuest = useCallback((value) => {
    console.log(' setIsGuest called with:', value, 'previous:', isGuest);
    setIsGuestState(value);
  }, [isGuest]);

  // ========== RESET GUEST MODE ON APP START ==========
  useEffect(() => {
    console.log(' App started - resetting isGuest to false');
    setIsGuestState(false);
  }, []);

  // ========== CHECK USER ON MOUNT ==========
  useEffect(() => {
    checkUser();
  }, []);

  // ========== SESSION KEEP-ALIVE (elderly "never log me out") ==========
  // Refreshes the Supabase session periodically while the app is open so the
  // access token doesn't expire mid-shopping trip. Best effort — failures are
  // silent because a dead refresh token still falls back to password login.
  useEffect(() => {
    const refresh = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.refreshSession();
        }
      } catch (e) {
        // silent — session may just not exist
      }
    };
    const interval = setInterval(refresh, 15 * 60 * 1000); // every 15 minutes
    return () => clearInterval(interval);
  }, []);

  // ========== DEEP LINK HANDLING ==========
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const { url } = event;
      console.log(' Deep link received:', url);
      
      if (url.includes('auth/callback') || url.includes('access_token')) {
        const { data, error } = await supabase.auth.getSession();
        
        if (data?.session) {
          Alert.alert(
            'Email Verified!',
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

  const extra = Constants.manifest?.extra || Constants.expoConfig?.extra || {};
  const authProxyUrl = extra.authProxyUrl
    || process.env.EXPO_PUBLIC_AUTH_PROXY_URL
    || 'https://supabase-proxy.jhayvy.workers.dev';

  const sendAuthenticatorSms = useCallback(async (phone) => {
    console.log(' sendAuthenticatorSms called. authProxyUrl:', authProxyUrl ? '(configured)' : '(MISSING)');
    if (!authProxyUrl) {
      throw new Error('Auth proxy URL is not configured.');
    }

    if (!phone || typeof phone !== 'string') {
      throw new Error('A valid phone number is required to send the authenticator SMS.');
    }

    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.slice(1);
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `63${normalizedPhone.slice(1)}`;
    }

    console.log(' Requesting iProg SMS for:', normalizedPhone);
    const response = await fetch(`${authProxyUrl}/iprog/send-authenticator-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: normalizedPhone }),
    });

    const data = await response.json();
    console.log(' iProg response status:', response.status, '| has code:', !!data?.verification_code);

    // The proxy can return a non-2xx status (e.g. carrier/provider hiccup)
    // while still generating and returning a usable verification_code in
    // the same body — checking response.ok first threw that code away, so
    // the OTP modal would open with no code that could ever pass, leaving
    // signup permanently stuck with no recovery path. Use the code if it's
    // there regardless of status; only fail hard if there's truly none.
    if (!data?.verification_code) {
      throw new Error(data?.error || 'Failed to send authenticator SMS.');
    }

    return {
      verification_code: data.verification_code,
      expires_in_minutes: data.expires_in_minutes,
      deliveryWarning: !response.ok ? (data?.error || 'The SMS may not have been delivered.') : null,
    };
  }, [authProxyUrl]);

  const sendEmailVerificationCode = useCallback(async (email) => {
    console.log(' sendEmailVerificationCode called. authProxyUrl:', authProxyUrl ? '(configured)' : '(MISSING)');
    if (!authProxyUrl) {
      throw new Error('Auth proxy URL is not configured.');
    }

    if (!email || typeof email !== 'string') {
      throw new Error('A valid email address is required to send the verification code.');
    }

    const response = await fetch(`${authProxyUrl}/resend/send-authenticator-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await response.json();
    console.log(' Resend response status:', response.status, '| has code:', !!data?.verification_code);

    // Same fix as sendAuthenticatorSms above — the proxy can return a
    // non-2xx status (email provider down/rejected the address) while
    // still generating a usable verification_code. Discarding it here
    // made every delivery hiccup a dead end with no way to ever verify.
    if (!data?.verification_code) {
      throw new Error(data?.error || 'Failed to send verification email.');
    }

    return {
      verification_code: data.verification_code,
      expires_in_minutes: data.expires_in_minutes,
      deliveryWarning: !response.ok ? (data?.error || 'The email may not have been delivered.') : null,
    };
  }, [authProxyUrl]);

  // ========== CHECK USER FUNCTION ==========
  const checkUser = useCallback(async () => {
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
        console.log(' User loaded:', user.email);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== LOGIN ==========
  const login = useCallback(async (identifier, password) => {
    try {
      setLoading(true);
      console.log(' Attempting login for:', identifier);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?\d{8,15}$/;
      const credentials = {};

      if (emailRegex.test(identifier)) {
        credentials.email = identifier;
      } else if (phoneRegex.test(identifier.trim())) {
        credentials.phone = identifier.trim();
      } else {
        throw new Error('Enter a valid email or phone number');
      }
      credentials.password = password;

      let signInResult = { data: null, error: null };

      if (credentials.email) {
        const directEmail = normalizeEmail(credentials.email);
        const candidates = [directEmail];
        for (let i = 2; i <= MAX_ACCOUNTS_PER_EMAIL; i++) {
          candidates.push(generateAuthEmail(directEmail, i));
        }

        const uniqueCandidates = [...new Set(candidates)];

        let firstError = null;
        let matched = [];

        for (const candidate of uniqueCandidates) {
          const attempt = await supabase.auth.signInWithPassword({
            email: candidate,
            password,
          });

          if (attempt.data?.user) {
            const profile = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', attempt.data.user.id)
              .single();
            matched.push({
              authEmail: candidate,
              userId: attempt.data.user.id,
              full_name: profile?.data?.full_name || candidate,
              role: profile?.data?.role || null,
            });
            if (!signInResult.data) {
              signInResult = attempt;
            }
          } else if (attempt.error) {
            if (!firstError) firstError = attempt.error;
          }
        }

        if (matched.length === 1) {
          console.log(' Login successful (single account):', matched[0].authEmail);
          await checkUser();
          return { success: true, account: matched[0] };
        }

        if (matched.length > 1) {
          console.log(' Multiple accounts found — returning picker:', matched.length);
          try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } catch (signOutErr) {
            console.warn(' Could not sign out before showing account picker:', signOutErr);
          }
          return {
            success: false,
            multipleAccounts: true,
            accounts: matched,
            error: 'Multiple accounts found. Please choose which one to sign in as.',
          };
        }

        if (firstError) {
          console.log(' Login error:', firstError);
          return { success: false, error: firstError.message };
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      
      if (error) {
        console.log(' Login error:', error);
        throw error;
      }
      
      console.log(' Login successful:', data.user?.email);
      await checkUser();
      return { success: true };
    } catch (error) {
      console.error('Login error details:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [checkUser]);

  const loginAsAccount = useCallback(async (authEmail, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (error) {
        console.error(' loginAsAccount error:', error);
        return { success: false, error: error.message };
      }

      console.log(' loginAsAccount success:', authEmail);
      await checkUser();
      return { success: true, account: { authEmail, userId: data.user?.id } };
    } catch (error) {
      console.error('loginAsAccount error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [checkUser]);

  // ========== SIGN UP WITH DOCUMENT SUPPORT ==========
  const signUp = useCallback(async (email, password, fullName, role, metadata = {}) => {
    try {
      console.log(' Starting sign up for:', email, 'role:', role, 'verification:', metadata.verificationMethod);

      const realEmail = normalizeEmail(email);
      const { count: accountCount, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('email', realEmail);

      if (countError) {
        console.error(' Could not count existing accounts for email:', countError);
      } else {
        if (accountCount >= MAX_ACCOUNTS_PER_EMAIL) {
          return {
            success: false,
            error: `This email already has ${MAX_ACCOUNTS_PER_EMAIL} accounts. The maximum of ${MAX_ACCOUNTS_PER_EMAIL} accounts per email has been reached.`,
          };
        }

        const { data: dupNames, error: dupError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('email', realEmail)
          .ilike('full_name', fullName.trim());

        if (dupError) {
          console.error(' Could not check duplicate name:', dupError);
        } else if (dupNames && dupNames.length > 0) {
          return {
            success: false,
            error: `An account with the name "${fullName.trim()}" already exists for this email. Please use a different name.`,
          };
        }
      }

      const authEmail = generateAuthEmail(realEmail, (accountCount || 0) + 1);

      const signUpPayload = {
        email: authEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            email: realEmail,
            phone: metadata.phone || '',
            verification_method: metadata.verificationMethod || 'email',
            ...(role === 'vendor' && {
              stall_name: metadata.stall_name,
              stall_section: metadata.stall_section,
              stall_number: metadata.stall_number,
              requires_approval: metadata.requires_approval,
            })
          }
        }
      };

      const { data, error } = await supabase.auth.signUp(signUpPayload);

      if (error) {
        console.error(' Auth signup error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('User creation failed');
      }

      console.log(' Auth user created:', data.user.id, '| authEmail:', authEmail);
      console.log(' Verification method:', metadata.verificationMethod || 'email');

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await supabase
          .from('profiles')
          .update({ email: realEmail })
          .eq('id', data.user.id);
      } catch (profileEmailErr) {
        console.warn(' Could not normalize profile email:', profileEmailErr);
      }

      if (role === 'vendor') {
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
          console.error(' Stall creation error:', stallError);
        }
        
        // The session from supabase.auth.signUp() above is live at this
        // point (signOut() hasn't run yet) — this is the only window in
        // the whole flow where the vendor_documents bucket's RLS will
        // actually accept these uploads.
        const [validIdUrl, businessPermitUrl] = await Promise.all([
          uploadVendorDocument(metadata.validIdFile, `valid_ids/${data.user.id}`),
          uploadVendorDocument(metadata.businessPermitFile, `business_permits/${data.user.id}`),
        ]);

        const documents = [];
        if (validIdUrl) {
          documents.push({ type: 'valid_id', url: validIdUrl });
        }
        if (businessPermitUrl) {
          documents.push({ type: 'business_permit', url: businessPermitUrl });
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
          console.error(' Application error:', appError);
        } else {
          console.log(' Vendor application created');
        }
      }

      console.log(' Sign up completed successfully');

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error(' Sign out after signup error:', signOutError);
      } else {
        console.log(' Signed out after signup — user must verify before login.');
      }
      setUser(null);
      setProfile(null);

      return { 
        success: true, 
        authEmail,
        message: role === 'vendor' 
          ? 'Application submitted for review! You will receive an email once approved.' 
          : metadata.verificationMethod === 'sms'
            ? 'Account created successfully! Please check your phone for the verification code.'
            : 'Account created successfully! Please check your email to verify.',
      };
      
    } catch (error) {
      console.error(' Sign up error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // ========== LOGOUT ==========
  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsGuestState(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // ========== RESET TO LOGIN ==========
  const resetToLogin = useCallback(() => {
    console.log(' resetToLogin called from AuthContext');
    if (global.navigationRef) {
      global.navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
      console.log(' Reset to Login executed');
    } else {
      console.log(' navigationRef not found');
    }
  }, []);

  // ============================================================
  //  FIXED: Memoize the context value to prevent re-renders
  // ============================================================
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isGuest,
    setIsGuest,
    login,
    loginAsAccount,
    signUp,
    sendAuthenticatorSms,
    sendEmailVerificationCode,
    logout,
    checkUser,
    resetToLogin,
  }), [
    user,
    profile,
    loading,
    isGuest,
    setIsGuest,
    login,
    loginAsAccount,
    signUp,
    sendAuthenticatorSms,
    sendEmailVerificationCode,
    logout,
    checkUser,
    resetToLogin,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};