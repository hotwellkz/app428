import { createClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'https://bhlzwqteygmxpxznezyg.supabase.co';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJobHp3cXRleWdteHB4em5lenlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4ODM2NTcsImV4cCI6MjA1MjQ1OTY1N30.3xAtMLN1Ke_1vrfsCU0LJHF-4G5naIc8dMSH9RG-tjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? LOCAL_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
