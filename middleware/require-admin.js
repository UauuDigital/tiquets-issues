const { getUserFromAccessToken } = require('../lib/supabase');

const ADMIN_EMAIL = 'digital@uauu.cat';

// Protecció de les rutes /api/admin/*: exigeix una sessió de Supabase Auth
// activa (capçalera Authorization: Bearer <access_token>) i que el correu
// de la sessió sigui el compte d'administració (`digital@uauu.cat`).
async function requireAdmin(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: 'Cal iniciar sessió per accedir a l\'administració.' });
  }

  const user = await getUserFromAccessToken(accessToken);
  if (!user || (user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return res.status(401).json({ error: 'No tens accés a l\'administració.' });
  }

  next();
}

module.exports = requireAdmin;
module.exports.ADMIN_EMAIL = ADMIN_EMAIL;
