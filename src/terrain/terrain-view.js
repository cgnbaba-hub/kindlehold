// Terrain rendering (Stage 0 minimal version: vertex-coloured heightfield).
import * as THREE from 'three';

export function createTerrainView({ scene, terrain }) {
  const n = terrain.n;
  const geo = new THREE.PlaneGeometry(terrain.size, terrain.size, terrain.res, terrain.res);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = terrain.heights[i];
    pos.setY(i, h);
    if (h < 0.2) c.set('#8a7a5a'); else if (h > 9) c.set('#7d7f80'); else c.set('#6f8a4a');
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { id: 'terrain-view', kind: 'view', mesh, n, dispose() { scene.remove(mesh); geo.dispose(); mesh.material.dispose(); } };
}
