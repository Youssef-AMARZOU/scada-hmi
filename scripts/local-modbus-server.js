/**
 * Local Modbus TCP Simulation Server
 * Runs on port 502
 * Usage: node scripts/local-modbus-server.js
 */

const modbus = require("jsmodbus");
const net = require("net");

const PORT = 502;
const HOST = "0.0.0.0";

// Create the net server first
const netServer = new net.Server();

// Create Modbus TCP server attached to the net server
const server = new modbus.server.TCP(netServer, {
  holding: Buffer.alloc(10000),
  coils: Buffer.alloc(10000),
  discrete: Buffer.alloc(10000),
  input: Buffer.alloc(10000),
});

// Initialize sample data in holding registers (16-bit values)
// Register 0: Temperature_M1 * 10 (e.g. 720 = 72.0°C)
server.holding.writeUInt16BE(720, 0);   // Temperature_M1
server.holding.writeUInt16BE(458, 2);   // Pressure_Main * 10
server.holding.writeUInt16BE(672, 4);   // Level_Tank * 10
server.holding.writeUInt16BE(231, 6);   // Flow_Rate * 10
server.holding.writeUInt16BE(21, 8);    // Vibration_M2 * 10
server.holding.writeUInt16BE(125, 10);  // Current_M1 * 10
server.holding.writeUInt16BE(980, 12);  // Temperature_BR2 * 10
server.holding.writeUInt16BE(45, 14);   // Vibration_BR2 * 10
server.holding.writeUInt16BE(15, 16);   // Convoyeur_Speed * 10
server.holding.writeUInt16BE(347, 18);  // Produced count
server.holding.writeUInt16BE(8, 20);    // Defects count
server.holding.writeUInt16BE(500, 22);  // Target count

// Initialize coils (boolean values, 1 bit each)
server.coils.writeUInt8(0b00000001, 0);  // Motor_Start = true

netServer.on("connection", (client) => {
  console.log(`[Modbus Server] Client connected: ${client.remoteAddress}:${client.remotePort}`);
});

server.on("readCoils", (request, response, send) => {
  console.log(`[Modbus Server] Read coils @ ${request.address}, count=${request.quantity}`);
  send(response);
});

server.on("readHoldingRegisters", (request, response, send) => {
  console.log(`[Modbus Server] Read holding registers @ ${request.address}, count=${request.quantity}`);
  send(response);
});

server.on("writeSingleCoil", (request, response, send) => {
  console.log(`[Modbus Server] Write coil @ ${request.address} = ${request.value}`);
  send(response);
});

server.on("writeSingleRegister", (request, response, send) => {
  console.log(`[Modbus Server] Write register @ ${request.address} = ${request.value}`);
  send(response);
});

// Simulate data drift
setInterval(() => {
  // Temperature_M1 (register 0)
  const temp = server.holding.readUInt16BE(0);
  const newTemp = Math.max(650, Math.min(900, temp + Math.round((Math.random() - 0.5) * 4)));
  server.holding.writeUInt16BE(newTemp, 0);

  // Pressure_Main (register 2)
  const press = server.holding.readUInt16BE(2);
  const newPress = Math.max(350, Math.min(600, press + Math.round((Math.random() - 0.5) * 3)));
  server.holding.writeUInt16BE(newPress, 2);

  // Vibration_M2 (register 8)
  const vib = server.holding.readUInt16BE(8);
  const newVib = Math.max(10, Math.min(50, vib + Math.round((Math.random() - 0.5) * 2)));
  server.holding.writeUInt16BE(newVib, 8);
}, 1000);

netServer.listen(PORT, HOST, () => {
  console.log(`[Modbus Server] Running on ${HOST}:${PORT}`);
  console.log(`[Modbus Server] Holding registers: 0-24 initialized with factory data`);
  console.log(`[Modbus Server] Coils: 0-7 initialized with motor states`);
});

process.on("SIGINT", () => {
  console.log("\n[Modbus Server] Shutting down...");
  netServer.close();
  process.exit(0);
});
