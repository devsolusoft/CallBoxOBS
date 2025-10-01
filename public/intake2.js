document.addEventListener("DOMContentLoaded", () => {
  const raw = document.getElementById("raw");
  const tbody = document.getElementById("tbody");
  const emptyHint = document.getElementById("emptyHint");

  const btnPreview = document.getElementById("btnPreview");
  const btnClear = document.getElementById("btnClear");
  const btnSend = document.getElementById("btnSend");

  let parsedPacientes = [];

  // --- Función para parsear el texto pegado ---
  function parseRaw(text) {
    const rows = text.trim().split("\n").filter(r => r.trim() !== "");
    const pacientes = [];

    rows.forEach(line => {
      const cols = line.split("\t"); // separador TAB

      if (cols.length < 8) return; // formato inválido

      const hora = cols[3] || "";
      const estado = cols[4] || "";
      const tipoAtencion = cols[5] || "";
      const rut = cols[6] || "";
      const nombreRaw = cols[7] || "";
      const obs = cols[8] || "";

      // nombre viene con (M, 64) → lo limpiamos
      let nombre = nombreRaw.replace(/\(.*\)/, "").trim();

      // extraemos edad si viene entre paréntesis
      let edadMatch = nombreRaw.match(/\((?:M|F),\s*(\d+)\)/i);
      let edad = edadMatch ? parseInt(edadMatch[1], 10) : "";

      pacientes.push({
        nombre,
        rut,
        edad,
        hora,
        tipoAtencion,
        observacion: obs,
        estado: estado || "Por Atender"
      });
    });

    return pacientes;
  }

  // --- Render en tabla ---
  function renderPreview(pacientes) {
    tbody.innerHTML = "";
    if (pacientes.length === 0) {
      emptyHint.style.display = "block";
      return;
    }
    emptyHint.style.display = "none";

    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.nombre}</td>
        <td>${p.rut}</td>
        <td>${p.edad}</td>
        <td>${p.hora}</td>
        <td>${p.tipoAtencion}</td>
        <td>${p.observacion || ""}</td>
        <td>${p.estado}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Botón Previsualizar ---
  btnPreview.addEventListener("click", () => {
    parsedPacientes = parseRaw(raw.value);
    renderPreview(parsedPacientes);
  });

  // --- Botón Limpiar ---
  btnClear.addEventListener("click", () => {
    raw.value = "";
    parsedPacientes = [];
    renderPreview(parsedPacientes);
  });

  // --- Botón Enviar ---
  btnSend.addEventListener("click", async () => {
    if (parsedPacientes.length === 0) {
      alert("No hay pacientes para enviar.");
      return;
    }

    for (let paciente of parsedPacientes) {
      try {
        const res = await fetch("/api/pacientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paciente)
        });

        if (!res.ok) {
          console.error("Error al enviar paciente:", paciente, await res.text());
        }
      } catch (err) {
        console.error("Error conexión:", err);
      }
    }

    alert("Pacientes enviados correctamente.");
    raw.value = "";
    parsedPacientes = [];
    renderPreview(parsedPacientes);
  });
});
