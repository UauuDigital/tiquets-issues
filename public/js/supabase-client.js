// Crea el client de Supabase compartit per a totes les pàgines públiques.
// Requereix que la pàgina hagi carregat abans, en aquest ordre:
//   1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//   2. <script src="/js/supabase-config.js"></script>
//   3. <script src="js/supabase-client.js"></script>
window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
