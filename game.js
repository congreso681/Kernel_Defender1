/**
 * ═══════════════════════════════════════════════════════════════════════
 * KERNEL DEFENDER v2 — game.js
 * Videojuego educativo · Sistemas Operativos I
 * Caballero Vargas, P.E. (2026) — Ing. en Sistemas, La Paz · Bolivia
 *
 * Gráficos: Torretas vectoriales (Galaxy Defense) + Polígonos neón (Falltopia)
 * Motor: Canvas 2D nativo · ES6 · Sin dependencias externas
 * ═══════════════════════════════════════════════════════════════════════
 */
'use strict';

// ══════════════════════════════════════════════════════════════════════
//  §1  CONSTANTES GLOBALES
// ══════════════════════════════════════════════════════════════════════
const CW = 800, CH = 480;           // dimensiones lógicas del canvas de juego
const KERNEL_X = 400, KERNEL_Y = 510; // núcleo fijo en base inferior
const SHIELD_R = 56;               // radio del escudo orbital
const KERNEL_R = 24;               // radio del núcleo

/** Paleta neón del sistema */
const C = {
  blue: '#00b4ff', cyan: '#00ffd2', green: '#2dff6e', orange: '#ff9500',
  purple: '#c040ff', red: '#ff2255', yellow: '#ffe600', white: '#d8eeff',
  gray: '#6a7f96', violet: '#8844ff', teal: '#00e5c0',
};

/** Armas = Algoritmos de Scheduling */
const WEAPONS = [
  {
    id: 0, name: 'FIFO Blaster', short: 'FIFO', col: C.blue, dmg: 15, cd: 300, burst: 1, spread: 0,
    theory: 'First In, First Out (FCFS) atiende procesos en estricto orden de llegada. No-apropiativo. La cola FIFO es la estructura de datos más simple para gestionar la ready queue.',
    pros: ['Implementación trivial (cola simple)', 'Sin inanición — todo proceso ejecuta eventualmente', 'Determinístico y predecible'],
    cons: ['Efecto convoy: procesos cortos esperan a largos', 'Tiempo de espera promedio alto', 'No considera prioridades ni burst time'],
    analogy: 'FIFO Blaster dispara proyectiles lineales de uno en uno. Limpia filas de Zombies eficientemente pero puede saturarse con enemigos de alta vida (efecto convoy).'
  },
  {
    id: 1, name: 'Quantum Burst', short: 'RR', col: C.cyan, dmg: 10, cd: 160, burst: 3, spread: 9,
    theory: 'Round Robin asigna a cada proceso un quantum q fijo. Al agotarlo sin terminar, el proceso regresa al final de la cola circular (preemptive). Equilibra el tiempo de respuesta para todos los hilos.',
    pros: ['Equitativo: ningún proceso monopoliza la CPU', 'Respuesta rápida para procesos interactivos', 'Preemptivo — previene el efecto convoy'],
    cons: ['Overhead de context switch si q es muy pequeño', 'Throughput inferior a SJF', 'Tiempo de respuesta alto con cargas masivas'],
    analogy: 'Quantum Burst lanza 3 proyectiles cíclicos con dispersión angular, distribuyendo daño equitativamente entre múltiples enemigos activos. Ideal para enjambres.'
  },
  {
    id: 2, name: 'Priority Sniper', short: 'PRIORITY', col: C.orange, dmg: 28, cd: 580, burst: 1, spread: 0,
    theory: 'Planificación por Prioridad despacha siempre el proceso listo de mayor prioridad. Apropiativo o no. El peligro principal es la inanición, mitigable con aging (incremento de prioridad con el tiempo de espera).',
    pros: ['Despacha hilos críticos primero', 'Flexible: prioridades estáticas o dinámicas', 'Óptimo para sistemas de tiempo real'],
    cons: ['Inanición (starvation) de procesos de baja prioridad', 'Inversión de prioridad sin manejo adecuado', 'Complejidad mayor que FIFO'],
    analogy: 'Priority Sniper usa trigonometría radial para auto-apuntar al proceso enemigo de mayor amenaza (más cercano al núcleo). Alto daño, bajo cadencia.'
  },
  {
    id: 3, name: 'Quick Terminator', short: 'SJF', col: C.green, dmg: 20, cd: 400, burst: 1, spread: 0,
    theory: 'Shortest Job First selecciona el proceso con menor burst time estimado. SRT (apropiativo) minimiza el tiempo de espera promedio de forma óptima. Requiere estimación del burst mediante media exponencial.',
    pros: ['Mínimo tiempo de espera promedio (óptimo demostrado)', 'Alto throughput', 'Ideal para lotes con burst times conocidos'],
    cons: ['Requiere estimación precisa del burst time', 'Starvation de procesos largos', 'Inaplicable sin historial de ejecución'],
    analogy: 'Quick Terminator inflige +20 daño crítico cuando el enemigo tiene < 30% HP restante — el "trabajo más corto". Óptimo contra Fork Bombs antes de su replicación.'
  },
  {
    id: 4, name: 'Multishot Array', short: 'MLFQ', col: C.purple, dmg: 12, cd: 480, burst: 3, spread: 26,
    theory: 'Multilevel Feedback Queue mantiene varias colas con distintos quantums. Procesos nuevos entran en la cola de mayor prioridad; si agotan su quantum, descienden a colas inferiores. Aging periódico eleva procesos que esperan demasiado.',
    pros: ['Separa automáticamente procesos interactivos de batch', 'Adaptativo sin información a priori', 'Balance entre respuesta y throughput'],
    cons: ['Implementación compleja — múltiples parámetros', 'Puede ser explotado con I/O voluntario antes del quantum', 'Overhead de bookkeeping por cola'],
    analogy: 'Multishot Array lanza 3 proyectiles en abanico a ±26°, cubriendo múltiples sectores orbitales simultáneamente. Ideal para Race Conditions y Bosses con escudos distribuidos.'
  },
];

/** Definición de tipos de procesos enemigos */
const ETYPES = {
  ZOMBIE: { hp: 30, spd: 0.75, col: C.gray, r: 13, score: 50, sides: 5, cpuD: 0.011, ramD: 0.004, ioD: 0.007 },
  ORPHAN: { hp: 22, spd: 1.35, col: C.orange, r: 11, score: 70, sides: 4, cpuD: 0.014, ramD: 0.014, ioD: 0.005 },
  DAEMON: { hp: 50, spd: 1.75, col: C.violet, r: 15, score: 100, sides: 6, cpuD: 0.019, ramD: 0.009, ioD: 0.019, alpha: 0.58 },
  FORKBOMB: { hp: 10, spd: 0.0, col: C.red, r: 17, score: 80, sides: 8, cpuD: 0.009, ramD: 0.038, ioD: 0.005 },
  PAGEFAULT: { hp: 80, spd: 0.55, col: C.teal, r: 17, score: 150, sides: 7, cpuD: 0.024, ramD: 0.007, ioD: 0.028 },
  RACECOND: { hp: 40, spd: 0.95, col: C.yellow, r: 12, score: 120, sides: 3, cpuD: 0.017, ramD: 0.011, ioD: 0.014 },
};

/** Power-ups / Primitivas de sincronización */
const PUPS = {
  MUTEX: { name: 'Mutex Lock', col: '#ffd700', dur: 5000, icon: '🔒' },
  SEMAPHORE: { name: 'Semaphore Signal', col: C.cyan, dur: 3000, icon: '🚦' },
  IRQ: { name: 'Interrupt Request', col: C.orange, dur: 4000, icon: '⚡' },
};

