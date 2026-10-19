// Supabase connection for sign-in and sync. Copy both values from
// Supabase → Project Settings → API. They are safe to publish: the anon key can only
// do what the row-level security rules in supabase/setup.sql allow (each user sees only their own data).
// Leave them empty and the app works offline on a single device, with no account features.
window.GG_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};
