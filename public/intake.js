document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("intakeForm");
  let statusDiv = document.getElementById("status");
  if (!statusDiv) {
    statusDiv = document.createElement("div");
    statusDiv.id = "status";
    if (form && form.parentNode) form.parentNode.insertBefore(statusDiv, form.nextSibling);
    else document.body.appendChild(statusDiv);
  }

  const clearBtn = document.getElementById("clearBtn");

  async function postPatientToServer(payload) {
    const res = await fetch("/api/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    // intenta parsear JSON (si no viene, deja null)
    const body = await res.clone().text().then(t => {
      try { return JSON.parse(t); } catch { return t || null; }
    }).catch(() => null);

    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // Función pública: enviar un único paciente 
  async function sendPatient(patient) {
    const payload = {
      nombreCompleto: patient.nombreCompleto || patient.nombre || "",
      rut: patient.rut || "",
      edad: patient.edad || "",
      tipoAtencion: patient.tipoAtencion || patient.tipo || "",
      hora: patient.hora || ""
    };
    return postPatientToServer(payload);
  }

  // Función pública: enviar varios pacientes
  async function sendPatients(patients, options = {}) {
    if (!Array.isArray(patients)) patients = [patients];
    const { parallel = false, onProgress } = options;
    const results = [];

    if (parallel) {
      // envía en paralelo
      const promises = patients.map((p, i) =>
        sendPatient(p)
          .then(res => ({ ok: true, response: res }))
          .catch(err => ({ ok: false, error: err }))
          .finally(() => {})
      );
      const settled = await Promise.all(promises);
      if (typeof onProgress === "function") settled.forEach((r, i) => onProgress(i, r));
      return settled;
    }

    // envía secuencial 
    for (let i = 0; i < patients.length; i++) {
      try {
        const r = await sendPatient(patients[i]);
        const okObj = { ok: true, response: r };
        results.push(okObj);
        if (typeof onProgress === "function") onProgress(i, okObj);
      } catch (err) {
        const failObj = { ok: false, error: err };
        results.push(failObj);
        if (typeof onProgress === "function") onProgress(i, failObj);
      }
    }
    return results;
  }

  window.sendPatient = sendPatient;
  window.sendPatients = sendPatients;

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        nombreCompleto: document.getElementById("nombreCompleto")?.value || "",
        rut: document.getElementById("rut")?.value || "",
        edad: document.getElementById("edad")?.value || "",
        tipoAtencion: document.getElementById("tipoAtencion")?.value || "",
        hora: document.getElementById("hora")?.value || ""
      };

      statusDiv.textContent = "Enviando...";
      try {
        await postPatientToServer(payload);
        statusDiv.textContent = "Paciente agregado correctamente.";
        form.reset();
      } catch (err) {
        console.error(err);
        statusDiv.textContent = "Error al agregar paciente.";
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (form) form.reset();
      statusDiv.textContent = "";
    });
  }
});
