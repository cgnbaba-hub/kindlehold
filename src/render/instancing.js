// Upload only the used part of instanced buffers. InstancedMeshes are allocated for their
// peak (hundreds of figures, particles, bars) but usually draw far fewer; three.js would
// otherwise send the whole buffer to the GPU every frame.

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
