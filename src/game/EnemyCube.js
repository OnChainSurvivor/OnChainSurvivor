import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';

export class EnemyCubeManager {
    constructor(maxEnemies = 100) {
        // Create a simple cube geometry
        this.geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.instancedMesh = new THREE.InstancedMesh(
            this.geometry,
            new THREE.MeshBasicMaterial({ color: 0xff0000 }),
            maxEnemies
        );
        
        this.activeEnemies = new Set();
        this.availableIds = Array.from({length: maxEnemies}, (_, i) => i);
        this.matrix = new THREE.Matrix4();
        this.tempVector = new THREE.Vector3();
        
        // Hide all instances initially
        for (let i = 0; i < maxEnemies; i++) {
            this.matrix.makeTranslation(0, -1000, 0);
            this.instancedMesh.setMatrixAt(i, this.matrix);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    addEnemy(position) {
        if (this.availableIds.length === 0) return null;
        
        const instanceId = this.availableIds.pop();
        const enemy = {
            id: instanceId,
            position: position.clone(),
            active: true,
            speed: 1.5
        };
        
        this.matrix.makeTranslation(position.x, position.y, position.z);
        this.instancedMesh.setMatrixAt(instanceId, this.matrix);
        this.activeEnemies.add(enemy);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        
        return enemy;
    }

    removeEnemy(enemy) {
        if (!enemy) return;
        this.activeEnemies.delete(enemy);
        this.availableIds.push(enemy.id);
        this.matrix.makeTranslation(0, -1000, 0);
        this.instancedMesh.setMatrixAt(enemy.id, this.matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    update(delta, playerPosition) {
        for (const enemy of this.activeEnemies) {
            this.tempVector.subVectors(playerPosition, enemy.position).normalize();
            enemy.position.addScaledVector(this.tempVector, enemy.speed * delta);
            
            this.matrix.makeTranslation(
                enemy.position.x,
                enemy.position.y,
                enemy.position.z
            );
            this.instancedMesh.setMatrixAt(enemy.id, this.matrix);
        }
        
        if (this.activeEnemies.size > 0) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
        }
    }

    getActiveEnemies() {
        return Array.from(this.activeEnemies);
    }

    respawnEnemy(enemy, newPosition) {
        if (!enemy) return;
        
        // Update the enemy's position
        enemy.position.copy(newPosition);
        
        // Ensure the enemy is marked as active
        enemy.active = true;
        
        // Update the instance matrix for this enemy
        this.matrix.makeTranslation(newPosition.x, newPosition.y, newPosition.z);
        this.instancedMesh.setMatrixAt(enemy.id, this.matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    getOldestEnemy() {
        return this.activeEnemies.values().next().value;
    }
} 