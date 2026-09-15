const express = require('express');

const requireAdmin = require('../../middleware/require-admin');

const router = express.Router();

// Verifica si la sessió activa (Bearer) té accés d'administració.
router.get('/api/admin/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

router.use(require('./repos'));
router.use(require('./tickets'));
router.use(require('./usuaris'));

module.exports = router;
