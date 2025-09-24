// v2: agrega "Volver a llamar" + sincronización básica entre usuarios (BroadcastChannel + localStorage con TTL 14 días)

/** Datos base (mock) */
/* --- Integración: pushToServer --- 
   Envía el evento confirmado al servidor local para que displays remotos (OBS) se actualicen.
   No rompe la lógica existente si el servidor no está presente (fail-safe).
*/
function pushToServer(payload) {
  try {
    const url = (location && location.origin ? location.origin : "") + "/api/broadcast";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(resp => {
      if (!resp.ok) console.warn("pushToServer responded", resp.status);
    }).catch(err => console.warn("pushToServer error", err));
  } catch (e) {
    console.warn("pushToServer exception", e);
  }
}


const boxes = [
  { id: 1, nombre: "Box 1" },   { id: 2, nombre: "Box 2" },   { id: 3, nombre: "Box 3" },   { id: 4, nombre: "Box 4" },   { id: 5, nombre: "Box 5" },   { id: 6, nombre: "Box 6" },   { id: 7, nombre: "Box 7" },   { id: 8, nombre: "Box 8" },   { id: 9, nombre: "Box 9" },   { id: 10, nombre: "Box 10" },   { id: 11, nombre: "Box 11" }
];

const pacientesBase = [
  { id: 1, nombreCompleto: "María Elena González Ruiz", rut: "15.234.567-8", horaCita: "09:00", estado: "Listo", tipoAtencion: "Consulta General", sexo: "Femenino", edad: 45 },
  { id: 2, nombreCompleto: "Carlos Alberto Mendoza Silva", rut: "12.876.543-2", horaCita: "09:30", estado: "No Listo", tipoAtencion: "Control Presión", sexo: "Masculino", edad: 67 },
  { id: 3, nombreCompleto: "Ana Patricia Herrera López", rut: "18.456.789-1", horaCita: "10:00", estado: "Listo", tipoAtencion: "Examen Rutina", sexo: "Femenino", edad: 32 },
  { id: 4, nombreCompleto: "Roberto Francisco Muñoz Torres", rut: "14.567.890-3", horaCita: "10:30", estado: "Listo", tipoAtencion: "Consulta Especializada", sexo: "Masculino", edad: 54 },
  { id: 5, nombreCompleto: "Carmen Rosa Jiménez Vega", rut: "16.789.123-7", horaCita: "11:00", estado: "No Listo", tipoAtencion: "Control Diabetes", sexo: "Femenino", edad: 61 },
  { id: 6, nombreCompleto: "Luis Eduardo Pérez Morales", rut: "11.345.678-9", horaCita: "11:30", estado: "Listo", tipoAtencion: "Consulta General", sexo: "Masculino", edad: 39 },
  { id: 7, nombreCompleto: "Esperanza del Carmen Castro Díaz", rut: "17.234.567-4", horaCita: "12:00", estado: "No Listo", tipoAtencion: "Examen Preventivo", sexo: "Femenino", edad: 28 },
  { id: 8, nombreCompleto: "Javier Antonio Rojas Fernández", rut: "13.678.901-5", horaCita: "12:30", estado: "Listo", tipoAtencion: "Control Post-Operatorio", sexo: "Masculino", edad: 48 },
  { id: 9, nombreCompleto: "Isabel Cristina Vargas Soto", rut: "19.123.456-0", horaCita: "13:00", estado: "No Listo", tipoAtencion: "Consulta Cardiológica", sexo: "Femenino", edad: 72 },
  { id: 10, nombreCompleto: "Manuel Ignacio Contreras Ramírez", rut: "10.987.654-6", horaCita: "13:30", estado: "Listo", tipoAtencion: "Control Hipertensión", sexo: "Masculino", edad: 58 }
];

/** === Server synchronization (WebSocket + polling) === */
let __serverPacientes = null;
let __callbox_ws = null;

async function syncServerPacientes() {
  try {
    const res = await fetch('/api/pacientes');
    if (!res.ok) return;
    const arr = await res.json();
    if (Array.isArray(arr)) {
      __serverPacientes = arr;
      try { renderPatientTable(); } catch(e){}
    }
  } catch(e){ /* ignore */ }
}

function initServerWebSocket() {
  try {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
    ws.onopen = () => { console.log('WS connected (server sync)'); syncServerPacientes(); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.type === 'NEW_PATIENT') {
          // immediate sync on new patient
          syncServerPacientes();
        }
        if (msg && msg.type === 'PACIENTES_CLEARED') {
          __serverPacientes = [];
          try { renderPatientTable(); } catch(e) {}
        }
      } catch(e){}
    };
    ws.onclose = ()=>{ console.log('WS closed (server sync)'); };
    ws.onerror = ()=>{};
    __callbox_ws = ws;
  } catch(e){ console.warn('WS init failed', e); }
}

