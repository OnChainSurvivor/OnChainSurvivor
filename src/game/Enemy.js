import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

export class Enemy {
  constructor(position) {
    const geometry = new THREE.BoxGeometry(.5, 1.5, .51);
    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
  }

  // Update the enemy so it moves toward the given target (the player's position)
  update(delta, targetPosition) {
    const direction = new THREE.Vector3().subVectors(targetPosition, this.mesh.position);
    direction.normalize();
    const speed = 1.5; // tweak enemy speed as needed
    this.mesh.position.addScaledVector(direction, speed * delta);
  }
} 