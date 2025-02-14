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
        const geometry = new THREE.OctahedronGeometry(1);
        geometry.scale(3.75, 5.25, 5.6);
        const material = this.createShaderMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        const mesh2 = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0, 0);
        mesh2.position.set(0, 0, 0);
        scene.add(mesh);
        scene.add(mesh2);
        mainScreen.octahedronMesh1 = mesh;
        mainScreen.octahedronMesh2 = mesh2;
      },
      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.octahedronMesh1 && mainScreen.octahedronMesh2) {
          mainScreen.octahedronMesh1.material.uniforms.time.value += delta;
          mainScreen.octahedronMesh2.material.uniforms.time.value += delta;
          
          mainScreen.octahedronMesh1.rotation.x += delta * 0.5;
          mainScreen.octahedronMesh2.rotation.x -= delta * 0.5;
          
          if (mainScreen.hasPlayerMoved) {
            const targetScale = new THREE.Vector3(0.01, 0.01, 0.01);
            mainScreen.octahedronMesh1.scale.lerp(targetScale, 0.05);
            mainScreen.octahedronMesh2.scale.lerp(targetScale, 0.05);
            
            if (mainScreen.octahedronMesh1.scale.x < 0.05) {
              scene.remove(mainScreen.octahedronMesh1);
              scene.remove(mainScreen.octahedronMesh2);
              mainScreen.octahedronMesh1 = null;
              mainScreen.octahedronMesh2 = null;
            }
          }
        }
      },
      createShaderMaterial() {
        return new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0.0 }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;

            vec3 rainbowColor(float t) {
              return vec3(
                0.5 + 0.5 * cos(6.28318 * (t + 0.0)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.33)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.66))
              );
            }

            void main() {
              float t = vUv.y + time * 0.2;
              gl_FragColor = vec4(rainbowColor(t), 1.0);
            }
          `,
          side: THREE.DoubleSide,
          wireframe: true,
        });
      }
    },
    MiniOctahedron: {
      initialize(mainScreen, scene, camera, renderer) {
        mainScreen.miniOctahedrons = [];
        
        const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.25);
        miniOctahedronGeometry.scale(0.5, 0.75, 0.5);
        const miniOctahedronMaterial = this.createShaderMaterial();
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
        
        if (mainScreen.miniOctahedrons.length > 0) {
          // All mini octahedrons share the same material instance.
          mainScreen.miniOctahedrons[0].material.uniforms.time.value += delta;
        }
        
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
      },
      createShaderMaterial() {
        return new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0.0 }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;

            vec3 rainbowColor(float t) {
              return vec3(
                0.5 + 0.5 * cos(6.28318 * (t + 0.0)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.33)),
                0.5 + 0.5 * cos(6.28318 * (t + 0.66))
              );
            }

            void main() {
              float t = vUv.y + time * 0.2;
              gl_FragColor = vec4(rainbowColor(t), 1.0);
            }
          `,

          wireframe: true,
        });
      }
    },
    NeonGrid: {
      initialize(mainScreen, scene, camera, renderer) {
        console.log("Initializing NeonGrid");

        // Use configurable grid size and divisions if they exist, otherwise default.
        const size = mainScreen.gridSize !== undefined ? mainScreen.gridSize : 100;
        const divisions = mainScreen.gridDivisions !== undefined ? mainScreen.gridDivisions : 10;

        const gridHelper = new THREE.GridHelper(size, divisions, 0x00ffff, 0x00ffff);
        gridHelper.material.opacity = 0.5;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
        mainScreen.neonGrid = gridHelper;

        // Calculate cell size from grid parameters.
        const cellSize = size / divisions;
        const halfSize = size / 2;

        mainScreen.gridLabels = [];

        // For each cell, create a sprite displaying its coordinate (1-based indexing).
        for (let i = 0; i < divisions; i++) {
          for (let j = 0; j < divisions; j++) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.fillStyle = 'cyan';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const labelText = `[${i + 1},${j + 1}]`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;

            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
              opacity: 0.8
            });
            const sprite = new THREE.Sprite(spriteMaterial);

            // Place the label at the center of its cell (grid on the XZ plane).
            const x = (j + 0.5) * cellSize - halfSize;
            const z = (i + 0.5) * cellSize - halfSize;
            sprite.position.set(x, 0.2, z);
            sprite.scale.set(3, 1.5, 1);

            // Save cell indices (0-indexed) for later comparison.
            sprite.userData.cell = { row: i, col: j };

            scene.add(sprite);
            mainScreen.gridLabels.push(sprite);
          }
        }
      },

      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.neonGrid && mainScreen.gridLabels) {
          // Use player's cube if available, otherwise fallback to the camera's position.
          const playerPos = (mainScreen.cube && mainScreen.cube.position)
            ? mainScreen.cube.position
            : camera.position;

          // Retrieve configurable grid parameters.
          const size = mainScreen.gridSize !== undefined ? mainScreen.gridSize : 100;
          const divisions = mainScreen.gridDivisions !== undefined ? mainScreen.gridDivisions : 10;
          const cellSize = size / divisions;
          const halfSize = size / 2;
          
          // Determine grid cell based on the player's position.
          const col = Math.floor((playerPos.x + halfSize) / cellSize);
          // Shift the row upward by one so that the cell above is selected.
          const row = Math.floor((playerPos.z + halfSize) / cellSize) - 1;
          
          const clampedRow = Math.max(0, Math.min(row, divisions - 1));
          const clampedCol = Math.max(0, Math.min(col, divisions - 1));

          // Only the label of the cell that matches the computed indices will be visible.
          mainScreen.gridLabels.forEach(sprite => {
            const cell = sprite.userData.cell;
            sprite.visible = (cell && cell.row === clampedRow && cell.col === clampedCol);
            sprite.quaternion.copy(camera.quaternion);
          });
        }
      }
    }
  };