/** Banco de 10 preguntas de SO1 */
const QUESTIONS = [
  {
    q: '¿Cuál es el principal problema del algoritmo FIFO en planificación de procesos?',
    opts: ['Genera demasiados cambios de contexto', 'El efecto convoy: procesos cortos esperan a largos', 'No puede manejar prioridades', 'Requiere conocer el burst time'],
    ok: 1, fb: 'El efecto convoy ocurre cuando un proceso largo bloquea la CPU, haciendo esperar a procesos cortos. Incrementa drásticamente el tiempo de espera promedio. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué mecanismo garantiza la equidad entre procesos en Round Robin?',
    opts: ['Prioridades dinámicas basadas en historial', 'Un quantum de tiempo fijo asignado por turno', 'La estimación del burst time más corto', 'Múltiples colas con diferentes prioridades'],
    ok: 1, fb: 'Round Robin asigna a cada proceso un quantum fijo. Al expirar, el proceso va al final de la cola circular, garantizando que ningún proceso monopolice la CPU. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué es la "inversión de prioridad"?',
    opts: ['Un proceso de baja prioridad retiene un recurso que necesita uno de alta prioridad', 'El planificador cambia prioridades arbitrariamente', 'MLFQ mueve todos los procesos a la cola más baja', 'Se detecta un deadlock en el sistema'],
    ok: 0, fb: 'La inversión de prioridad ocurre cuando un proceso de baja prioridad posee un recurso bloqueando indirectamente a uno de alta prioridad. La solución es la herencia de prioridad. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Cuándo se produce una condición de carrera (Race Condition)?',
    opts: ['Dos procesos acceden a un recurso compartido sin sincronización', 'Cuando un proceso ejecuta más rápido que otro', 'El planificador no puede decidir qué proceso ejecutar', 'Un proceso excede su quantum en Round Robin'],
    ok: 0, fb: 'Una Race Condition ocurre cuando dos o más hilos acceden a recursos compartidos sin exclusión mutua y el resultado depende del orden no determinístico de ejecución. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué es un proceso Zombie en sistemas UNIX/Linux?',
    opts: ['Proceso que consume 100% de CPU sin terminar', 'Proceso terminado cuya entrada persiste porque su padre no invocó wait()', 'Proceso que espera un recurso bloqueado', 'Proceso demonio en segundo plano sin terminal'],
    ok: 1, fb: 'Un proceso Zombie completó su ejecución pero permanece en la tabla de procesos porque su padre no ejecutó wait() para recoger su código de salida. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Cuáles son las 4 condiciones de Coffman para que ocurra un Deadlock?',
    opts: ['Exclusión mutua, retención y espera, no expropiación, espera circular', 'Inanición, inversión de prioridad, Race Condition, bloqueo activo', 'Fork, exec, wait, exit como primitivas', 'FIFO, RR, Priority, SJF como algoritmos concurrentes'],
    ok: 0, fb: 'Las condiciones de Coffman: (1) Exclusión mutua, (2) Retención y espera, (3) No expropiación de recursos, (4) Espera circular entre procesos. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué es el "aging" en planificación por prioridad?',
    opts: ['Reducir gradualmente la prioridad de procesos que llevan tiempo ejecutándose', 'Incrementar la prioridad de procesos que llevan tiempo esperando en cola', 'Terminar procesos que llevan demasiado tiempo bloqueados', 'Asignar prioridades basadas en el PID del proceso'],
    ok: 1, fb: 'El aging incrementa la prioridad de un proceso mientras permanece en la cola de listos sin ejecutarse, previniendo la inanición (starvation). (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué describe el término "thrashing" en gestión de memoria virtual?',
    opts: ['Fragmentación excesiva del espacio de direcciones', 'El SO pasa más tiempo en swapping que ejecutando procesos útiles', 'Proceso de compactación de memoria física', 'Política de reemplazo de páginas LRU'],
    ok: 1, fb: 'Thrashing: el grado de multiprogramación supera la memoria física disponible. Los procesos generan fallos de página continuos y la utilización de CPU colapsa. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Cuál es la diferencia fundamental entre un semáforo binario y un mutex?',
    opts: ['No hay diferencia: son equivalentes', 'Un mutex tiene ownership: solo el hilo que lo adquirió puede liberarlo; un semáforo puede ser señalizado por cualquier hilo', 'Semáforos son solo entre procesos; mutex solo entre hilos', 'Mutex permite múltiples accesos; semáforos solo uno'],
    ok: 1, fb: 'La diferencia clave es la propiedad (ownership). Un mutex solo puede ser liberado por el hilo que lo adquirió. Un semáforo binario puede ser V() por cualquier entidad. (Caballero Vargas, 2026)'
  },
  {
    q: '¿Qué ocurre cuando un proceso Orphan es adoptado por init (PID 1)?',
    opts: ['El proceso es terminado inmediatamente', 'Continúa ejecutándose con init como nuevo padre, que ejecutará wait() al terminar', 'Se convierte automáticamente en daemon', 'Pierde todos sus descriptores de archivo'],
    ok: 1, fb: 'El proceso huérfano es adoptado por init (o systemd), que ejecutará wait() periódicamente para recoger su estado de salida, evitando que se convierta en zombie. (Caballero Vargas, 2026)'
  },
];

// ══════════════════════════════════════════════════════════════════════
//  §1b  CONFIGURACIÓN DE BACKEND Y FIREBASE
// ══════════════════════════════════════════════════════════════════════
const BACKEND_URL = 'https://kernel-defender-backend-production.up.railway.app';

// 🔥 CONFIGURACIÓN DE FIREBASE - Reemplaza con tus datos
const firebaseConfig = {
  apiKey: "AIzaSyD-7XU3dEWcA_LwXXez4M-GMjYofLw-RJA",
  authDomain: "kernel-defender.firebaseapp.com",
  projectId: "kernel-defender",
  storageBucket: "kernel-defender.firebasestorage.app",
  messagingSenderId: "808319934167",
  appId: "1:808319934167:web:7a37cf75ea03dc46149a92"
};

// Inicializar Firebase (compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// ══════════════════════════════════════════════════════════════════════
//  §2  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════
let G = {};

function newState(mode) {
  return {
    mode, running: false, paused: false, over: false, won: false,
    cpu: 100, ram: 100, io: 100, shield: 100,
    score: 0, wave: 1, lives: 3, elapsed: 0,
    aw: 0, cds: [0, 0, 0, 0, 0], seen: [false, false, false, false, false],
    aim: -Math.PI / 2, aimL: false, aimR: false,
    enemies: [], projs: [], parts: [], pups: [], gPages: [], fTexts: [],
    spawnT: 0, spawnI: 2200,
    waveKills: 0, waveTarget: 10,
    examT: 0, examI: 90000,
    bossActive: false, bossData: null,
    mutexOn: false, mutexEnd: 0,
    semaOn: false, semaEnd: 0,
    irqOn: false, irqEnd: 0,
    aiT: 0, aiLog: 'Planificador en espera...',
    fired: 0, hit: 0, killed: 0, examOk: 0, examTotal: 0,
    rafId: null, lastT: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  §3  REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const gameCanvas = $('gameCanvas');
const ctx = gameCanvas.getContext('2d');
gameCanvas.width = CW; gameCanvas.height = CH;

const menuCanvas = $('menuBg');
const menuCtx = menuCanvas ? menuCanvas.getContext('2d') : null;
const bootCanvas = $('bootCanvas');
const bootCtx = bootCanvas ? bootCanvas.getContext('2d') : null;
const overCanvas = $('overCanvas');
const overCtx = overCanvas ? overCanvas.getContext('2d') : null;

// ══════════════════════════════════════════════════════════════════════
//  §4  LOCALSTORAGE — dashboard de partidas
// ══════════════════════════════════════════════════════════════════════
function loadSt() {
  try { return JSON.parse(localStorage.getItem('kd2') || '{}'); } catch { return {}; }
}
function saveSt() {
  const s = loadSt();
  s.games = (s.games || 0) + 1;
  s.hi = Math.max(s.hi || 0, G.score);
  s.wave = Math.max(s.wave || 0, G.wave);
  const tot = (s.et || 0) + G.examTotal, ok = (s.eo || 0) + G.examOk;
  s.acc = tot > 0 ? Math.round(ok / tot * 100) : 0;
  s.et = tot; s.eo = ok;
  try { localStorage.setItem('kd2', JSON.stringify(s)); } catch { }
}
function renderDash() {
  const s = loadSt();
  const el = $('menu-stats');
  if (el) el.innerHTML = `Partidas: <b>${s.games || 0}</b> &nbsp;·&nbsp; Récord: <b>${s.hi || 0}</b> &nbsp;·&nbsp; Mejor oleada: <b>${s.wave || 0}/12</b> &nbsp;·&nbsp; Exactitud examen: <b>${s.acc || 0}%</b>`;
}

// ══════════════════════════════════════════════════════════════════════
//  §4b  AUTENTICACIÓN CON FIREBASE
// ══════════════════════════════════════════════════════════════════════

// Inicializar Firebase (solo si firebase está disponible)
let auth = null;
let provider = null;
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    provider = new firebase.auth.GoogleAuthProvider();
    console.log('🔥 Firebase inicializado');
  } else {
    console.warn('⚠️ Firebase SDK no cargado');
  }
} catch (e) {
  console.warn('⚠️ Error inicializando Firebase:', e.message);
}

async function loginWithGoogle() {
  if (!auth) {
    alert('❌ Firebase no está disponible. Verifica la conexión a internet.');
    return { success: false, message: 'Firebase no disponible' };
  }
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    const token = await user.getIdToken();

    const response = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseToken: token })
    });

    const data = await response.json();
    if (data.success) {
      console.log('✅ Login con Google:', data.user);
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('username', data.user.username);
      updateAuthUI(true, data.user);
      return { success: true, user: data.user };
    }
    return { success: false, message: data.message };
  } catch (error) {
    console.error('❌ Error en login con Google:', error);
    return { success: false, message: error.message };
  }
}

async function logoutUser() {
  try { if (auth) await auth.signOut(); } catch (e) { }
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('username');
  updateAuthUI(false);
  console.log('👋 Sesión cerrada');
  return { success: true };
}

function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function updateAuthUI(isLoggedIn, user = null) {
  const googleBtn = document.getElementById('btn-google-login');
  const logoutBtn = document.getElementById('btn-logout');
  const userInfo = document.getElementById('user-info');
  const dashBtn = document.getElementById('btn-dashboard');

  if (isLoggedIn && user) {
    if (googleBtn) googleBtn.style.display = 'none';
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-block';
      logoutBtn.textContent = `👤 ${user.username || user.email} | Cerrar`;
    }
    if (userInfo) userInfo.textContent = `✅ Conectado como: ${user.username || user.email}`;
    // Mostrar botón dashboard solo si es profesor
    if (dashBtn) {
      const teacherEmails = ['profesor@email.com', 'docente@univ.bo', 'patricia@univ.bo'];
      dashBtn.style.display = teacherEmails.includes(user.email) ? 'inline-block' : 'none';
    }
  } else {
    if (googleBtn) googleBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo) userInfo.textContent = '';
    if (dashBtn) dashBtn.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════════════
//  §4c  GUARDAR PUNTUACIÓN EN LA NUBE
// ══════════════════════════════════════════════════════════════════════

