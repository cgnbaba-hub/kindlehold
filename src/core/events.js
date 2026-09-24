// Synchronous event bus with bounded listener counts.
import { log } from './logger.js';

const MAX_LISTENERS = 64;

export function createEventBus() {
  /** @type {Record<string, Function[]>} */
  const listeners = Object.create(null);
  let depth = 0;

  return {
    /** @returns {() => void} unsubscribe */
    on(name, fn) {
      const list = listeners[name] || (listeners[name] = []);
      list.push(fn);
      if (list.length > MAX_LISTENERS) log.warn('events', `listener count for "${name}" is ${list.length}`);
      return () => {
        const l = listeners[name];
        if (!l) return;
        const i = l.indexOf(fn);
        if (i >= 0) l.splice(i, 1);
      };
    },
    emit(name, payload) {
      const list = listeners[name];
      if (!list || list.length === 0) return;
      if (depth > 16) { log.error('events', `event recursion too deep at "${name}"`); return; }
      depth++;
      // iterate over a snapshot length so listeners removed mid-emit are safe
      for (let i = 0; i < list.length; i++) {
        const fn = list[i];
        try { fn(payload); } catch (err) {
          log.error('events', `listener for "${name}" threw: ${err && err.message}`, err);
        }
      }
      depth--;
    },
    listenerCount(name) { return listeners[name] ? listeners[name].length : 0; },
    totalListeners() {
      let n = 0;
      for (const k in listeners) n += listeners[k].length;
      return n;
    },
    clear() { for (const k in listeners) delete listeners[k]; },
  };
}
