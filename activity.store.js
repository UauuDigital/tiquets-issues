// Emmagatzematge senzill (fitxer JSON) de l'historial d'activitat dels
// tiquets: creacions i canvis d'estat/prioritat fets des de l'admin.
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'activity.json');
const MAX_ENTRIES = 200;

function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error llegint activity.json:', err);
    return [];
  }
}

function save(entries) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

function list() {
  return load().slice().reverse();
}

function add(entry) {
  const entries = load();
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  save(entries);
}

module.exports = { list, add };
