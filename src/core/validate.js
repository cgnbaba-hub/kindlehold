// Validation helpers for untrusted JSON (saves, scenarios, settings).
// All imported data is treated as hostile: size-limited, prototype-pollution
// keys stripped, and checked against small declarative schemas.

const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);

export class ValidationError extends Error {
  constructor(message, path = '') {
    super(path ? `${path}: ${message}` : message);
    this.name = 'ValidationError';
    this.path = path;
  }
}

/** JSON.parse with a byte limit and dangerous-key stripping. Throws ValidationError. */
export function safeParse(text, maxBytes) {
  if (typeof text !== 'string') throw new ValidationError('input is not text');
  if (maxBytes && text.length > maxBytes) throw new ValidationError(`input too large (${text.length} > ${maxBytes} bytes)`);
  let out;
  try {
    out = JSON.parse(text, (key, value) => (DANGEROUS.has(key) ? undefined : value));
  } catch (err) {
    throw new ValidationError(`invalid JSON (${err.message})`);
  }
  return out;
}

/** Deep check that an already-parsed value has no dangerous own keys (for objects not from safeParse). */
export function assertNoDangerousKeys(value, path = '$', depth = 0) {
  if (depth > 64) throw new ValidationError('structure too deep', path);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (DANGEROUS.has(key)) throw new ValidationError(`forbidden key "${key}"`, path);
      assertNoDangerousKeys(value[key], `${path}.${key}`, depth + 1);
    }
  }
}

// ---- tiny schema DSL --------------------------------------------------------
// A schema is a function (value, path) => void that throws ValidationError.

export const v = {
  number({ min = -Infinity, max = Infinity, int = false } = {}) {
    return (x, p) => {
      if (typeof x !== 'number' || !Number.isFinite(x)) throw new ValidationError('expected finite number', p);
      if (x < min || x > max) throw new ValidationError(`number out of range [${min}, ${max}]`, p);
      if (int && !Number.isInteger(x)) throw new ValidationError('expected integer', p);
    };
  },
  string({ max = 1000, pattern = null, oneOf = null } = {}) {
    return (x, p) => {
      if (typeof x !== 'string') throw new ValidationError('expected string', p);
      if (x.length > max) throw new ValidationError('string too long', p);
      if (pattern && !pattern.test(x)) throw new ValidationError('string has invalid format', p);
      if (oneOf && !oneOf.includes(x)) throw new ValidationError(`expected one of ${oneOf.join(', ')}`, p);
    };
  },
  boolean() { return (x, p) => { if (typeof x !== 'boolean') throw new ValidationError('expected boolean', p); }; },
  optional(schema) { return (x, p) => { if (x !== undefined && x !== null) schema(x, p); }; },
  any() { return () => {}; },
  array(item, { max = 10000 } = {}) {
    return (x, p) => {
      if (!Array.isArray(x)) throw new ValidationError('expected array', p);
      if (x.length > max) throw new ValidationError(`array too long (${x.length} > ${max})`, p);
      for (let i = 0; i < x.length; i++) item(x[i], `${p}[${i}]`);
    };
  },
  object(shape, { allowExtra = true } = {}) {
    return (x, p) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new ValidationError('expected object', p);
      for (const key of Object.keys(shape)) shape[key](x[key], `${p}.${key}`);
      if (!allowExtra) for (const key of Object.keys(x)) if (!(key in shape)) throw new ValidationError(`unexpected key "${key}"`, p);
    };
  },
  record(valueSchema, { max = 10000, keyPattern = null } = {}) {
    return (x, p) => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new ValidationError('expected object map', p);
      const keys = Object.keys(x);
      if (keys.length > max) throw new ValidationError(`too many entries (${keys.length} > ${max})`, p);
      for (const k of keys) {
        if (keyPattern && !keyPattern.test(k)) throw new ValidationError(`invalid key "${k}"`, p);
        valueSchema(x[k], `${p}.${k}`);
      }
    };
  },
};

export function validate(schema, value, rootName = '$') {
  schema(value, rootName);
  return value;
}
