        // Initialize scene, camera, and renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        // Create a floor
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, 
            metalness: 0.6,  // Add this line
            roughness: 0.4   // Add this line
             });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // Create a cube with neon effect
        const createNeonMaterial = (color) => {
            return new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 1,
                wireframe: false
            });
        };

        const cubeGeometry = new THREE.BoxGeometry();
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x888888,
            emissiveIntensity: 1,
            metalness: 0.5,  // Add this line
            roughness: 0.3   // Add this line
        });

        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        scene.add(cube);

        // Position the camera
        camera.position.set(0, 10, 0);
        camera.lookAt(0, 0, 0);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        // Add directional light
        //const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        //directionalLight.position.set(1, 1, 1).normalize();
        //scene.add(directionalLight);

        // Add more lighting for better reflections
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(0, 10, 10);
        scene.add(directionalLight);

        // Handle user input
        const keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            i: false,
            j: false,
            k: false,
            l: false
        };

        document.addEventListener('keydown', (event) => {
            if (event.key === 'w') keys.w = true;
            if (event.key === 'a') keys.a = true;
            if (event.key === 's') keys.s = true;
            if (event.key === 'd') keys.d = true;
            if (event.key === 'i') keys.i = true;
            if (event.key === 'j') keys.j = true;
            if (event.key === 'k') keys.k = true;
            if (event.key === 'l') keys.l = true;
        });

        document.addEventListener('keyup', (event) => {
            if (event.key === 'w') keys.w = false;
            if (event.key === 'a') keys.a = false;
            if (event.key === 's') keys.s = false;
            if (event.key === 'd') keys.d = false;
            if (event.key === 'i') keys.i = false;
            if (event.key === 'j') keys.j = false;
            if (event.key === 'k') keys.k = false;
            if (event.key === 'l') keys.l = false;
        });

        // Array to store mini cubes
        const miniCubes = [];

        function createMiniCube(x, y, z) {
            const miniGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const miniMaterial = createNeonMaterial(0xff0000);
            const miniCube = new THREE.Mesh(miniGeometry, miniMaterial);
            miniCube.position.set(x, y, z);
            scene.add(miniCube);
            miniCubes.push(miniCube);
        }

        // Cleanup function to remove mini cubes that go out of the scene
        function cleanupMiniCubes() {
            for (let i = miniCubes.length - 1; i >= 0; i--) {
                const miniCube = miniCubes[i];
                if (miniCube.position.x > 50 || miniCube.position.x < -50 || miniCube.position.z > 50 || miniCube.position.z < -50) {
                    scene.remove(miniCube);
                    miniCubes.splice(i, 1);
                }
            }
        }

        // Render loop
        function animate() {
            requestAnimationFrame(animate);

            if (keys.w) cube.position.z -= 0.1;
            if (keys.a) cube.position.x -= 0.1;
            if (keys.s) cube.position.z += 0.1;
            if (keys.d) cube.position.x += 0.1;

            if (keys.i) createMiniCube(cube.position.x, cube.position.y, cube.position.z - 1);
            if (keys.j) createMiniCube(cube.position.x - 1, cube.position.y, cube.position.z);
            if (keys.k) createMiniCube(cube.position.x, cube.position.y, cube.position.z + 1);
            if (keys.l) createMiniCube(cube.position.x + 1, cube.position.y, cube.position.z);

            miniCubes.forEach(miniCube => {
                if (keys.i) miniCube.position.z -= 0.2;
                if (keys.j) miniCube.position.x -= 0.2;
                if (keys.k) miniCube.position.z += 0.2;
                if (keys.l) miniCube.position.x += 0.2;
            });

            cleanupMiniCubes();

            renderer.render(scene, camera);
        }

        animate();