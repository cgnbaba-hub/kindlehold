import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeParse, v, validate, ValidationError, assertNoDangerousKeys } from '../../src/core/validate.js';

test('safeParse strips prototype-pollution keys', () => {
  const o = safeParse('{"a":1,"__proto__":{"polluted":true},"b":{"constructor":{"x":1}}}');
  assert.equal(o.a, 1);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(o, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(o.b, 'constructor'), false);
});

test('safeParse rejects oversized and malformed input', () => {
  assert.throws(() => safeParse('x'.repeat(100), 50), ValidationError);
  assert.throws(() => safeParse('{bad json'), ValidationError);
  assert.throws(() => safeParse(42), ValidationError);
});

test('schema DSL validates shapes and ranges', () => {
  const schema = v.object({ n: v.number({ min: 0, max: 10, int: true }), s: v.string({ oneOf: ['a', 'b'] }), list: v.array(v.number(), { max: 3 }) });
  validate(schema, { n: 3, s: 'a', list: [1, 2] });
  assert.throws(() => validate(schema, { n: 11, s: 'a', list: [] }), /out of range/);
  assert.throws(() => validate(schema, { n: 1, s: 'c', list: [] }), /one of/);
  assert.throws(() => validate(schema, { n: 1, s: 'a', list: [1, 2, 3, 4] }), /too long/);
  assert.throws(() => validate(schema, { n: NaN, s: 'a', list: [] }), /finite/);
});

test('assertNoDangerousKeys catches objects built outside safeParse', () => {
  const o = JSON.parse('{"x":{"__proto__":1}}');
  assert.throws(() => assertNoDangerousKeys(o), /forbidden key/);
});
