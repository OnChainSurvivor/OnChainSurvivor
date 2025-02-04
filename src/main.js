import { GameManager } from './game/GameManager.js';
import { initRenderer } from './game/Renderer.js';
import { initiateJoystick } from './input/Joystick.js';
import { 
  setupUI, 
  fadeOutMainMenu, 
  fadeInMainMenu, 
  getExitButton,
  showExitButton,
  hideExitButton
} from './ui/UI.js';
//import { initWeb3 } from './web3/contract.js';

// Initialize Three.js renderer, scene, and camera
initRenderer();

// Initialize input (joystick setup) and UI elements (menu, overlays, etc.)
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
    // Fade out the main menu UI over 500ms, then show the Exit button.
    fadeOutMainMenu(500).then(() => {
      showExitButton();
    });
    gameStarted = true;
  }
}

// Listen for WASD keys.
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!gameStarted && ["w", "a", "s", "d"].includes(key)) {
    startGame();
  }
});

// Listen for joystick movement.
document.addEventListener("joystickMoveInitiated", () => {
  if (!gameStarted) {
    startGame();
  }
});

// Add handler to the Exit button that brings the UI back to the main menu.
// Note: We no longer stop the game so that the cube remains visible.
getExitButton().addEventListener("click", function() {
  if (gameStarted) {
    hideExitButton();
    fadeInMainMenu(500);
    gameStarted = false;
  }
});
