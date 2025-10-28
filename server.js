// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
globalThis.__wssClients = new Set();


app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // <-- tu carpeta con index.html, display.html, etc.

let pacientes = [];
let pacienteActivo = null;

function broadcast(msg) {
  const str = typeof msg === "string" ? msg : JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(str);
      } catch (e) {
        console.warn("Error enviando mensaje WS:", e.message);
      }
    }
  });
}


/* === Rutas REST === */

// obtener lista de pacientes
app.get("/api/pacientes", (req, res) => {
  res.json(pacientes);
});

// agregar nuevo paciente
app.post("/api/pacientes", (req, res) => {
  const paciente = req.body;
  if (!paciente || !paciente.nombreCompleto) {
    return res.status(400).json({ error: "Paciente inválido" });
  }
  paciente.id = Date.now();
  pacientes.push(paciente);

  // notificar a index.js
  broadcast(JSON.stringify({ type: "NEW_PATIENT", data: paciente }));
  res.json(paciente);
});

// limpiar pacientes
app.delete("/api/pacientes/:id", (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);

  // Filtrar el paciente fuera de la lista
  const before = pacientes.length;
  pacientes = pacientes.filter(p => p.id !== idNum);

  console.log(`🗑️ Paciente eliminado: ${id}`);

  // Notificar a todos los clientes conectados que se eliminó un paciente
  broadcast(JSON.stringify({
    type: "PATIENT_DELETED",
    data: { id: idNum }
  }));

  res.json({ ok: true, removed: before - pacientes.length });
});



// 🔔 llamar paciente
app.post("/api/llamar", (req, res) => {
  const paciente = req.body;
  if (!paciente || !paciente.nombreCompleto) {
    return res.status(400).json({ error: "Paciente inválido para llamado" });
  }

  pacienteActivo = paciente;

  broadcast(
    JSON.stringify({
      type: "PATIENT_CALL",
      data: {
        paciente: paciente,
        box: paciente.boxId || paciente.box || "",
        at: new Date().toISOString(),
      },
    })
  );

  res.json({ ok: true, paciente });
});

/* === WebSockets === */
wss.on("connection", (ws) => {
  console.log("🟢 Nuevo cliente WebSocket conectado");
  globalThis.__wssClients.add(ws);

  // Envía lista inicial de pacientes
  ws.send(JSON.stringify({ type: "HELLO", data: pacientes }));

  // Limpia al desconectarse
  ws.on("close", () => {
    globalThis.__wssClients.delete(ws);
    console.log("🔴 Cliente WebSocket desconectado");
  });
});


/* === Start server === */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
