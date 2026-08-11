const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "AVIS: falten SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
    "El registre, l'aprovacio d'usuaris i la proteccio de /api/tickets estaran desactivats."
  );
}

// Client amb la service role key: salta la RLS. Nomes s'ha de fer servir
// des del backend, mai exposar aquesta clau al navegador.
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Aquest projecte de Supabase és compartit amb una altra app ("compras");
// totes les nostres taules viuen sota l'esquema `tiquets`, mai `public`.
function tiquets(client) {
  return client.schema('tiquets');
}

// Verifica un access token de sessió (enviat pel navegador) i retorna
// l'usuari de Supabase Auth, o null si no és vàlid.
async function getUserFromAccessToken(accessToken) {
  if (!supabaseAdmin || !accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = { supabaseAdmin, tiquets, getUserFromAccessToken };
