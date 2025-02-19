let scene, camera, renderer, composer;

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
    // renderer.setPixelRatio(window.devicePixelRatio || 1);
    
    // Create a render target
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        encoding: THREE.sRGBEncoding,
    });
    
    // Create the composer and add passes
    composer = new THREE.EffectComposer(renderer, renderTarget);
    const renderPass = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1,    // increased strength for a brighter bloom
        0,    
        0.0     // lowered threshold to capture more bright areas
    );
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // Listen for window resize events to keep the scene updated
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // If you have a composer, update its size as well:
    if(composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
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

export function getComposer() {
    return composer;
}

export function renderScene() {
    // Use the composer so that the bloom/neon passes are applied
    composer.render(scene, camera);

    // (Optional) If you have other post-processing steps, call them here.
    if (styleTransferEnabled) {
        // Get the frame from the canvas, pass it to the style transfer module asynchronously
        applyStyleTransfer(canvas).then((styledFrame) => {
            // Draw or update the displayed frame as needed.
        });
    }
} 