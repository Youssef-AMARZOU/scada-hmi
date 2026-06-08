/**
 * Alarm Engine — Evaluates Factory I/O tag values against configurable thresholds.
 * Generates ISA 18.2 compliant alarms with deduplication.
 */
class AlarmEngine {
  constructor() {
    this._thresholds = [
      { tagPattern: '*', type: 'Float', warningHigh: 80, criticalHigh: 95, warningLow: null, criticalLow: null },
    ];
    this._activeAlarms = new Map(); // tagName+severity → timestamp (dedup window)
    this._dedupeWindowMs = 30000; // 30 seconds between same alarm
  }

  setThresholds(thresholds) {
    if (Array.isArray(thresholds)) {
      this._thresholds = thresholds;
    }
  }

  getThresholds() {
    return [...this._thresholds];
  }

  /**
   * Evaluate a set of tags against thresholds.
   * Returns array of new alarm objects.
   */
  evaluate(tags) {
    const now = Date.now();
    const newAlarms = [];

    // Clean expired dedup entries
    for (const [key, ts] of this._activeAlarms) {
      if (now - ts > this._dedupeWindowMs) {
        this._activeAlarms.delete(key);
      }
    }

    tags.forEach(tag => {
      if (tag.type !== 'Float' || typeof tag.value !== 'number') return;

      const threshold = this._findThreshold(tag);
      if (!threshold) return;

      let severity = null;
      let message = '';

      // Critical high
      if (threshold.criticalHigh != null && tag.value >= threshold.criticalHigh) {
        severity = 'critical';
        message = `${tag.name} = ${tag.value.toFixed(2)} ≥ ${threshold.criticalHigh} (seuil critique haut)`;
      }
      // Warning high
      else if (threshold.warningHigh != null && tag.value >= threshold.warningHigh) {
        severity = 'warning';
        message = `${tag.name} = ${tag.value.toFixed(2)} ≥ ${threshold.warningHigh} (seuil d'avertissement haut)`;
      }
      // Critical low
      else if (threshold.criticalLow != null && tag.value <= threshold.criticalLow) {
        severity = 'critical';
        message = `${tag.name} = ${tag.value.toFixed(2)} ≤ ${threshold.criticalLow} (seuil critique bas)`;
      }
      // Warning low
      else if (threshold.warningLow != null && tag.value <= threshold.warningLow) {
        severity = 'warning';
        message = `${tag.name} = ${tag.value.toFixed(2)} ≤ ${threshold.warningLow} (seuil d'avertissement bas)`;
      }

      if (severity) {
        const dedupeKey = `${tag.name}:${severity}`;
        if (!this._activeAlarms.has(dedupeKey)) {
          this._activeAlarms.set(dedupeKey, now);
          newAlarms.push({
            id: `ALM-${now}-${Math.random().toString(36).substr(2, 6)}`,
            severity,
            message,
            tagName: tag.name,
            value: tag.value,
            threshold: severity === 'critical' ? (threshold.criticalHigh || threshold.criticalLow) : (threshold.warningHigh || threshold.warningLow),
            timestamp: new Date(now).toISOString(),
            acknowledged: false,
            source: 'AlarmEngine',
          });
        }
      }
    });

    return newAlarms;
  }

  _findThreshold(tag) {
    // First try exact match
    const exact = this._thresholds.find(t => t.tagPattern === tag.name);
    if (exact) return exact;

    // Then try prefix match
    const prefix = this._thresholds.find(t => t.tagPattern !== '*' && tag.name.startsWith(t.tagPattern));
    if (prefix) return prefix;

    // Fall back to wildcard
    return this._thresholds.find(t => t.tagPattern === '*' && t.type === tag.type);
  }
}

module.exports = AlarmEngine;
