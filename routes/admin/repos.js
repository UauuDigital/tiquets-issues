const express = require('express');

const reposStore = require('../../repos.store');
const requireAdmin = require('../../middleware/require-admin');
const { GITHUB_TOKEN, verifyGithubRepo, normalizeProjectUrl } = require('../../lib/github-api');

const router = express.Router();

// --- Gestió (CRUD) de repositoris connectats, protegida per requireAdmin ---
router.get('/api/admin/repos', requireAdmin, (_req, res) => {
  res.json(reposStore.list());
});

// Llista els repositoris de GitHub als quals el GITHUB_TOKEN té accés
// (propis, com a col·laborador, o d'organitzacions), perquè l'admin
// pugui triar-los d'un desplegable en lloc d'escriure'ls a mà.
router.get('/api/admin/github-repos', requireAdmin, async (_req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té GITHUB_TOKEN configurat (revisa .env).' });
  }
  try {
    const repos = [];
    for (let page = 1; page <= 5; page++) {
      const ghResponse = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=full_name`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );
      if (!ghResponse.ok) {
        const errText = await ghResponse.text();
        console.error('Error llistant repositoris de GitHub:', ghResponse.status, errText);
        return res.status(502).json({ error: 'No s\'han pogut llistar els repositoris de GitHub.' });
      }
      const data = await ghResponse.json();
      repos.push(...data.map((r) => ({ owner: r.owner.login, repo: r.name, fullName: r.full_name })));
      if (data.length < 100) break;
    }
    res.json(repos);
  } catch (err) {
    console.error('Error connectant amb GitHub:', err);
    res.status(500).json({ error: 'No s\'ha pogut connectar amb GitHub.' });
  }
});

router.post('/api/admin/repos', requireAdmin, async (req, res) => {
  const { label, owner, repo, description, projectUrl } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const urlCheck = normalizeProjectUrl(projectUrl);
  if (!urlCheck.ok) return res.status(400).json({ error: urlCheck.error });
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const entry = reposStore.create({
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || '',
    projectUrl: urlCheck.value
  });
  res.status(201).json(entry);
});

router.put('/api/admin/repos/:id', requireAdmin, async (req, res) => {
  const { label, owner, repo, description, projectUrl } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const urlCheck = normalizeProjectUrl(projectUrl);
  if (!urlCheck.ok) return res.status(400).json({ error: urlCheck.error });
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const updated = reposStore.update(req.params.id, {
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || '',
    projectUrl: urlCheck.value
  });
  if (!updated) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.json(updated);
});

router.delete('/api/admin/repos/:id', requireAdmin, (req, res) => {
  const ok = reposStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.status(204).end();
});

module.exports = router;
