import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { getScene, getCamera, getRenderer } from './Renderer.js';
import { keys } from '../input/Joystick.js';
import { shootingKeys } from '../input/ShootingJoystick.js';
import { Enemy } from './Enemy.js';

export class GameManager {
  constructor() {
    this.scene = getScene();
    this.camera = getCamera();
    this.renderer = getRenderer();
    this.clock = new THREE.Clock();
    this.cube = null;
    // Player movement speed has been increased (from 2 to 6 already)
    this.moveSpeed = 6;
    // Bullet properties
    this.bulletSpeed = 10;
    this.shootCooldown = 0;
    // Set a higher target for camera z-offset
    this.targetCameraZ = 50;
    this.running = false;
    this.animationFrameId = null;
    this.initScene();

    // Trail properties (for visualizing movement)
    this.trailPieces = [];
    this.trailTimer = 0;

    // Arrays for enemies and bullets
    this.enemies = [];
    this.bullets = [];
    // Object pools for recycling (optimization)
    this.bulletPool = [];
    this.enemyPool = [];

    // Define a paused flag (default: false)
    this.isPaused = false;

    // Create enemy counter in the corner
    this.createUI();
  }

  createUI() {
    this.enemyCounterElement = document.createElement("div");
    this.enemyCounterElement.style.position = "fixed";
    this.enemyCounterElement.style.top = "10px";
    this.enemyCounterElement.style.left = "10px";
    this.enemyCounterElement.style.color = "#ffffff";
    this.enemyCounterElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.enemyCounterElement.style.padding = "5px";
    this.enemyCounterElement.style.fontFamily = "Arial, sans-serif";
    this.enemyCounterElement.style.zIndex = "1000";
    document.body.appendChild(this.enemyCounterElement);
  }

  initScene() {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
  }

