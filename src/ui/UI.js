// UI.js - Provides helper functions to create and manage UI elements

// Module-scoped variables for the main menu root and exit button.
let mainMenuUI;
let exitButton;

// Import the setCanMove function from the joystick module
import { setCanMove } from '../input/Joystick.js';

/**
 * Creates and returns a title element.
 * @param {string} text - The text content of the title.
 * @param {string} [type="h1"] - The HTML tag to use, e.g., "h1", "h2", "h3".
 * @returns {HTMLElement}
 */
export function createTitleElement(text, type = "h1") {
  const el = document.createElement(type);
  el.textContent = text;
  el.style.whiteSpace = "pre-line";
  el.className = type; // you can assign a default class based on type
  el.classList.add('rainbow-text');
  return el;
}

/**
 * Creates a container element and assigns classes and inline styles.
 * @param {Array<string>} classList - Array of CSS class names.
 * @param {Object} [styles={}] - Object of inline CSS styles.
 * @returns {HTMLElement}
 */
export function createContainer(classList = [], styles = {}) {
  const container = document.createElement("div");
  classList.forEach(cls => container.classList.add(cls));
  Object.assign(container.style, styles);
  return container;
}

/**
 * Creates a button element with the given configuration.
 * @param {Object} config - Button configuration (title, description, thumbnail, effect).
 * @param {number} [scale=1] - Optional scale factor for sizing.
 * @returns {HTMLElement}
 */
export function createButton(config, scale = 1) {
  const btn = document.createElement("button");
  btn.textContent = config.title;
  btn.title = config.description;
  // If a thumbnail is provided, use it as a background image.
  if (config.thumbnail) {
    btn.style.backgroundImage = `url('${config.thumbnail}')`;
    btn.style.backgroundSize = "cover";
    btn.style.backgroundPosition = "center";
  }
  // Optionally store the effect function for later use (if needed)
  btn.effect = config.effect;
  // Adjust the button size based on the scale factor
  btn.style.transform = `scale(${scale})`;
  return btn;
}

/**
 * Append one or more elements to a container with the given ID.
 * @param {string} containerId - The id of the container in the DOM.
 * @param {Array<HTMLElement>} elements - An array of elements to append.
 */
export function addContainerUI(containerId, elements = []) {
  const container = document.getElementById(containerId);
  if (container) {
    elements.forEach(el => container.appendChild(el));
  } else {
    console.warn(`Container with id "${containerId}" not found.`);
  }
}

/**
 * Creates and returns the settings menu overlay element.
 * @returns {HTMLElement}
 */
function createSettingsMenu() {
  const settingsContainer = document.createElement("div");
  settingsContainer.className = "settings-menu";
  Object.assign(settingsContainer.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "1000",
    display: "none" // Initially hidden
  });

  const innerMenu = document.createElement("div");
  innerMenu.className = "settings-inner-menu";
  Object.assign(innerMenu.style, {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    width: "300px",
    textAlign: "center"
  });

  // Header
  const header = document.createElement("h2");
  header.textContent = "Settings";
  innerMenu.appendChild(header);

  // Sample setting: Volume control
  const volumeContainer = document.createElement("div");
  volumeContainer.style.margin = "10px 0";
  const volumeLabel = document.createElement("label");
  volumeLabel.textContent = "Volume:";
  volumeLabel.style.marginRight = "10px";
  const volumeInput = document.createElement("input");
  volumeInput.type = "range";
  volumeInput.min = "0";
  volumeInput.max = "100";
  volumeInput.value = "50";
  volumeContainer.appendChild(volumeLabel);
  volumeContainer.appendChild(volumeInput);
  innerMenu.appendChild(volumeContainer);

  // Sample setting: Toggle sound on/off
  const soundContainer = document.createElement("div");
  soundContainer.style.margin = "10px 0";
  const soundLabel = document.createElement("label");
  soundLabel.textContent = "Sound:";
  soundLabel.style.marginRight = "10px";
  const soundCheckbox = document.createElement("input");
  soundCheckbox.type = "checkbox";
  soundCheckbox.checked = true;
  soundContainer.appendChild(soundLabel);
  soundContainer.appendChild(soundCheckbox);
  innerMenu.appendChild(soundContainer);

  // Close button to hide the settings menu
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.marginTop = "10px";
  closeButton.addEventListener("click", function() {
    settingsContainer.style.display = "none";
    setCanMove(true); // Re-enable joystick input when settings menu is closed
  });
  innerMenu.appendChild(closeButton);

  settingsContainer.appendChild(innerMenu);
  return settingsContainer;
}

