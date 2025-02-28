// abilityComponents.js - Provides implementation for all ability effects
// Each ability has initialize and update methods similar to WorldComponents

export const abilityComponents = {
  // Onchain Trail ability - leaves a damaging trail behind the player
  OnchainTrail: {
    initialize(gameManager) {
      console.log("Initializing Onchain Trail ability");
      
      // Store a reference to the game manager
      this.gameManager = gameManager;
      
      // Create custom properties for this ability
      this.trailPieces = [];
      this.trailTimer = 0;
      this.trailInterval = 0.15; // Slightly faster trail generation
      this.trailLifetime = 3.0; // Longer lifetime for damage effect
      this.damagePerSecond = 1.0; // Damage dealt to enemies per second
      this.trailRadius = 0.5; // Collision radius for the trail pieces
      
      // Create a reusable box for collision detection
      this.trailCollisionBox = new THREE.Box3();
      
      // Override the default trail creation in GameManager
      gameManager.hasCustomTrail = true;
      
      console.log("Onchain Trail initialized, custom trail flag set:", gameManager.hasCustomTrail);
    },
    
    update(delta) {
      if (!this.gameManager || !this.gameManager.player) return;
      
      const gameManager = this.gameManager;
      
      // Create a trail piece at regular intervals when the player is moving
      this.trailTimer += delta;
      if (this.trailTimer >= this.trailInterval) {
        // Get keys from the imported keys object in GameManager
        const keys = gameManager.keys || window.keys;
        
        // Only create trail when player is moving
        if (keys && (keys.w || keys.a || keys.s || keys.d)) {
          console.log("Creating Onchain Trail piece");
          
          // Create a more dramatic trail piece for the ability
          const footSize = { width: 0.1, length: 0.5 }; // Larger footprint
          const footGeometry = new THREE.Shape();
          footGeometry.moveTo(-footSize.width, -footSize.length / 2);
          footGeometry.lineTo(-footSize.width, footSize.length / 2);
          footGeometry.quadraticCurveTo(0, footSize.length / 2 + 0.1, footSize.width, footSize.length / 2);
          footGeometry.lineTo(footSize.width, -footSize.length / 2);
          footGeometry.quadraticCurveTo(0, -footSize.length / 2 - 0.1, -footSize.width, -footSize.length / 2);

          const footShape = new THREE.ShapeGeometry(footGeometry);
          
          // Use a glowing material for the trail
          const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600, // Orange-red glow
            transparent: true,
            opacity: 0.8
          });

          const trailPiece = new THREE.Mesh(footShape, trailMaterial);
          trailPiece.position.copy(gameManager.player.position);
          trailPiece.rotation.x = -Math.PI / 2;
          trailPiece.rotation.z = gameManager.player.rotation.y + (this.trailPieces.length % 2 ? Math.PI / 6 : -Math.PI / 6);
          trailPiece.position.y += 0.01;
          trailPiece.birth = gameManager.clock.elapsedTime;
          trailPiece.damage = this.damagePerSecond; // Damage this trail piece can deal
          trailPiece.hasDealtDamage = new Set(); // Track which enemies this piece has damaged
          
          gameManager.scene.add(trailPiece);
          this.trailPieces.push(trailPiece);
          this.trailTimer = 0;
        }
      }
      
      // Process existing trail pieces - apply damage and fade out
      for (let i = this.trailPieces.length - 1; i >= 0; i--) {
        const piece = this.trailPieces[i];
        const age = gameManager.clock.elapsedTime - piece.birth;
        
        // Remove old trail pieces
        if (age > this.trailLifetime) {
          gameManager.scene.remove(piece);
          this.trailPieces.splice(i, 1);
          continue;
        }
        
        // Update opacity based on age
        piece.material.opacity = 0.8 * (1 - age / this.trailLifetime);
        
        // Apply damage to enemies that touch the trail
        this.trailCollisionBox.setFromCenterAndSize(
          piece.position,
          new THREE.Vector3(this.trailRadius, this.trailRadius, this.trailRadius)
        );
        
        // Get enemies in range using the octree
        const enemiesInRange = gameManager.dynamicOctree.query(this.trailCollisionBox);
        
        // Apply damage to each enemy in range
        for (const enemy of enemiesInRange) {
          // Skip if this trail piece has already damaged this enemy
          if (piece.hasDealtDamage.has(enemy.id)) continue;
          
          // Mark this enemy as damaged by this trail piece
          piece.hasDealtDamage.add(enemy.id);
          
          // Apply damage effect - for now, we'll just remove the enemy
          // In a more complex implementation, you could reduce enemy health
          console.log("Trail damaged enemy:", enemy.id);
          
          // Create a visual effect for the damage
          this.createDamageEffect(enemy.position);
          
          // Remove the enemy
          gameManager.enemyManager.removeEnemy(enemy);
          
          // Randomly drop an item (20% chance)
          if (Math.random() < 0.2) {
            this.dropAbilityItem(enemy.position);
          }
        }
      }
    },
    
    // Helper method to create a visual effect when an enemy is damaged
    createDamageEffect(position) {
      const gameManager = this.gameManager;
      
      // Create a burst particle effect
      const particleCount = 10;
      const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
      });
      
      for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Random velocity
        particle.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2,
          (Math.random() - 0.5) * 2
        );
        
        particle.life = 0.5; // Short lifetime
        particle.birth = gameManager.clock.elapsedTime;
        
        gameManager.scene.add(particle);
        
        // Add to a temporary array for updating
        if (!gameManager.particles) gameManager.particles = [];
        gameManager.particles.push(particle);
      }
    },
    
    // Helper method to drop an ability item
    dropAbilityItem(position) {
      const gameManager = this.gameManager;
      
      // Create a simple ability drop
      const dropGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const dropMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow for ability
      const drop = new THREE.Mesh(dropGeometry, dropMaterial);
      
      // Position the drop at the enemy's location
      drop.position.copy(position);
      
      // Add some rotation animation
      drop.userData.spinSpeed = 2.0;
      
      // Add the drop to the scene and track it
      gameManager.scene.add(drop);
      gameManager.droppedItems.push(drop);
    },
    
    // Cleanup method when ability is removed
    cleanup() {
      // Remove all trail pieces
      for (const piece of this.trailPieces) {
        this.gameManager.scene.remove(piece);
      }
      this.trailPieces = [];
      
      // Reset the custom trail flag
      this.gameManager.hasCustomTrail = false;
    }
  },
  
  // Add more abilities here following the same pattern
  FrontrunningBot: {
    initialize(gameManager) {
      console.log("Initializing Frontrunning Bot ability");
      
      // Store a reference to the game manager
      this.gameManager = gameManager;
      
      // Create custom properties for this ability
      this.botTimer = 0;
      this.botInterval = 5.0; // Spawn a bot every 5 seconds
      this.activeBots = [];
      this.botSpeed = 50.0; // Even more ridiculous high speed
      this.botLifetime = 2.0; // How long each bot lives
      this.botDamage = 5.0; // High damage for each bot hit
      
      // Create a reusable box for collision detection
      this.botCollisionBox = new THREE.Box3();
      
      // Create rainbow shader material
      this.createRainbowShaderMaterial();
    },
    
    createRainbowShaderMaterial() {
      // Define the vertex shader
      const vertexShader = `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      
      // Define the fragment shader for rainbow effect
      const fragmentShader = `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        vec3 hsb2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0);
          rgb = rgb*rgb*(3.0-2.0*rgb);
          return c.z * mix(vec3(1.0), rgb, c.y);
        }
        
        void main() {
          // Create a more dynamic rainbow effect
          float hue = vUv.y + sin(vUv.x * 10.0 + time) * 0.1 + time * 0.3;
          
          // Add some vertical bands
          hue += sin(vUv.y * 20.0 + time * 2.0) * 0.05;
          
          // Create a pulsing effect
          float brightness = 0.9 + sin(time * 3.0) * 0.1;
          float saturation = 0.8 + sin(time * 5.0) * 0.2;
          
          // Generate the rainbow color
          vec3 color = hsb2rgb(vec3(hue, saturation, brightness));
          
          // Add a glowing edge effect
          float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          edge *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
          
          // Combine the colors with the edge glow
          color = mix(color, vec3(1.0, 1.0, 1.0), 1.0 - edge);
          
          // Set the final color with transparency
          gl_FragColor = vec4(color, 0.8);
        }
      `;
      
      // Create the shader material
      this.rainbowMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        side: THREE.DoubleSide
      });
    },
    
    update(delta) {
      if (!this.gameManager || !this.gameManager.player) return;
      
      const gameManager = this.gameManager;
      
      // Update the time uniform for the rainbow shader
      if (this.rainbowMaterial) {
        this.rainbowMaterial.uniforms.time.value += delta;
      }
      
      // Spawn a new bot every interval
      this.botTimer += delta;
      if (this.botTimer >= this.botInterval) {
        this.spawnBot();
        this.botTimer = 0;
      }
      
      // Update existing bots
      for (let i = this.activeBots.length - 1; i >= 0; i--) {
        const bot = this.activeBots[i];
        
        // Move the bot forward in its stored direction
        if (bot.direction) {
          bot.position.x += bot.direction.x * this.botSpeed * delta;
          bot.position.z += bot.direction.z * this.botSpeed * delta;
        } else {
          // Fallback to translateZ if direction is not set (should not happen)
          bot.translateZ(this.botSpeed * delta);
        }
        
        // Update lifetime
        bot.life -= delta;
        
        // Remove expired bots
        if (bot.life <= 0) {
          gameManager.scene.remove(bot);
          this.activeBots.splice(i, 1);
          continue;
        }
        
        // Create a collision box around the bot's position
        // Use a larger box that extends in front of the bot in its direction of travel
        const boxSize = 3.0; // Larger collision box
        const forwardExtension = 2.0; // Extend box forward in direction of travel
        
        // Calculate the forward offset based on the bot's direction
        const forwardOffset = {
          x: bot.direction ? bot.direction.x * forwardExtension : 0,
          z: bot.direction ? bot.direction.z * forwardExtension : 0
        };
        
        this.botCollisionBox.min.set(
          bot.position.x - boxSize + forwardOffset.x, 
          bot.position.y - 0.5, 
          bot.position.z - boxSize + forwardOffset.z
        );
        this.botCollisionBox.max.set(
          bot.position.x + boxSize + forwardOffset.x, 
          bot.position.y + 0.5, 
          bot.position.z + boxSize + forwardOffset.z
        );
        
        // Get enemies in range using the octree
        const enemiesInRange = gameManager.dynamicOctree.query(this.botCollisionBox);
        
        // Apply damage to each enemy in range
        for (const enemy of enemiesInRange) {
          // Skip if this bot has already damaged this enemy
          if (bot.hasDealtDamage.has(enemy.id)) continue;
          
          // Simple distance check for more reliable collision
          const distanceSq = bot.position.distanceToSquared(enemy.position);
          const collisionThreshold = 9.0; // Even larger collision radius (3^2)
          
          if (distanceSq < collisionThreshold) {
            // Mark this enemy as damaged by this bot
            bot.hasDealtDamage.add(enemy.id);
            
            // Create a visual effect for the damage
            this.createBotImpactEffect(enemy.position);
            
            // Remove the enemy
            gameManager.enemyManager.removeEnemy(enemy);
            
            // Randomly drop an item (30% chance)
            if (Math.random() < 0.3) {
              this.dropAbilityItem(enemy.position);
            }
          }
        }
      }
    },
    
    spawnBot() {
      const gameManager = this.gameManager;
      
      // Create a triangle geometry for the bot
      const triangleGeometry = new THREE.BufferGeometry();
      
      // Define vertices for a triangle pointing in the Z direction (forward in the game)
      // Make it even larger for better visibility and collision
      const vertices = new Float32Array([
        0, 0, 0,        // bottom center
        -1.5, 0, 3.0,   // top left (wider and taller)
        1.5, 0, 3.0     // top right (wider and taller)
      ]);
      
      // Add UVs for proper shader rendering
      const uvs = new Float32Array([
        0.5, 0.0,  // bottom center
        0.0, 1.0,  // top left
        1.0, 1.0   // top right
      ]);
      
      triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      triangleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      triangleGeometry.computeVertexNormals();
      
      // Create the bot mesh with the rainbow shader material
      const bot = new THREE.Mesh(triangleGeometry, this.rainbowMaterial.clone());
      
      // Position at player's feet and orient in player's facing direction
      bot.position.copy(gameManager.player.position);
      bot.position.y = 0.01; // Just above the ground
      
      // Rotate to face in the player's direction
      bot.rotation.y = gameManager.player.rotation.y;
      
      // Add properties for tracking
      bot.life = this.botLifetime;
      bot.birth = gameManager.clock.elapsedTime;
      bot.hasDealtDamage = new Set();
      bot.direction = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.rotation.y);
      
      // Add to scene and tracking array
      gameManager.scene.add(bot);
      this.activeBots.push(bot);
      
      // Create a spawn effect
      this.createBotSpawnEffect(bot.position);
      
      console.log("Spawned Frontrunning Bot");
    },
    
    createBotSpawnEffect(position) {
      const gameManager = this.gameManager;
      
      // Create a burst of particles
      const particleCount = 15;
      const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff, // Cyan for bot spawn
        transparent: true,
        opacity: 0.8
      });
      
      for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Random velocity in upward cone
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particle.velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          1 + Math.random() * 2,
          Math.sin(angle) * speed
        );
        
        particle.life = 0.5; // Short lifetime
        particle.birth = gameManager.clock.elapsedTime;
        
        gameManager.scene.add(particle);
        
        // Add to particles array for updating
        if (!gameManager.particles) gameManager.particles = [];
        gameManager.particles.push(particle);
      }
    },
    
    createBotImpactEffect(position) {
      const gameManager = this.gameManager;
      
      // Create a burst of particles
      const particleCount = 20;
      const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
      
      for (let i = 0; i < particleCount; i++) {
        // Create a particle with random rainbow color
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
        
        const particleMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Random velocity in all directions
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        particle.velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.random() * 3,
          Math.sin(angle) * speed
        );
        
        particle.life = 0.7; // Short lifetime
        particle.birth = gameManager.clock.elapsedTime;
        
        gameManager.scene.add(particle);
        
        // Add to particles array for updating
        if (!gameManager.particles) gameManager.particles = [];
        gameManager.particles.push(particle);
      }
      
      // Add a flash effect
      const flashGeometry = new THREE.SphereGeometry(1, 16, 16);
      const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7
      });
      
      const flash = new THREE.Mesh(flashGeometry, flashMaterial);
      flash.position.copy(position);
      flash.scale.set(0.1, 0.1, 0.1);
      flash.life = 0.3;
      flash.birth = gameManager.clock.elapsedTime;
      
      gameManager.scene.add(flash);
      gameManager.particles.push(flash);
      
      // Add a scaling animation to the flash
      flash.update = (delta) => {
        flash.scale.multiplyScalar(1.2);
        flash.material.opacity -= delta * 3;
      };
    },
    
    // Helper method to drop an ability item
    dropAbilityItem(position) {
      const gameManager = this.gameManager;
      
      // Create a simple ability drop
      const dropGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const dropMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow for ability
      const drop = new THREE.Mesh(dropGeometry, dropMaterial);
      
      // Position the drop at the enemy's location
      drop.position.copy(position);
      
      // Add some rotation animation
      drop.userData.spinSpeed = 2.0;
      
      // Add the drop to the scene and track it
      gameManager.scene.add(drop);
      gameManager.droppedItems.push(drop);
    },
    
    // Cleanup method when ability is removed
    cleanup() {
      // Remove all active bots
      for (const bot of this.activeBots) {
        this.gameManager.scene.remove(bot);
      }
      this.activeBots = [];
    }
  },
  
  // Glowing Hair ability - creates beautiful particle hair effect around the player
  DebtDrown: {
    initialize(gameManager) {
      console.log("Initializing Glowing Hair ability");
      
      // Store a reference to the game manager
      this.gameManager = gameManager;
      
      // Create custom properties for this ability
      this.particles = [];
      this.particleCount = 100; // Number of hair particles
      this.particleLifetime = 1.5; // How long each particle lives
      this.spawnTimer = 0;
      this.spawnInterval = 0.05; // Spawn particles frequently
      this.hairLength = 1.5; // Length of the hair strands
      this.hairColors = [
        new THREE.Color(0xff0000), // Red
        new THREE.Color(0xff7f00), // Orange
        new THREE.Color(0xffff00), // Yellow
        new THREE.Color(0x00ff00), // Green
        new THREE.Color(0x0000ff), // Blue
        new THREE.Color(0x4b0082), // Indigo
        new THREE.Color(0x9400d3)  // Violet
      ];
      
      // Create the initial batch of particles
      this.createHairParticles(this.particleCount);
    },
    
    update(delta) {
      if (!this.gameManager || !this.gameManager.player) return;
      
      const gameManager = this.gameManager;
      const player = gameManager.player;
      
      // Define the slow down range and factor
      const slowDownRange = 5.0; // Range within which enemies are slowed
      const slowDownFactor = 0.5; // Factor by which to slow down enemies
      const minSpeed = 0.5; // Minimum speed threshold to prevent stopping completely

      // Check for enemies in range
      const enemiesInRange = gameManager.dynamicOctree.query(new THREE.Box3().setFromCenterAndSize(player.position, new THREE.Vector3(slowDownRange, slowDownRange, slowDownRange)));

      // Slow down enemies that are close
      for (const enemy of enemiesInRange) {
        if (enemy.speed) { // Assuming enemies have a speed property
          enemy.speed = Math.max(enemy.speed * slowDownFactor, minSpeed); // Gradually reduce speed but not below minSpeed
          console.log(`Slowing down enemy: ${enemy.id}, new speed: ${enemy.speed}`);
        }
      }

      // Spawn new particles at regular intervals
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.createHairParticles(5); // Add a few new particles each time
        this.spawnTimer = 0;
      }
      
      // Update existing particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        
        // Update lifetime
        particle.life -= delta;
        
        // Remove expired particles
        if (particle.life <= 0) {
          gameManager.scene.remove(particle);
          this.particles.splice(i, 1);
          continue;
        }
        
        // Calculate normalized life (1.0 to 0.0)
        const normalizedLife = particle.life / this.particleLifetime;
        
        // Update position - follow the player with slight delay
        const targetPosition = new THREE.Vector3(
          player.position.x + particle.offset.x,
          player.position.y + particle.offset.y,
          player.position.z + particle.offset.z
        );
        
        // Apply player rotation to the offset
        targetPosition.sub(player.position)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y)
          .add(player.position);
        
        // Smooth movement with lerp
        particle.position.lerp(targetPosition, 0.1);
        
        // Add some gentle floating motion
        const time = gameManager.clock.elapsedTime;
        particle.position.y += Math.sin(time * particle.floatSpeed) * 0.003;
        particle.position.x += Math.cos(time * particle.floatSpeed * 0.7) * 0.002;
        particle.position.z += Math.sin(time * particle.floatSpeed * 0.5) * 0.002;
        
        // Update opacity based on life
        particle.material.opacity = normalizedLife * 0.7;
        
        // Scale down slightly as they age
        const scale = 0.8 + normalizedLife * 0.2;
        particle.scale.set(scale, scale, scale);
      }
    },
    
    createHairParticles(count) {
      const gameManager = this.gameManager;
      const player = gameManager.player;
      
      if (!player) return;
      
      for (let i = 0; i < count; i++) {
        // Create a small glowing particle
        const size = 0.03 + Math.random() * 0.05;
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        
        // Choose a random color from our palette
        const colorIndex = Math.floor(Math.random() * this.hairColors.length);
        const color = this.hairColors[colorIndex].clone();
        
        // Add slight variation to the color
        color.r += (Math.random() - 0.5) * 0.1;
        color.g += (Math.random() - 0.5) * 0.1;
        color.b += (Math.random() - 0.5) * 0.1;
        
        const material = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.7
        });
        
        const particle = new THREE.Mesh(geometry, material);
        
        // Position around the player's head
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.3 + Math.random() * 0.3; // Distance from head center
        const height = 1.7 + (Math.random() - 0.5) * 0.3; // Head height
        
        // Calculate offset from player position
        particle.offset = new THREE.Vector3(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
        
        // Add some variation to hair length
        const hairDirection = new THREE.Vector3(
          particle.offset.x,
          -this.hairLength * (0.5 + Math.random() * 0.5), // Downward with variation
          particle.offset.z
        ).normalize();
        
        // Scale the direction by a random amount for varied hair length
        const hairScale = this.hairLength * (0.7 + Math.random() * 0.3);
        hairDirection.multiplyScalar(hairScale);
        
        // Add the hair direction to the offset
        particle.offset.add(hairDirection);
        
        // Set initial position
        particle.position.copy(player.position).add(particle.offset);
        
        // Add properties for animation
        particle.life = this.particleLifetime * (0.7 + Math.random() * 0.3);
        particle.floatSpeed = 1 + Math.random() * 2;
        particle.birth = gameManager.clock.elapsedTime;
        
        // Add to scene and tracking array
        gameManager.scene.add(particle);
        this.particles.push(particle);
      }
    },
    
    // Cleanup method when ability is removed
    cleanup() {
      // Remove all particles
      for (const particle of this.particles) {
        this.gameManager.scene.remove(particle);
      }
      this.particles = [];
    }
  }
};

// AbilityManager class to handle active abilities
export class AbilityManager {
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.activeAbilities = new Map(); // Map of active abilities
  }
  
  // Add an ability to the player
  addAbility(abilityName) {
    // Check if the ability exists in the components
    if (!abilityComponents[abilityName]) {
      console.error(`Ability ${abilityName} not found in abilityComponents`);
      return false;
    }
    
    // Check if the ability is already active
    if (this.activeAbilities.has(abilityName)) {
      console.log(`Ability ${abilityName} is already active`);
      return false;
    }
    
    // Create a new instance of the ability
    const ability = Object.create(abilityComponents[abilityName]);
    
    // Initialize the ability
    ability.initialize(this.gameManager);
    
    // Add to active abilities
    this.activeAbilities.set(abilityName, ability);
    
    console.log(`Ability ${abilityName} activated`);
    return true;
  }
  
  // Remove an ability from the player
  removeAbility(abilityName) {
    const ability = this.activeAbilities.get(abilityName);
    if (!ability) return false;
    
    // Call cleanup if it exists
    if (ability.cleanup) {
      ability.cleanup();
    }
    
    // Remove from active abilities
    this.activeAbilities.delete(abilityName);
    
    console.log(`Ability ${abilityName} deactivated`);
    return true;
  }
  
  // Update all active abilities
  update(delta) {
    this.activeAbilities.forEach(ability => {
      if (ability.update) {
        ability.update(delta);
      }
    });
  }
  
  // Check if an ability is active
  hasAbility(abilityName) {
    return this.activeAbilities.has(abilityName);
  }
  
  // Get all active ability names
  getActiveAbilityNames() {
    return Array.from(this.activeAbilities.keys());
  }
  
  // Clear all abilities
  clearAllAbilities() {
    this.activeAbilities.forEach((ability, name) => {
      this.removeAbility(name);
    });
  }
} 