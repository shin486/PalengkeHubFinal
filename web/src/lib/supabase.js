import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjpgmpufwpbgqjzqymvj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGdtcHVmd3BiZ3FqenF5bXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjIyNjAsImV4cCI6MjA4OTIzODI2MH0.RzvRg521pq25V16GrkDTaSuUDhaWF43GEl9jkNp0trQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
  },
});