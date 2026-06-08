/**
 * Local OPC-UA Simulation Server
 * Runs on port 4840
 * Usage: node scripts/local-opcua-server.js
 */

const { OPCUAServer, Variant, DataType, StatusCodes, resolveNodeId } = require("node-opcua");

async function startServer() {
  const server = new OPCUAServer({
    port: 4840,
    resourcePath: "/UA/INDUS",
    buildInfo: {
      productName: "INDUS-Local-OPCUA-Server",
      productUri: "urn:indus:opcua:local",
    },
  });

  await server.initialize();

  const addressSpace = server.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace();
  const objectsFolder = addressSpace.rootFolder.objects;

  // Create a device object
  const device = namespace.addObject({
    organizedBy: objectsFolder,
    browseName: "FactoryDevices",
  });

  // Add variables
  const addFloatVar = (name, initialValue, unit) => {
    let currentValue = initialValue;
    return namespace.addVariable({
      componentOf: device,
      browseName: name,
      dataType: "Float",
      value: {
        get: () => new Variant({ dataType: DataType.Float, value: currentValue }),
        set: (variant) => { currentValue = variant.value; return StatusCodes.Good; },
      },
    });
  };

  const addBoolVar = (name, initialValue) => {
    let currentValue = initialValue;
    return namespace.addVariable({
      componentOf: device,
      browseName: name,
      dataType: "Boolean",
      value: {
        get: () => new Variant({ dataType: DataType.Boolean, value: currentValue }),
        set: (variant) => { currentValue = variant.value; return StatusCodes.Good; },
      },
    });
  };

  const vars = {
    Temperature_M1: addFloatVar("Temperature_M1", 72.0, "°C"),
    Pressure_Main: addFloatVar("Pressure_Main", 45.8, "bar"),
    Level_Tank: addFloatVar("Level_Tank", 67.2, "%"),
    Flow_Rate: addFloatVar("Flow_Rate", 23.1, "L/min"),
    Vibration_M2: addFloatVar("Vibration_M2", 2.1, "mm/s"),
    Current_M1: addFloatVar("Current_M1", 12.5, "A"),
    Temperature_BR2: addFloatVar("Temperature_BR2", 98.0, "°C"),
    Vibration_BR2: addFloatVar("Vibration_BR2", 4.5, "mm/s"),
    Convoyeur_Speed: addFloatVar("Convoyeur_Speed", 1.5, "m/s"),
    Motor_Start: addBoolVar("Motor_Start", true),
    Motor2_Start: addBoolVar("Motor2_Start", false),
    Emergency_Stop: addBoolVar("Emergency_Stop", false),
    Sensor_Entry: addBoolVar("Sensor_Entry", true),
    Sensor_Exit: addBoolVar("Sensor_Exit", false),
  };

  await server.start();
  console.log(`[OPC-UA Server] Running on opc.tcp://127.0.0.1:4840/UA/INDUS`);
  console.log(`[OPC-UA Server] ${Object.keys(vars).length} tags exposed`);

  // Simulate value changes
  setInterval(() => {
    Object.entries(vars).forEach(([name, v]) => {
      if (v.dataType.value === DataType.Float.value) {
        const current = v.readValue().value.value;
        const noise = (Math.random() - 0.5) * 0.3;
        const newVal = parseFloat((current + noise).toFixed(2));
        v.setValueFromSource(new Variant({ dataType: DataType.Float, value: newVal }));
      }
    });
  }, 1000);

  process.on("SIGINT", async () => {
    console.log("\n[OPC-UA Server] Shutting down...");
    await server.shutdown();
    process.exit(0);
  });
}

startServer().catch(err => {
  console.error("[OPC-UA Server] Error:", err.message);
  process.exit(1);
});
