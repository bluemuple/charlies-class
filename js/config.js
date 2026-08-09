/* Charlie's Class — Supabase connection.
   Project: bluemuple / charlies-class (AWS ap-southeast-2, Sydney).

   SUPABASE_KEY is the *publishable* key. It is meant to be public — it ends up
   in this file on a public website — and it can only do what the table's
   row-level-security policies allow (see supabase/schema.sql).
   Never put the sb_secret_… key here; that one is admin access.

   If both values are blank the site falls back to Local demo mode
   (data stays in one browser), which is handy for trying things offline. */
window.CHARLIE_CONFIG = {
  SUPABASE_URL: "https://vdjscacldhtomcyxpqur.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_CYPwYh0gWbjnz7PwIPlj4w_RpdxijRJ"
};
