import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://uaylyrxirohiptkkznrk.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheWx5cnhpcm9oaXB0a2t6bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDg2NDgsImV4cCI6MjA5MTc4NDY0OH0.TqWX9GdPtAeQ_ZFhWPdlqKpWp1UGeZJHxdFDZ5M7gPg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
