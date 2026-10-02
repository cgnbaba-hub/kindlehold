// Upload only the used part of instanced buffers. InstancedMeshes are allocated for their
// peak (hundreds of figures, particles, bars) but usually draw far fewer; three.js would
// otherwise send the whole buffer to the GPU every frame.
import * as THREE from 'three';

/** Mark the first `mesh.count` instances (matrix, colour and extra per-instance attributes) for upload. */
export function flushInstances(mesh, extra = []) {
  const n = mesh.count;
  if (n <= 0) return; // nothing drawn: nothing to send (an empty range would upload everything)
  range(mesh.instanceMatrix, 0, n * 16);
  if (mesh.instanceColor) range(mesh.instanceColor, 0, n * 3);
  for (const a of extra) range(a, 0, n * a.itemSize);
}

/** Mark a single instance's matrix for upload (e.g. one felled tree in a big forest mesh). */
export function flushInstance(mesh, index) {
  range(mesh.instanceMatrix, index * 16, 16);
}

function range(attr, start, count) {
  attr.addUpdateRange(start, count);
  attr.needsUpdate = true;
}

/**
 * Draws only the instances of `src` whose ball (radius around the instance's origin) touches
 * the camera's view. `src` holds every instance and stays out of the scene; a twin mesh with
 * the same geometry and material is drawn instead and refilled when the view or the data
 * change (call touch() after writing to `src`). The radius is generous on purpose: an
 * object just outside the picture can still cast its shadow into it.
 */
export function createInstanceCuller(scene, src, radius) {
  const dst = new THREE.InstancedMesh(src.geometry, src.material, src.instanceMatrix.count);
  dst.castShadow = src.castShadow; dst.receiveShadow = src.receiveShadow;
  dst.customDepthMaterial = src.customDepthMaterial;
  dst.frustumCulled = false; dst.count = 0;
  scene.add(dst);
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), ball = new THREE.Sphere(new THREE.Vector3(), radius);
  const last = new Float32Array(16);
  let dirty = true;
  return {
    mesh: dst,
    touch() { dirty = true; },
    update(camera) {
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const e = pv.elements;
      if (!dirty) {
        let moved = false;
        for (let i = 0; i < 16; i++) if (Math.abs(e[i] - last[i]) > 1e-6) { moved = true; break; }
        if (!moved) return;
      }
      dirty = false; last.set(e);
      frustum.setFromProjectionMatrix(pv);
      if (src.instanceColor && !dst.instanceColor) dst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(src.instanceColor.array.length), 3);
      const sm = src.instanceMatrix.array, dm = dst.instanceMatrix.array;
      const sc = src.instanceColor ? src.instanceColor.array : null, dc = dst.instanceColor ? dst.instanceColor.array : null;
      let n = 0;
      for (let i = 0; i < src.count; i++) {
        const o = i * 16;
        ball.center.set(sm[o + 12], sm[o + 13], sm[o + 14]);
        if (!frustum.intersectsSphere(ball)) continue;
        dm.set(sm.subarray(o, o + 16), n * 16);
        if (dc) dc.set(sc.subarray(i * 3, i * 3 + 3), n * 3);
        n++;
      }
      dst.count = n;
      flushInstances(dst);
    },
    dispose() { scene.remove(dst); dst.dispose(); },
  };
}
