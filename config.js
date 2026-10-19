// Supabase connection for sign-in and sync. Copy both values from
// Supabase → Project Settings → API. They are safe to publish: the anon key can only
// do what the row-level security rules in supabase/setup.sql allow (each user sees only their own data).
// Leave them empty and the app works offline on a single device, with no account features.
window.GG_CONFIG = {
  // Where links in sign-up and password-reset emails should open.
  siteUrl: "https://albinfrancisvb-pixel.github.io/gentle-gut/",
  supabaseUrl: "https://mgnzzhmvwhtztgpdpejr.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbnp6aG12d2h0enRncGRwZWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTA0MzUsImV4cCI6MjEwNzk4NjQzNX0.rYlIRL2ynRRyQPb_iwp9zPqBbzGhdMCiQ-1VauJun04",
};
