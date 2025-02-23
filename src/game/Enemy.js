import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

export class Enemy {
  constructor(position, enemyColor) {
    // Use the provided enemyColor; fallback to red if none is provided.
    const color = enemyColor 

    // Create a heart shape
    const heartShape = new THREE.Shape();
    heartShape.moveTo(5, 5);
    heartShape.bezierCurveTo(5, 5, 4, 0, 0, 0);
    heartShape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    heartShape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    heartShape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
    heartShape.bezierCurveTo(16, 7, 16, 0, 10, 0);
    heartShape.bezierCurveTo(7, 0, 5, 5, 5, 5);

    // Create geometry and material using the enemyColor from the worlds config.
    const geometry = new THREE.ShapeGeometry(heartShape);
    const material = new THREE.MeshBasicMaterial({ 
      color: color, 
      side: THREE.DoubleSide 
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.scale.set(0.06, 0.06, 0.06);
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