document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("intakeForm");
  const statusDiv = document.getElementById("status");
  const clearBtn = document.getElementById("clearBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

const payload = {
  nombreCompleto: document.getElementById("nombreCompleto").value,  // 🔄 usar nombreCompleto
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
