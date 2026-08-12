// Helpers de sessió compartits, per damunt de window.supabaseClient
// (carregat abans per public/js/supabase-client.js).
window.AuthSession = (function () {
  async function getSession() {
    const { data } = await window.supabaseClient.auth.getSession();
    return data.session || null;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session ? session.access_token : null;
  }

  // Retorna la fila de tiquets.usuaris de l'usuari actual (o null si
  // encara no ha estat aprovat). Nomes funciona amb sessio activa: la RLS
  // permet llegir unicament la propia fila. Requereix que l'esquema
  // `tiquets` estigui a "Exposed schemas" a Supabase.
  async function getUsuari() {
    const session = await getSession();
    if (!session) return null;
    const { data } = await window.supabaseClient
      .schema('tiquets')
      .from('usuaris')
      .select('id, nom, email, actiu')
      .eq('id', session.user.id)
      .maybeSingle();
    return data || null;
  }

  function onChange(callback) {
    window.supabaseClient.auth.onAuthStateChange((_event, session) => callback(session));
  }

  async function signOut() {
    await window.supabaseClient.auth.signOut();
  }

  return { getSession, getAccessToken, getUsuari, onChange, signOut };
})();
