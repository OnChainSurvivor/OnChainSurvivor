import { getScene, getCamera, getRenderer } from './Renderer.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { keys } from '../input/Joystick.js';
import { shootingKeys } from '../input/ShootingJoystick.js';

export class GameManager {
    constructor() {
        this.scene = getScene();
        this.camera = getCamera();
        this.renderer = getRenderer();
        this.clock = new THREE.Clock();
        this.cube = null;
        // Movement speed in units per second
        this.moveSpeed = 2;
        // Bullet properties
        this.bullets = [];
        this.bulletSpeed = 10;
        this.shootCooldown = 0;
        // Set target camera z-position for zooming out
        this.targetCameraZ = 10;
        // State control for the game loop.
        this.running = false;
        this.animationFrameId = null;
        this.initScene();

        // Trail properties for visualizing movement
        this.trailPieces = [];
        this.trailTimer = 0;
    }

    initScene() {
        // Create a simple player cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);
    }

    start() {
        this.running = true;
        this.animate();
    }

    shootBullet(direction) {
        // Create a small red sphere as bullet
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const bullet = new THREE.Mesh(geometry, material);
        // Start at the cube's position
        bullet.position.copy(this.cube.position);
        // Store velocity vector and life timer
        bullet.velocity = direction.clone().multiplyScalar(this.bulletSpeed);
        bullet.life = 2; // bullet lives for 2 seconds
        this.scene.add(bullet);
        this.bullets.push(bullet);
    }

    updateBullets(delta) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
            bullet.life -= delta;
            if (bullet.life <= 0) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }

    animate() {
        if (!this.running) return;
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();

        // Update cube position based on movement keys (WASD)
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

        // Handle shooting: check if any shooting key (i, j, k, l) is active.
        // Compute a directional vector from the shooting input.
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
            this.shootCooldown = 0.3; // 0.3 second cooldown between shots
        }
        // Decrease shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown -= delta;
        }

        // Update all bullets
        this.updateBullets(delta);

        // Create a trail piece every 0.2 seconds
        this.trailTimer += delta;
        const trailInterval = 0.2; // seconds between trail pieces
        if (this.trailTimer >= trailInterval) {
            const trailGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const trailMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const trailPiece = new THREE.Mesh(trailGeometry, trailMaterial);
            trailPiece.position.copy(this.cube.position);
            // Record the creation time using clock.elapsedTime
            trailPiece.birth = this.clock.elapsedTime;
            this.scene.add(trailPiece);
            this.trailPieces.push(trailPiece);
            this.trailTimer = 0;
        }

        // Remove trail pieces older than 2 seconds
        const trailLifetime = 2; // seconds
        for (let i = this.trailPieces.length - 1; i >= 0; i--) {
            const piece = this.trailPieces[i];
            if (this.clock.elapsedTime - piece.birth > trailLifetime) {
                this.scene.remove(piece);
                this.trailPieces.splice(i, 1);
            }
        }

        // Define a small offset relative to the cube's position.
        // For example, an offset of (2, 2, 10) moves the camera 2 units right, 2 units up, and 10 units behind the cube.
        const offset = new THREE.Vector3(2, 2, 10);

        // Calculate the target position for the camera
        const targetPosition = this.cube.position.clone().add(offset);
        
        // Smoothly interpolate the camera's position toward the target position.
        this.camera.position.lerp(targetPosition, 0.05);

        // Ensure the camera is always looking at the cube.
        this.camera.lookAt(this.cube.position);

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Stops the game loop.
     */
    stop() {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}