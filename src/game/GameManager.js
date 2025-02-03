import { getScene, getCamera, getRenderer } from './Renderer.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { keys } from '../input/Joystick.js';

export class GameManager {
    constructor() {
        this.scene = getScene();
        this.camera = getCamera();
        this.renderer = getRenderer();
        this.clock = new THREE.Clock();
        this.cube = null;
        // Movement speed in units per second
        this.moveSpeed = 2;
        // State control for the game loop.
        this.running = false;
        this.animationFrameId = null;
        this.initScene();
    }

    initScene() {
        // Create a simple rotating cube to validate that everything is working
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);
    }

    start() {
        this.running = true;
        this.animate();
    }

    animate() {
        if (!this.running) return;
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();

        // Rotate cube continuously for visual effect
        if (this.cube) {
            this.cube.rotation.x += delta;
            this.cube.rotation.y += delta;
        }

        // Use joystick keys to update the cube's position
        // 'w' moves upward, 's' moves downward
        if (keys.w) {
            this.cube.position.y += this.moveSpeed * delta;
        }
        if (keys.s) {
            this.cube.position.y -= this.moveSpeed * delta;
        }
        // 'a' moves left, 'd' moves right
        if (keys.a) {
            this.cube.position.x -= this.moveSpeed * delta;
        }
        if (keys.d) {
            this.cube.position.x += this.moveSpeed * delta;
        }

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