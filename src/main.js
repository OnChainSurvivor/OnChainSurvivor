import { GameManager } from './game/GameManager.js';
import { initRenderer } from './game/Renderer.js';
import { initiateJoystick } from './input/Joystick.js';
import { setupUI,  hideUI } from './ui/UI.js';
import { worlds } from './game/worldsConfig.js';
//import { initWeb3 } from './web3/contract.js';

// Initialize Three.js renderer, scene, and camera
initRenderer();

// Load the selected world from local storage and set it as the default world
let defaultWorld = null;
const savedWorld = localStorage.getItem('selectedWorld');
if (savedWorld) {
  try {
    // Parse the stored world (assumes it was saved as a JSON string)
    const parsedWorld = JSON.parse(savedWorld);
    // Look up the matching world config from the worlds array (fallback to the first world if not found)
    defaultWorld = worlds.find(world => world.title === parsedWorld.title) || worlds[0];
  } catch (error) {
    console.error('Error loading world from local storage:', error);
    defaultWorld = worlds[0];
  }
} else {
  defaultWorld = worlds[0];
}

// Initialize input (movement and shooting joysticks) and UI elements
initiateJoystick();
setupUI();

// Instantiate and start the game with the selected world
const game = new GameManager(defaultWorld);
game.start();

// Game state variable tracking whether the main menu overlay is hidden.
let gameStarted = false;

/**
 * Called to begin the gameplay.
 * Fades out the main menu UI and shows the Exit button.
 */
function startGame() {
  if (!gameStarted) {
    hideUI();
    game.run();
    gameStarted = true;
  }
}

// Listen for WASD keys to start the game.
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!gameStarted && ["w", "a", "s", "d"].includes(key)) {
    startGame();
  }
});

// Listen for movement joystick events.
// When the left joystick is activated, change the start prompt to "Move to play" and start the game.
document.addEventListener("joystickMoveInitiated", () => {
  if (!gameStarted) {
    startGame();
  }
});