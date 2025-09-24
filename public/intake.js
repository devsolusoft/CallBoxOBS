<<<<<<< HEAD
// intake.js - guarda pacientes en "Citas del Día" (index.html) y notifica actualización
(function(){
  const form = document.getElementById('intakeForm');
  const status = document.getElementById('status');
  const bcDisplay = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('callbox_channel') : null;

  function toPayload() {
    return {
      nombreCompleto: document.getElementById('nombreCompleto').value.trim(),
      rut: document.getElementById('rut').value.trim(),
      edad: document.getElementById('edad').value.trim(),
      tipoAtencion: document.getElementById('tipoAtencion').value.trim(),
      hora: document.getElementById('hora').value.trim(),
      };
  }

  function todayKey() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth()+1).padStart(2,'0');
    const d = String(t.getDate()).padStart(2,'0');
    return `llamador:intake:batch:${y}-${m}-${d}`;
  }

  function saveToIntakeBatch(item) {
    try {
      const key = todayKey();
      const raw = localStorage.getItem(key);
      let batch = raw ? JSON.parse(raw) : { items: [], savedAt: Date.now() };
      if (!Array.isArray(batch.items)) batch.items = [];
      batch.items.push(item);
      batch.savedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(batch));
      return true;
    } catch (e) {
      console.warn('Error guardando intake batch', e);
      return false;
    }
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if (status) status.textContent = 'Enviando...';

    const payload = toPayload();

    // Adaptar campos al formato que index.html espera
    const item = {
      nombre: payload.nombreCompleto || '',
      rut: payload.rut || '',
      edad: payload.edad || '',
      tipoAtencion: payload.tipoAtencion || '',
      hora: payload.hora || ''
    };

    const saved = saveToIntakeBatch(item);

    // Notificar a display.html (opcional)
    try {
      if (bcDisplay) bcDisplay.postMessage({ type:'NEW_PATIENT', data: item });
    } catch(e){ console.warn('Broadcast display falló', e); }

    // Notificar a index.html para que recargue las Citas del Día
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const appChannel = new BroadcastChannel('llamador-pacientes-v2');
        appChannel.postMessage({ type: 'STATE_UPDATED', boxId: null });
        if (typeof appChannel.close === 'function') appChannel.close();
      }
    } catch(e){ console.warn('Notificación a app falló', e); }

    if (status) status.textContent = saved ? 'Paciente agregado a Citas del Día.' : 'Error al guardar paciente.';
    form.reset();
  });

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', ()=>{ form.reset(); if (status) status.textContent=''; });
})();
=======
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("intakeForm");
  const statusDiv = document.getElementById("status");
  const clearBtn = document.getElementById("clearBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      nombreCompleto: document.getElementById("nombreCompleto").value,
      rut: document.getElementById("rut").value,
      edad: document.getElementById("edad").value,
      tipoAtencion: document.getElementById("tipoAtencion").value,
      hora: document.getElementById("hora").value
    };

    try {
      const res = await fetch("/api/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        statusDiv.textContent = "Paciente agregado correctamente.";
        form.reset();
      } else {
        statusDiv.textContent = "Error al agregar paciente.";
      }
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "Error de conexión con el servidor.";
    }
  });

  clearBtn.addEventListener("click", () => {
    form.reset();
    statusDiv.textContent = "";
  });
});
>>>>>>> 6fe531c (corregido intake, permite subir nuevos pacientes, y crea lista que se refleja en todos los box, se permite ejecutar desde diferentes navegadores)
