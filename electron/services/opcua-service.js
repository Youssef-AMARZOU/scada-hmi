const EventEmitter = require('events');

class OPCUAService extends EventEmitter {
  constructor() {
    super();
    this._client = null;
    this._session = null;
    this._subscription = null;
    this._connected = false;
    this._endpointUrl = 'opc.tcp://localhost:4840';
    this._monitoredItems = new Map();
    this._tags = [];
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._readTimer = null;
    this._opcua = null;
    this._connecting = false;
  }

  async connect(endpointUrl) {
    if (this._connecting) return { error: 'Already connecting' };

    // Fallback chain: user URL -> Prosys (53530) -> Factory I/O (4840) -> UaExpert (12600)
    const fallbackUrls = [];
    if (endpointUrl) fallbackUrls.push(endpointUrl);
    if (!fallbackUrls.includes('opc.tcp://localhost:53530')) fallbackUrls.push('opc.tcp://localhost:53530');
    if (!fallbackUrls.includes('opc.tcp://localhost:4840')) fallbackUrls.push('opc.tcp://localhost:4840');
    if (!fallbackUrls.includes('opc.tcp://localhost:12600')) fallbackUrls.push('opc.tcp://localhost:12600');

    this._connecting = true;
    let lastError = '';

    for (const url of fallbackUrls) {
      this._endpointUrl = url;
      console.log(`[OPC-UA] Trying ${url}...`);

      try {
        this._opcua = require('node-opcua');

        this._client = this._opcua.OPCUAClient.create({
          applicationName: 'INDUS-Platform',
          applicationUri: 'urn:INDUS-Platform',
          connectionStrategy: {
            initialDelay: 1000,
            maxDelay: 5000,
            maxRetry: 0,
          },
          securityMode: this._opcua.MessageSecurityMode.None,
          securityPolicy: this._opcua.SecurityPolicy.None,
          endpointMustExist: false,
          requestedSessionTimeout: 120000,
          keepSessionAlive: true,
        });

        this._client.on('backoff', (retry, delay) => {
          console.log(`[OPC-UA] Backoff retry ${retry}, delay ${delay}ms`);
          this.emit('status', { connected: false, reconnecting: true, attempt: retry });
        });

        this._client.on('connection_lost', () => {
          console.log('[OPC-UA] Connection lost');
          this._connected = false;
          this._session = null;
          this.emit('status', { connected: false });
          this._scheduleReconnect();
        });

        this._client.on('connection_reestablished', () => {
          console.log('[OPC-UA] Connection reestablished');
          this._connected = true;
          this.emit('status', { connected: true, url: this._endpointUrl });
        });

        await this._client.connect(this._endpointUrl);
        console.log(`[OPC-UA] TCP connected to ${this._endpointUrl}`);

        const session = await this._client.createSession();
        this._session = session;
        console.log('[OPC-UA] Session created');

        this._session.on('session_closed', () => {
          console.log('[OPC-UA] Session closed by server');
          this._connected = false;
          this._session = null;
          this.emit('status', { connected: false });
          this._scheduleReconnect();
        });

        this._connected = true;
        this._reconnectAttempts = 0;
        this.emit('status', { connected: true, url: this._endpointUrl });

        await this._browseAndSubscribe();

        this._connecting = false;
        console.log(`[OPC-UA] Successfully connected to ${this._endpointUrl} with ${this._tags.length} tags`);
        return { success: true, endpointUrl: this._endpointUrl, tagCount: this._tags.length };
      } catch (err) {
        lastError = err.message;
        console.log(`[OPC-UA] Failed ${url}: ${err.message}`);
        // Clean up failed client before trying next URL
        try { if (this._client) await this._client.disconnect(); } catch {}
        this._client = null;
        this._session = null;
      }
    }

    console.log(`[OPC-UA] All fallback endpoints failed. Last error: ${lastError}`);
    this._connected = false;
    this._connecting = false;
    this.emit('status', { connected: false, error: lastError });
    this._scheduleReconnect();
    return { error: lastError };
  }

