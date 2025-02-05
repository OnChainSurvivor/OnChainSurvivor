import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

let scene, camera, renderer;

export function initRenderer() {
    // Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Setup Camera using the canvas dimensions
    const canvas = document.getElementById('survivorCanvas');
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Listen for window resize events to keep the scene updated
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    const canvas = document.getElementById('survivorCanvas');
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

export function getRenderer() {
    return renderer;
}

export function renderScene() {
    renderer.render(scene, camera);

    // Assuming 'canvas' is the WebGL canvas from which you want to extract the current frame
    if (styleTransferEnabled) {
        // Get the frame from the canvas, pass it to the style transfer module asynchronously
        applyStyleTransfer(canvas).then((styledFrame) => {
            // Draw the styled frame to an on-screen canvas or update the visible canvas with the processed image.
            // The strategy here can vary: you might use an offscreen canvas or replace the WebGL canvas content.
        });
    }
} 