// Prefer server list when available
// Injected behavior: __intake_baseOrMocks will use __serverPacientes if non-empty

setInterval(syncServerPacientes, 5000);
window.addEventListener('load', ()=>{ initServerWebSocket(); syncServerPacientes(); });



/** Estado global */
let currentBox = null;
let currentPatient = null;
let currentAction = "call"; // "call" | "recall"

/** Canal para sincronización en vivo entre pestañas/navegadores (mismo origen) */
const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("llamador-pacientes-v2") : null;

/** Utilidades de persistencia (TTL 14 días) */
const TTL_DAYS = 14;
function storageKey(boxId) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  // Scope por día y Box
  return `llamador:box:${boxId}:date:${y}-${m}-${d}`;
}
function loadState(boxId) {
  try {
    const raw = localStorage.getItem(storageKey(boxId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // TTL: si es más viejo que 14 días, limpiar
    if (!data.savedAt || Date.now() - data.savedAt > TTL_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(storageKey(boxId));
      return null;
    }
    return data;
  } catch (e) {
    console.error("Error al cargar estado:", e);
    return null;
  }
}
function saveState(boxId, pacientes) {
  try {
    const payload = { pacientes, savedAt: Date.now(), version: 2 };
    localStorage.setItem(storageKey(boxId), JSON.stringify(payload));
  } catch (e) {
    console.error("Error al guardar estado:", e);
  }
}
function purgeOldState() {
  try {
    const now = Date.now();
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("llamador:box:")) {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data.savedAt || now - data.savedAt > TTL_DAYS * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(k);
        }
      }
    });
  } catch (e) {}
}