async function saveScoreToCloud(score, wave, mode) {
  const username = localStorage.getItem('username') || 'anonymous';
  const token = localStorage.getItem('authToken');

  try {
    const response = await fetch(`${BACKEND_URL}/api/scores/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({
        username: username,
        score: score,
        wave: wave,
        mode: mode || 'manual',
        duration_seconds: Math.floor(G.elapsed / 1000)
      })
    });
    const data = await response.json();
    if (data.success) {
      console.log('✅ Puntuación guardada en la nube');
    } else {
      console.error('❌ Error:', data.message);
    }
    return data;
  } catch (error) {
    console.error('❌ Error de red:', error);
    return { success: false, message: 'Error de conexión' };
  }
}

// ══════════════════════════════════════════════════════════════════════
//  §5  NAVEGACIÓN DE PANTALLAS
// ══════════════════════════════════════════════════════════════════════
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(`screen-${name}`);
  if (el) el.classList.add('active');
}

// ══════════════════════════════════════════════════════════════════════
//  §6  BOOT SEQUENCE ANIMADA
// ══════════════════════════════════════════════════════════════════════
const BOOT_LINES = [
  '> KERNEL DEFENDER OS v2.0 — BOOT SEQUENCE',
  '> Inicializando subsistemas de scheduling...',
  '> Cargando algoritmos: FIFO · RR · PRIORITY · SJF · MLFQ',
  '> Montando sistema de gestión de memoria...',
  '> Detectando procesos corruptos en la ready queue...',
  '> Activando escudo orbital del Kernel...',
  '> 12 oleadas de corrupción identificadas',
  '> Sistema listo. Aguardando planificador.',
];

let bootAnim = null;
function startBoot() {
  show('boot');
  const linesEl = $('boot-lines');
  const barEl = $('boot-bar');
  const readyEl = $('boot-ready');
  linesEl.innerHTML = '';

  animBootLogo();

  let i = 0, pct = 0;
  const interval = setInterval(() => {
    if (i < BOOT_LINES.length) {
      const d = document.createElement('div');
      d.textContent = BOOT_LINES[i];
      linesEl.appendChild(d);
      linesEl.scrollTop = linesEl.scrollHeight;
      i++;
    }
    pct = Math.min(100, pct + 100 / BOOT_LINES.length + Math.random() * 5);
    barEl.style.width = pct + '%';
    if (i >= BOOT_LINES.length && pct >= 98) {
      clearInterval(interval);
      barEl.style.width = '100%';
      setTimeout(() => { readyEl.classList.remove('hidden'); }, 300);
    }
  }, 340);
}

function animBootLogo() {
  if (!bootCtx) return;
  const cx = 160, cy = 160, t = performance.now() / 1000;
  bootCtx.clearRect(0, 0, 320, 320);

  const bg = bootCtx.createRadialGradient(cx, cy, 0, cx, cy, 140);
  bg.addColorStop(0, 'rgba(0,40,80,0.9)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  bootCtx.fillStyle = bg; bootCtx.fillRect(0, 0, 320, 320);

  for (let r = 40; r <= 130; r += 30) {
    bootCtx.beginPath();
    bootCtx.arc(cx, cy, r, 0, Math.PI * 2);
    bootCtx.strokeStyle = `rgba(0,180,255,${0.06 + 0.04 * Math.sin(t + r / 20)})`;
    bootCtx.lineWidth = 1; bootCtx.stroke();
  }

  const pulseR = 28 + Math.sin(t * 2) * 4;
  const grd = bootCtx.createRadialGradient(cx, cy - 4, 2, cx, cy, pulseR);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.4, '#00b4ff'); grd.addColorStop(1, 'transparent');
  bootCtx.beginPath(); bootCtx.arc(cx, cy, pulseR, 0, Math.PI * 2);
  bootCtx.fillStyle = grd; bootCtx.fill();

  bootCtx.fillStyle = 'rgba(0,255,210,0.8)';
  bootCtx.font = 'bold 14px Courier New'; bootCtx.textAlign = 'center';
  bootCtx.fillText('KERNEL', cx, cy + 55);

  bootAnim = requestAnimationFrame(animBootLogo);
}

// ══════════════════════════════════════════════════════════════════════
//  §7  FONDO DE MENÚ ANIMADO
// ══════════════════════════════════════════════════════════════════════
const MENU_STARS = Array.from({ length: 120 }, () => ({
  x: Math.random() * 800, y: Math.random() * 600,
  r: Math.random() * 1.4 + 0.2,
  speed: Math.random() * 0.3 + 0.05,
  alpha: Math.random() * 0.6 + 0.1,
}));
let menuRaf = null;

function animMenu() {
  if (!menuCtx) return;
  menuCtx.fillStyle = 'rgba(4,8,15,0.18)'; menuCtx.fillRect(0, 0, 800, 600);

  const nb = menuCtx.createRadialGradient(400, 300, 0, 400, 300, 360);
  nb.addColorStop(0, 'rgba(0,20,60,0.04)'); nb.addColorStop(1, 'transparent');
  menuCtx.fillStyle = nb; menuCtx.fillRect(0, 0, 800, 600);

  for (const s of MENU_STARS) {
    s.y = (s.y + s.speed) % 600;
    menuCtx.beginPath(); menuCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    menuCtx.fillStyle = `rgba(200,230,255,${s.alpha})`; menuCtx.fill();
  }
  menuRaf = requestAnimationFrame(animMenu);
}

// ══════════════════════════════════════════════════════════════════════
//  §8  INICIO DE PARTIDA
// ══════════════════════════════════════════════════════════════════════
function startGame(mode) {
  if (G.rafId) cancelAnimationFrame(G.rafId);
  if (menuRaf) { cancelAnimationFrame(menuRaf); menuRaf = null; }
  G = newState(mode);
  G.running = true;
  show('game');
  $('hud-mode').textContent = mode === 'auto' ? '🤖 AUTÓNOMO' : mode === 'exam' ? '📋 EXAMEN' : '⚡ MANUAL';
  $('ai-log').classList.toggle('hidden', mode !== 'auto');
  selectWeapon(0, true);
  updateHUD();
  G.lastT = performance.now();
  G.rafId = requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════════════════
//  §9  GAME LOOP PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
function loop(ts) {
  const dt = Math.min(ts - G.lastT, 48);
  G.lastT = ts;
  if (!G.paused && !G.over) { update(dt); render(); }
  else if (G.paused) { render(); }
  if (!G.over) G.rafId = requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════════════════
//  §10  UPDATE
// ══════════════════════════════════════════════════════════════════════
function update(dt) {
  G.elapsed += dt;
  tickTimers(dt);
  tickAim(dt);
  tickCooldowns(dt);
  if (G.mode === 'auto') tickAI(dt);
  tickEnemies(dt);
  tickProjs(dt);
  tickPups(dt);
  tickGPages(dt);
  tickParts(dt);
  tickFTexts(dt);
  checkSpawn(dt);
  checkWave();
  drainRes(dt);
  checkOver();
  updateHUD();
}

function tickTimers(dt) {
  if (G.mode === 'exam') {
    G.examT += dt;
    if (G.examT >= G.examI) { G.examT = 0; showExam(); }
  }
  const now = Date.now();
  if (G.mutexOn && now > G.mutexEnd) G.mutexOn = false;
  if (G.semaOn && now > G.semaEnd) G.semaOn = false;
  if (G.irqOn && now > G.irqEnd) G.irqOn = false;
}

function tickAim(dt) {
  const spd = 0.042 * (dt / 16);
  if (G.aimL) G.aim -= spd;
  if (G.aimR) G.aim += spd;
  G.aim = Math.max(-Math.PI * 0.97, Math.min(-Math.PI * 0.03, G.aim));
}

function tickCooldowns(dt) {
  for (let i = 0; i < 5; i++) {
    G.cds[i] = Math.max(0, G.cds[i] - dt);
    const fill = $(`wcd${i}`);
    if (fill) {
      const base = WEAPONS[i].cd * (G.irqOn ? 0.5 : 1);
      fill.style.width = G.cds[i] > 0 ? `${(G.cds[i] / base) * 100}%` : '0%';
    }
  }
}

function tickAI(dt) {
  G.aiT -= dt;
  if (G.aiT > 0) return;
  G.aiT = 550;

  const E = G.enemies; if (!E.length) return;
  const cnt = {};
  for (const e of E) cnt[e.type] = (cnt[e.type] || 0) + 1;

  let chosen = G.aw, reason = '';
  if (cnt['FORKBOMB']) { chosen = 3; reason = 'SJF → Fork Bomb detectada. Eliminar antes de replicación.'; }
  else if (cnt['RACECOND']) { chosen = 4; reason = 'MLFQ → Race Condition. Cobertura multi-sector.'; }
  else if (cnt['PAGEFAULT']) { chosen = 2; reason = 'Priority → Page Fault evasivo. Auto-apuntado activado.'; }
  else if (E.length >= 5) { chosen = 1; reason = `Round Robin → Enjambre ${E.length} procesos. Distribución equitativa.`; }
  else if (cnt['ZOMBIE'] && Object.keys(cnt).length === 1) { chosen = 0; reason = 'FIFO → Cola de Zombies. Despacho en orden de llegada.'; }
  else { chosen = 2; reason = 'Priority → Procesos mixtos. Despachando por amenaza.'; }

  if (chosen !== G.aw) selectWeapon(chosen, true);
  G.aiLog = reason; $('ai-log-txt').textContent = reason;

  if (G.cds[G.aw] === 0) {
    const tgt = closestEnemy();
    if (tgt) G.aim = Math.max(-Math.PI * 0.97, Math.min(-Math.PI * 0.03,
      Math.atan2(tgt.y - KERNEL_Y, tgt.x - KERNEL_X)));
    shoot();
  }
}

function closestEnemy() {
  let b = null, bd = Infinity;
  for (const e of G.enemies) { const d = Math.hypot(e.x - KERNEL_X, e.y - KERNEL_Y); if (d < bd) { bd = d; b = e; } }
  return b;
}

function tickEnemies(dt) {
  const freeze = G.semaOn;
  const spd = freeze ? 0 : 1;
  const now = Date.now();

  for (const e of G.enemies) {
    if (e.dead) continue;
    e.rot += 0.012 * (dt / 16);

    switch (e.type) {
      case 'ZOMBIE':
        e.y += e.speed * spd * (dt / 16);
        break;
      case 'ORPHAN': {
        const dx = KERNEL_X - e.x, dy = KERNEL_Y - e.y, d = Math.hypot(dx, dy);
        if (d > 0) { e.x += dx / d * e.speed * spd * (dt / 16); e.y += dy / d * e.speed * spd * (dt / 16); }
        e.forkT = (e.forkT || 0) + dt;
        if (e.forkT >= 5000) { e.forkT = 0; spawnMini(e.x - 14, e.y); spawnMini(e.x + 14, e.y); }
        break;
      }
      case 'DAEMON':
        e.y += e.speed * spd * (dt / 16);
        e.x = e.bx + Math.sin(e.y * 0.028 + e.ph) * 65;
        e.al = 0.58 + Math.sin(now / 380) * 0.18;
        break;
      case 'FORKBOMB':
        e.forkT = (e.forkT || 0) + dt;
        if (e.forkT >= 3000 && (e.gen || 0) < 3) {
          e.forkT = 0; spawnFBChild(e);
          G.ram = Math.max(0, G.ram - 8); addFT(e.x, e.y - 22, '-8 RAM', C.red);
        }
        e.y += 0.12 * spd * (dt / 16);
        break;
      case 'PAGEFAULT':
        e.y += e.speed * spd * (dt / 16);
        e.teleT = (e.teleT || 0) + dt;
        if (e.teleT >= 2000) {
          e.teleT = 0;
          e.x = 70 + Math.random() * (CW - 140); e.y = 35 + Math.random() * (CH * 0.48);
          G.gPages.push({ x: e.x, y: e.y, r: 10, life: 4200, age: 0 });
          puff(e.x, e.y, C.teal, 12);
        }
        break;
      case 'RACECOND':
        e.y += e.speed * spd * (dt / 16);
        if (e.partner && e.partner.dead && !e.revT) e.revT = now + 2000;
        if (e.revT && now >= e.revT && e.partner && e.partner.dead) {
          e.partner.dead = false;
          e.partner.hp = ETYPES.RACECOND.hp; e.partner.y = e.y - 28;
          e.revT = null; addFT(e.partner.x, e.partner.y - 20, '¡REVIVIDO!', C.yellow);
        }
        break;
    }

    const dk = Math.hypot(e.x - KERNEL_X, e.y - KERNEL_Y);
    if (dk <= SHIELD_R + e.radius) {
      if (!G.mutexOn) { G.shield = Math.max(0, G.shield - 9); addFT(KERNEL_X, KERNEL_Y - 32, '-9 ESCUDO', C.red); }
      e.dead = true; burst(e.x, e.y, e.col, 14);
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function tickProjs(dt) {
  for (const p of G.projs) {
    p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16); p.life -= dt;
    p.trail.unshift({ x: p.x, y: p.y });
    if (p.trail.length > 12) p.trail.pop();

    if (p.life <= 0 || p.x < -20 || p.x > CW + 20 || p.y < -20 || p.y > CH + 20) { p.dead = true; continue; }

    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.r) {
        let dmg = p.dmg;
        if (p.wid === 3 && e.hp / (ETYPES[e.type]?.hp || 40) < 0.3) {
          dmg += 20; addFT(e.x, e.y - 26, '💥 CRÍTICO!', C.green);
        }
        e.hp -= dmg; G.hit++;
        burst(p.x, p.y, p.col, 5);
        addFT(e.x, e.y - 18, `-${dmg}`, p.col);
        p.dead = true;
        if (e.hp <= 0) killE(e);
        break;
      }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

function tickPups(dt) {
  for (const pu of G.pups) {
    pu.age += dt; pu.y += Math.sin(pu.age / 280) * 0.35;
    if (pu.age > 8000) { pu.dead = true; continue; }
    for (const p of G.projs) {
      if (p.dead) continue;
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < pu.r + p.r) { activatePup(pu); pu.dead = true; p.dead = true; break; }
    }
  }
  G.pups = G.pups.filter(pu => !pu.dead);
}

function activatePup(pu) {
  const def = PUPS[pu.type], now = Date.now();
  if (pu.type === 'MUTEX') { G.mutexOn = true; G.mutexEnd = now + def.dur; }
  if (pu.type === 'SEMAPHORE') { G.semaOn = true; G.semaEnd = now + def.dur; }
  if (pu.type === 'IRQ') { G.irqOn = true; G.irqEnd = now + def.dur; }
  G.score += 50; addFT(pu.x, pu.y - 28, `⬆ ${def.name}`, def.col);
}

function tickGPages(dt) {
  for (const g of G.gPages) {
    g.age += dt;
    if (g.age > g.life) { g.dead = true; continue; }
    for (const p of G.projs) {
      if (p.dead) continue;
      if (Math.hypot(p.x - g.x, p.y - g.y) < g.r + p.r) {
        G.ram = Math.min(100, G.ram + 20);
        addFT(g.x, g.y - 20, '+20 RAM', C.green); g.dead = true; p.dead = true;
        burst(g.x, g.y, '#ffd700', 8); break;
      }
    }
  }
  G.gPages = G.gPages.filter(g => !g.dead);
}

function tickParts(dt) {
  for (const p of G.parts) {
    p.x += p.vx * (dt / 16); p.y += p.vy * (dt / 16); p.life -= dt;
    p.alpha = Math.max(0, p.life / p.ml);
  }
  G.parts = G.parts.filter(p => p.life > 0);
}

function tickFTexts(dt) {
  for (const t of G.fTexts) { t.y -= 0.65 * (dt / 16); t.life -= dt; t.alpha = Math.max(0, t.life / 1100); }
  G.fTexts = G.fTexts.filter(t => t.life > 0);
}

function checkSpawn(dt) {
  G.spawnT += dt;
  if (G.spawnT < G.spawnI) return;
  G.spawnT = 0;
  G.spawnI = Math.max(750, 2200 - (G.wave - 1) * 130);
  if (G.bossActive) { tickBoss(dt); return; }
  if ([4, 8, 12].includes(G.wave) && !G.bossActive && G.waveKills >= G.waveTarget - 2) { spawnBoss(); return; }
  spawnRandom();
}

function spawnRandom() {
  const pool = ['ZOMBIE'];
  if (G.wave >= 2) pool.push('ORPHAN');
  if (G.wave >= 3) pool.push('DAEMON', 'FORKBOMB');
  if (G.wave >= 4) pool.push('PAGEFAULT');
  if (G.wave >= 5) pool.push('RACECOND');
  const t = pool[Math.floor(Math.random() * pool.length)];
  if (t === 'RACECOND') spawnRC();
  else spawnE(t, 60 + Math.random() * (CW - 120), t === 'FORKBOMB' ? 20 + Math.random() * 35 : -20);
}

function spawnE(type, x, y, extra = {}) {
  const d = ETYPES[type]; if (!d) return null;
  const hp = d.hp * (1 + (G.wave - 1) * 0.06);
  const e = {
    id: Math.random(), type, x, y, bx: x,
    hp, maxHp: hp, speed: d.spd, col: d.col,
    radius: d.r, sides: d.sides, rot: Math.random() * Math.PI * 2,
    al: d.alpha || 1, ph: Math.random() * Math.PI * 2,
    dead: false, score: d.score, ...extra,
  };
  G.enemies.push(e); return e;
}

function spawnRC() {
  const x1 = 100 + Math.random() * (CW - 200);
  const e1 = spawnE('RACECOND', x1, -20);
  const e2 = spawnE('RACECOND', x1 + 42 + Math.random() * 28, -20, { col: C.orange });
  if (e1 && e2) { e1.partner = e2; e2.partner = e1; }
}

function spawnMini(x, y) { const e = spawnE('ZOMBIE', x, y); if (e) { e.radius = 6; e.hp = 10; e.maxHp = 10; e.score = 20; } }
function spawnFBChild(par) {
  for (const ox of [-40, 40]) {
    const e = spawnE('FORKBOMB', par.x + ox, par.y + 22);
    if (e) { e.gen = (par.gen || 0) + 1; e.radius = Math.max(7, par.radius - 3); }
  }
}
function puff(x, y, col, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    G.parts.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, col, r: 3, life: 500, ml: 500, alpha: 1 });
  }
}

// ── §10k BOSSES ──────────────────────────────────────────────────────
function spawnBoss() {
  G.bossActive = true;
  if (G.wave === 4) G.bossData = {
    type: 'DEADLOCK',
    a: { x: 230, y: 110, hp: 220, maxHp: 220, dead: false, immune: false, col: '#ff4466', r: 36 },
    b: { x: 570, y: 110, hp: 220, maxHp: 220, dead: false, immune: false, col: '#4466ff', r: 36 }
  };
  if (G.wave === 8) G.bossData = {
    type: 'STARVATION',
    x: CW / 2, y: 75, hp: 420, maxHp: 420, dead: false, r: 46, col: C.violet, immune: false, spT: 0
  };
  if (G.wave === 12) G.bossData = {
    type: 'KERNELPANIC',
    x: CW / 2, y: 68, hp: 640, maxHp: 640, dead: false, r: 52, col: C.red,
    phase: 1, phT: 0, shieldOpen: false, shieldEnd: 0, spT: 0
  };
  addFT(CW / 2, 50, '⚠ BOSS INVOCADO', C.red);
}

function tickBoss(dt) {
  if (!G.bossData) return;
  const b = G.bossData;
  if (b.type === 'DEADLOCK') tickDeadlock(b);
  if (b.type === 'STARVATION') tickStarv(b, dt);
  if (b.type === 'KERNELPANIC') tickKP(b, dt);
}

function tickDeadlock(b) {
  if (b.a.dead && b.b.dead) { bossWin(); return; }
  b.a.immune = !b.b.dead; b.b.immune = !b.a.dead;
  const t = Date.now() / 1000;
  b.a.x = CW / 2 - 150 + Math.sin(t * 0.55) * 28; b.b.x = CW / 2 + 150 + Math.sin(t * 0.55 + Math.PI) * 28;
  for (const p of G.projs) {
    if (p.dead) continue;
    for (const nd of [b.a, b.b]) {
      if (nd.dead || nd.immune) continue;
      if (Math.hypot(p.x - nd.x, p.y - nd.y) < nd.r + p.r) {
        nd.hp -= p.dmg; p.dead = true; burst(p.x, p.y, p.col, 5);
        addFT(nd.x, nd.y - 20, `-${p.dmg}`, p.col);
        if (nd.hp <= 0) { nd.dead = true; nd.hp = 0; }
      }
    }
  }
}
function tickStarv(b, dt) {
  if (b.dead) { bossWin(); return; }
  b.spT += dt; if (b.spT >= 1800) { b.spT = 0; spawnE('ORPHAN', b.x + (Math.random() - .5) * 110, b.y + 40); }
  b.immune = G.enemies.filter(e => Math.hypot(e.x - b.x, e.y - b.y) < 190).length > 0;
  for (const p of G.projs) {
    if (p.dead || b.immune) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r) {
      b.hp -= p.dmg; p.dead = true; burst(p.x, p.y, p.col, 5);
      addFT(b.x, b.y - 22, `-${p.dmg}`, p.col);
      if (b.hp <= 0) { b.dead = true; G.score += 500; bossWin(); }
    }
  }
}
function tickKP(b, dt) {
  if (b.dead) { bossWin(); return; }
  b.phT += dt;
  if (b.phase === 1 && b.hp < b.maxHp * 0.66) { b.phase = 2; addFT(CW / 2, 48, 'FASE 2: PRIORITY INVERSION', C.orange); }
  if (b.phase === 2 && b.hp < b.maxHp * 0.33) { b.phase = 3; b.shieldOpen = true; b.shieldEnd = Date.now() + 30000; addFT(CW / 2, 48, 'FASE 3: SYSTEM CALL — 30s', C.red); }
  if (b.phase === 3 && Date.now() > b.shieldEnd) { G.shield = 0; addFT(CW / 2, 48, 'SHUTDOWN EJECUTADO', C.red); }
  b.spT += dt; const sr = b.phase === 1 ? 1100 : 1900;
  if (b.spT >= sr) { b.spT = 0; spawnE('DAEMON', b.x + (Math.random() - .5) * 80, b.y + 32); }
  for (const p of G.projs) {
    if (p.dead) continue;
    if (b.phase >= 3 && !b.shieldOpen) continue;
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r) {
      b.hp -= p.dmg; p.dead = true; burst(p.x, p.y, p.col, 5);
      addFT(b.x, b.y - 22, `-${p.dmg}`, p.col);
      if (b.hp <= 0) { b.dead = true; G.score += 1000; bossWin(); }
    }
  }
}
function bossWin() { G.bossActive = false; G.bossData = null; G.score += 300; G.waveKills += G.waveTarget; addFT(CW / 2, CH / 2, '✓ BOSS ELIMINADO +300', C.green); }

// ── §10l MATAR ENEMIGO ───────────────────────────────────────────────
function killE(e) {
  e.dead = true; G.score += e.score; G.killed++; G.waveKills++;
  burst(e.x, e.y, e.col, 13); addFT(e.x, e.y - 24, `+${e.score}`, C.green);
  if (Math.random() < 0.10) dropPup(e.x, e.y);
}
function dropPup(x, y) {
  const keys = Object.keys(PUPS);
  const t = keys[Math.floor(Math.random() * keys.length)];
  G.pups.push({ type: t, x, y: y - 10, r: 13, col: PUPS[t].col, age: 0, dead: false });
}

// ── §10m DRENADO DE RECURSOS ─────────────────────────────────────────
function drainRes(dt) {
  for (const e of G.enemies) {
    const d = ETYPES[e.type]; if (!d) continue;
    const sc = (dt / 1000) * (G.wave * 0.28 + 1);
    G.cpu = Math.max(0, G.cpu - d.cpuD * sc);
    G.ram = Math.max(0, G.ram - d.ramD * sc);
    G.io = Math.max(0, G.io - d.ioD * sc);
  }
  if (G.bossData && G.bossData.phase === 1) {
    G.cpu = Math.max(0, G.cpu - 0.06 * (dt / 1000));
    G.ram = Math.max(0, G.ram - 0.06 * (dt / 1000));
  }
}

// ── §10n AVANCE DE OLEADA ────────────────────────────────────────────
function checkWave() {
  if (G.bossActive) return;
  if (G.waveKills >= G.waveTarget && G.wave < 12) {
    G.wave++; G.waveKills = 0; G.waveTarget = 10 + G.wave * 2;
    G.spawnI = Math.max(750, 2200 - (G.wave - 1) * 130);
    addFT(CW / 2, CH / 2, `OLEADA ${G.wave}`, C.cyan);
    G.cpu = Math.min(100, G.cpu + 4); G.ram = Math.min(100, G.ram + 4); G.io = Math.min(100, G.io + 4);
  }
  if (G.wave === 12 && G.waveKills >= G.waveTarget) endGame(true);
}

// ── §10o GAME OVER ───────────────────────────────────────────────────
function checkOver() {
  let r = null;
  if (G.shield <= 0) r = 'Escudo del Kernel destruido. Corrupción total del sistema.';
  if (G.cpu <= 0) r = 'CPU al 0% — Inanición del planificador. KERNEL PANIC.';
  if (G.ram <= 0) r = 'RAM al 0% — Desbordamiento de memoria. KERNEL PANIC.';
  if (G.io <= 0) r = 'I/O Wait al 0% — Bloqueo del sistema de archivos. KERNEL PANIC.';
  if (G.lives <= 0) r = 'Sin vidas restantes. KERNEL PANIC.';
  if (r) { G.over = true; endGame(false, r); }
}

// ══════════════════════════════════════════════════════════════════════
//  §11  DISPARAR
// ══════════════════════════════════════════════════════════════════════
function shoot() {
  const w = WEAPONS[G.aw];
  const cd = w.cd * (G.irqOn ? 0.5 : 1);
  if (G.cds[G.aw] > 0) return;
  G.cds[G.aw] = cd; G.fired += w.burst;

  for (let i = 0; i < w.burst; i++) {
    let ang = w.burst > 1
      ? G.aim + ((i - (w.burst - 1) / 2) * w.spread * Math.PI / 180)
      : G.aim;

    if (w.id === 2) {
      const tgt = bestTarget();
      if (tgt) ang = Math.max(-Math.PI * 0.97, Math.min(-Math.PI * 0.03,
        Math.atan2(tgt.y - KERNEL_Y, tgt.x - KERNEL_X)));
    }

    const px = KERNEL_X + Math.cos(ang) * (SHIELD_R + 6);
    const py = KERNEL_Y + Math.sin(ang) * (SHIELD_R + 6);
    G.projs.push({
      x: px, y: py, vx: Math.cos(ang) * 8.5, vy: Math.sin(ang) * 8.5,
      dmg: w.dmg, wid: w.id, col: w.col, r: 5, life: 2600, dead: false,
      trail: [],
    });
    burst(px, py, w.col, 4);
  }
}

function bestTarget() {
  if (!G.enemies.length) return null;
  let b = null, bs = -Infinity;
  for (const e of G.enemies) {
    const d = Math.hypot(e.x - KERNEL_X, e.y - KERNEL_Y);
    const th = (1 / d) * 1000 + (1 - e.hp / e.maxHp) * 40;
    if (th > bs) { bs = th; b = e; }
  }
  return b;
}

// ══════════════════════════════════════════════════════════════════════
//  §12  SELECCIÓN DE ARMA + MODAL TEORÍA
// ══════════════════════════════════════════════════════════════════════
function selectWeapon(i, silent = false) {
  G.aw = i;
  document.querySelectorAll('.wslot').forEach((el, j) => el.classList.toggle('active', j === i));
  if (!silent && !G.seen[i]) { G.seen[i] = true; pauseGame(); showTheory(i); }
}
function showTheory(i) {
  const w = WEAPONS[i];
  $('mt-icon').textContent = WEAPONS[i].id === 0 ? '🔵' : WEAPONS[i].id === 1 ? '🔷' : WEAPONS[i].id === 2 ? '🟠' : WEAPONS[i].id === 3 ? '🟢' : '🟣';
  $('mt-name').textContent = w.name;
  $('mt-theory').textContent = w.theory;
  $('mt-pros').innerHTML = w.pros.map(p => `<li>${p}</li>`).join('');
  $('mt-cons').innerHTML = w.cons.map(c => `<li>${c}</li>`).join('');
  $('mt-analogy').textContent = w.analogy;
  $('modal-theory').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════════════
//  §13  MODO EXAMEN
// ══════════════════════════════════════════════════════════════════════
let eqData = null, eAnswered = false, eTid = null;
function showExam() {
  if (G.mode !== 'exam') return;
  pauseGame(); eAnswered = false;
  eqData = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  G.examTotal++;
  $('exam-q').textContent = eqData.q;
  const opts = $('exam-opts'); opts.innerHTML = '';
  $('exam-fb').classList.add('hidden'); $('exam-fb').className = 'exam-fb hidden';
  $('exam-tfill').style.width = '100%';
  eqData.opts.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'eopt';
    b.textContent = ['A', 'B', 'C', 'D'][i] + '. ' + o;
    b.onclick = () => answerExam(i, b); opts.appendChild(b);
  });
  $('modal-exam').classList.remove('hidden');
  let tl = 30000;
  if (eTid) clearInterval(eTid);
  eTid = setInterval(() => {
    tl -= 200; $('exam-tfill').style.width = `${(tl / 30000) * 100}%`;
    if (tl <= 0) { clearInterval(eTid); if (!eAnswered) failExam(); }
  }, 200);
}
function answerExam(i, btn) {
  if (eAnswered) return; eAnswered = true; clearInterval(eTid);
  const ok = i === eqData.ok;
  document.querySelectorAll('.eopt').forEach((b, j) => {
    if (j === eqData.ok) b.classList.add('correct');
    else if (j === i && !ok) b.classList.add('wrong');
    b.disabled = true;
  });
  const fb = $('exam-fb');
  fb.textContent = eqData.fb; fb.classList.remove('hidden'); fb.classList.add(ok ? 'ok' : 'bad');
  if (ok) { G.score += 100; G.examOk++; G.cpu = Math.min(100, G.cpu + 15); G.ram = Math.min(100, G.ram + 15); G.io = Math.min(100, G.io + 15); addFT(CW / 2, CH / 2, '+100 +15% RECURSOS', C.green); }
  else { G.cpu = Math.max(0, G.cpu - 15); G.ram = Math.max(0, G.ram - 15); addFT(CW / 2, CH / 2, 'INCORRECTA -15%', C.red); }
  setTimeout(() => { $('modal-exam').classList.add('hidden'); resumeGame(); }, 2800);
}
function failExam() {
  eAnswered = true;
  G.cpu = Math.max(0, G.cpu - 10); G.ram = Math.max(0, G.ram - 10);
  const fb = $('exam-fb'); fb.textContent = 'Tiempo agotado. ' + eqData.fb;
  fb.classList.remove('hidden'); fb.classList.add('bad');
  setTimeout(() => { $('modal-exam').classList.add('hidden'); resumeGame(); }, 2800);
}

// ══════════════════════════════════════════════════════════════════════
//  §14  PAUSA / REANUDAR
// ══════════════════════════════════════════════════════════════════════
function pauseGame() { G.paused = true; }
function resumeGame() { G.paused = false; G.lastT = performance.now(); }

// ══════════════════════════════════════════════════════════════════════
//  §15  FIN DE PARTIDA
// ══════════════════════════════════════════════════════════════════════
function endGame(won, reason = '') {
  G.over = true; G.won = won;
  cancelAnimationFrame(G.rafId);

  // Guardar en local
  saveSt();

  // Guardar en la nube
  saveScoreToCloud(G.score, G.wave, G.mode);

  const m = Math.floor(G.elapsed / 60000), s = Math.floor((G.elapsed % 60000) / 1000);
  const acc = G.fired > 0 ? Math.round(G.hit / G.fired * 100) : 0;
  const eacc = G.examTotal > 0 ? Math.round(G.examOk / G.examTotal * 100) + '%' : 'N/A';
  const html = `Puntuación: <span>${G.score}</span><br>Oleada: <span>${G.wave}/12</span><br>Procesos eliminados: <span>${G.killed}</span><br>Precisión: <span>${acc}%</span><br>Tiempo: <span>${m}:${String(s).padStart(2, '0')}</span>${G.mode === 'exam' ? `<br>Exactitud examen: <span>${eacc}</span>` : ''}`;
  const title = $('over-title');
  title.textContent = won ? '🏆 SISTEMA ESTABLE' : '💀 KERNEL PANIC';
  title.className = 'over-title ' + (won ? 'win' : 'panic');
  $('over-reason').textContent = won ? 'El Kernel ha sobrevivido las 12 oleadas de corrupción.' : reason;
  $('over-stats').innerHTML = html;
  animOverCanvas(won);
  show('over');
}
function animOverCanvas(won) {
  if (!overCtx) return;
  let f = 0;
  function draw() {
    f++;
    overCtx.fillStyle = 'rgba(4,8,15,0.12)'; overCtx.fillRect(0, 0, 800, 600);
    const col = won ? C.green : C.red;
    for (let r = 40; r < 500; r += 60) {
      const phase = (f * 0.8 + r) % 360;
      overCtx.beginPath(); overCtx.arc(400, 300, r + (f % 80) * 0.5, 0, Math.PI * 2);
      overCtx.strokeStyle = col + '22'; overCtx.lineWidth = 1.5; overCtx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ══════════════════════════════════════════════════════════════════════
//  §16  RENDER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════
function render() {
  ctx.fillStyle = '#020609'; ctx.fillRect(0, 0, CW, CH);
  drawStarfield();
  drawOrbitalGrid();
  drawGoldenPages();
  drawPowerups();
  drawTrails();
  drawProjectiles();
  drawEnemies();
  drawBoss();
  drawParticles();
  drawFloatTexts();
  drawKernel();
  drawTurret();
  drawPupStatus();
}

const STARS = [
  ...Array.from({ length: 70 }, () => ({ x: Math.random() * CW, y: Math.random() * CH, r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.45 + 0.08, spd: 0.04 })),
  ...Array.from({ length: 30 }, () => ({ x: Math.random() * CW, y: Math.random() * CH, r: Math.random() * 1.8 + 0.5, a: Math.random() * 0.6 + 0.2, spd: 0.10 })),
];
function drawStarfield() {
  for (const s of STARS) {
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,225,255,${s.a})`; ctx.fill();
  }
}

function drawOrbitalGrid() {
  ctx.save(); ctx.globalAlpha = 0.055; ctx.strokeStyle = C.blue; ctx.lineWidth = 1;
  for (let r = 80; r <= 500; r += 80) {
    ctx.beginPath(); ctx.arc(KERNEL_X, KERNEL_Y, r, -Math.PI, 0); ctx.stroke();
  }
  for (let a = -Math.PI; a <= 0; a += Math.PI / 8) {
    ctx.beginPath(); ctx.moveTo(KERNEL_X, KERNEL_Y);
    ctx.lineTo(KERNEL_X + Math.cos(a) * 520, KERNEL_Y + Math.sin(a) * 520); ctx.stroke();
  }
  ctx.restore();
}

function drawKernel() {
  const kx = KERNEL_X, ky = KERNEL_Y;
  const now = Date.now() / 1000;

  const haloR = SHIELD_R + 22 + Math.sin(now * 1.6) * 6;
  const halo = ctx.createRadialGradient(kx, ky, SHIELD_R, kx, ky, haloR);
  halo.addColorStop(0, `rgba(0,255,210,${0.06 + 0.04 * Math.sin(now * 2)})`);
  halo.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(kx, ky, haloR, 0, Math.PI * 2);
  ctx.fillStyle = halo; ctx.fill();

  if (G.mutexOn) {
    ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(now * 8) * 0.15;
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 5;
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(kx, ky, SHIELD_R + 14, -Math.PI, 0); ctx.stroke();
    ctx.restore();
  }

  const shp = G.shield / 100;
  const shCol = G.shield > 50 ? C.cyan : G.shield > 25 ? C.orange : C.red;
  ctx.save();
  ctx.globalAlpha = shp * 0.07;
  ctx.fillStyle = shCol;
  ctx.beginPath(); ctx.arc(kx, ky, SHIELD_R, -Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.18 + shp * 0.62;
  ctx.strokeStyle = shCol; ctx.lineWidth = 7;
  ctx.shadowColor = shCol; ctx.shadowBlur = shp > 0 ? 20 : 0;
  ctx.beginPath(); ctx.arc(kx, ky, SHIELD_R, -Math.PI, 0); ctx.stroke();
  ctx.globalAlpha = shp * 0.4; ctx.lineWidth = 2; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(kx, ky, SHIELD_R - 10, -Math.PI, 0); ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 8; i++) {
    const a = -Math.PI + (i / 8) * Math.PI + now * 0.7;
    const px = kx + Math.cos(a) * SHIELD_R, py = ky + Math.sin(a) * SHIELD_R;
    if (py > ky) continue;
    ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = shCol; ctx.shadowColor = shCol; ctx.shadowBlur = 8; ctx.fill();
  }
  ctx.shadowBlur = 0;

  const pr = KERNEL_R + Math.sin(now * 2.2) * 2.5;
  const grd = ctx.createRadialGradient(kx, ky - 4, 2, kx, ky, pr);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, '#00b4ff'); grd.addColorStop(1, 'rgba(0,100,200,0)');
  ctx.beginPath(); ctx.arc(kx, ky, pr, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
  ctx.beginPath(); ctx.arc(kx, ky, KERNEL_R, 0, Math.PI * 2);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2;
  ctx.shadowColor = C.blue; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,255,210,0.7)'; ctx.font = 'bold 8px Courier New';
  ctx.textAlign = 'center'; ctx.fillText('KERNEL', kx, ky + KERNEL_R + 13);
}

