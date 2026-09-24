// Structured logger with a bounded ring buffer (readable by debug overlay and verification).

const RING = 400;
const entries = [];
let seq = 0;
let consoleLevel = 2; // 0 debug, 1 info, 2 warn, 3 error
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function push(level, source, message, data) {
  const entry = { seq: seq++, level, source, message: String(message) };
  if (data !== undefined) entry.data = data instanceof Error ? { name: data.name, message: data.message, stack: data.stack } : data;
  entries.push(entry);
  if (entries.length > RING) entries.shift();
  if (LEVELS[level] >= consoleLevel && typeof console !== 'undefined') {
    const line = `[${source}] ${entry.message}`;
    if (level === 'error') console.error(line, data instanceof Error ? data : '');
    else if (level === 'warn') console.warn(line);
    else if (level === 'info') console.info(line);
    else if (level === 'debug') console.debug(line);
  }
  return entry;
}

export const log = {
  debug: (s, m, d) => push('debug', s, m, d),
  info: (s, m, d) => push('info', s, m, d),
  warn: (s, m, d) => push('warn', s, m, d),
  error: (s, m, d) => push('error', s, m, d),
  entries: () => entries.slice(),
  count(level) { let n = 0; for (const e of entries) if (e.level === level) n++; return n; },
  setConsoleLevel(level) { consoleLevel = LEVELS[level] ?? 1; },
  clear() { entries.length = 0; },
};
