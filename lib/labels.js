// Edita aquests mapes per adaptar les categories/prioritats de la teva empresa.
// Si una etiqueta no existeix al repositori, GitHub la crea automàticament (sense color personalitzat).
const CATEGORY_LABELS = {
  bug: 'tipus: error',
  funcionalitat: 'tipus: petició',
  acces: 'tipus: accés i permisos',
  altres: 'tipus: altres'
};

const PRIORITY_LABELS = {
  baixa: 'prioritat: baixa',
  mitjana: 'prioritat: mitjana',
  alta: 'prioritat: alta',
  critica: 'prioritat: crítica'
};

// Etiquetes llegibles pel desplegable de Departament del portal (public/index.html).
const DEPARTMENT_LABELS = {
  comercial: 'Comercial',
  coordinacio: 'Coordinació',
  cuina: 'Cuina',
  administracio: 'Administració',
  digital: 'Digital'
};

// Etiquetes llegibles per al lliscador de Prioritat del portal.
const PRIORITY_TEXT = {
  baixa: 'Baixa',
  mitjana: 'Mitjana',
  alta: 'Alta',
  critica: 'Crítica'
};

// Estats possibles d'un tiquet a l'historial de l'admin.
const TICKET_STATUSES = ['no_comencat', 'comencat', 'acabat', 'cancelat', 'en_espera'];

module.exports = { CATEGORY_LABELS, PRIORITY_LABELS, DEPARTMENT_LABELS, PRIORITY_TEXT, TICKET_STATUSES };
