import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

export class Enemy {
  constructor(position) {
    const x = 0, y = 0;

    // Create a heart shape
    const heartShape = new THREE.Shape();
    heartShape.moveTo(x + 5, y + 5);
    heartShape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
    heartShape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
    heartShape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
    heartShape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
    heartShape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
    heartShape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

    // Create geometry and material
    const geometry = new THREE.ShapeGeometry(heartShape);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.set(0.05, 0.05, 0.05);

    this.mesh.rotation.x = Math.PI / 2;
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