const { getUserFromAccessToken, supabaseAdmin, tiquets } = require('../lib/supabase');

async function requireApprovedUser(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: 'Cal iniciar sessió per crear un tiquet.' });
  }

  const user = await getUserFromAccessToken(accessToken);
  if (!user) {
    return res.status(401).json({ error: 'La sessió no és vàlida. Torna a iniciar sessió.' });
  }

  const { data: usuari, error } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('actiu')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error comprovant usuari aprovat:', error);
    return res.status(500).json({ error: 'No s\'ha pogut comprovar el teu accés.' });
  }
  if (!usuari || !usuari.actiu) {
    return res.status(403).json({ error: 'El teu compte encara no té accés aprovat per crear tiquets.' });
  }

  req.userId = user.id;
  next();
}

module.exports = requireApprovedUser;
