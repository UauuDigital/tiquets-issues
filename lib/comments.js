// Els comentaris públics es publiquen amb el compte del bot, així que el nom
// de qui l'escriu es guarda com a primera línia del propi cos del comentari,
// amb aquest format exacte: "_Comentari de NOM:_" seguit d'una línia en blanc.
function publicCommentAuthorLine(name, email) {
  return `_Comentari de ${name}${email ? ` — ${email}` : ''}:_`;
}

const PUBLIC_COMMENT_AUTHOR_RE = /^_Comentari de (.+?):_\n/;

function extractPublicCommentAuthor(body) {
  const match = (body || '').match(PUBLIC_COMMENT_AUTHOR_RE);
  return match ? match[1].trim() : null;
}

function stripPublicCommentAuthor(body) {
  return (body || '').replace(PUBLIC_COMMENT_AUTHOR_RE, '').trim();
}

module.exports = { publicCommentAuthorLine, extractPublicCommentAuthor, stripPublicCommentAuthor };
