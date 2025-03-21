export const worldComponents = {
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
        const centerPoint = new THREE.Vector3(0, 0, 0);
        
        if (mainScreen.miniOctahedrons.length > 0) {
          // All mini octahedrons share the same material instance.
          mainScreen.miniOctahedrons[0].material.uniforms.time.value += delta;
        }
        
        mainScreen.miniOctahedrons.forEach((miniOctahedron, index) => {
          miniOctahedron.rotation.x += mainScreen.miniRotationIncrement;
          miniOctahedron.rotation.y += mainScreen.miniRotationIncrement;
          
          if (!mainScreen.hasPlayerMoved) {
            // Orbit behavior around origin
            const orbitRadius = miniOctahedron.position.distanceTo(centerPoint);
            const phi = Math.PI * index / mainScreen.miniOctahedrons.length;
            const theta = Math.sqrt(mainScreen.miniOctahedrons.length * Math.PI) * phi;
            const angle = timeNow * mainScreen.orbitSpeed;
            
            miniOctahedron.position.set(
              orbitRadius * Math.cos(angle + theta) * Math.sin(phi),
              orbitRadius * Math.cos(phi),
              orbitRadius * Math.sin(angle + theta) * Math.sin(phi)
            );
            
            const direction = miniOctahedron.position.clone().normalize().negate();
            if (miniOctahedron.position.length() > 1) {
              miniOctahedron.position.addScaledVector(direction, mainScreen.attractionSpeed);
            }
          } else {
            // Shrinking and gathering behavior towards center
            const attractionDir = centerPoint.clone().sub(miniOctahedron.position).normalize();
            miniOctahedron.position.addScaledVector(attractionDir, 0.2);
            miniOctahedron.scale.multiplyScalar(1 - mainScreen.miniScaleSpeed);
            
            if (miniOctahedron.scale.x <= mainScreen.scaleThreshold) {
              scene.remove(miniOctahedron);
              mainScreen.miniOctahedrons.splice(index, 1);
            }
          }
        });
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

        const size = mainScreen.gridSize !== undefined ? mainScreen.gridSize : 100;
        const divisions = mainScreen.gridDivisions !== undefined ? mainScreen.gridDivisions : 10;
        const cellSize = size / divisions;
        const halfSize = size / 2;

        // Create the grid helper with the sceneConfig color
        const gridHelper = new THREE.GridHelper(
          size, 
          divisions,
          mainScreen.sceneConfig.gridColor, // Primary color
          mainScreen.sceneConfig.gridColor  // Secondary color
        );
        gridHelper.material.opacity = 0;
        gridHelper.material.transparent = true;
        gridHelper.visible = false;
        scene.add(gridHelper);
        mainScreen.neonGrid = gridHelper;

        // (The cell number labels have been removed.)
        mainScreen.gridLabels = []; // Left empty or removed entirely if not needed.

        // Create textured cube with improved material settings
        const cubeGeometry = new THREE.BoxGeometry(cellSize * 0.4, cellSize * 0.4, cellSize * 0.00004);
        const textureLoader = new THREE.TextureLoader();
        
        // Create an improved material with better rendering properties
        const cubeMaterial = new THREE.MeshPhysicalMaterial({ 
          color: 0xffffff,
          metalness: 0.0,    // Reduced metalness for better texture visibility
          roughness: 0,    // Smoother surface
          clearcoat: 1,    // Add clearcoat for shine
          clearcoatRoughness: 1,
          transparent: true,
          alphaTest: 0,    // Help with transparency
          side: THREE.DoubleSide
        });

        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

        // Position cube (same as before)
        const cubeCellRow = 2;
        const cubeCellCol = 5;
        const cubeX = (cubeCellCol + 0.5) * cellSize - halfSize;
        const cubeZ = (cubeCellRow + 0.5) * cellSize - halfSize;
    
        // Add a point light near the cube for better visibility
        const pointLight = new THREE.PointLight(0xffffff, 1, 10);
        pointLight.position.set(cubeX, 3, cubeZ);
        scene.add(pointLight);
        mainScreen.cubeLight = pointLight;

        // --- Add card-like slab next to the cube (without white slab) ---

        // Compute the position for the Auditor card (same cell previously occupied by the white slab)
        const cardX = cubeX + cellSize * -0.5; // to the right of the cube
        const cardY = 3.6;
        const cardZ = -50;

        // Create a group for the auditor card components and position it accordingly
        const cardGroup = new THREE.Group();
        cardGroup.position.set(cardX, cardY, cardZ);
        cardGroup.visible = false;
        scene.add(cardGroup);
        mainScreen.cardGroup = cardGroup;

        // Title area (top portion)
        const titleGeometry = new THREE.PlaneGeometry(cellSize * 0.55, cellSize * 0.15);
        const titleMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0  // start invisible
        });
        const titleArea = new THREE.Mesh(titleGeometry, titleMaterial);
        titleArea.position.set(0, cellSize * 0.3, 0.051);
        cardGroup.add(titleArea);

        // Image area (middle portion)
        const imageGeometry = new THREE.PlaneGeometry(cellSize * 0.55, cellSize * 0.4);
        const imageMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.0,
          roughness: 0,
          clearcoat: 1,
          clearcoatRoughness: 1,
          transparent: true,
          opacity: 0,  // start invisible
          alphaTest: 0,
          side: THREE.DoubleSide
        });
        const imageArea = new THREE.Mesh(imageGeometry, imageMaterial);
        imageArea.position.set(0, 0, 0.051);
        cardGroup.add(imageArea);

        // Create the effect text area (bottom portion) with a rainbow shader
        const textGeometry = new THREE.PlaneGeometry(cellSize * 0.55, cellSize * 0.2);
        const textMaterial = new THREE.ShaderMaterial({
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
          side: THREE.DoubleSide
        });
        const textArea = new THREE.Mesh(textGeometry, textMaterial);
        textArea.position.set(0, -cellSize * 0.25, 0.051);

        // Add the auditor card components (without the white slab background) to the group
        cardGroup.add(titleArea);
        cardGroup.add(imageArea);
        //cardGroup.add(textArea);

        // Load the texture for the image area
        textureLoader.load(
          'src/Media/Classes/Onchain Survivor/MSURVIVOR.png',
          texture => {
            console.log('Texture loaded successfully');
            texture.encoding = THREE.sRGBEncoding;
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            
            // IMPORTANT: set opacity: 0 so that the fade-in update works
            imageArea.material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: 0,
              side: THREE.DoubleSide
            });
            imageArea.material.needsUpdate = true;
          },
          progress => {
            console.log('Loading progress:', progress);
          },
          error => {
            console.error('Error loading card texture:', error);
          }
        );

        // Add the text using 3D text geometry and the same rainbow shader material
        const fontLoader = new THREE.FontLoader();
        fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font) {
          // Get the title area width and height
          const titleAreaWidth = cellSize * 0.55;  // From the titleGeometry definition
          const titleAreaHeight = cellSize * 0.15;
          
          // Create text geometry with a temporary size of 1
          const textGeo = new THREE.TextGeometry(`Today's Prize`, {
            font: font,
            size: 1,
            height: 0.1,
            curveSegments: 12,
            bevelEnabled: false
          });

          // Compute initial bounding box
          textGeo.computeBoundingBox();
          const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
          const textHeight = textGeo.boundingBox.max.y - textGeo.boundingBox.min.y;

          // Calculate scale factors for width and height
          // Use 80% of the title area to leave some padding
          const scaleX = (titleAreaWidth * 0.8) / textWidth;
          const scaleY = (titleAreaHeight * 0.8) / textHeight;

          // Use the smaller scale to maintain aspect ratio
          const scale = Math.min(scaleX, scaleY);

          // Apply the scale to the geometry
          textGeo.scale(scale, scale, 1);

          // Recompute bounding box after scaling
          textGeo.computeBoundingBox();
          const scaledWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
          const scaledHeight = textGeo.boundingBox.max.y - textGeo.boundingBox.min.y;

          // Center the text
          textGeo.translate(-scaledWidth / 2, -scaledHeight / 2, 0);

          const textMesh = new THREE.Mesh(textGeo, textMaterial);
          textMesh.position.set(0, cellSize * 0.29, 0.052);
          cardGroup.add(textMesh);

          // Store the text mesh in mainScreen for animation updates
          mainScreen.titleText = textMesh;
        });

        // --- Create a rainbow border for the auditor card ---

        // Calculate half dimensions based on the card configuration
        const halfWidth = cellSize * 0.55 / 2; // width of the card is cellSize * 0.55
        const topY = cellSize * 0.375;         // top: titleArea center (cellSize*0.3) + half of its height (cellSize*0.15/2)
        const bottomY = -cellSize * 0.35;        // bottom: textArea center (-cellSize*0.25) - half of its height (cellSize*0.2/2)

        // Create vertices for the border (a closed loop)
        const borderVertices = new Float32Array([
          -halfWidth,  topY,    0.052,
           halfWidth,  topY,    0.052,
           halfWidth,  bottomY, 0.052,
          -halfWidth,  bottomY, 0.052,
          -halfWidth,  topY,    0.052  // Close the loop
        ]);

        // Assign UV coordinates for the border so the shader can vary the color along the edge.
        const borderUvs = new Float32Array([
          0, 1,
          1, 1,
          1, 0,
          0, 0,
          0, 1
        ]);

        const borderGeometry = new THREE.BufferGeometry();
        borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderVertices, 3));
        borderGeometry.setAttribute('uv', new THREE.BufferAttribute(borderUvs, 2));

        const borderMaterial = new THREE.ShaderMaterial({
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
              float t = vUv.x + time * 0.2;
              gl_FragColor = vec4(rainbowColor(t), 1.0);
            }
          `,
          transparent: true,
        });

        // Create a Line mesh (a line loop) using the border geometry and material, and add it to the card group
        const borderLine = new THREE.Line(borderGeometry, borderMaterial);
        cardGroup.add(borderLine);
        mainScreen.cardBorder = borderLine;
        mainScreen.cardGroup.rotation.y = 99;

        // Add this near the beginning of the initialize method
        mainScreen.objective = 100;
      },

      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.hasPlayerMoved) {
          // Fade in the grid (as before)
          if (mainScreen.neonGrid) {
            if (!mainScreen.neonGrid.visible) {
              mainScreen.neonGrid.visible = true;
            }
            if (mainScreen.neonGrid.material.opacity < 0.5) {
              mainScreen.neonGrid.material.opacity = Math.min(
                mainScreen.neonGrid.material.opacity + delta * 0.2,
                0.5
              );
            }
          }
          
          // Fade in the card slab
          if (mainScreen.cardGroup) {
            if (!mainScreen.cardGroup.visible) {
              mainScreen.cardGroup.visible = true;
            }
            // Traverse through every child of the card group
            mainScreen.cardGroup.traverse(child => {
              if (child.material && typeof child.material.opacity === 'number') {
                // Increase the opacity gradually (from 0 to 1)
                child.material.opacity = Math.min(child.material.opacity + delta * 0.5, 1);
              }
            });
            // Optionally, apply a slight rotation for an extra effect
            mainScreen.cardGroup.rotation.y = Math.sin(Date.now() * 0.01 * 0.5) * 0.15;
          }
        }
        
        // Update any animated shader uniforms
        if (mainScreen.titleText) {
          mainScreen.titleText.material.uniforms.time.value += delta;
        }
        if (mainScreen.cardBorder) {
          mainScreen.cardBorder.material.uniforms.time.value += delta;
        }
      }
    },
    Monad: {
      initialize(mainScreen, scene, camera, renderer) {
        console.log("Initializing Monad");
        
        // Create the outer shape (rounded square)
        const outerShape = new THREE.Shape();
        const size = 4;
        const cornerRadius = 1.5;
    
        // Start from top right and draw clockwise
        outerShape.moveTo(size - cornerRadius, size);
        outerShape.lineTo(-size + cornerRadius, size);
        outerShape.quadraticCurveTo(-size, size, -size, size - cornerRadius);
        outerShape.lineTo(-size, -size + cornerRadius);
        outerShape.quadraticCurveTo(-size, -size, -size + cornerRadius, -size);
        outerShape.lineTo(size - cornerRadius, -size);
        outerShape.quadraticCurveTo(size, -size, size, -size + cornerRadius);
        outerShape.lineTo(size, size - cornerRadius);
        outerShape.quadraticCurveTo(size, size, size - cornerRadius, size);

        // Create the inner shape (hole)
        const innerShape = new THREE.Shape();
        const innerSize = 3;
        const innerRadius = 1;
        
        innerShape.moveTo(innerSize - innerRadius, innerSize);
        innerShape.lineTo(-innerSize + innerRadius, innerSize);
        innerShape.quadraticCurveTo(-innerSize, innerSize, -innerSize, innerSize - innerRadius);
        innerShape.lineTo(-innerSize, -innerSize + innerRadius);
        innerShape.quadraticCurveTo(-innerSize, -innerSize, -innerSize + innerRadius, -innerSize);
        innerShape.lineTo(innerSize - innerRadius, -innerSize);
        innerShape.quadraticCurveTo(innerSize, -innerSize, innerSize, -innerSize + innerRadius);
        innerShape.lineTo(innerSize, innerSize - innerRadius);
        innerShape.quadraticCurveTo(innerSize, innerSize, innerSize - innerRadius, innerSize);

        // Add the hole to the outer shape
        outerShape.holes.push(innerShape);

        // Create geometry from the shape
        const geometry = new THREE.ExtrudeGeometry(outerShape, {
          depth: 0.5,
          bevelEnabled: true,
          bevelThickness: 0.2,
          bevelSize: 1,
          bevelSegments: 3
        });

        const material = this.createShaderMaterial();
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0 , 0, 15); // Add a slight tilt on the X axis
 
        scene.add(mesh);

        mainScreen.monadMesh1 = mesh;

      },

      update(mainScreen, scene, camera, renderer, delta) {
        if (mainScreen.monadMesh1 ) {
          mainScreen.monadMesh1.material.uniforms.time.value += delta;
  
          mainScreen.monadMesh1.rotation.y += delta * 0.5;
 
          if (mainScreen.hasPlayerMoved) {
            const targetScale = new THREE.Vector3(0.01, 0.01, 0.01);
            mainScreen.monadMesh1.scale.lerp(targetScale, 0.05);
      
            if (mainScreen.monadMesh1.scale.x < 0.05) {
              scene.remove(mainScreen.monadMesh1);
              
              mainScreen.monadMesh1 = null;

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

            vec3 neonPurple(float t) {
              // Base purple color
              vec3 baseColor = vec3(0.5, 0.0, 1.0);
              
              // Pulse effect
              float pulse = 0.5 + 0.5 * sin(t * 3.0);
              
              // Mix between darker and brighter purple
              return mix(
                baseColor * 0.5,  // darker purple
                vec3(0.8, 0.4, 1.0),  // brighter purple-pink
                pulse
              );
            }

            void main() {
              float t = vUv.y + time * 0.2;
              vec3 color = neonPurple(t);
              
              // Add glow effect
              float glow = 0.3 + 0.7 * (0.5 + 0.5 * sin(t * 4.0));
              color += vec3(0.2, 0.0, 0.4) * glow;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `,
          side: THREE.DoubleSide,
          wireframe: true,
        });
      }
    },
  };