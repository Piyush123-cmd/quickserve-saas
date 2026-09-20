import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rstdptvekepnetjtkymo.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzdGRwdHZla2VwbmV0anRreW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTc4NTQsImV4cCI6MjA4NzQ5Mzg1NH0.yVw83e4kYyM24Q3tMvdn6g3ZqY5K8g1eP0Zf8eD4f_U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);