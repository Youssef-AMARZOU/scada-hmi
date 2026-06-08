const EventEmitter = require('events');

class InfluxService extends EventEmitter {
  constructor() {
    super();
    this._client = null;
    this._writeApi = null;
    this._queryApi = null;
    this._connected = false;
    this._config = { url: 'http://localhost:8086', org: 'indus', bucket: 'factory-data', token: '' };
    this._Point = null;
    this._writeCount = 0;
    this._flushTimer = null;
    this._healthTimer = null;
  }

  async connect(config) {
    if (config) this._config = { ...this._config, ...config };
    const { url, token, org, bucket } = this._config;

    if (!token) {
      console.log('[InfluxDB] No token — attempting auto-setup...');
      const setupResult = await this.setup(this._config);
      if (setupResult.token) {
        this._config.token = setupResult.token;
        return this.connect(this._config);
      }
      console.log('[InfluxDB] Auto-setup failed — provide token manually');
      this.emit('status', { connected: false, error: 'No token. Configure in Settings.' });
      return { error: 'No token configured. Configure in Settings.' };
    }

    try {
      const { InfluxDB, Point } = require('@influxdata/influxdb-client');
      this._Point = Point;
      this._client = new InfluxDB({ url, token, timeout: 10000 });
      this._writeApi = this._client.getWriteApi(org, bucket, 'ms', {
        batchSize: 100, flushInterval: 5000, maxRetries: 3, retryJitter: 1000,
      });
      this._queryApi = this._client.getQueryApi(org);

      // Verify connection with a simple query
      try {
        await this._queryApi.collectRows('from(bucket: "' + bucket + '") |> range(start: -1m) |> limit(n:1)');
      } catch (queryErr) {
        // If bucket doesn't exist, try to create it
        if (queryErr.message && queryErr.message.includes('not found')) {
          console.log(`[InfluxDB] Bucket "${bucket}" not found, attempting to create...`);
          try {
            await this._createBucket(org, bucket, token);
            console.log(`[InfluxDB] Bucket "${bucket}" created`);
          } catch (createErr) {
            console.log(`[InfluxDB] Could not create bucket: ${createErr.message}`);
          }
        }
      }

      this._connected = true;
      console.log(`[InfluxDB] Connected to ${url}, org=${org}, bucket=${bucket}`);
      this.emit('status', { connected: true, url, org, bucket });
      this._healthCheck();
      return { success: true };
    } catch (err) {
      console.log(`[InfluxDB] Connection error: ${err.message}`);
      this._connected = false;
      this.emit('status', { connected: false, error: err.message });
      return { error: err.message };
    }
  }

  async setup(config) {
    const url = config?.url || this._config.url;
    console.log(`[InfluxDB] Running setup on ${url}...`);

    try {
      // Check if reachable
      try {
        const healthResp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
        if (!healthResp.ok) throw new Error('InfluxDB not reachable');
      } catch (e) {
        return { error: `InfluxDB not reachable at ${url}: ${e.message}` };
      }

      // Try onboarding
      try {
        const onboardResp = await fetch(`${url}/api/v2/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: config?.username || 'admin',
            password: config?.password || 'indusadmin2026!',
            org: config?.org || 'indus',
            bucket: config?.bucket || 'factory-data',
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (onboardResp.status === 201) {
          const data = await onboardResp.json();
          const token = data.auth?.token;
          console.log(`[InfluxDB] Setup complete! Token generated.`);
          return { success: true, token, org: data.org?.name, bucket: data.bucket?.name };
        } else if (onboardResp.status === 422) {
          console.log('[InfluxDB] Already initialized — need existing token.');
          return { error: 'Already initialized. Provide the existing token in Settings.' };
        } else {
          const text = await onboardResp.text();
          return { error: `Setup failed: ${onboardResp.status} ${text}` };
        }
      } catch (err) {
        return { error: `Setup request failed: ${err.message}` };
      }
    } catch (err) {
      return { error: err.message };
    }
  }

  async _createBucket(orgId, bucketName, token) {
    const { url } = this._config;
    // Find org ID first
    const orgsResp = await fetch(`${url}/api/v2/orgs?org=${orgId}`, {
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    const orgsData = await orgsResp.json();
    const orgIdActual = orgsData.orgs?.[0]?.id;
    if (!orgIdActual) throw new Error('Could not find org ID');

    const resp = await fetch(`${url}/api/v2/buckets`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: bucketName,
        orgID: orgIdActual,
        retentionRules: [{ everySeconds: 2592000 }], // 30 days
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok && resp.status !== 422) {
      throw new Error(`Create bucket failed: ${resp.status}`);
    }
  }

  disconnect() {
    if (this._writeApi) { try { this._writeApi.close(); } catch {} }
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
    this._client = null;
    this._writeApi = null;
    this._queryApi = null;
    this._connected = false;
    this.emit('status', { connected: false });
    console.log('[InfluxDB] Disconnected');
  }

  writeTags(tags) {
    if (!this._connected || !this._writeApi || !this._Point) return;
    try {
      const now = Date.now();
      tags.forEach(tag => {
        if (tag.value === undefined || tag.value === null) return;
        const point = new this._Point('factory_tag')
          .tag('name', tag.name)
          .tag('kind', tag.kind || 'Variable')
          .tag('type', tag.type || 'Unknown')
          .tag('machine', tag.machine || 'unknown')
          .timestamp(now);
        if (typeof tag.value === 'number') point.floatField('value', tag.value);
        else if (typeof tag.value === 'boolean') { point.booleanField('state', tag.value); point.intField('value', tag.value ? 1 : 0); }
        else point.stringField('value', String(tag.value));
        this._writeApi.writePoint(point);
      });
      this._writeCount += tags.length;
    } catch {}
  }

  writePoint(measurement, tags, fields) {
    if (!this._connected || !this._writeApi || !this._Point) return;
    try {
      const point = new this._Point(measurement);
      Object.entries(tags || {}).forEach(([k, v]) => point.tag(k, String(v)));
      Object.entries(fields || {}).forEach(([k, v]) => {
        if (typeof v === 'number') point.floatField(k, v);
        else if (typeof v === 'boolean') point.booleanField(k, v);
        else point.stringField(k, String(v));
      });
      this._writeApi.writePoint(point);
    } catch {}
  }

  async query(fluxQuery) {
    if (!this._connected || !this._queryApi) return { error: 'InfluxDB not connected' };
    try {
      const results = [];
      return new Promise((resolve) => {
        this._queryApi.queryRows(fluxQuery, {
          next(row, tableMeta) { results.push(tableMeta.toObject(row)); },
          error(error) { resolve({ error: error.message, results: [] }); },
          complete() { resolve({ results, count: results.length }); },
        });
      });
    } catch (err) {
      return { error: err.message };
    }
  }

  getStatus() {
    return {
      connected: this._connected,
      url: this._config.url,
      org: this._config.org,
      bucket: this._config.bucket,
      hasToken: !!this._config.token,
      writeCount: this._writeCount,
    };
  }

  _healthCheck() {
    if (this._healthTimer) clearInterval(this._healthTimer);
    this._healthTimer = setInterval(async () => {
      try {
        const resp = await fetch(`${this._config.url}/health`, { signal: AbortSignal.timeout(3000) });
        const data = await resp.json();
        if (data.status !== 'pass' && this._connected) {
          this._connected = false;
          this.emit('status', { connected: false, error: 'Health check failed' });
        }
      } catch {
        if (this._connected) {
          this._connected = false;
          this.emit('status', { connected: false, error: 'Unreachable' });
        }
      }
    }, 30000);
  }
}

module.exports = InfluxService;