// UI.js - Provides helper functions to create and manage UI elements

// Module-scoped variables for the main menu root and exit button.
let mainMenuUI;
let exitButton;

// Import the setCanMove function from the joystick module
import { setCanMove } from '../input/Joystick.js';
//Import AbilityTypes to fill Abilities Album
import { abilityTypes } from '../abilityCards.js';
//Import playerTypes to fill Character Album
import { playerTypes } from '../characterCards.js';
//Import WorldTypes to fill world Album 
import { worldTypes } from '../worldCards.js';

/**
 * Creates and returns a title element.
 * @param {string} text - The text content of the title.
 * @param {string} classCSS - The CSS class of the main style document to apply tag to use, e.g., "title", "minititle".
 * @returns {HTMLElement}
 */
export function createTitleElement (text, classCSS) {
  const element = document.createElement('div');
  element.innerText = text;
  element.classList.add(classCSS); 
  element.classList.add('rainbow-text'); 
  return element;
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

export function createTitleContainer(text) {
  const container = document.createElement('div');
  container.classList.add('choose-menu-title');
  const title = createTitleElement(text, "title"); 
  container.appendChild(title);
  return container;
}

/**
 * Creates a menu element to choose from any given list.
 * @param {Array<string>} entityList - Array of CSS class names.
 * @param {Object} text - Object of inline CSS styles.
 * @returns {HTMLElement}
 */
export function createChooseMenu(entityList, text, type) {
  const popUpContainer = createContainer(['choose-menu-container']);;
  const titleContainer = createTitleContainer(text);
  const gridContainer = createContainer(['choose-menu-grid']); 
  addContainerUI('center-container', [popUpContainer]);
  entityList.forEach(entity => {
      const itemButton = createButton(entity, 1);
      gridContainer.appendChild(itemButton);
      itemButton.onclick = () => handleEntitySelection(entity, type);
  });
  popUpContainer.appendChild(titleContainer);
  popUpContainer.appendChild(gridContainer);
}

/**
 * Creates a button element with the given configuration.
 * @param {Object} config - Button configuration (title, description, thumbnail, effect).
 * @param {number} [scale=1] - Optional scale factor for sizing.
 * @returns {HTMLElement}
 */
export function createButton(dataType, scale = 1, onClick) {
  const button = document.createElement('button');
  button.style.width = `${175 * scale}px`;
  button.style.margin = '3px';
  button.style.display = 'flex';
  button.style.flexDirection = 'column';
  button.style.alignItems = 'center';
  button.style.backgroundColor = 'black';
  button.style.overflow = 'hidden';
  button.style.padding = '0';
  button.style.cursor = 'pointer';
  button.style.fontFamily = 'Arial, sans-serif';

  button.style.border = '1px solid transparent'; 
  button.style.borderImageSlice = 1; 
  button.style.borderImageSource = 'linear-gradient(45deg, red, orange, yellow, green, deepskyblue, blueviolet, violet)'; 

  const title = document.createElement('div');
  title.innerText = dataType.title;
  title.style.fontSize = `${20 * scale}px`;
  title.classList.add('rainbow-text'); 
  title.style.height = `${2.5 * scale}em`; 
  title.style.lineHeight = `${1.5 * scale}em`;
  title.style.overflow = 'hidden';
  title.style.textAlign = 'center'; 
  title.style.display = scale > 0.751 ? 'flex' : 'none';  
  title.style.alignItems = 'center';
  title.style.justifyContent = 'center';
  title.style.padding = `${5 * scale}px 0`;

  const img = document.createElement('img');
  img.src = dataType.thumbnail;
  img.style.width = `${150 * scale}px`;
  img.style.height = `${150 * scale}px`;

  const description = document.createElement('div');
  description.innerText = `${dataType.description}`;
  description.style.fontSize = `${14.5 * scale}px`;
  description.classList.add('rainbow-text'); 

  description.style.height = `${5 * scale}em`; 
  description.style.lineHeight = `${1 * scale}em`; 
  description.style.overflow = 'hidden'; 
  description.style.textAlign = 'center';
  description.style.alignItems = 'center'; 
  description.style.justifyContent = 'center';
  description.style.padding = `${5 * scale}px`;
  description.style.display = scale > 0.751 ? 'flex' : 'none'; 

  button.appendChild(title);
  button.appendChild(img);
  button.appendChild(description);
  
  if (onClick) button.onclick = onClick;

  return button;
}

/**
 * Append one or more elements to a container with the given ID.
 * @param {string} location - The CSS class location of the container in the DOM.
 * @param {Array<HTMLElement>} uiElements - An array of elements to append.
 */
export function  addContainerUI(location,uiElements){
  const container = document.createElement('div');
  document.body.appendChild(container);
  container.classList.add(location, 'fade-in');
  uiElements.forEach(element => {
      container.appendChild(element);
  });
  uiContainers.push(container);
  setTimeout(() => {container.classList.add('show'); }, 10);
  return container;
}  

/**
 * removes all elements of a container, with a second fade in effect.
 */
export function hideUI(){
  uiContainers.forEach(container => {
  container.classList.add('fade-out'); 
  setTimeout(() => { container.classList.add('hide'); }, 10);
  setTimeout(() => {
      while (container.firstChild) {
          container.removeChild(container.firstChild);
      }
      container.parentNode.removeChild(container);}, 1000);
      })
  uiContainers.length = 0;
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

let player;
let ability;
let world;


  let selectedPlayer = playerTypes[0]; 
  let selectedAbility = playerTypes[0];
  let selectedWorld = worldTypes[0]; 


  function createRandomRunEffect(button, images, finalImageIndex, scale, category) {
    if (!spinningStates[category])
    return;
    const imgContainer = document.createElement('div');
    imgContainer.style.position = 'relative';
    imgContainer.style.height = `${150 * scale}px`; 
    imgContainer.style.width = `${150 * scale}px`; 

    images = images.concat(images); 

    images.forEach((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = `${150 * scale}px`;
        img.style.height = `${150 * scale}px`;
        img.style.display = 'block';
        imgContainer.appendChild(img);
    });

    button.innerHTML = ''; 
    button.appendChild(imgContainer);

    const totalHeight = images.length * 150 * scale;
    let currentTop = 0;
    let speed = (Math.random() * 0.5 + 0.25) * Math.sign(Math.random() + 0.5);
    function spin() {
        if (spinningStates[category]) {
            currentTop -= speed;
            if (currentTop <= -totalHeight / 2) {
                currentTop = 0;
            }
            imgContainer.style.transform = `translateY(${currentTop}px)`;
        }
        requestAnimationFrame(spin); 
    }
    spin();
    button.parentElement.addEventListener('click', () => {
     //   spinningStates[category] = false;
    });
}
let spinningStates = {
  class: true,
  ability: true,
  world: true
};

world = worldTypes[0];
ability = playerTypes[0];
player = playerTypes[0];
const uiContainers = [];

export function setupUI() {
  const mainTitle = createTitleElement('🏆⚔️🔗\nOnchain Survivor','title');
  const worldTitle = createTitleElement(world.title,"minititle");
  const miniTitle = createTitleElement('Move To Start! ', "minititle");
  const web3Title = createTitleElement('♦️\nWeb3\n♦️',"subtitle");
  web3Title.style.cursor = 'pointer';
  const todaysContainer = createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });

  const challengeTitle = createTitleElement(``, "minititle");

  todaysContainer.appendChild(challengeTitle);

  const classImages = playerTypes.map(player => player.thumbnail);
  const abilityImages = abilityTypes.map(player => player.thumbnail);
  const worldImages = worldTypes.map(world => world.thumbnail);

  const classContainer = document.createElement('div');
  const classSubTitle = createTitleElement('🏆\nSurvivors',  "subtitle")
  const classButton = createButton(selectedPlayer,  0.65);
  classContainer.appendChild(classSubTitle);
  classContainer.appendChild(classButton);

  const abilitiesSubTitle = createTitleElement('⚔️\nSkills', "subtitle");
  const abilitiesButton = createButton(selectedAbility,  0.65);
  const classAbilityContainer = document.createElement('div');
  classAbilityContainer.appendChild(abilitiesSubTitle);
  classAbilityContainer.appendChild(abilitiesButton);

  const worldSubTitle = createTitleElement('🔗\nPlay', "subtitle");
  const worldButton = createButton(selectedWorld, 0.65);
  const worldContainer = document.createElement('div');
  worldContainer.appendChild(worldSubTitle);
  worldContainer.appendChild(worldButton);

  const menuButtonsContainer =  createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(3, auto)' });
  menuButtonsContainer.appendChild(classContainer);
  menuButtonsContainer.appendChild(classAbilityContainer);
  menuButtonsContainer.appendChild(worldContainer);

  menuButtonsContainer.childNodes.forEach(button => {
      button.addEventListener('click', () => {
          hideUI();
          if(button === classContainer)  createChooseMenu(playerTypes, "\n Survivor Album 🏆","Survivor");
          if(button === classAbilityContainer) createChooseMenu(abilityTypes, "\nAbility Album ⚔️","Ability");
         });
  });

  createRandomRunEffect(classButton, classImages, 110,  0.6 , "class"); 
  createRandomRunEffect(abilitiesButton, abilityImages, 0,  0.6 , "ability");
  createRandomRunEffect(worldButton, worldImages, 0,  0.6, "world");

  todaysContainer.appendChild(menuButtonsContainer);

  const aboutTitle = createTitleElement('\n⚙️\n', "subtitle");

  addContainerUI('top-container', [mainTitle,worldTitle]);

  addContainerUI('BR-container', [aboutTitle]);
   aboutTitle.style.cursor = 'pointer';
   aboutTitle.onclick = () => {
       isPaused = true;
       hideUI();
       createSettingsMenu();
   }

   const loadingText = createTitleElement(`2025 - Terms and Conditions`, "minititle");
  
  addContainerUI('bottom-container', [miniTitle,todaysContainer,loadingText]);
  todaysContainer.style.cursor = 'pointer';
  loadingText.onclick = () => {
      isPaused = true; 
      hideUI();
      showToC();
  }


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
  return createTitleElement("🏆⚔️🔗\nOnchain Survivor");
}