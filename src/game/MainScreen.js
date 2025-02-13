import { worldComponents } from './WorldComponents.js'; // This object should include your plug-and-play component definitions (e.g., BloomEnvironment, Octahedron, etc.)

const MainScreen = {
  title: "The Dark Forest",
  description: "Survive in Ethereum, an open, futuristic landscape where data flows freely. Be aware of what's lurking in the dark!",
  thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
  backgroundColor: new THREE.Color(0x000000),
  texturePath: 'Media/Textures/ENVTEXTURE.png',
  // You can reuse the enemyMaterial from your original world definition or customize it for this screen.
  enemyMaterial: new THREE.MeshPhysicalMaterial({
    envMap: null,
    reflectivity: 1,
    roughness: 0,
    metalness: 1,
    clearcoat: 0.13,
    clearcoatRoughness: 0.1,
    transmission: 0.82,
    ior: 2.75,
    thickness: 10,
    sheen: 1,
    color: new THREE.Color('white'),
    wireframe: true,
    emissive: 0x0ff00,
    emissiveIntensity: 2
  }),
  // Plug-and-play components for the main screen
  components: ["BloomEnvironment", "Octahedron", "MiniOctahedron", "NeonGrid"],

  // Call this once during initialization
  setup(scene, camera, renderer) {
    // Set the scene background color
    scene.background = this.backgroundColor;
    
    // Initialize each plug-and-play component by name if it provides an initialize() method.
    this.components.forEach(componentName => {
      const component = worldComponents[componentName];
      if (component && typeof component.initialize === 'function') {
        component.initialize(this, scene, camera, renderer);
      }
    });
    
    // Position the camera to focus on the main screen elements.
    camera.position.set(15, 10, 15);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  },

  // Call this on every animation frame to update dynamic elements
  update(scene, camera, renderer, delta) {
    // Allow each component to update itself on each animation frame.
    this.components.forEach(componentName => {
      const component = worldComponents[componentName];
      if (component && typeof component.update === 'function') {
        component.update(this, scene, camera, renderer, delta);
      }
    });
  }
};

export { MainScreen };