function drawTurret() {
  const kx = KERNEL_X, ky = KERNEL_Y;
  const ang = G.aim;
  const baseR = SHIELD_R + 2;
  const mx = kx + Math.cos(ang) * baseR, my = ky + Math.sin(ang) * baseR;

  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ang + Math.PI / 2);

  const w = WEAPONS[G.aw];
  const col = w.col;

  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#0a1828'; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;

  ctx.fillStyle = '#0d1e36';
  ctx.beginPath();
  ctx.roundRect(-7, -4, 14, 8, 2); ctx.fill();
  ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = col + 'cc';
  ctx.shadowColor = col; ctx.shadowBlur = 8;
  ctx.fillRect(-2.5, -22, 5, 18);
  ctx.fillRect(-4, -8, 8, 6);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-1.5, -20, 3, 12);
  ctx.beginPath(); ctx.arc(0, -22, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;

  if (w.burst > 1) {
    ctx.fillStyle = col + '88';
    ctx.fillRect(-8, -16, 3, 12); ctx.fillRect(5, -16, 3, 12);
  }

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(kx + Math.cos(ang) * 200, ky + Math.sin(ang) * 200);
  ctx.stroke(); ctx.setLineDash([]); ctx.restore();
}

function drawEnemies() {
  for (const e of G.enemies) {
    ctx.save(); ctx.globalAlpha = e.al || 1;
    drawPoly(e.x, e.y, e.radius, e.sides, e.rot, e.col);
    const bw = e.radius * 2.2, bx = e.x - e.radius * 1.1, by = e.y - e.radius - 7;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 4);
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = pct > 0.5 ? C.green : pct > 0.25 ? C.yellow : C.red;
    ctx.fillRect(bx, by, bw * pct, 4);
    ctx.fillStyle = e.col; ctx.font = `${Math.floor(e.radius * 0.75)}px Courier New`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(eIcon(e.type), e.x, e.y);
    if (e.type === 'RACECOND' && e.partner && !e.partner.dead) {
      ctx.strokeStyle = C.yellow + '66'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.partner.x, e.partner.y);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

function drawPoly(x, y, r, sides, rot, col) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const ir = r * (0.82 + 0.18 * Math.sin(i * 2.3 + rot));
    if (i === 0) ctx.moveTo(x + Math.cos(a) * ir, y + Math.sin(a) * ir);
    else ctx.lineTo(x + Math.cos(a) * ir, y + Math.sin(a) * ir);
  }
  ctx.closePath();
  ctx.fillStyle = col + '28'; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.shadowColor = col; ctx.shadowBlur = 9; ctx.stroke(); ctx.shadowBlur = 0;
}

