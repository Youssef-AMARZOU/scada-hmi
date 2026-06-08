const EventEmitter = require('events');

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this._client = null;
    this._connected = false;
    this._url = 'mqtt://localhost:1883';
    this._subscriptions = new Set();
    this._reconnecting = false;
    this._manuallyStopped = false;
  }

  connect(url) {
    if (url) this._url = url;
    this._manuallyStopped = false;
    this._doConnect();
    return { success: true };
  }

  _doConnect() {
    if (this._client) {
      try { this._client.end(true); } catch {}
    }

    console.log(`[MQTT] Connecting to ${this._url}...`);

    try {
      const mqtt = require('mqtt');
      this._client = mqtt.connect(this._url, {
        clientId: `indus-${Date.now()}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 5000,
        keepalive: 30,
        protocolVersion: 4,
        resubscribe: true,
      });

      this._client.on('connect', () => {
        console.log('[MQTT] Connected');
        this._connected = true;
        this._reconnecting = false;
        this.emit('status', { connected: true, url: this._url });
      });

      this._client.on('message', (topic, message) => {
        let payload;
        try {
          payload = JSON.parse(message.toString());
        } catch {
          payload = message.toString();
        }
        this.emit('message', { topic, payload, timestamp: new Date().toISOString() });
      });

      this._client.on('error', (err) => {
        console.log(`[MQTT] Error: ${err.message}`);
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          this._connected = false;
          this._reconnecting = true;
          this.emit('status', { connected: false, error: err.message, reconnecting: true });
        }
      });

      this._client.on('close', () => {
        if (this._connected) {
          console.log('[MQTT] Disconnected');
          this._connected = false;
          this._reconnecting = true;
          this.emit('status', { connected: false, reconnecting: true });
        }
      });

      this._client.on('reconnect', () => {
        this._reconnecting = true;
        console.log('[MQTT] Reconnecting...');
        this.emit('status', { connected: false, reconnecting: true });
      });

      this._client.on('offline', () => {
        this._connected = false;
      });

    } catch (err) {
      console.log(`[MQTT] Module error: ${err.message}`);
      this.emit('status', { connected: false, error: err.message });
    }
  }

  disconnect() {
    this._manuallyStopped = true;
    if (this._client) {
      try { this._client.end(true); } catch {}
      this._client = null;
    }
    this._connected = false;
    this._subscriptions.clear();
    this.emit('status', { connected: false });
    console.log('[MQTT] Disconnected');
  }

  publish(topic, payload) {
    if (!this._client || !this._connected) return { error: 'MQTT not connected' };
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this._client.publish(topic, message, { qos: 0 });
    return { success: true };
  }

  subscribe(topic) {
    this._subscriptions.add(topic);
    if (this._client && this._connected) {
      this._client.subscribe(topic);
      console.log(`[MQTT] Subscribed to ${topic}`);
    }
    return { success: true };
  }

  unsubscribe(topic) {
    this._subscriptions.delete(topic);
    if (this._client && this._connected) {
      this._client.unsubscribe(topic);
    }
    return { success: true };
  }

  getStatus() {
    return {
      connected: this._connected,
      url: this._url,
      reconnecting: this._reconnecting,
      subscriptionCount: this._subscriptions.size,
    };
  }
}

module.exports = MQTTService;