  shootBullet(direction) {
    let bullet;
    if (this.bulletPool.length > 0) {
      // Reuse a bullet from the pool
      bullet = this.bulletPool.pop();
      bullet.position.copy(this.cube.position);
      bullet.velocity.copy(direction).multiplyScalar(this.bulletSpeed);
      bullet.life = 2;
      bullet.visible = true;
      if (!this.scene.children.includes(bullet)) {
        this.scene.add(bullet);
      }
    } else {
      // Create a new bullet if none exist in the pool
      const geometry = new THREE.SphereGeometry(0.1, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      bullet = new THREE.Mesh(geometry, material);
      bullet.position.copy(this.cube.position);
      bullet.velocity = direction.clone().multiplyScalar(this.bulletSpeed);
      bullet.life = 2;
      this.scene.add(bullet);
    }
    this.bullets.push(bullet);
  }

  updateBullets(delta) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
      bullet.life -= delta;
      if (bullet.life <= 0) {
        // Recycle the bullet via object pool
        this.scene.remove(bullet);
        this.bullets.splice(i, 1);
        this.bulletPool.push(bullet);
      }
    }
  }

  spawnEnemy() {
    const spawnRadius = 20;
    const angle = Math.random() * Math.PI * 2;
    const distance = spawnRadius * (0.8 + 0.4 * Math.random());
    const spawnX = this.cube.position.x + Math.cos(angle) * distance;
    const spawnY = this.cube.position.y + Math.sin(angle) * distance;
    const spawnPosition = new THREE.Vector3(spawnX, spawnY, this.cube.position.z);
    let enemy;
    if (this.enemyPool.length > 0) {
      enemy = this.enemyPool.pop();
      // Make sure the recycled enemy has a mesh; if not, recreate it.
      if (!enemy.mesh) {
        enemy = new Enemy(spawnPosition);
      } else {
        enemy.mesh.position.copy(spawnPosition);
      }
      enemy.active = true;
      // Always add the enemy's mesh back to the scene.
      if (!this.scene.children.includes(enemy.mesh)) {
        this.scene.add(enemy.mesh);
      }
    } else {
      enemy = new Enemy(spawnPosition);
      enemy.active = true;
      this.scene.add(enemy.mesh);
    }
    this.enemies.push(enemy);
  }

  restartGame() {
    // Clear enemy spawner if applicable
    if (this.enemySpawner) {
      clearInterval(this.enemySpawner);
      this.enemySpawner = null;
    }
    // Remove all enemies and bullets from the scene and recycle them
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.mesh);
      enemy.active = false;
      this.enemyPool.push(enemy);
    });
    this.enemies = [];
    this.bullets.forEach(bullet => {
      this.scene.remove(bullet);
      this.bulletPool.push(bullet);
    });
    this.bullets = [];
    // Reset player position
    this.cube.position.set(0, 0, 0);
    this.shootCooldown = 0;
    console.log("Game restarted!");
    // Restart enemy spawner
    this.startEnemySpawner();
  }

  startEnemySpawner() {
    // Spawn an enemy every 100ms, up to a maximum of 10000 enemies
    if (this.enemySpawner) clearInterval(this.enemySpawner);
    this.enemySpawner = setInterval(() => {
      if (this.enemies.length < 10000 && !this.isPaused) {
        this.spawnEnemy();
      }
    }, 100);
  }

  start() {
    this.running = true;
    this.startEnemySpawner();
    // Ensure bullets array is cleared initially
    this.bullets = [];
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  animate() {
    if (!this.running) return;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    // Update player (cube) movement via keys (WASD)
    if (keys.w) {
      this.cube.position.y += this.moveSpeed * delta;
    }
    if (keys.s) {
      this.cube.position.y -= this.moveSpeed * delta;
    }
    if (keys.a) {
      this.cube.position.x -= this.moveSpeed * delta;
    }
    if (keys.d) {
      this.cube.position.x += this.moveSpeed * delta;
    }

    // Handle shooting input (increased firing frequency)
    let shootX = 0;
    let shootY = 0;
    if (shootingKeys.i) shootY += 1;
    if (shootingKeys.k) shootY -= 1;
    if (shootingKeys.j) shootX -= 1;
    if (shootingKeys.l) shootX += 1;
    const shootDirection = new THREE.Vector3(shootX, shootY, 0);
    if (shootDirection.length() > 0 && this.shootCooldown <= 0) {
      shootDirection.normalize();
      this.shootBullet(shootDirection);
      this.shootCooldown = 0.1;
    }
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }

    // Update all bullets
    this.updateBullets(delta);

    // Update enemies and check for collisions
    const enemyCollisionThresholdSq = 1;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.active) continue;
      // Move enemy toward the player
      const direction = new THREE.Vector3().subVectors(this.cube.position, enemy.mesh.position).normalize();
      const enemySpeed = enemy.movementspeed || 1.5;
      enemy.mesh.position.addScaledVector(direction, enemySpeed * delta);
      enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      // Collision: enemy with player
      if (enemy.mesh.position.distanceToSquared(this.cube.position) < enemyCollisionThresholdSq) {
        console.log("Enemy collided with player!");
        this.restartGame();
        return;
      }
      // Collision: enemy with bullet
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const bullet = this.bullets[j];
        if (enemy.mesh.position.distanceToSquared(bullet.position) < 0.25) {
          // Recycle both enemy and bullet when a collision is detected
          this.scene.remove(enemy.mesh);
          this.scene.remove(bullet);
          enemy.active = false;
          this.enemyPool.push(enemy);
          this.enemies.splice(i, 1);
          this.bullets.splice(j, 1);
          this.bulletPool.push(bullet);
          break;
        }
      }
    }

    // Create a trail piece for the player every 0.2 seconds
    this.trailTimer += delta;
    const trailInterval = 0.2;
    if (this.trailTimer >= trailInterval) {
      const trailGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const trailMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const trailPiece = new THREE.Mesh(trailGeometry, trailMaterial);
      trailPiece.position.copy(this.cube.position);
      trailPiece.birth = this.clock.elapsedTime;
      this.scene.add(trailPiece);
      this.trailPieces.push(trailPiece);
      this.trailTimer = 0;
    }
    // Remove trail pieces older than 2 seconds
    const trailLifetime = 2;
    for (let i = this.trailPieces.length - 1; i >= 0; i--) {
      const piece = this.trailPieces[i];
      if (this.clock.elapsedTime - piece.birth > trailLifetime) {
        this.scene.remove(piece);
        this.trailPieces.splice(i, 1);
      }
    }

    // Update camera position to follow the player with a larger offset (zoomed out more)
    const offset = new THREE.Vector3(0, 15, 50);
    const targetPosition = this.cube.position.clone().add(offset);
    this.camera.position.lerp(targetPosition, 0.1);
    this.camera.lookAt(this.cube.position);
    
    // Update enemy counter UI
    this.enemyCounterElement.innerText = `Enemies: ${this.enemies.length}`;

    this.renderer.render(this.scene, this.camera);
  }
}