// Module host: registers modules and runs every lifecycle call inside an error
// boundary. Non-critical modules are disabled after repeated failures; critical
// failures are surfaced through onCritical (-> recoverable error overlay).
import { log } from './logger.js';
import { EV } from './contracts.js';

const FAIL_LIMIT = 3;

export function createModuleHost({ bus, onCritical, now = () => 0 } = {}) {
  /** @type {{mod:any, status:string, errors:number, lastError:string|null, errorTimes:number[], disabled:boolean}[]} */
  const records = [];

  function fail(rec, phase, err) {
    rec.errors++;
    rec.lastError = `${phase}: ${err && err.message ? err.message : String(err)}`;
    const t = now();
    rec.errorTimes.push(t);
    while (rec.errorTimes.length > FAIL_LIMIT) rec.errorTimes.shift();
    log.error(rec.mod.id, `${phase} failed: ${err && err.message}`, err);
    if (bus) bus.emit(EV.MODULE_ERROR, { module: rec.mod.id, phase, message: rec.lastError });
    const burst = rec.errorTimes.length >= FAIL_LIMIT && (t - rec.errorTimes[0]) <= 10000;
    if (phase === 'init' || burst || rec.mod.critical) {
      rec.disabled = true;
      rec.status = 'failed';
      if (rec.mod.critical && onCritical) onCritical(rec.mod.id, err);
    } else {
      rec.status = 'degraded';
    }
  }

  function call(rec, phase, ...args) {
    if (rec.disabled) return undefined;
    const fn = rec.mod[phase];
    if (typeof fn !== 'function') return undefined;
    try {
      return fn.apply(rec.mod, args);
    } catch (err) {
      fail(rec, phase, err);
      return undefined;
    }
  }

  return {
    register(mod) {
      if (!mod || typeof mod.id !== 'string') throw new Error('module must have an id');
      if (records.some((r) => r.mod.id === mod.id)) throw new Error(`duplicate module id ${mod.id}`);
      const rec = { mod, status: 'registered', errors: 0, lastError: null, errorTimes: [], disabled: false };
      records.push(rec);
      return mod;
    },
    get(id) { const r = records.find((x) => x.mod.id === id); return r ? r.mod : null; },
    initAll(ctx) {
      for (const rec of records) {
        call(rec, 'init', ctx);
        if (!rec.disabled) rec.status = 'ok';
      }
    },
    startAll() { for (const rec of records) call(rec, 'start'); },
    update(step) { for (const rec of records) if (rec.mod.kind === 'sim') call(rec, 'update', step); },
    render(alpha, frame) { for (const rec of records) if (rec.mod.kind === 'view') call(rec, 'render', alpha, frame); },
    pauseAll() { for (const rec of records) call(rec, 'pause'); },
    resumeAll() { for (const rec of records) call(rec, 'resume'); },
    serializeAll() {
      const out = {};
      for (const rec of records) {
        const v = call(rec, 'serialize');
        if (v !== undefined && v !== null) out[rec.mod.id] = v;
      }
      return out;
    },
    deserializeAll(data = {}) {
      for (const rec of records) call(rec, 'deserialize', data[rec.mod.id] ?? null);
    },
    /** Re-run init for a failed non-critical module (used by "retry" in the error UI). */
    retry(id, ctx) {
      const rec = records.find((r) => r.mod.id === id);
      if (!rec) return false;
      rec.disabled = false; rec.errorTimes = []; rec.status = 'ok';
      call(rec, 'dispose');
      call(rec, 'init', ctx);
      if (!rec.disabled) call(rec, 'start');
      return !rec.disabled;
    },
    disposeAll() {
      for (let i = records.length - 1; i >= 0; i--) {
        const rec = records[i];
        const was = rec.disabled; rec.disabled = false;
        call(rec, 'dispose');
        rec.disabled = was;
      }
    },
    health() {
      return records.map((rec) => {
        let detail = null;
        let status = rec.status;
        if (!rec.disabled && typeof rec.mod.getHealthStatus === 'function') {
          try {
            const h = rec.mod.getHealthStatus();
            if (h && h.status) { status = rec.status === 'degraded' && h.status === 'ok' ? 'degraded' : h.status; detail = h.detail || null; }
          } catch (err) { status = 'degraded'; detail = String(err && err.message); }
        }
        return { id: rec.mod.id, kind: rec.mod.kind, critical: !!rec.mod.critical, status, errors: rec.errors, lastError: rec.lastError, detail };
      });
    },
  };
}