/** === Bridge Intake (localStorage) — integración mínima, sin backend === */
function __intake_readToday(){
  try{
    const t = new Date();
    const key = `llamador:intake:batch:${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function __intake_map(item, idx){
  // Mapeo al esquema que usa Callbox 2.2
  return {
    id: 100000 + idx,                  // alto para no chocar con tus IDs mock
    nombreCompleto: item.nombre || "",
    rut: item.rut || "",
    horaCita: item.hora || "",
    estado: "por atender",             // Intake trae "Por atender" → normalizamos en minúsculas
    tipoAtencion: item.tipoAtencion || "Toma de Muestra(s)",
    sexo: "",
    edad: item.edad ? Number(item.edad) : "",
    observacion: item.observaciones || "",
    callCount: 0,
    lastCalledAt: null
  };
}
function __intake_baseOrMocks(){
  // Prefer server-provided pacientes when available
  if (Array.isArray(__serverPacientes) && __serverPacientes.length) {
    return __serverPacientes.map(__intake_map);
  }
  const batch = __intake_readToday();
  if (batch && Array.isArray(batch.items) && batch.items.length) {
    return batch.items.map(__intake_map);
  }
  // Fallback: tus pacientes base actuales
  return pacientesBase.map(p => ({ ...p, callCount: p.callCount || 0 }));
}
/** ===================================================================== */

/** Inicialización */
document.addEventListener("DOMContentLoaded", () => {
  purgeOldState();
  initializeApp();
  // storage sync cross-tab fallback
  window.addEventListener("storage", (e) => {
    if (!currentBox) return;
    if (e.key === storageKey(currentBox.id)) {
      renderPatientTable(); // refresca vista con nuevo estado
    }
  });
  // BroadcastChannel sync
  if (channel) {
    channel.onmessage = (ev) => {
      if (!currentBox) return;
      if (ev?.data?.type === "STATE_UPDATED" && ev.data.boxId === currentBox.id) {
        renderPatientTable();
      }
    };
  }
});

function initializeApp() {
  renderBoxSelection();
  setCurrentDate();
  attachEventListeners();

  const boxSelectionScreen = document.getElementById("box-selection");
  const patientListScreen = document.getElementById("patient-list");
  if (boxSelectionScreen && patientListScreen) {
    boxSelectionScreen.classList.remove("hidden");
    patientListScreen.classList.add("hidden");
  }
}

function renderBoxSelection() {
  const boxGrid = document.getElementById("box-grid");
  if (!boxGrid) return;
  boxGrid.innerHTML = "";
  boxes.forEach(box => {
    const btn = document.createElement("button");
    btn.className = "box-btn";
    btn.textContent = box.nombre;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectBox(box, btn);
    });
    boxGrid.appendChild(btn);
  });
}

function selectBox(box, buttonElement) {
  currentBox = box;
  document.querySelectorAll(".box-btn").forEach(b => b.classList.remove("selected"));
  if (buttonElement) buttonElement.classList.add("selected");

  const boxTitle = document.getElementById("box-title");
  if (boxTitle) boxTitle.textContent = `Citas del Día - ${box.nombre}`;

  setTimeout(() => showPatientList(), 250);
}

function showPatientList() {
  const boxSelectionScreen = document.getElementById("box-selection");
  const patientListScreen = document.getElementById("patient-list");
  if (!boxSelectionScreen || !patientListScreen) return;
  boxSelectionScreen.classList.add("hidden");
  patientListScreen.classList.remove("hidden");
  renderPatientTable();
}

function showBoxSelection() {
  const boxSelectionScreen = document.getElementById("box-selection");
  const patientListScreen = document.getElementById("patient-list");
  if (!boxSelectionScreen || !patientListScreen) return;
  patientListScreen.classList.add("hidden");
  boxSelectionScreen.classList.remove("hidden");
  document.querySelectorAll(".box-btn").forEach(btn => btn.classList.remove("selected"));
  currentBox = null;
}

/** Fecha actual */
function setCurrentDate() {
  const currentDateElement = document.getElementById("current-date");
  if (!currentDateElement) return;
  const today = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  currentDateElement.textContent = today.toLocaleDateString("es-CL", options);
}

/** Fusiona estado persistido con el base */
function getPacientesActuales() {
  // Base desde Intake (si hay lote hoy) o desde los mocks
  const base = __intake_baseOrMocks();

  if (!currentBox) return base.map(p => ({ ...p }));

  // Merge con estado persistido por box (TTL 14 días)
  const stored = loadState(currentBox.id);
  if (!stored?.pacientes) return base.map(p => ({ ...p }));

  const map = new Map(stored.pacientes.map(p => [p.id, p]));
  return base.map(p => {
    const s = map.get(p.id);
    return { ...p, ...(s || {}), callCount: s?.callCount ?? p.callCount ?? 0, lastCalledAt: s?.lastCalledAt ?? p.lastCalledAt ?? null };
  });
}

/** === Callbox 2.2 customizations ===
 * Estados: "Por atender" | "atendido"
 * Acciones: "llamar" | "volver a llamar" | "eliminar"
 */
function normalizePaciente(p) {
  const estadoBase = (p.estado && typeof p.estado === "string") ? p.estado.toLowerCase() : "por atender";
  // map v2 -> v2.2
  let estado = "por atender";
  if (estadoBase === "llamado" || estadoBase === "atendido") estado = "atendido";
  return {
    ...p,
    estado,
    callCount: p.callCount || 0,
    lastCalledAt: p.lastCalledAt || null
  };
}
function getPacientesActuales22() {
  const base = getPacientesActuales().map(normalizePaciente);
  // Orden: "por atender" primero por hora; luego "atendido" por hora
  base.sort((a,b) => {
    const prio = (s) => s === "por atender" ? 0 : 1;
    const A = prio(a.estado), B = prio(b.estado);
    if (A !== B) return A - B;
    return (a.horaCita || "").localeCompare(b.horaCita || "");
  });
  return base;
}

/* ===== Vista 2.2 (coincide con tus columnas de index.html) ===== */
function renderPatientTable(){
  const tbody = document.getElementById("patients-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  function norm(s){ const k=(s||"").toString().toLowerCase(); return (k==="llamado"||k==="atendido")?"atendido":"por atender"; }
  function prio(s){ return s==="por atender" ? 0 : 1; }

  const pacientes = getPacientesActuales22()
    .map(p=>({...p, estado:norm(p.estado)}))
    .sort((a,b)=>{ const A=prio(a.estado), B=prio(b.estado); if(A!==B) return A-B; return (a.horaCita||"").localeCompare(b.horaCita||""); });

  pacientes.forEach(paciente => {
    const tr = document.createElement("tr");
    const estado = norm(paciente.estado);
    let estadoHtml = "";
    if (estado === "por atender") {
      estadoHtml = `<span class="status-badge ready">● Por atender</span>`;
    } else {
      const c = paciente.callCount || 0;
      const time = paciente.lastCalledAt ? ` • ${formatTime(paciente.lastCalledAt)}` : "";
      estadoHtml = `<span class="status-badge called">● atendido (${c})${time}</span>`;
    }

    const actions = document.createElement("div");
    actions.className = "btn-actions";
    if (estado !== "atendido") {
      const btnLlamar = document.createElement("button");
      btnLlamar.className = "btn btn--primary";
      btnLlamar.innerHTML = `<span class="icon">📞</span> Llamar`;
      btnLlamar.title = "Marcar al paciente como atendido";
      btnLlamar.addEventListener("click", (e)=>{ e.preventDefault(); openConfirmationModal(paciente.id, "call"); });
      actions.appendChild(btnLlamar);
    } else {
      const btnRecall = document.createElement("button");
      btnRecall.className = "btn btn--secondary";
      btnRecall.innerHTML = `<span class="icon">🔄</span> Volver a llamar`;
      btnRecall.title = "Registrar un nuevo llamado para este paciente";
      btnRecall.addEventListener("click", (e)=>{ e.preventDefault(); openConfirmationModal(paciente.id, "recall"); });
      actions.appendChild(btnRecall);
    }
    const btnDelete = document.createElement("button");
    btnDelete.className = "btn";
    btnDelete.innerHTML = `<span class="icon-trash">🗑</span> Eliminar`;
    btnDelete.title = "Quitar este paciente de la lista";
    btnDelete.addEventListener("click", (e)=>{
      e.preventDefault();
      if (confirm("¿Eliminar paciente de la lista?")) {
        const list = getPacientesActuales22().filter(p => p.id !== paciente.id);
        saveState(currentBox.id, list);
        if (channel) channel.postMessage({ type: "STATE_UPDATED", boxId: currentBox.id });
        renderPatientTable();
      }
    });
    actions.appendChild(btnDelete);

    tr.innerHTML = `
      <td><strong>${paciente.nombreCompleto}</strong></td>
      <td>${paciente.rut || ""}</td>
      <td>${(paciente.edad ?? "")}</td>
      <td>${paciente.horaCita || ""}</td>
      <td>Toma de Muestra(s)</td>
      <td>${paciente.observacion || paciente.obs || ""}</td>
      <td>${estadoHtml}</td>
      <td></td>
    `;
    tr.querySelector("td:last-child").appendChild(actions);
    tbody.appendChild(tr);
  });
}

/* ===== Modal (v2 → mapeado a confirm v2.2) ===== */
function openConfirmationModal(patientId, action = "call") {
  currentAction = action;
  const pacientes = getPacientesActuales22();
  currentPatient = pacientes.find(p => p.id === patientId);
  if (!currentPatient) return;

  // Detalle compacto (coincide con columnas actuales)
  const el = document.getElementById("patient-details");
  if (el) {
    const count = currentPatient.callCount || 0;
    const last = currentPatient.lastCalledAt ? formatDateTime(currentPatient.lastCalledAt) : "—";
    el.innerHTML = `
      <div class="patient-detail-row"><span class="patient-detail-label">Nombre:</span><span class="patient-detail-value">${currentPatient.nombreCompleto}</span></div>
      <div class="patient-detail-row"><span class="patient-detail-label">RUT:</span><span class="patient-detail-value">${currentPatient.rut}</span></div>
      <div class="patient-detail-row"><span class="patient-detail-label">Hora de Cita:</span><span class="patient-detail-value">${currentPatient.horaCita}</span></div>
      <div class="patient-detail-row"><span class="patient-detail-label">Veces llamado:</span><span class="patient-detail-value">${count}</span></div>
      <div class="patient-detail-row"><span class="patient-detail-label">Último llamado:</span><span class="patient-detail-value">${last}</span></div>
    `;
  }

  const title = document.getElementById("modal-title");
  const text = document.getElementById("confirmation-text");
  if (title) title.textContent = action === "recall" ? "Confirmar volver a llamar" : "Confirmar llamado";
  if (text) text.textContent = action === "recall"
    ? "¿Confirma que desea volver a llamar a este paciente?"
    : "¿Está seguro que desea llamar a este paciente?";

  showModal(document.getElementById("confirmation-modal"));
}

let __cb28_processing = false;
function confirmPatientCall22(){
  if(__cb28_processing) return;             // ✅ guard único
  __cb28_processing = true;

  if (!currentPatient || !currentBox) return;
  const state = getPacientesActuales22();
  const idx = state.findIndex(p => p.id === currentPatient.id);
  if (idx === -1) return;

  const nowIso = new Date().toISOString();
  const prev = state[idx];
  const newCount = (prev.callCount || 0) + 1;

  state[idx] = {
    ...prev,
    estado: "atendido",
    callCount: newCount,
    lastCalledAt: nowIso
  };

  saveState(currentBox.id, state);
  // Enviar evento al servidor para que displays remotos (OBS) actualicen la tarjeta
try {
  const payload = {
    boxId: (currentBox && (currentBox.id || currentBox.name)) ? (currentBox.id || currentBox.name) : "box",
    paciente: state[idx],
    action: currentAction || "call",
    at: (new Date()).toISOString()
  };

  // 🔔 notificar a display vía servidor
  fetch("/api/llamar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.paciente)
  }).catch(err => console.error("Error al llamar paciente:", err));

  // 🔄 mantener compatibilidad con la función pushToServer (logs, depuración)
  pushToServer(payload);

} catch (e) {
  console.warn("pushToServer failed:", e);
}


  if (channel) channel.postMessage({ type: "STATE_UPDATED", boxId: currentBox.id });

  hideModal(document.getElementById("confirmation-modal"));

  const successTitle = document.getElementById("success-title");
  const successText = document.getElementById("success-text");
  if (successTitle && successText) {
    if (currentAction === "recall") {
      successTitle.textContent = "Nuevo llamado registrado";
      successText.textContent = "Se ha vuelto a llamar al paciente.";
    } else {
      successTitle.textContent = "Llamado exitoso";
      successText.textContent = "El paciente ha sido llamado y marcado como atendido.";
    }
  }
  showModal(document.getElementById("success-modal"));

  setTimeout(()=>{ renderPatientTable(); __cb28_processing=false; }, 200); // ✅ refresca y libera guard
}

/** Eventos */
function attachEventListeners() {
  const changeBoxBtn = document.getElementById("change-box-btn");
  if (changeBoxBtn) changeBoxBtn.addEventListener("click", (e) => { e.preventDefault(); showBoxSelection(); });

  const cancelBtn = document.getElementById("cancel-btn");
  if (cancelBtn) cancelBtn.addEventListener("click", (e) => { e.preventDefault(); hideModal(document.getElementById("confirmation-modal")); currentPatient = null; });

  const confirmBtn = document.getElementById("confirm-btn");
  if (confirmBtn) confirmBtn.addEventListener("click", (e) => { e.preventDefault(); confirmPatientCall(); });

  const successOkBtn = document.getElementById("success-ok-btn");
  if (successOkBtn) successOkBtn.addEventListener("click", (e) => { e.preventDefault(); hideModal(document.getElementById("success-modal")); currentPatient = null; });

  // cerrar con backdrop
  ["confirmation-modal", "success-modal"].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      const backdrop = modal.querySelector(".modal-backdrop");
      if (backdrop) backdrop.addEventListener("click", () => { hideModal(modal); currentPatient = null; });
    }
  });

  // ESC para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ["confirmation-modal", "success-modal"].forEach(id => {
        const m = document.getElementById(id);
        if (m && !m.classList.contains("hidden")) hideModal(m);
      });
      currentPatient = null;
    }
  });
}

/** Helpers de formato */
function pad(n) { return n.toString().padStart(2, "0"); }
function formatTime(iso) {
  try {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}
function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    const fecha = d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "2-digit" });
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${fecha} ${hora}`;
  } catch { return ""; }
}

