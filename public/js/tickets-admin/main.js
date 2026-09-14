// admin-auth.js pot disparar l'esdeveniment abans que aquest script arribi
// a escoltar-lo (si la sessió ja està en memòria, boot() es resol molt
// ràpid): si window.adminAccessToken ja existeix, l'esdeveniment ja ha
// passat i cal carregar les dades directament en lloc d'esperar-lo.
function bootTicketsAdmin() {
  loadTickets();
  loadActivity();
}
if (window.adminAccessToken) {
  bootTicketsAdmin();
} else {
  document.addEventListener('admin-authenticated', bootTicketsAdmin);
}
