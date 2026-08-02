const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createLocalStorage() {
  const store = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };
}

function loadDajoxDB() {
  const context = {
    console,
    window: {},
    document: {},
    localStorage: createLocalStorage(),
    getDajoxSalonId: () => 'test-salon'
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'dajox_db.js'), 'utf8');
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'dajox_db.js' });
  return context.DajoxDB;
}

const DajoxDB = loadDajoxDB();
const cls = DajoxDB.createClass('Clase prueba', 'FICHA-001', 'instructor@mail.com');
cls.bancoPreguntas = [{
  id: 'banco-1',
  titulo: 'Banco 1',
  preguntas: [{ id: 'pq-1', pregunta: 'Pregunta 1', opciones: ['A', 'B'], correcta: 0, puntos: 20 }]
}];
DajoxDB.updateClass(cls);

const normalized = DajoxDB.getClass(cls.id);
if (!Array.isArray(normalized.preguntasIndividuales) || normalized.preguntasIndividuales.length !== 1) {
  throw new Error('No se normalizaron las preguntas del banco');
}

DajoxDB.enrollStudent(cls.id, 'aprendiz@mail.com');
DajoxDB.recordAnswer(cls.id, { alumno: 'aprendiz@mail.com', tipo: 'pregunta_individual', idMeta: 'pq-1', esCorrecto: true, puntos: 20, timestamp: 1 });

const tracking = DajoxDB.getClassTracking(cls.id);
if (tracking.length !== 1 || tracking[0].pendingQuestions !== 0 || tracking[0].score.puntos !== 20) {
  throw new Error('El seguimiento del estudiante no se calculó correctamente');
}

console.log('class-sync test passed');