function eIcon(t) {
  return { ZOMBIE: 'Z', ORPHAN: 'O', DAEMON: 'D', FORKBOMB: 'F', PAGEFAULT: 'P', RACECOND: 'R' }[t] || '?';
}

function drawTrails() {
  for (const p of G.projs) {
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const a = (1 - i / p.trail.length) * 0.55;
      const r = p.r * (1 - i / p.trail.length) * 0.8;
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fillStyle = p.col + Math.floor(a * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }
}

function drawProjectiles() {
  for (const p of G.projs) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
  }
}

function drawPowerups() {
  for (const pu of G.pups) {
    const bob = Math.sin(pu.age / 280) * 4;
    ctx.save();
    ctx.beginPath(); ctx.arc(pu.x, pu.y + bob, pu.r, 0, Math.PI * 2);
    ctx.fillStyle = pu.col + '33'; ctx.fill();
    ctx.strokeStyle = pu.col; ctx.lineWidth = 2; ctx.shadowColor = pu.col; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = pu.col; ctx.font = '11px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(PUPS[pu.type].icon, pu.x, pu.y + bob); ctx.restore();
  }
}

function drawGoldenPages() {
  for (const g of G.gPages) {
    const a = 1 - g.age / g.life;
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd70033'; ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd700'; ctx.font = '11px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('📄', g.x, g.y); ctx.restore();
  }
}

