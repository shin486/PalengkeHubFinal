// app.config.js — replaces BOTH app.config.js AND app.json
// After adding this file, DELETE app.json from your project root

export default {
  expo: {
    name: "PalengkeHub-Final",
    slug: "PalengkeHub-Final",
    scheme: "palengkehub",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.palengkehub.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      config: {
        googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      config: {
        googleMaps: {
          apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
        },
      },
    },
    web: {
      favicon: "./assets/favicon.png",
      // KEY FIX: Use Metro bundler for web instead of webpack
      // This fixes the AsyncStorage ESM resolution error on Expo 54
      bundler: "metro",
    },
    extra: {
      eas: {
        projectId: "b4b641a9-9226-46f7-9d6b-6b0c02bd3a23",
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      paymongoProxyUrl: process.env.EXPO_PUBLIC_PAYMONGO_PROXY_URL || process.env.PAYMONGO_PROXY_URL || '',
      authProxyUrl: process.env.EXPO_PUBLIC_AUTH_PROXY_URL || process.env.AUTH_PROXY_URL || '',
      paymongoSuccessUrl: process.env.EXPO_PUBLIC_PAYMONGO_SUCCESS_URL || process.env.PAYMONGO_SUCCESS_URL || 'https://supabase-proxy.jhayvy.workers.dev/paymongo/success',
      paymongoFailedUrl: process.env.EXPO_PUBLIC_PAYMONGO_FAILED_URL || process.env.PAYMONGO_FAILED_URL || 'https://supabase-proxy.jhayvy.workers.dev/paymongo/failed',
    },
  },
};