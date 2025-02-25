import { worldComponents } from './WorldComponents.js';

// A common prototype for every world.
const baseWorldConfig = {
  setup(scene, camera, renderer) {
    // Set scene background using the config
    scene.background = this.sceneConfig.backgroundColor;
    // Initialize each plug‐and‐play component
    this.components.forEach(componentName => {
      const component = worldComponents[componentName];
      if (component && typeof component.initialize === 'function') {
        component.initialize(this, scene, camera, renderer);
      }
    });
    // Position camera for the world
    camera.position.set(15, 10, 15);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  },
  update(scene, camera, renderer, delta) {
    this.components.forEach(componentName => {
      const component = worldComponents[componentName];
      if (component && typeof component.update === 'function') {
        component.update(this, scene, camera, renderer, delta);
      }
    });
  }
};

// List your worlds (both for game logic and UI)
const worlds = [
  {
    // Spread the common behavior into this world config
    ...baseWorldConfig,
    title: "The Dark Forest (Testnet Version)",
    description: "Survive in Ethereum, an open, futuristic landscape where data flows freely. Be aware of what's lurking in the dark!",
    thumbnail: 'src/Media/Worlds/ETHEREUMVERSE.png',
    sceneConfig: {
      backgroundColor: new THREE.Color(0x000000),
      texturePath: 'src/Media/Textures/ENVTEXTURE.png',
      playerColor: new THREE.Color(0x00ff00),
      bulletColor: new THREE.Color(0x00ff00),
      enemyColor: new THREE.Color(0xff0000),
      gridColor: new THREE.Color(0x0000ff),
    },
    components: ["Octahedron", "MiniOctahedron", "NeonGrid"]
  },
  {
    ...baseWorldConfig,
    title: "Monad-land (Testnet Version)",
    description: "Survive in Monad Testnet, an extremely fast purple landscape where 10.000 entities move per second!",
    thumbnail: 'src/Media/Worlds/ETHEREUMVERSE.png',
    sceneConfig: {
      backgroundColor: new THREE.Color(0x000000),
      texturePath: 'src/Media/Textures/ENVTEXTURE.png',
      playerColor: new THREE.Color(0xff00ff),
      bulletColor: new THREE.Color(0xff00ff),
      enemyColor: new THREE.Color(0x00ff00),
      gridColor: new THREE.Color(0xff00ff),
    },
    components: ["Monad", "NeonGrid"]
  },
];

export { worlds }; 