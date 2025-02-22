import { GameManager } from './game/GameManager.js';
import { initRenderer } from './game/Renderer.js';
import { initiateJoystick } from './input/Joystick.js';
import { setupUI,  hideUI } from './ui/UI.js';
//import { initWeb3 } from './web3/contract.js';

// Initialize Three.js renderer, scene, and camera
initRenderer();

// Initialize input (movement and shooting joysticks) and UI elements
initiateJoystick();
setupUI();

// Instantiate and start the game immediately so the cube is visible.
const game = new GameManager();
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