function drawBoss() {
  if (!G.bossActive || !G.bossData) return;
  const b = G.bossData;
  if (b.type === 'DEADLOCK') {
    for (const nd of [b.a, b.b]) {
      if (nd.dead) continue;
      drawBossNode(nd.x, nd.y, nd.r, nd.immune ? '#555' : nd.col, nd.immune ? '🔒' : '⚔', nd.hp, nd.maxHp);
    }
    if (!b.a.dead && !b.b.dead) {
      ctx.save(); ctx.strokeStyle = '#ff446688'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }
  if (b.type === 'STARVATION' && !b.dead) {
    drawBossNode(b.x, b.y, b.r, b.immune ? '#6a3a9a' : C.violet, '🌀', b.hp, b.maxHp);
    if (b.immune) { ctx.fillStyle = 'rgba(160,90,220,0.4)'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center'; ctx.fillText('INMUNE — elimina sub-procesos', b.x, b.y - b.r - 12); }
  }
  if (b.type === 'KERNELPANIC' && !b.dead) {
    const col = b.phase === 1 ? C.red : b.phase === 2 ? C.orange : '#ff0088';
    drawBossNode(b.x, b.y, b.r, col, '☢', b.hp, b.maxHp);
    ctx.fillStyle = col; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center';
    const pl = ['', 'THRASHING', 'PRIORITY INV.', 'SYSTEM CALL'][b.phase];
    ctx.fillText(`FASE ${b.phase}: ${pl}`, b.x, b.y - b.r - 12);
    if (b.phase === 3 && b.shieldOpen) {
      const rm = Math.max(0, Math.ceil((b.shieldEnd - Date.now()) / 1000));
      ctx.fillStyle = C.yellow; ctx.fillText(`⚠ ESCUDO ABIERTO: ${rm}s`, b.x, b.y - b.r - 24);
    }
  }
}

function drawBossNode(x, y, r, col, icon, hp, maxHp) {
  const pulse = Math.sin(Date.now() / 190) * 5;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r + 12 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = col + '44'; ctx.lineWidth = 3; ctx.stroke();
  drawPoly(x, y, r, 6, Date.now() / 1800, col);
  ctx.fillStyle = col; ctx.font = `${Math.floor(r * 0.72)}px Courier New`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x, y);
  const bw = r * 2.6, bx = x - r * 1.3, by = y + r + 7;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = col; ctx.fillRect(bx, by, bw * Math.max(0, hp / maxHp), 6);
  ctx.restore();
}

function drawParticles() {
  for (const p of G.parts) {
    ctx.save(); ctx.globalAlpha = p.alpha;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 2, 0, Math.PI * 2);
    ctx.fillStyle = p.col; ctx.fill(); ctx.restore();
  }
}

