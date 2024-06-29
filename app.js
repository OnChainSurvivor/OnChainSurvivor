       // Step 1: Initialize the scene, camera, and renderer
       const scene = new THREE.Scene();
       const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
       const renderer = new THREE.WebGLRenderer({ antialias: true });
       renderer.setSize(window.innerWidth, window.innerHeight);
       document.body.appendChild(renderer.domElement);

       // Step 2: Create a custom shader material
       const geometry = new THREE.BoxGeometry();
       const material = new THREE.ShaderMaterial({
           vertexShader: document.getElementById('vertexShader').textContent,
           fragmentShader: document.getElementById('fragmentShader').textContent,
           side: THREE.FrontSide,
           uniforms: {
               glowColor: { value: new THREE.Color(0x00ff00) }
           }
       });
       const cube = new THREE.Mesh(geometry, material);
       scene.add(cube);

       // Step 3: Add more intense lighting
       const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Brighter ambient light
       scene.add(ambientLight);

       const pointLight = new THREE.PointLight(0xffffff, 2, 100); // Brighter point light
       pointLight.position.set(10, 10, 10);
       scene.add(pointLight);

       const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // Brighter directional light
       directionalLight.position.set(-1, 1, 1).normalize();
       scene.add(directionalLight);

       // Additional spot light for more brilliance
       const spotLight = new THREE.SpotLight(0xffffff, 2);
       spotLight.position.set(0, 20, 10);
       spotLight.angle = Math.PI / 4;
       spotLight.penumbra = 0.1;
       spotLight.decay = 2;
       spotLight.distance = 200;
       scene.add(spotLight);

       // Position the camera
       camera.position.z = 5;

       // Array of colors
       const colors = [
           0x00ff00, // Green
           0xff0000, // Red
           0x0000ff, // Blue
           0xffff00, // Yellow
           0xff00ff, // Magenta
           0x00ffff  // Cyan
       ];
       let currentColorIndex = 0;

       // Function to change the neon color
       function changeColor() {
           currentColorIndex = (currentColorIndex + 1) % colors.length;
           material.uniforms.glowColor.value.setHex(colors[currentColorIndex]);
       }

       // Event listener for keydown to change color
       window.addEventListener('keydown', (event) => {
           if (event.key === 'c' || event.key === 'C') {
               changeColor();
           }
       });

       // Step 4: Animate the cube
       function animate() {
           requestAnimationFrame(animate);
           cube.rotation.x += 0.01;
           cube.rotation.y += 0.01;
           renderer.render(scene, camera);
       }

       // Step 5: Render the scene
       animate();

       // Handle window resize
       window.addEventListener('resize', () => {
           camera.aspect = window.innerWidth / window.innerHeight;
           camera.updateProjectionMatrix();
           renderer.setSize(window.innerWidth, window.innerHeight);
       });