#!/usr/bin/env node
// INDUS MQTT Bridge - MATLAB to MQTT via Node.js
// Usage: node mqtt_bridge.js <host:port> <topic> [message|--file path]
const mqtt = require('mqtt');
const fs = require('fs');

const host = process.argv[2] || 'localhost:1883';
const topic = process.argv[3];
const arg4 = process.argv[4] || '';

let message;
if (arg4 === '--file' && process.argv[5]) {
    message = fs.readFileSync(process.argv[5], 'utf8');
} else {
    message = arg4;
}

if (!topic || !message) {
    console.error('Usage: node mqtt_bridge.js <host:port> <topic> <message>');
    process.exit(1);
}

const client = mqtt.connect(`mqtt://${host}`, {
    connectTimeout: 2000,
    reconnectPeriod: 0
});

client.on('connect', () => {
    client.publish(topic, message, { qos: 0 }, (err) => {
        if (err) { console.error(err.message); process.exit(1); }
        client.end(true);
        process.exit(0);
    });
});

client.on('error', (err) => {
    console.error(err.message);
    process.exit(1);
});

setTimeout(() => { process.exit(1); }, 3000);
