// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // <-- tu carpeta con index.html, display.html, etc.

let pacientes = [];
let pacienteActivo = null;

function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
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
app.delete("/api/pacientes", (req, res) => {
  pacientes = [];
  broadcast(JSON.stringify({ type: "PACIENTES_CLEARED" }));
  res.json({ ok: true });
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
  console.log("Nuevo cliente conectado");
  ws.send(JSON.stringify({ type: "HELLO", pacientes }));
});

/* === Start server === */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