function drawFloatTexts() {
  for (const t of G.fTexts) {
    ctx.save(); ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.col; ctx.font = 'bold 11px Courier New'; ctx.textAlign = 'center';
    ctx.shadowColor = t.col; ctx.shadowBlur = 5; ctx.fillText(t.txt, t.x, t.y);
    ctx.restore();
  }
}

function drawPupStatus() {
  const now = Date.now(); let oy = 18;
  const draw = (txt, col) => {
    ctx.save(); ctx.fillStyle = col + '22'; ctx.strokeStyle = col; ctx.lineWidth = 1;
    const w = ctx.measureText(txt).width + 16;
    ctx.beginPath(); ctx.roundRect(8, oy - 10, w, 16, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.font = '8px Courier New'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 15, oy - 2); ctx.restore(); oy += 20;
  };
  if (G.mutexOn) draw(`🔒 Mutex ${((G.mutexEnd - now) / 1000).toFixed(1)}s`, '#ffd700');
  if (G.semaOn) draw(`🚦 Semaphore ${((G.semaEnd - now) / 1000).toFixed(1)}s`, C.cyan);
  if (G.irqOn) draw(`⚡ IRQ x2 ${((G.irqEnd - now) / 1000).toFixed(1)}s`, C.orange);
}

// ══════════════════════════════════════════════════════════════════════
//  §17  HUD UPDATE
// ══════════════════════════════════════════════════════════════════════
function updateHUD() {
  setBar('cpu', G.cpu); setBar('ram', G.ram); setBar('io', G.io); setBar('shield', G.shield);
  $('score-val').textContent = G.score;
  $('wave-val').textContent = G.wave;
  const m = Math.floor(G.elapsed / 60000), s = Math.floor((G.elapsed % 60000) / 1000);
  $('timer-val').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  $('lives-icons').textContent = '❤'.repeat(Math.max(0, G.lives));
}
function setBar(n, v) {
  const pct = Math.max(0, Math.min(100, v));
  $(`bar-${n}`).style.width = pct + '%'; $(`val-${n}`).textContent = Math.round(pct) + '%';
  const f = $(`bar-${n}`);
  f.style.boxShadow = pct < 25 ? '0 0 7px #ff2255' : pct < 50 ? '0 0 5px #ffe600' : '';
}

// ══════════════════════════════════════════════════════════════════════
//  §18  HELPERS PARTÍCULAS
// ══════════════════════════════════════════════════════════════════════
function burst(x, y, col, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, r: 1.5 + Math.random() * 2, life: 400 + Math.random() * 400, ml: 800, alpha: 1 });
  }
}
function addFT(x, y, txt, col) { G.fTexts.push({ x, y, txt, col, alpha: 1, life: 1100 }); }

// ══════════════════════════════════════════════════════════════════════
//  §19  INPUT: TECLADO
// ══════════════════════════════════════════════════════════════════════
const keys = {};
document.addEventListener('keydown', e => {
  if (keys[e.code]) return; keys[e.code] = true;
  if (!G.running || G.over) return;
  switch (e.code) {
    case 'Digit1': selectWeapon(0); break;
    case 'Digit2': selectWeapon(1); break;
    case 'Digit3': selectWeapon(2); break;
    case 'Digit4': selectWeapon(3); break;
    case 'Digit5': selectWeapon(4); break;
    case 'Space': e.preventDefault(); if (!G.paused) shoot(); break;
    case 'KeyA': case 'ArrowLeft': G.aimL = true; break;
    case 'KeyD': case 'ArrowRight': G.aimR = true; break;
    case 'KeyP': case 'Escape':
      if (G.paused) { $('modal-pause').classList.add('hidden'); resumeGame(); }
      else { pauseGame(); $('modal-pause').classList.remove('hidden'); }
      break;
  }
});
document.addEventListener('keyup', e => {
  delete keys[e.code];
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') G.aimL = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') G.aimR = false;
});

