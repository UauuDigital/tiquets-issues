// Emmagatzematge senzill (fitxer JSON) dels repositoris connectats.
// Permet fer CRUD en calent des de l'API d'administració sense reiniciar el servidor.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'repos.json');

function seedFromLegacyConfig() {
  try {
    return require('./repos.config');
  } catch (err) {
    return [];
  }
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = seedFromLegacyConfig();
    save(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error llegint repos.json:', err);
    return [];
  }
}

function save(repos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(repos, null, 2) + '\n', 'utf8');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function list() {
  return load();
}

function create({ label, owner, repo, description }) {
  const repos = load();
  const baseId = slugify(`${owner}-${repo}`) || slugify(label);
  let id = baseId;
  let n = 2;
  while (repos.some((r) => r.id === id)) {
    id = `${baseId}-${n++}`;
  }
  const entry = { id, label, owner, repo, description: description || '' };
  repos.push(entry);
  save(repos);
  return entry;
}

function update(id, { label, owner, repo, description }) {
  const repos = load();
  const idx = repos.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  repos[idx] = { ...repos[idx], label, owner, repo, description: description || '' };
  save(repos);
  return repos[idx];
}

function remove(id) {
  const repos = load();
  const idx = repos.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  repos.splice(idx, 1);
  save(repos);
  return true;
}

module.exports = { list, create, update, remove };
