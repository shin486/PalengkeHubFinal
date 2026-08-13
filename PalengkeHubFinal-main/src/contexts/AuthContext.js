import React, { createContext, useState, useEffect, useContext } from 'react';
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

// Generates a deterministic auth email for the nth account using a real email.
// Account #1 uses the real email; accounts #2–#5 use RFC 5233 "+" aliases that
// still deliver to the same inbox (e.g. juan@gmail.com → juan+ph2@gmail.com).
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

  const extra = Constants.manifest?.extra || Constants.expoConfig?.extra || {};
  // Fallback chain for the auth proxy URL:
  // 1. extra from app.config.js
  // 2. Inlined EXPO_PUBLIC_AUTH_PROXY_URL env var
  // 3. The deployed Cloudflare Worker URL as a final fallback.
  //    (The old localhost:8787 dev default caused "Failed to fetch" whenever
  //    the local wrangler dev server wasn't running.)
  const authProxyUrl = extra.authProxyUrl
    || process.env.EXPO_PUBLIC_AUTH_PROXY_URL
    || 'https://supabase-proxy.jhayvy.workers.dev';

  const sendAuthenticatorSms = async (phone) => {
    console.log('📤 sendAuthenticatorSms called. authProxyUrl:', authProxyUrl ? '(configured)' : '(MISSING)');
    if (!authProxyUrl) {
      throw new Error('Auth proxy URL is not configured.');
    }

    if (!phone || typeof phone !== 'string') {
      throw new Error('A valid phone number is required to send the authenticator SMS.');
    }

    // iProg requires international format (e.g. 639260150443).
    // Convert common local formats: 09260150443 → 639260150443, +639... → 639...
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.slice(1);
    } else if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `63${normalizedPhone.slice(1)}`;
    }

    console.log('📱 Requesting iProg SMS for:', normalizedPhone);
    const response = await fetch(`${authProxyUrl}/iprog/send-authenticator-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: normalizedPhone }),
    });

    const data = await response.json();
    console.log('📨 iProg response status:', response.status, '| has code:', !!data?.verification_code);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send authenticator SMS.');
    }

    if (!data?.verification_code) {
      throw new Error('Invalid response from authenticator SMS service.');
    }

    return {
      verification_code: data.verification_code,
      expires_in_minutes: data.expires_in_minutes,
    };
  };

  // ========== EMAIL VERIFICATION (6-DIGIT OTP VIA RESEND) ==========
  // Sends a 6-digit numeric code to the user's email through the Cloudflare
  // Worker → Resend API (same UX as the SMS authenticator via iProg).
  // Returns the generated code so the screen can compare it locally before
  // auto-logging the user in (identical gate-before-login flow as SMS).
  const sendEmailVerificationCode = async (email) => {
    console.log('📤 sendEmailVerificationCode called. authProxyUrl:', authProxyUrl ? '(configured)' : '(MISSING)');
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
    console.log('📨 Resend response status:', response.status, '| has code:', !!data?.verification_code);
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send verification email.');
    }

    if (!data?.verification_code) {
      throw new Error('Invalid response from email verification service.');
    }

    return {
      verification_code: data.verification_code,
      expires_in_minutes: data.expires_in_minutes,
    };
  };

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
  const login = async (identifier, password) => {
    try {
      setLoading(true);
      console.log('🔐 Attempting login for:', identifier);

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

      // ── Multi-account per email: alias fallback + picker ──
      // Supabase auth users have unique emails (the +alias), but the *real*
      // email is stored on the profile. So when a user logs in with their real
      // email, the auth email might be juan+ph2@gmail.com (or +ph3 ... +ph5).
      // Try the direct email first, then the deterministic aliases.
      let signInResult = { data: null, error: null };

      if (credentials.email) {
        const directEmail = normalizeEmail(credentials.email);
        const candidates = [directEmail];
        for (let i = 2; i <= MAX_ACCOUNTS_PER_EMAIL; i++) {
          candidates.push(generateAuthEmail(directEmail, i));
        }

        // Dedupe (in case directEmail already includes a "+phN" alias)
        const uniqueCandidates = [...new Set(candidates)];

        let firstError = null;
        let matched = [];

        for (const candidate of uniqueCandidates) {
          const attempt = await supabase.auth.signInWithPassword({
            email: candidate,
            password,
          });

          if (attempt.data?.user) {
            // Found a valid account with this email+password
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
            // Remember this attempt's session so we can restore it if needed
            if (!signInResult.data) {
              signInResult = attempt;
            }
          } else if (attempt.error) {
            if (!firstError) firstError = attempt.error;
          }
        }

        if (matched.length === 1) {
          // ── Admin access control: TEMPORARILY DISABLED for testing ──
          // if (matched[0].role === 'admin') {
          //   await supabase.auth.signOut();
          //   setUser(null);
          //   setProfile(null);
          //   return {
          //     success: false,
          //     adminWebOnly: true,
          //     error: 'Admin accounts can only log in through the PalengkeHub web portal. Please visit the Admin Login page on the website. Customers and vendors can log in here on the app.',
          //   };
          // }
          console.log('✅ Login successful (single account):', matched[0].authEmail);
          await checkUser();
          return { success: true, account: matched[0] };
        }

        if (matched.length > 1) {
          console.log('👥 Multiple accounts found — returning picker:', matched.length);
          // IMPORTANT: each successful signInWithPassword above created a
          // session (ending with the LAST matched account). Sign out so the
          // picker can choose without a stale session lingering.
          try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } catch (signOutErr) {
            console.warn('⚠️ Could not sign out before showing account picker:', signOutErr);
          }
          return {
            success: false,
            multipleAccounts: true,
            accounts: matched,
            error: 'Multiple accounts found. Please choose which one to sign in as.',
          };
        }

        // No candidate matched → report the first error (usually "invalid login")
        if (firstError) {
          console.log('❌ Login error:', firstError);
          return { success: false, error: firstError.message };
        }
      }

      // Fall back to the phone-based sign-in path (no multi-account aliasing)
      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      
      if (error) {
        console.log('❌ Login error:', error);
        throw error;
      }
      
      // ── Admin access control: TEMPORARILY DISABLED for testing ──
      // const { data: loginProfile } = await supabase
      //   .from('profiles')
      //   .select('role')
      //   .eq('id', data.user.id)
      //   .single();

      // if (loginProfile?.role === 'admin') {
      //   await supabase.auth.signOut();
      //   setUser(null);
      //   setProfile(null);
      //   return {
      //     success: false,
      //     adminWebOnly: true,
      //     error: 'Admin accounts can only log in through the PalengkeHub web portal. Please visit the Admin Login page on the website. Customers and vendors can log in here on the app.',
      //   };
      // }
      
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

  // Sign in as a specific account (chosen from the multi-account picker).
  // The screen passes the alias email + the password already entered.
  const loginAsAccount = async (authEmail, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (error) {
        console.error('❌ loginAsAccount error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ loginAsAccount success:', authEmail);
      await checkUser();
      return { success: true, account: { authEmail, userId: data.user?.id } };
    } catch (error) {
      console.error('loginAsAccount error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN UP WITH DOCUMENT SUPPORT ==========
  const signUp = async (email, password, fullName, role, metadata = {}) => {
  try {
    console.log('📝 Starting sign up for:', email, 'role:', role, 'verification:', metadata.verificationMethod);

    // ── Multi-account per email: enforce limit + unique full name ──
    const realEmail = normalizeEmail(email);
    const { count: accountCount, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', realEmail);

    if (countError) {
      console.error('⚠️ Could not count existing accounts for email:', countError);
    } else {
      if (accountCount >= MAX_ACCOUNTS_PER_EMAIL) {
        return {
          success: false,
          error: `This email already has ${MAX_ACCOUNTS_PER_EMAIL} accounts. The maximum of ${MAX_ACCOUNTS_PER_EMAIL} accounts per email has been reached.`,
        };
      }

      // Reject duplicate full name for the same email
      const { data: dupNames, error: dupError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('email', realEmail)
        .ilike('full_name', fullName.trim());

      if (dupError) {
        console.error('⚠️ Could not check duplicate name:', dupError);
      } else if (dupNames && dupNames.length > 0) {
        return {
          success: false,
          error: `An account with the name "${fullName.trim()}" already exists for this email. Please use a different name.`,
        };
      }
    }

    // Account #1 uses the real email; #2–#5 use a "+" alias that still
    // delivers to the same inbox (email OTP keeps working).
    const authEmail = generateAuthEmail(realEmail, (accountCount || 0) + 1);

    // Always create the account with the auth email so it is stored in the
    // database first. The chosen verification (email or SMS via iProg)
    // happens AFTER account creation.
    const signUpPayload = {
      email: authEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          email: realEmail, // <-- real email for display + future account counting
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
      console.error('❌ Auth signup error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('User creation failed');
    }

    console.log('✅ Auth user created:', data.user.id, '| authEmail:', authEmail);
    console.log('🔐 Verification method:', metadata.verificationMethod || 'email');

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // IMPORTANT: Ensure the profile stores the REAL email (not the +alias),
    // so future account-count checks work even if the DB trigger stored the
    // alias. RLS usually allows a user to update their own row.
    try {
      await supabase
        .from('profiles')
        .update({ email: realEmail })
        .eq('id', data.user.id);
    } catch (profileEmailErr) {
      console.warn('⚠️ Could not normalize profile email:', profileEmailErr);
    }

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

    // IMPORTANT: Sign out immediately after account creation.
    // Because "Confirm email" is disabled in this Supabase project, signUp()
    // returns a session and auto-logs the user in. That would cause
    // RootNavigator to immediately navigate away from the SignUp screen,
    // unmounting the OTP modal before it can appear.
    // The user must verify their phone (iProg SMS) / email BEFORE logging in.
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('⚠️ Sign out after signup error:', signOutError);
    } else {
      console.log('🚪 Signed out after signup — user must verify before login.');
    }
    // Clear the in-memory user/profile so the app doesn't treat the
    // just-created (unverified) user as logged in.
    setUser(null);
    setProfile(null);

    return { 
      success: true, 
      authEmail,           // <-- used by the screen for auto-login after OTP
      message: role === 'vendor' 
        ? 'Application submitted for review! You will receive an email once approved.' 
        : metadata.verificationMethod === 'sms'
          ? 'Account created successfully! Please check your phone for the verification code.'
          : 'Account created successfully! Please check your email to verify.',
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
    loginAsAccount,
    signUp,
    sendAuthenticatorSms,
    sendEmailVerificationCode,
    logout,
    checkUser,
    resetToLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};