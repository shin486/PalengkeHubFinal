// src/contexts/AuthContext.js

import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Required once at module scope — expo-web-browser's own recommendation —
// so WebBrowser.openAuthSessionAsync's native browser overlay actually
// dismisses itself when the OAuth provider redirects back into the app.
WebBrowser.maybeCompleteAuthSession();

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
    // fetch(uri).blob() is unreliable on Android for the content:// URIs
    // the document/image picker can return — it fails silently on some
    // pickers/OS versions. expo-file-system isn't available on web
    // though, so native reads the file as base64 and decodes to an
    // ArrayBuffer, while web keeps using fetch+blob (which works fine
    // there for blob:/data: URIs).
    let blob;
    if (Platform.OS === 'web') {
      const response = await fetch(file.uri);
      blob = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      blob = decodeBase64(base64);
    }
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
    console.log(' iProg response status:', response.status);

    // The code is generated and checked server-side now (see
    // verifyAuthenticatorCode) — the proxy never hands it back. A 400 here
    // means the request itself was malformed (no code was ever generated);
    // anything else means a code exists server-side even if this specific
    // status is non-2xx (e.g. a carrier/provider hiccup), so we still open
    // the OTP screen with a warning rather than dead-ending signup — the
    // real verify call is the actual source of truth either way.
    if (response.status === 400) {
      throw new Error(data?.error || 'Failed to send authenticator SMS.');
    }

    return {
      identifier: normalizedPhone,
      expires_in_minutes: data?.expires_in_minutes,
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
    console.log(' Resend response status:', response.status);

    // Same shape as sendAuthenticatorSms above — the code is generated and
    // checked server-side now (see verifyAuthenticatorCode), never handed
    // back here. A 400 means the request was malformed (no code was ever
    // generated); anything else still opens the OTP screen, with a warning
    // if the status wasn't 2xx.
    if (response.status === 400) {
      throw new Error(data?.error || 'Failed to send verification email.');
    }

    return {
      identifier: email.trim(),
      expires_in_minutes: data?.expires_in_minutes,
      deliveryWarning: !response.ok ? (data?.error || 'The email may not have been delivered.') : null,
    };
  }, [authProxyUrl]);

  const verifyAuthenticatorCode = useCallback(async ({ channel, identifier, code }) => {
    if (!authProxyUrl) {
      throw new Error('Auth proxy URL is not configured.');
    }
    if (!channel || !identifier || !code) {
      throw new Error('Missing verification details.');
    }

    const response = await fetch(`${authProxyUrl}/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, identifier, code }),
    });

    const data = await response.json().catch(() => ({}));
    console.log(' verifyAuthenticatorCode response status:', response.status, '| success:', !!data?.success);

    return {
      success: !!data?.success,
      error: data?.error || null,
      attemptsRemaining: data?.attemptsRemaining,
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

        if (profile?.role === 'admin') {
          console.log(' Admin session restored in app — signing out (admin is web-only)');
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }

        setProfile(profile);
        console.log(' User loaded:', user.email);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== SOCIAL SIGN-IN (Google / Facebook) — customers only ==========
  // OAuth "sign in" and "sign up" are literally the same handshake as far
  // as Supabase is concerned — completing it always yields an
  // authenticated auth.users row, created fresh on a first-ever attempt
  // with that identity (or reused, and auto-linked by Supabase to an
  // existing account if the verified email already matches one). Whether
  // that's allowed to become a PalengkeHub account depends on `mode`,
  // which the caller sets from which screen/button was tapped:
  //   - mode 'signup': no matching profiles row yet -> create one (role
  //     'consumer', populated from the provider's name/avatar/email).
  //   - mode 'login': no matching profiles row yet -> this identity has
  //     never been used here before. Sign back out and report it rather
  //     than silently creating an account from a plain "sign in" tap —
  //     an account must be created (via the signup button) first.
  // If a profiles row already exists (this identity was used before, or
  // got auto-linked), both modes just log the user in.
  const finishOAuthSignIn = useCallback(async (sessionUser, mode) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (existingProfile?.role) {
      if (existingProfile.role !== 'consumer') {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return { success: false, error: 'Google/Facebook sign-in is only available for customer accounts.' };
      }
      await checkUser();
      return { success: true };
    }

    if (mode !== 'signup') {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      return {
        success: false,
        needsSignup: true,
        error: 'No PalengkeHub account is linked to this login yet. Please sign up first.',
      };
    }

    // update, not upsert -- the on_auth_user_created trigger fires
    // synchronously within the same transaction as the auth.users
    // insert (OAuth-created rows included), so by the time a valid
    // session exists here the profiles row is already guaranteed to
    // exist. .upsert()'s INSERT ... ON CONFLICT DO UPDATE requires the
    // (admin-only) insert policy even when it ends up updating an
    // existing row -- so this always 403'd for a real user, meaning
    // Google/Facebook sign-in has likely always failed at this exact
    // step, immediately signing the user back out with "Could not
    // finish creating your account."
    const meta = sessionUser.user_metadata || {};
    const { error: upsertError } = await supabase
      .from('profiles')
      .update({
        email: sessionUser.email,
        full_name: meta.full_name || meta.name || 'PalengkeHub Customer',
        avatar_url: meta.avatar_url || meta.picture || null,
      })
      .eq('id', sessionUser.id);

    if (upsertError) {
      console.error(' OAuth profile creation error:', upsertError);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      return { success: false, error: 'Could not finish creating your account. Please try again.' };
    }

    await checkUser();
    return { success: true };
  }, [checkUser]);

  // Native: opens the provider's consent screen in an in-app browser tab
  // and captures the redirect directly — no deep-link event needed. Web:
  // signInWithOAuth navigates the whole tab away, so this never "returns"
  // on web; the WEB OAUTH REDIRECT RETURN effect below picks the flow back
  // up once the browser lands back on the app with the provider's response.
  const signInWithOAuthProvider = useCallback(async (provider, mode) => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem('pk_oauth_mode', mode);
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        });
        if (error) {
          await AsyncStorage.removeItem('pk_oauth_mode');
          return { success: false, error: error.message };
        }
        return { success: true, redirecting: true };
      }

      const redirectTo = makeRedirectUri({ scheme: 'palengkehub', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        return { success: false, error: error?.message || 'Could not start sign-in.' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        return { success: false, cancelled: true, error: 'Sign-in was cancelled.' };
      }

      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (exchangeError || !exchangeData?.session) {
        return { success: false, error: exchangeError?.message || 'Could not complete sign-in.' };
      }

      return await finishOAuthSignIn(exchangeData.session.user, mode);
    } catch (error) {
      console.error(' OAuth sign-in error:', error);
      return { success: false, error: error.message };
    }
  }, [finishOAuthSignIn]);

  // ========== WEB OAUTH REDIRECT RETURN ==========
  // Web has no equivalent to WebBrowser.openAuthSessionAsync's captured
  // redirect — signInWithOAuthProvider above navigates the tab away
  // entirely, so the app remounts fresh once the provider sends it back
  // here. `pk_oauth_mode` (stashed in AsyncStorage, which on web is
  // backed by localStorage — survives the reload) is how this effect
  // recovers whether the tap that started this was Login or Sign Up.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const url = window.location.href;
    if (!url.includes('code=') && !url.includes('access_token=')) return;

    (async () => {
      try {
        const mode = (await AsyncStorage.getItem('pk_oauth_mode')) || 'login';
        await AsyncStorage.removeItem('pk_oauth_mode');

        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        // Strip the OAuth params so refreshing the page doesn't replay this.
        window.history.replaceState(null, '', window.location.pathname);

        if (error || !data?.session) {
          console.error(' Web OAuth exchange error:', error);
          return;
        }

        const result = await finishOAuthSignIn(data.session.user, mode);
        if (!result.success) {
          Alert.alert(
            result.needsSignup ? 'No account found' : 'Sign-in failed',
            result.error || 'Please try again.'
          );
        }
      } catch (err) {
        console.error(' Web OAuth return handling error:', err);
      }
    })();
  }, [finishOAuthSignIn]);

  // ========== LOGIN ==========
  const login = useCallback(async (identifier, password) => {
    // Deliberately does NOT toggle the global `loading` flag the way
    // checkUser() does. RootNavigator unmounts the entire Stack.Navigator
    // (including LoginScreen itself) whenever `loading` is true, to show
    // LoadingSpinner during the app's initial boot check. If login() also
    // flipped that flag, every sign-in attempt would tear down LoginScreen
    // for its duration and remount a *fresh* instance once it settled —
    // fine for a successful single-account login (which navigates away
    // regardless), but fatal for the multi-account-picker and error paths,
    // which return to LoginScreen and rely on its OWN local state
    // (pickerVisible, error text) to show the follow-up UI. That state was
    // being set on the old, already-unmounted instance and thrown away the
    // instant the remount happened, which surfaced as "sign in just
    // refreshes back to a blank Login screen, no error, nothing" — for
    // multi-account emails, that's every login attempt: LoginScreen's own
    // local isLoading (set below in handleLogin) already gives the button
    // its spinner, so nothing user-visible needs AuthContext.loading here.
    try {
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

        // Only probe the alias slots that actually exist. Accounts are
        // always assigned the next sequential +phN slot on signup (see
        // generateAuthEmail above), so a count of N means slots 1..N are
        // populated and nothing above N is — trying signInWithPassword
        // against all 5 possible slots on every single login attempt (the
        // previous behavior, unconditionally) sends up to 5x the real auth
        // requests per attempt. That's enough to burn through Supabase's
        // own auth rate limit from nothing more than one or two people
        // mistyping their password, locking out everyone behind the same
        // IP. This cheap RPC (a plain count, not an auth attempt, so it
        // isn't subject to that rate limit) tells us how many slots are
        // worth trying before we start spending real auth attempts.
        let accountCount = 1;
        try {
          const { data: countData, error: countError } = await supabase
            .rpc('check_email_account_count', { p_email: directEmail });
          if (!countError && typeof countData === 'number' && countData > 0) {
            accountCount = Math.min(countData, MAX_ACCOUNTS_PER_EMAIL);
          } else if (countError) {
            // A failed RPC call resolves with {data:null, error} here — it
            // does NOT throw — so this branch, not the catch below, is what
            // actually handles "RPC unreachable" in practice. Without it,
            // accountCount silently stayed at the default of 1 on any RPC
            // failure (missing function, RLS, network), under-trying for
            // any real multi-account email instead of falling back to
            // probing every slot the way the comment below always claimed.
            accountCount = MAX_ACCOUNTS_PER_EMAIL;
          }
        } catch (e) {
          // RPC unreachable — fall back to the old behavior (probe every
          // slot) rather than risk under-trying and missing a real account.
          accountCount = MAX_ACCOUNTS_PER_EMAIL;
        }

        const candidates = [directEmail];
        for (let i = 2; i <= accountCount; i++) {
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

        const adminMatched = matched.filter((m) => m.role === 'admin');
        matched = matched.filter((m) => m.role !== 'admin');

        if (matched.length === 0 && adminMatched.length > 0) {
          try {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } catch (signOutErr) {
            console.warn(' Could not sign out admin-only account:', signOutErr);
          }
          return {
            success: false,
            adminWebOnly: true,
            error: 'Admin accounts can only sign in through the PalengkeHub web portal.',
          };
        }

        if (matched.length === 1) {
          // The loop above tries every candidate@n alias for this email
          // even after the real one already succeeds, to find out whether
          // more than one account shares this email+password. Supabase's
          // client treats each signInWithPassword call as authoritative —
          // a LATER *failed* attempt (against a candidate alias that
          // doesn't exist) clears the session an EARLIER successful one
          // just set. That only happens when more than one candidate was
          // actually tried, though — accountCount above now bounds the
          // candidate list to real slots, so the common case (one account
          // on this email) makes exactly one signInWithPassword call, and
          // there's no later attempt left to clear anything.
          //
          // Re-authenticating unconditionally here used to be the fix, but
          // now that the common case is down to one call, that extra call
          // reintroduces the exact same risk for the most common login of
          // all: if THIS redundant call has any transient hiccup (rate
          // limit, network blip), it clears the perfectly good session the
          // single try above just established, and login gets reported as
          // failed despite having actually succeeded — "sign in just
          // refreshes back to Login". Only worth the extra round-trip when
          // more than one candidate was genuinely tried.
          if (uniqueCandidates.length > 1) {
            const { error: reauthError } = await supabase.auth.signInWithPassword({ email: matched[0].authEmail, password });
            if (reauthError) {
              // Previously unchecked — the caller was told login succeeded
              // even when no session actually exists (e.g. rate-limited
              // after the earlier per-candidate attempts, or a transient
              // network blip), leaving the user stuck on whatever screen
              // trusted that false "success".
              console.error(' Re-authentication failed for single matched account:', reauthError.message);
              return { success: false, error: reauthError.message || 'Login failed. Please try again.' };
            }
          }
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

      const { data: phoneProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (phoneProfile?.role === 'admin') {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return {
          success: false,
          adminWebOnly: true,
          error: 'Admin accounts can only sign in through the PalengkeHub web portal.',
        };
      }

      console.log(' Login successful:', data.user?.email);
      await checkUser();
      return { success: true };
    } catch (error) {
      console.error('Login error details:', error);
      return { success: false, error: error.message };
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

      const { data: accountProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (accountProfile?.role === 'admin') {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return {
          success: false,
          adminWebOnly: true,
          error: 'Admin accounts can only sign in through the PalengkeHub web portal.',
        };
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
        const [validIdUrl, businessPermitUrl, gcashQrUrl] = await Promise.all([
          uploadVendorDocument(metadata.validIdFile, `valid_ids/${data.user.id}`),
          uploadVendorDocument(metadata.businessPermitFile, `business_permits/${data.user.id}`),
          uploadVendorDocument(metadata.gcashQrFile, `gcash_qr/${data.user.id}`),
        ]);

        // The stall the vendor is applying for already exists (see the
        // insert above) — the GCash QR belongs on it directly so checkout
        // can show it right away once the application is approved, not
        // just on the application record for admin review.
        if (gcashQrUrl) {
          const { error: gcashError } = await supabase
            .from('stalls')
            .update({ gcash_qr_url: gcashQrUrl, gcash_number: metadata.gcashNumber || null })
            .eq('vendor_id', data.user.id);
          if (gcashError) {
            console.error(' Stall GCash update error:', gcashError);
          }
        }

        const documents = [];
        if (validIdUrl) {
          documents.push({ type: 'valid_id', url: validIdUrl });
        }
        if (businessPermitUrl) {
          documents.push({ type: 'business_permit', url: businessPermitUrl });
        }
        if (gcashQrUrl) {
          documents.push({ type: 'gcash_qr', url: gcashQrUrl });
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
      try {
        if (typeof global.navigationRef.reset === 'function') {
          global.navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        } else {
          global.navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        }
        console.log(' Reset to Login executed');
      } catch (err) {
        console.error('Error executing resetToLogin:', err);
      }
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
    signInWithOAuthProvider,
    sendAuthenticatorSms,
    sendEmailVerificationCode,
    verifyAuthenticatorCode,
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
    signInWithOAuthProvider,
    sendAuthenticatorSms,
    sendEmailVerificationCode,
    verifyAuthenticatorCode,
    logout,
    checkUser,
    resetToLogin,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};