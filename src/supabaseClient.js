import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qbedzukaxpsvpodfmhqj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR6dWtheHBzdnBvZGZtaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODgxOTMxNDUsImV4cCI6MjAwMzc2OTE0NX0.lzRgom-8Kqn3iwnt-6ja2iUEG8q6gpc7vuuU8-Se4lY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