/* ===== Guard antidoble-incremento (fix sintaxis) ===== */
let __cb25_processing = false;              // ✅ define variable
function confirmPatientCallGuarded(fn){
  if (__cb25_processing) return;
  __cb25_processing = true;                 // ✅ marca en curso
  try { fn && fn(); }
  finally { setTimeout(()=>{ __cb25_processing = false; }, 0); } // ✅ libera
}
// Mapea confirm antiguo → nueva confirm con guard
if (typeof confirmPatientCall22 === "function") {
  window.confirmPatientCall = function(){ confirmPatientCallGuarded(confirmPatientCall22); };
}

/* === CallBox 2.7 — helpers === */
function __cb27_normalizeEstado(s){
  if(!s) return "por atender";
  const k = (""+s).trim().toLowerCase();
  if (k === "llamado" || k === "atendido") return "atendido";
  return "por atender";
}
function __cb27_getPacientes(){
  try { return (getPacientesActuales() || []).map(p => ({...p, estado: __cb27_normalizeEstado(p.estado)})); }
  catch(e){ return []; }
}

/* === Utilidades modales === */
function showModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
  const focusable = modal.querySelectorAll("button, [href], input, select, textarea");
  if (focusable.length) focusable[0].focus();
}
function hideModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
}

/* confirm override removed in v2.8: handled by confirmPatientCallGuarded -> confirmPatientCall22 */