// ══════════════════════════════════════════════════════════════════════
//  §20  INPUT: TÁCTIL
// ══════════════════════════════════════════════════════════════════════
function initTouch() {
  const mobL = $('mob-l'), mobR = $('mob-r'), mobF = $('mob-fire');
  if (!mobL) return;
  const on = (el, start, end) => {
    el.addEventListener('touchstart', e => { e.preventDefault(); start(); }, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
  };
  on(mobL, () => { if (!G.paused) G.aimL = true }, () => G.aimL = false);
  on(mobR, () => { if (!G.paused) G.aimR = true }, () => G.aimR = false);
  mobF.addEventListener('touchstart', e => { e.preventDefault(); if (!G.paused) shoot(); }, { passive: false });
  mobF.addEventListener('click', () => { if (!G.paused) shoot(); });
  document.querySelectorAll('.wslot').forEach(el => {
    el.addEventListener('click', () => selectWeapon(parseInt(el.dataset.w)));
  });
}

// ══════════════════════════════════════════════════════════════════════
//  §21  RESPONSIVE CANVAS
// ══════════════════════════════════════════════════════════════════════
function resizeCanvas() {
  const wrap = $('canvas-wrap'); if (!wrap) return;
  const sc = Math.min(wrap.clientWidth / CW, wrap.clientHeight / CH, 1);
  gameCanvas.style.transform = `scale(${sc})`;
  gameCanvas.style.transformOrigin = 'top center';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ══════════════════════════════════════════════════════════════════════
//  §22  BINDING DE BOTONES UI
// ══════════════════════════════════════════════════════════════════════
function initUI() {
  // Boot
  $('btn-boot-enter')?.addEventListener('click', () => {
    if (bootAnim) { cancelAnimationFrame(bootAnim); bootAnim = null; }
    show('menu'); animMenu(); renderDash(); updateAuthUI(isAuthenticated(), getCurrentUser());
  });
  // Menú — cards de modo
  $('card-manual')?.addEventListener('click', () => startGame('manual'));
  $('card-auto')?.addEventListener('click', () => startGame('auto'));
  $('card-exam')?.addEventListener('click', () => startGame('exam'));
  // Modal teoría
  $('mt-ok')?.addEventListener('click', () => { $('modal-theory').classList.add('hidden'); resumeGame(); });
  // Pausa
  $('btn-pause')?.addEventListener('click', () => {
    if (G.paused) { $('modal-pause').classList.add('hidden'); resumeGame(); }
    else { pauseGame(); $('modal-pause').classList.remove('hidden'); }
  });
  $('btn-resume')?.addEventListener('click', () => { $('modal-pause').classList.add('hidden'); resumeGame(); });
  $('btn-quit')?.addEventListener('click', () => {
    $('modal-pause').classList.add('hidden');
    G.over = true; cancelAnimationFrame(G.rafId);
    show('menu'); renderDash();
  });
  // Game Over
  $('btn-retry')?.addEventListener('click', () => startGame(G.mode || 'manual'));
  $('btn-to-menu')?.addEventListener('click', () => { show('menu'); renderDash(); animMenu(); });

  // Dashboard
  const dashBtn = document.getElementById('btn-dashboard');
  if (dashBtn) {
    dashBtn.addEventListener('click', showDashboard);
  }

  // Dashboard - Volver
  document.getElementById('dash-back')?.addEventListener('click', () => {
    show('menu');
  });

  // Dashboard - Refrescar
  document.getElementById('dash-refresh')?.addEventListener('click', loadDashboardData);
}

// ══════════════════════════════════════════════════════════════════════
//  §23  POLYFILLS & ARRANQUE
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  G = newState('manual');

  // Polyfill roundRect
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y); this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r); this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h); this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r); this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y); this.closePath();
    };
  }

  initUI();
  initTouch();
  initAuthUI();
  startBoot();

  console.log('%cKERNEL DEFENDER v2\n%cCaballero Vargas, P.E. (2026) · SO1 · La Paz, Bolivia',
    'color:#00ffd2;font-size:1.2rem;font-weight:bold;',
    'color:#6a7f96;font-size:.8rem;');
});

// ══════════════════════════════════════════════════════════════════════
//  §24  INICIALIZAR UI DE AUTENTICACIÓN
// ══════════════════════════════════════════════════════════════════════
function initAuthUI() {
  const googleBtn = document.getElementById('btn-google-login');
  const logoutBtn = document.getElementById('btn-logout');

  if (isAuthenticated()) {
    const user = getCurrentUser();
    if (user) updateAuthUI(true, user);
  } else {
    updateAuthUI(false);
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      const result = await loginWithGoogle();
      if (result.success) {
        renderDash();
      } else {
        alert('❌ Error: ' + result.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutUser();
      renderDash();
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
//  §25  DASHBOARD DOCENTE
// ══════════════════════════════════════════════════════════════════════

function isTeacher() {
  const user = getCurrentUser();
  if (!user) return false;
  const teacherEmails = ['profesor@email.com', 'docente@univ.bo', 'patricia@univ.bo'];
  return teacherEmails.includes(user.email);
}

async function showDashboard() {
  if (!isTeacher()) {
    alert('🚫 Acceso restringido. Solo profesores pueden ver el dashboard.');
    return;
  }
  show('dashboard');
  await loadDashboardData();
}

async function loadDashboardData() {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  try {
    // 1. Estadísticas Generales
    const statsRes = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers });
    const stats = await statsRes.json();
    if (stats.success) {
      document.getElementById('dash-total-students').textContent = stats.data.totalStudents;
      document.getElementById('dash-total-games').textContent = stats.data.totalGames;
      const hours = Math.floor(stats.data.totalTimeSeconds / 3600);
      const mins = Math.floor((stats.data.totalTimeSeconds % 3600) / 60);
      document.getElementById('dash-total-time').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      document.getElementById('dash-avg-score').textContent = stats.data.avgScore;
    }

    // 2. Actividad Reciente
    const activityRes = await fetch(`${BACKEND_URL}/api/admin/activity`, { headers });
    const activity = await activityRes.json();
    if (activity.success) {
      renderActivityTable(activity.data);
    }

    // 3. Uso de Algoritmos
    const algoRes = await fetch(`${BACKEND_URL}/api/admin/algorithms`, { headers });
    const algo = await algoRes.json();
    if (algo.success) {
      renderAlgorithms(algo.data);
    }

    // 4. Rendimiento en Exámenes
    const examRes = await fetch(`${BACKEND_URL}/api/admin/exam-performance`, { headers });
    const exam = await examRes.json();
    if (exam.success) {
      renderExamTable(exam.data);
    }

    // 5. Actividad por Hora
    const hourlyRes = await fetch(`${BACKEND_URL}/api/admin/hourly-activity`, { headers });
    const hourly = await hourlyRes.json();
    if (hourly.success) {
      renderHourlyActivity(hourly.data);
    }

    // 6. Bajo Rendimiento
    const lowRes = await fetch(`${BACKEND_URL}/api/admin/low-performance`, { headers });
    const low = await lowRes.json();
    if (low.success) {
      renderLowPerformance(low.data);
    }

  } catch (error) {
    console.error('Error cargando dashboard:', error);
    document.querySelectorAll('.dash-loading').forEach(el => {
      el.textContent = '❌ Error cargando datos';
    });
  }
}

function renderActivityTable(data) {
  const tbody = document.getElementById('dash-activity-body');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="dash-loading">No hay datos de actividad</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${row.username}</strong></td>
            <td>${row.email}</td>
            <td>${row.totalGames}</td>
            <td style="color:var(--green)">${row.bestScore}</td>
            <td style="color:var(--cyan)">🌊 ${row.bestWave}</td>
            <td>${formatTime(row.totalTime)}</td>
            <td>${row.lastPlayed ? formatDate(row.lastPlayed) : 'Nunca'}</td>
        </tr>
    `).join('');
}

function renderAlgorithms(data) {
  const total = data.reduce((sum, d) => sum + parseInt(d.times_used), 0);
  if (total === 0) return;

  const algoMap = {
    'manual': 'FIFO',
    'auto': 'RR',
    'exam': 'PRIORITY'
  };

  const colors = {
    'FIFO': 'fifo',
    'RR': 'rr',
    'PRIORITY': 'priority',
    'SJF': 'sjf',
    'MLFQ': 'mlfq'
  };

  data.forEach(item => {
    const name = algoMap[item.mode] || item.mode;
    const pct = Math.round((parseInt(item.times_used) / total) * 100);
    const id = `algo-${name.toLowerCase()}`;
    const pctId = `algo-${name.toLowerCase()}-pct`;

    const el = document.getElementById(id);
    const pctEl = document.getElementById(pctId);
    if (el) {
      el.style.width = pct + '%';
      el.className = `dash-algo-fill ${colors[name.toLowerCase()] || ''}`;
    }
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

function renderExamTable(data) {
  const tbody = document.getElementById('dash-exam-body');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="dash-loading">No hay datos de examen</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${row.username}</strong></td>
            <td>${row.email}</td>
            <td>${row.total_answers}</td>
            <td style="color:var(--green)">${row.correct_answers}</td>
            <td style="color:${row.accuracy >= 70 ? 'var(--green)' : 'var(--orange)'}">
                ${row.accuracy || 0}%
            </td>
        </tr>
    `).join('');
}

function renderHourlyActivity(data) {
  const container = document.getElementById('dash-hourly-bars');
  if (!data || data.length === 0) {
    container.innerHTML = '<span class="dash-loading">No hay datos</span>';
    return;
  }

  const max = Math.max(...data.map(d => parseInt(d.games)), 1);
  const hours = Array(24).fill(0);
  data.forEach(d => {
    const hour = parseInt(d.hour);
    if (hour >= 0 && hour < 24) {
      hours[hour] = parseInt(d.games);
    }
  });

  const barHeight = 70;
  container.innerHTML = hours.map((val, i) => `
        <div class="dash-hour-bar" style="height:${(val / max) * barHeight + 2}px; background:${val > 0 ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}"
             title="${i}:00 - ${val} partidas"></div>
    `).join('');
}

function renderLowPerformance(data) {
  const tbody = document.getElementById('dash-low-body');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="dash-loading">✅ Todos los estudiantes están activos</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
        <tr>
            <td><strong>${row.username}</strong></td>
            <td>${row.email}</td>
            <td style="color:var(--orange)">${row.last_played ? formatDate(row.last_played) : 'Nunca ha jugado'}</td>
            <td style="color:var(--red)">${row.total_games || 0} partidas</td>
        </tr>
    `).join('');
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}