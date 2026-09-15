// Emmagatzematge senzill (fitxer JSON) de l'historial de tiquets creats.
// Només de lectura des de l'API d'administració; el portal hi afegeix
// una entrada cada cop que es crea una incidència a GitHub amb èxit.
const fs = require('fs');
const path = require('path');
const { saveJsonAtomic } = require('./lib/json-store');

const DATA_FILE = path.join(__dirname, 'tickets.json');
const MAX_ENTRIES = 300;

function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error llegint tickets.json:', err);
    return [];
  }
}

function save(tickets) {
  saveJsonAtomic(DATA_FILE, tickets);
}

function list() {
  return load().slice().reverse();
}

function add(entry) {
  const tickets = load();
  tickets.push(entry);
  while (tickets.length > MAX_ENTRIES) tickets.shift();
  save(tickets);
}

function update(id, patch) {
  const tickets = load();
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tickets[idx] = { ...tickets[idx], ...patch };
  save(tickets);
  return tickets[idx];
}

function remove(id) {
  const tickets = load();
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tickets.splice(idx, 1);
  save(tickets);
  return true;
}

module.exports = { list, add, update, remove };
