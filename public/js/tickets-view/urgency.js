// Setmanes fins arribar a 100 (saturació) segons prioritat.
const PRIORITY_URGENCY_WEEKS_TO_MAX = { baixa: 4, mitjana: 2, alta: 1 };
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function computeUrgencyScore(t) {
  const status = t.status || 'no_comencat';
  if (status === 'acabat' || status === 'cancelat') return 0;
  if (t.priority === 'critica') return 100;
  const weeksOpen = Math.max(0, (Date.now() - new Date(t.createdAt).getTime()) / MS_PER_WEEK);
  const weeksToMax = PRIORITY_URGENCY_WEEKS_TO_MAX[t.priority] || PRIORITY_URGENCY_WEEKS_TO_MAX.baixa;
  return Math.min(100, Math.round((weeksOpen / weeksToMax) * 100));
}

// Gradient continu gris molt clar -> vermell -> negre, segons la urgència.
const URGENCY_COLOR_MAX = 100;
const URGENCY_GRAY = [209, 213, 219];
const URGENCY_RED = [220, 38, 38];
const URGENCY_BLACK = [0, 0, 0];

function mixColorRgb(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function urgencyColorRgb(score) {
  const t = Math.max(0, Math.min(score, URGENCY_COLOR_MAX)) / URGENCY_COLOR_MAX;
  if (t <= 0.5) return mixColorRgb(URGENCY_GRAY, URGENCY_RED, t / 0.5);
  return mixColorRgb(URGENCY_RED, URGENCY_BLACK, (t - 0.5) / 0.5);
}

function urgencyColor(score) {
  const [r, g, b] = urgencyColorRgb(score);
  return `rgb(${r}, ${g}, ${b})`;
}

// Zones del tauler, de més a menys urgència. Els tiquets acabats o cancel·lats
// tenen la seva pròpia zona (independent de la urgència), sempre al final.
const ZONES = [
  { key: 'max', label: 'Urgència màxima', color: '#0a0a0a', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 100 },
  { key: 'high', label: 'Urgència alta', color: '#dc2626', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 50 && t.urgencyScore < 100 },
  { key: 'medium', label: 'Urgència mitjana', color: '#a16207', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 25 && t.urgencyScore < 50 },
  { key: 'low', label: 'Urgència baixa', color: '#166534', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore < 25 },
  { key: 'acabat', label: 'Acabat', color: '#2563eb', match: (t) => t.status === 'acabat' },
  { key: 'cancelat', label: 'Cancel·lat', color: '#6b7280', match: (t) => t.status === 'cancelat' }
];

function zoneForTicket(t) {
  return ZONES.find((z) => z.match(t)) || ZONES[ZONES.length - 1];
}

function urgencyLevelKey(score) {
  if (score <= 0) return 'none';
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 100) return 'high';
  return 'max';
}

const URGENCY_LEVEL_LABELS_CA = {
  none: 'Cap urgència',
  low: 'Urgència baixa',
  medium: 'Urgència mitjana',
  high: 'Urgència alta',
  max: 'Urgència màxima'
};

const URGENCY_ICONS = {
  low: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>`,
  medium: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.3v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.4" r="1" fill="currentColor"/></svg>`,
  high: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 6v4.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.8" r="1.1" fill="#fff"/></svg>`,
  max: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.28"/><circle cx="10" cy="10" r="7" fill="currentColor"/><path d="M10 6.3v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14" r="1.1" fill="#fff"/></svg>`,
  acabat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cancelat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
};

const URGENCY_ICON_COLORS = { low: '#166534', medium: '#a16207', high: '#dc2626', max: '#0a0a0a', acabat: '#2563eb', cancelat: '#6b7280' };

function urgencyIconHtml(t) {
  const key = zoneForTicket(t).key;
  return `<span class="urgency-icon" style="color:${URGENCY_ICON_COLORS[key]}">${URGENCY_ICONS[key]}</span>`;
}

// Distintiu d'urgència per al modal: mateixa icona i color que la
// targeta, perquè el nivell es reconegui d'un cop d'ull i no només
// pel text.
function urgencyBadgeHtml(t) {
  const zone = zoneForTicket(t);
  const color = URGENCY_ICON_COLORS[zone.key];
  return `<span class="urgency-badge" style="--urgency-color:${color}">${URGENCY_ICONS[zone.key]}${escapeHtml(zone.label)}</span>`;
}

function formatTicketDate(iso) {
  try {
    return new Intl.DateTimeFormat('ca-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  } catch (err) {
    return iso;
  }
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ara mateix';
  if (diffMin < 60) return `fa ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `fa ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'fa 1 dia';
  if (diffDays < 30) return `fa ${diffDays} dies`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'fa 1 mes';
  if (diffMonths < 12) return `fa ${diffMonths} mesos`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? 'fa 1 any' : `fa ${diffYears} anys`;
}
