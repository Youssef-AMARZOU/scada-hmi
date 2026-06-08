const EventEmitter = require('events');

/**
 * Factory I/O REST API Service
 * Polls the Factory I/O Web API for real-time tag data.
 * Handles auto-reconnection, error resilience, and tag caching.
 */
class FactoryIOService extends EventEmitter {
  constructor() {
    super();
    this._url = 'http://localhost:7410';
    this._pollInterval = 300;
    this._timer = null;
    this._connected = false;
    this._tags = [];
    this._reconnectAttempts = 0;
    this._maxReconnect = 50;
  }

  connect(url, pollInterval) {
    if (url) this._url = url.replace(/\/$/, '');
    if (pollInterval) this._pollInterval = pollInterval;
    this._reconnectAttempts = 0;
    console.log(`[FactoryIO] Connecting to ${this._url} (poll ${this._pollInterval}ms)`);
    this._startPolling();
    return { success: true };
  }

  disconnect() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._connected = false;
    this._tags = [];
    this.emit('status', { connected: false });
    console.log('[FactoryIO] Disconnected');
  }

  _startPolling() {
    if (this._timer) clearInterval(this._timer);

    this._timer = setInterval(async () => {
      try {
        const resp = await fetch(`${this._url}/api/tags`, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(2000),
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const tags = await resp.json();

        const wasDisconnected = !this._connected;
        this._connected = true;
        this._tags = tags;
        this._reconnectAttempts = 0;

        if (wasDisconnected) {
          console.log(`[FactoryIO] Connected — ${tags.length} tags`);
          this.emit('status', { connected: true, tagCount: tags.length });
        }

        this.emit('tags', tags);
      } catch (err) {
        if (this._connected) {
          console.log(`[FactoryIO] Connection lost: ${err.message}`);
          this._connected = false;
          this.emit('status', { connected: false, error: err.message });
        }

        this._reconnectAttempts++;
        if (this._reconnectAttempts > this._maxReconnect) {
          // Slow down polling when Factory I/O is unavailable
          if (this._timer) clearInterval(this._timer);
          this._timer = setInterval(() => this._poll(), 5000);
        }
      }
    }, this._pollInterval);
  }

  async _poll() {
    try {
      const resp = await fetch(`${this._url}/api/tags`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        // Reconnected — restore fast polling
        this._reconnectAttempts = 0;
        this._startPolling();
      }
    } catch {}
  }

  async getTags() {
    if (this._connected && this._tags.length > 0) return this._tags;
    return this._fetch('/api/tags');
  }

  async getValues() {
    return this._fetch('/api/tag/values');
  }

  async setValues(body) {
    return this._write('/api/tag/values', body);
  }

  async setValuesByName(body) {
    return this._write('/api/tag/values/by-name', body);
  }

  async forceValues(body) {
    return this._write('/api/tag/values-force', body);
  }

  async releaseValues(body) {
    return this._write('/api/tag/values-release', body);
  }

  getStatus() {
    return {
      connected: this._connected,
      url: this._url,
      tagCount: this._tags.length,
      pollInterval: this._pollInterval,
    };
  }

  async _fetch(endpoint) {
    try {
      const resp = await fetch(`${this._url}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async _write(endpoint, body) {
    try {
      const resp = await fetch(`${this._url}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      return { error: err.message };
    }
  }
}

module.exports = FactoryIOService;