/**
 * Sets up the UI elements including the main menu overlay and the Exit button.
 * The main menu includes:
 * - Top container: Game title.
 * - Bottom container: "Move to start".
 * - Top right container: Web3 LogIn.
 * - Bottom Right: Settings icon.
 * And separately, an Exit button in the Top Right.
 */
export function setupUI() {
  // Create the main menu root container
  mainMenuUI = document.createElement("div");
  mainMenuUI.id = "mainMenuUI";
  Object.assign(mainMenuUI.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "1000",
    opacity: "1",
    transition: "opacity 500ms ease",
    pointerEvents: "auto",
    backgroundColor: "rgba(0, 0, 0, 0.5)" // Semi-transparent background so the cube remains visible.
  });

  // Top container: Game title ("Onchain Survivor")
  const topContainer = createContainer(['top-container'], {});
  topContainer.appendChild(createGameTitle());
  mainMenuUI.appendChild(topContainer);

  // Bottom container: "Move to start" text
  const bottomContainer = createContainer(['bottom-container'], {});
  bottomContainer.appendChild(createTitleElement("Move to start", "h2"));
  mainMenuUI.appendChild(bottomContainer);

  // Left container: Web3 LogIn
  const TopRightContainer = createContainer(['TR-container'], { });
  TopRightContainer.appendChild(createTitleElement("Web3\nLogIn", "h2"));
  mainMenuUI.appendChild(TopRightContainer);

  // Bottom Right container: Settings icon and settings menu overlay
  const settingsTrigger = createContainer(['BR-container'], {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    cursor: "pointer"
  });
  settingsTrigger.appendChild(createTitleElement("⚙️", "h2"));
  const settingsMenu = createSettingsMenu();
  mainMenuUI.appendChild(settingsMenu);
  settingsTrigger.addEventListener("click", function() {
    settingsMenu.style.display = "flex";
    setCanMove(false); // Disable joystick input when settings menu is opened
  });
  mainMenuUI.appendChild(settingsTrigger);

  // Append the main menu UI to the document
  document.body.appendChild(mainMenuUI);

  // Create the Exit button in the Top Right (TR container) - initially hidden.
  const exitContainer = createContainer(['TR-container'], {
    position: "fixed",
    top: "20px",
    right: "20px",
    display: "none",
    cursor: "pointer",
    zIndex: "1100", // above the main menu UI
    opacity: "0",   // start fully transparent
    transition: "opacity 500ms ease"
  });
  exitButton = document.createElement("button");
  exitButton.textContent = "Exit";
  exitButton.style.padding = "10px 20px";
  exitContainer.appendChild(exitButton);
  document.body.appendChild(exitContainer);
}

/**
 * Returns a Promise that fades out the main menu UI (over the given duration) and then hides it.
 * @param {number} [duration=500] - Duration in milliseconds.
 * @returns {Promise}
 */
export function fadeOutMainMenu(duration = 500) {
  return new Promise(resolve => {
    if (mainMenuUI) {
      mainMenuUI.style.opacity = "0";
      setTimeout(() => {
        mainMenuUI.style.display = "none";
        resolve();
      }, duration);
    } else {
      resolve();
    }
  });
}

/**
 * Fades in the main menu UI (over the given duration).
 * @param {number} [duration=500] - Duration in milliseconds.
 */
export function fadeInMainMenu(duration = 500) {
  if (mainMenuUI) {
    mainMenuUI.style.display = "block";
    // Force a reflow so the transition works.
    void mainMenuUI.offsetWidth;
    mainMenuUI.style.opacity = "1";
  }
}

/**
 * Returns the Exit button element.
 * @returns {HTMLElement}
 */
export function getExitButton() {
  return exitButton;
}

/**
 * Fades in the Exit button (by fading in its parent container).
 */
export function showExitButton() {
  const exitContainer = getExitButton().parentElement;
  exitContainer.style.display = "block";
  // Force reflow so transition applies.
  void exitContainer.offsetWidth;
  exitContainer.style.opacity = "1";
}

/**
 * Fades out the Exit button (by fading out its parent container).
 */
export function hideExitButton() {
  const exitContainer = getExitButton().parentElement;
  exitContainer.style.opacity = "0";
  setTimeout(() => {
    exitContainer.style.display = "none";
  }, 500); // Wait for the transition to complete.
}

function createGameTitle() {
  return createTitleElement("Onchain Survivor");
}