  async disconnect() {
    this._connecting = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._readTimer) {
      clearInterval(this._readTimer);
      this._readTimer = null;
    }
    try {
      if (this._subscription) { await this._subscription.terminate(); this._subscription = null; }
      if (this._session) { await this._session.close(); this._session = null; }
      if (this._client) { await this._client.disconnect(); this._client = null; }
    } catch (e) { console.log(`[OPC-UA] Disconnect error: ${e.message}`); }
    this._connected = false;
    this._monitoredItems.clear();
    this.emit('status', { connected: false });
    console.log('[OPC-UA] Disconnected');
  }

  async _browseAndSubscribe() {
    if (!this._session) return;
    const opcua = this._opcua;

    try {
      this._subscription = opcua.ClientSubscription.create(this._session, {
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10,
      });

      this._subscription.on('started', () => {
        console.log(`[OPC-UA] Subscription started (id=${this._subscription.subscriptionId})`);
      });
      this._subscription.on('terminated', () => {
        console.log('[OPC-UA] Subscription terminated');
        this._subscription = null;
      });

      // Strategy 1: Browse Objects folder comprehensively
      let tags = [];
      try {
        tags = await this._browseRecursive(opcua.resolveNodeId('ObjectsFolder'), 2);
      } catch (e) {
        console.log(`[OPC-UA] Objects browse failed: ${e.message}`);
      }

      // Strategy 2: Try ns=2 (common for Factory I/O, Prosys simulation)
      if (tags.length === 0) {
        try {
          const ns2Browse = await this._session.browse({
            nodeId: 'i=85',
            browseDirection: opcua.BrowseDirection.Forward,
            includeSubtypes: true,
            resultMask: 63,
          });
          const refs = ns2Browse.references || [];
          for (const ref of refs) {
            if (ref.nodeClass === opcua.NodeClass.Variable) {
              try {
                const dataValue = await this._session.read({ nodeId: ref.nodeId, attributeId: opcua.AttributeIds.Value });
                tags.push({
                  id: ref.nodeId.toString(),
                  name: ref.browseName.name || ref.nodeId.toString(),
                  nodeId: ref.nodeId.toString(),
                  value: this._extractValue(dataValue),
                  type: this._getDataType(dataValue),
                  kind: this._inferKind(ref),
                  quality: (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad',
                  namespace: ref.nodeId.namespace,
                });
              } catch {}
            }
          }
        } catch (e) {
          console.log(`[OPC-UA] ns=2 browse failed: ${e.message}`);
        }
      }

      // If still nothing, try common Prosys/UaExpert node patterns
      if (tags.length === 0) {
        try {
          tags = await this._tryCommonNodes();
        } catch {}
      }

      this._tags = tags;
      console.log(`[OPC-UA] Found ${tags.length} tags`);

      // Monitor each tag
      for (const tag of tags) {
        this._monitorNode(tag.nodeId, tag.name);
      }

      this.emit('tags', tags);
      this._startPeriodicRead();

    } catch (err) {
      console.log(`[OPC-UA] Browse error: ${err.message}`);
      this._startPeriodicRead();
    }
  }

  async _browseRecursive(nodeId, maxDepth, depth = 0) {
    if (depth >= maxDepth) return [];
    const opcua = this._opcua;
    const tags = [];

    try {
      const browseResult = await this._session.browse({
        nodeId,
        browseDirection: opcua.BrowseDirection.Forward,
        includeSubtypes: true,
        resultMask: 63,
        nodeClassMask: opcua.NodeClassMask.Variable | opcua.NodeClassMask.Object,
      });

      const refs = browseResult.references || [];
      for (const ref of refs) {
        if (ref.nodeClass === opcua.NodeClass.Variable) {
          try {
            const dataValue = await this._session.read({ nodeId: ref.nodeId, attributeId: opcua.AttributeIds.Value });
            tags.push({
              id: ref.nodeId.toString(),
              name: ref.browseName.name || ref.nodeId.toString(),
              nodeId: ref.nodeId.toString(),
              value: this._extractValue(dataValue),
              type: this._getDataType(dataValue),
              kind: this._inferKind(ref),
              quality: (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad',
              namespace: ref.nodeId.namespace,
            });
          } catch {}
        } else if (ref.nodeClass === opcua.NodeClass.Object && depth < maxDepth - 1) {
          const childTags = await this._browseRecursive(ref.nodeId, maxDepth, depth + 1);
          tags.push(...childTags);
        }
      }
    } catch {}

    return tags;
  }

  async _tryCommonNodes() {
    const tags = [];
    const opcua = this._opcua;

    // Prosys Simulation Server common nodes
    const prosysPatterns = [
      'ns=3;s=Counter', 'ns=3;s=Random', 'ns=3;s=SineWave', 'ns=3;s=Square',
      'ns=3;s=Triangle', 'ns=3;s=Temperature', 'ns=3;s=Pressure', 'ns=3;s=Flow',
      'ns=3;s=Level', 'ns=3;s=Speed', 'ns=3;s=DigitalInput', 'ns=3;s=DigitalOutput',
    ];

    for (const nodeIdStr of prosysPatterns) {
      try {
        const nodeId = opcua.resolveNodeId(nodeIdStr);
        const dataValue = await this._session.read({ nodeId, attributeId: opcua.AttributeIds.Value });
        if (dataValue && dataValue.value && dataValue.value.value !== null) {
          tags.push({
            id: nodeIdStr, name: nodeIdStr.split('=')[1] || nodeIdStr,
            nodeId: nodeIdStr, value: this._extractValue(dataValue),
            type: this._getDataType(dataValue), kind: 'Variable',
            quality: (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad',
            namespace: 3,
          });
        }
      } catch {}
    }
    return tags;
  }

  _inferKind(ref) {
    const name = (ref.browseName?.name || '').toLowerCase();
    if (name.includes('input') || name.includes('sensor')) return 'Input';
    if (name.includes('output') || name.includes('motor') || name.includes('valve') || name.includes('start') || name.includes('stop')) return 'Output';
    return 'Variable';
  }

  _monitorNode(nodeId, tagName) {
    if (!this._subscription) return;
    const opcua = this._opcua;
    try {
      const monitoredItem = opcua.ClientMonitoredItem.create(
        this._subscription,
        { nodeId, attributeId: opcua.AttributeIds.Value },
        { samplingInterval: 500, discardOldest: true, queueSize: 1 },
        opcua.TimestampsToReturn.Both
      );

      monitoredItem.on('changed', (dataValue) => {
        const value = this._extractValue(dataValue);
        const tag = this._tags.find(t => t.nodeId === nodeId.toString());
        if (tag) {
          tag.value = value;
          tag.quality = (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad';
          tag.timestamp = dataValue.serverTimestamp || new Date();
        }
        this.emit('tags', [...this._tags]);
      });

      this._monitoredItems.set(nodeId.toString(), monitoredItem);
    } catch (e) {
      console.log(`[OPC-UA] Monitor error for ${nodeId}: ${e.message}`);
    }
  }

  _startPeriodicRead() {
    if (this._readTimer) clearInterval(this._readTimer);
    this._readTimer = setInterval(async () => {
      if (!this._session || !this._connected || this._tags.length === 0) return;
      const opcua = this._opcua;
      try {
        for (const tag of this._tags) {
          try {
            const dataValue = await this._session.read({ nodeId: tag.nodeId, attributeId: opcua.AttributeIds.Value });
            tag.value = this._extractValue(dataValue);
            tag.quality = (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad';
          } catch {}
        }
        this.emit('tags', [...this._tags]);
      } catch {}
    }, 1000);
  }

  async writeValue(nodeId, value, dataType) {
    if (!this._session || !this._connected) return { error: 'OPC UA not connected' };
    const opcua = this._opcua;
    try {
      const statusCode = await this._session.write({
        nodeId,
        attributeId: opcua.AttributeIds.Value,
        value: { value: { dataType: this._resolveDataType(dataType), value } },
      });
      return { success: statusCode.isGood(), statusCode: statusCode.toString() };
    } catch (err) {
      return { error: err.message };
    }
  }

  async readValue(nodeId) {
    if (!this._session || !this._connected) return { error: 'OPC UA not connected' };
    const opcua = this._opcua;
    try {
      const dataValue = await this._session.read({ nodeId, attributeId: opcua.AttributeIds.Value });
      return {
        value: this._extractValue(dataValue),
        type: this._getDataType(dataValue),
        quality: (dataValue.statusCode && dataValue.statusCode.isGood()) ? 'Good' : 'Bad',
        timestamp: dataValue.serverTimestamp,
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  getTags() { return [...this._tags]; }

  getStatus() {
    return {
      connected: this._connected,
      url: this._endpointUrl,
      tagCount: this._tags.length,
      monitoredCount: this._monitoredItems.size,
      protocol: 'OPC-UA',
    };
  }

  _extractValue(dataValue) {
    if (!dataValue || !dataValue.value) return null;
    const v = dataValue.value.value;
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && v.constructor?.name === 'Float') return parseFloat(v);
    return v;
  }

  _getDataType(dataValue) {
    if (!dataValue?.value) return 'Unknown';
    const v = dataValue.value.value;
    if (typeof v === 'boolean') return 'Boolean';
    if (typeof v === 'number') return Number.isInteger(v) ? 'Int32' : 'Float';
    if (typeof v === 'string') return 'String';
    return 'Unknown';
  }

  _resolveDataType(typeStr) {
    const opcua = this._opcua;
    if (!opcua) return 11; // Float fallback
    const map = {
      'Boolean': opcua.DataType.Boolean,
      'Int16': opcua.DataType.Int16,
      'Int32': opcua.DataType.Int32,
      'Float': opcua.DataType.Float,
      'Double': opcua.DataType.Double,
      'String': opcua.DataType.String,
    };
    return map[typeStr] || opcua.DataType.Float;
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectAttempts++;
    const delay = Math.min(this._reconnectAttempts * 3000, 30000);
    console.log(`[OPC-UA] Reconnecting in ${delay / 1000}s...`);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      // Clean up old session/client before reconnecting
      try {
        if (this._subscription) { await this._subscription.terminate().catch(() => {}); this._subscription = null; }
        if (this._session) { await this._session.close().catch(() => {}); this._session = null; }
        if (this._client) { await this._client.disconnect().catch(() => {}); this._client = null; }
      } catch {}
      this._connected = false;
      this._connecting = false;
      await this.connect(this._endpointUrl);
    }, delay);
  }
}

module.exports = OPCUAService;