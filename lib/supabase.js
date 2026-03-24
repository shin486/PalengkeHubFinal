import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'

const supabaseUrl = 'https://jjpgmpufwpbgqjzqymvj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGdtcHVmd3BiZ3FqenF5bXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjIyNjAsImV4cCI6MjA4OTIzODI2MH0.RzvRg521pq25V16GrkDTaSuUDhaWF43GEl9jkNp0trQ'

// Create a redirect URL using your app scheme
export const getRedirectUrl = () => {
  return 'palengkehub://auth/callback'
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})