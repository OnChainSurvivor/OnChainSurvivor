export const worldComponents = {
    BloomEnvironment: {
      initialize(mainScreen, scene, camera, renderer) {
        console.log("Initializing Bloom Environment for:", mainScreen.title);
        // For example purposes, add an ambient light to simulate a blooming effect.
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        // (Optionally, add UnrealBloomPass postprocessing in your renderer setup.)
      },
      update(mainScreen, scene, camera, renderer, delta) {
        // No dynamic updates needed for this static bloom effect.
      }
    },
    Octahedron: {
      initialize(mainScreen, scene, camera, renderer) {
        console.log("Initializing Octahedron");
        // Create an octahedron using the main screen's enemyMaterial (or a fallback material)
        const geometry = new THREE.OctahedronGeometry(1);
        geometry.scale(  3.75,5.25,5.6);
        const material = mainScreen.enemyMaterial || new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const mesh = new THREE.Mesh(geometry, material);
        const mesh2 = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        mesh2.position.set(0, 0, 0);
        scene.add(mesh);
        scene.add(mesh2);
        // Save a reference so we can update it.
        mainScreen.octahedronMesh1 = mesh;
        mainScreen.octahedronMesh2 = mesh2;
      },
      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.octahedronMesh1 && mainScreen.octahedronMesh2) {
          // Rotate the octahedrons normally.
          mainScreen.octahedronMesh1.rotation.x += delta * 0.5;
          mainScreen.octahedronMesh2.rotation.x -= delta * 0.5;
          
          // When the player moves, quickly minimize their size.
          if (mainScreen.hasPlayerMoved) {
            // Use a lerp factor that brings the scale down quickly.
            const targetScale = new THREE.Vector3(0.01, 0.01, 0.01);
            mainScreen.octahedronMesh1.scale.lerp(targetScale, 0.05);
            mainScreen.octahedronMesh2.scale.lerp(targetScale, 0.05);
            
            // Once the scale is small enough, remove the meshes.
            if (mainScreen.octahedronMesh1.scale.x < 0.05) {
              scene.remove(mainScreen.octahedronMesh1);
              scene.remove(mainScreen.octahedronMesh2);
              mainScreen.octahedronMesh1 = null;
              mainScreen.octahedronMesh2 = null;
            }
          }
        }
      }
    },
    MiniOctahedron: {
      initialize(mainScreen, scene, camera, renderer) {
        mainScreen.miniOctahedrons = [];
        
        const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.25);
        miniOctahedronGeometry.scale(0.5, 0.75, 0.5);
        const miniOctahedronMaterial = mainScreen.enemyMaterial || new THREE.MeshBasicMaterial({ color: 0xffffff });
        const numCrystals = 750;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        
        const possibleRadii = [1, 25, 50];
        const radiusx = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
        const radiusy = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
        const radiusz = possibleRadii[Math.floor(Math.random() * possibleRadii.length)];
        
        const possibleRoot = [1, 2, 3];
        const possibleSqrt = [0.1, 0.5, 1, 2];
        const root = possibleRoot[Math.floor(Math.random() * possibleRoot.length)];
        const Sqrt = possibleSqrt[Math.floor(Math.random() * possibleSqrt.length)];
        
        for (let i = 0; i < numCrystals; i++) {
          const miniOctahedron = new THREE.Mesh(miniOctahedronGeometry, miniOctahedronMaterial);
          
          const y = 1 - (i / (numCrystals - 1)) * root;
          const squareTerm = Sqrt - y * y;
          const radiusVal = squareTerm > 0 ? Math.sqrt(squareTerm) : 0;
          
          const phi = goldenAngle * i;
          const theta = Math.atan2(radiusVal, y);
          
          miniOctahedron.position.set(
            radiusx * Math.cos(phi) * Math.sin(theta),
            radiusy * y,
            radiusz * Math.sin(phi) * Math.sin(theta)
          );
          
          miniOctahedron.rotation.set(
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI
          );
          
          mainScreen.miniOctahedrons.push(miniOctahedron);
          scene.add(miniOctahedron);
        }
        
        // Matching exact values from survival.js
        mainScreen.miniRotationIncrement = 0.01;
        mainScreen.scaleThreshold = 0.3;
        mainScreen.miniScaleSpeed = 0.005;
        mainScreen.orbitSpeed = 0.5;
        mainScreen.attractionSpeed = 0.025;
      },
      update(mainScreen, scene, camera, renderer, delta) {
        const timeNow = Date.now() * 0.001;
        
        if (mainScreen.miniOctahedrons.length > 0 && mainScreen.octahedronMesh1) {
          mainScreen.miniOctahedrons.forEach((miniOctahedron, index) => {
            miniOctahedron.rotation.x += mainScreen.miniRotationIncrement;
            miniOctahedron.rotation.y += mainScreen.miniRotationIncrement;
            
            if (!mainScreen.hasPlayerMoved) {
              // Orbit behavior (equivalent to isMainMenu in survival.js)
              const orbitRadius = miniOctahedron.position.distanceTo(mainScreen.octahedronMesh1.position);
              const phi = Math.PI * index / mainScreen.miniOctahedrons.length;
              const theta = Math.sqrt(mainScreen.miniOctahedrons.length * Math.PI) * phi;
              const angle = timeNow * mainScreen.orbitSpeed;
              
              miniOctahedron.position.set(
                mainScreen.octahedronMesh1.position.x + orbitRadius * Math.cos(angle + theta) * Math.sin(phi),
                mainScreen.octahedronMesh1.position.y + orbitRadius * Math.cos(phi),
                mainScreen.octahedronMesh1.position.z + orbitRadius * Math.sin(angle + theta) * Math.sin(phi)
              );
              
              const direction = miniOctahedron.position.clone().normalize().negate();
              if (miniOctahedron.position.length() > 1) {
                miniOctahedron.position.addScaledVector(direction, mainScreen.attractionSpeed);
              }
            } else {
              // Shrinking and gathering behavior
              const attractionDir = mainScreen.octahedronMesh1.position.clone().sub(miniOctahedron.position).normalize();
              miniOctahedron.position.addScaledVector(attractionDir, 0.2);
              miniOctahedron.scale.multiplyScalar(1 - mainScreen.miniScaleSpeed);
              
              if (miniOctahedron.scale.x <= mainScreen.scaleThreshold) {
                scene.remove(miniOctahedron);
                mainScreen.miniOctahedrons.splice(index, 1);
              }
            }
          });
        }
      }
    },
    NeonGrid: {
      initialize(mainScreen, scene, camera, renderer) {
        console.log("Initializing NeonGrid");
        // Create a grid helper with neon-inspired colors.
        const size = 1000;
        const divisions = 500;
        const gridHelper = new THREE.GridHelper(size, divisions, 0x00ffff, 0x00ffff);
        gridHelper.material.opacity = 0.5;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
        mainScreen.neonGrid = gridHelper;
      },
      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.neonGrid) {
          // Optional: rotate the grid for a dynamic effect.
          // mainScreen.neonGrid.rotation.y += delta * 0.2;
        }
      }
    }
  };