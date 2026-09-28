import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualityForGpu, sanitizeSettings } from '../../src/app/settings.js';

test('first-visit quality follows the graphics chip', () => {
  assert.equal(qualityForGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'), 'low');
  assert.equal(qualityForGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'medium');
  assert.equal(qualityForGpu('ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'), 'medium');
  assert.equal(qualityForGpu('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'medium');
  assert.equal(qualityForGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high');
  assert.equal(qualityForGpu('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high');
  assert.equal(qualityForGpu('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'high');
  assert.equal(qualityForGpu(''), null);
  assert.equal(sanitizeSettings({ quality: 'medium' }).quality, 'medium');
});
