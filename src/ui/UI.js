// UI.js - Provides helper functions to create and manage UI elements

// Module-scoped variables for the main menu root, exit button, card types and ui Containers.
let mainMenuUI;
let exitButton;
let uiContainers = [];
let player;
let ability;
let world;

//Categories of spinning states, may be turned off in the future. 
let spinningStates = {
  class: true,
  ability: true,
  world: true
};


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
 * @param {Array<string>} classNames - Array of CSS class names.
 * @param {Object} [styles={}] - Object of inline CSS styles.
 * @returns {HTMLElement}
 */
export function createContainer (classNames = [], styles = {}) {
  const container = document.createElement('div');
  classNames.forEach(className => container.classList.add(className));
  Object.assign(container.style, styles);
  document.body.appendChild(container);
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
  const titleContainer = createTitleElement(text,"title");
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

function handleEntitySelection(entity, type) {
  if (type === "Survivor")  {

      hideUI();
      setupUI();
  } else if (type === "Ability") {
      hideUI();
      setupUI();
  } else if (type === "World") {
      hideUI();
      setupUI();
  }
}


/**
 * Creates a button element with the given configuration.
 * @param {Object} dataType - exported data from JSON to populate the button .
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
  const popUpContainer = createContainer(['choose-menu-container']);
  const statusButton = createTitleElement('\n Settings\n\n',  "title");
  popUpContainer.appendChild(statusButton);

  const volumesTitle = createTitleElement('- Volume -\n\n', "subtitle");
  popUpContainer.appendChild(volumesTitle);

const volumesContainer =createContainer(['abilities-grid']);
const fxVolumeSlider = document.createElement('input');
fxVolumeSlider.type = 'range'
fxVolumeSlider.min = '0';
fxVolumeSlider.max = '100';
fxVolumeSlider.value = '50'; 
fxVolumeSlider.id = 'fxVolumeSlider';
fxVolumeSlider.classList.add('rainbow-slider');

const fxVolumeTitle = createTitleElement("FX",  "subtitle");
fxVolumeTitle.htmlFor = 'fxVolumeSlider';
volumesContainer.appendChild(fxVolumeTitle);

volumesContainer.appendChild(fxVolumeSlider);

const vaVolumeSlider = document.createElement('input');
vaVolumeSlider.type = 'range'
vaVolumeSlider.min = '0';
vaVolumeSlider.max = '100';
vaVolumeSlider.value = '50'; 
vaVolumeSlider.id = 'vaVolumeSlider';
vaVolumeSlider.classList.add('rainbow-slider');

const vaVolumeTitle = createTitleElement("Voices",  "subtitle");
vaVolumeTitle.htmlFor= 'vaVolumeSlider';
volumesContainer.appendChild(vaVolumeTitle);
volumesContainer.appendChild(vaVolumeSlider);

const volumeSlider = document.createElement('input');
volumeSlider.type = 'range';
volumeSlider.min = '0';
volumeSlider.max = '100';
volumeSlider.value = '50'; 
volumeSlider.id = 'volumeSlider';
volumeSlider.classList.add('rainbow-slider'); 

const VolumeTitle = createTitleElement("Music", "subtitle");
VolumeTitle.htmlFor = 'volumeSlider';
volumesContainer.appendChild(VolumeTitle);

volumesContainer.appendChild(volumeSlider);
popUpContainer.appendChild(volumesContainer); 

const themeContainer = document.createElement('div');
const themesTitle = createTitleElement('\n - Themes -\n\n', "subtitle");
themeContainer.appendChild(themesTitle);

const themeOptions = [
    { id: 'rainbowCheckbox', label: 'Chroma', filter: 'brightness(130%)' }, 
    { id: 'goldCheckbox', label: 'Gold', filter: 'brightness(130%) sepia(100%) hue-rotate(15deg) saturate(180%)' },
    { id: 'silverCheckbox', label: 'Silver', filter: 'brightness(130%) grayscale(100%)' },
    { id: 'bronzeCheckbox', label: 'Bronze', filter: 'brightness(130%) sepia(100%) hue-rotate(5deg)' }
];
const themesContainerGrid = createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
const checkboxes=[];
themeOptions.forEach(option => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = option.id;
    checkbox.classList.add('rainbow-checkbox'); 
    const themeTitle = createTitleElement(option.label, "subtitle");
    themeTitle.htmlFor= option.id;
    themeContainer.appendChild(themesTitle);
    themesContainerGrid.appendChild(checkbox);
    themesContainerGrid.appendChild(themeTitle);
    themeContainer.appendChild(themesContainerGrid);

    checkbox.addEventListener('change', (event) => {
        themeOptions.forEach(otherOption => {
            if (otherOption.id !== option.id) {
                document.getElementById(otherOption.id).checked = false;
            }
        });

        if (event.target.checked) { 
          document.documentElement.style.setProperty('--image-filter', option.filter);
        }  
        if (!event.target.checked) { 
          event.target.checked = true;  
          return; 
      }

    });
    checkboxes.push(checkbox);
});

popUpContainer.appendChild(themeContainer);

const langContainer = document.createElement('div');
const langTitle = createTitleElement('\n - Language -\n\n', "subtitle");
langContainer.appendChild(langTitle);

const languageSelect = document.createElement('select');
languageSelect.classList.add('rainbow-select'); 

const languageOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" }, 
    { value: "fr", label: "Français" }, 
    { value: "de", label: "Deutsch" }, 
    { value: "pt", label: "Português" },
    { value: "zh", label: "中文" },
    { value: "ja", label: "日本語" },
    { value: "ru", label: "Русский" },
    { value: "ko", label: "한국어" },

];

languageOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value; 
    optionElement.text = option.label; 
    languageSelect.appendChild(optionElement);
});

langContainer.appendChild(languageSelect);
popUpContainer.appendChild(langContainer); 
const goBackButton = createTitleElement('\n- Go back -\n\n', "title");
goBackButton.style.cursor = 'pointer';

addContainerUI('center-container', [popUpContainer]);
goBackButton.onclick = () => {
  hideUI();
  setupUI();
};
popUpContainer.appendChild(goBackButton);

const savedSettings = localStorage.getItem('onchainSurvivorSettings');
if (savedSettings) {
  const settings = JSON.parse(savedSettings);
  languageSelect.value = settings.language;
  fxVolumeSlider.value = settings.fxVolume;
  vaVolumeSlider.value = settings.vaVolume;
  volumeSlider.value = settings.musicVolume;
  for (let i = 0; i < themeOptions.length; i++) {
      if (settings.theme === themeOptions[i].filter) {
        checkboxes[i].checked = true; 
        document.documentElement.style.setProperty('--image-filter', settings.theme); 
        break;
      }
  }
}

function saveSettings() {
  const settings = {
    theme: document.documentElement.style.getPropertyValue('--image-filter'),
    language: languageSelect.value, 
    fxVolume: fxVolumeSlider.value, 
    vaVolume: vaVolumeSlider.value,
    musicVolume: volumeSlider.value,
  };
  localStorage.setItem('onchainSurvivorSettings', JSON.stringify(settings));
 }

  languageSelect.addEventListener('change', saveSettings);
  fxVolumeSlider.addEventListener('change', saveSettings);
  vaVolumeSlider.addEventListener('change', saveSettings);
  volumeSlider.addEventListener('change', saveSettings);
  checkboxes.forEach(checkbox => {
  checkbox.addEventListener('change', saveSettings);
  });

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

world = worldTypes[0];
ability = playerTypes[0];
player = playerTypes[0];

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
  const classButton = createButton(player,  0.65);
  classContainer.appendChild(classSubTitle);
  classContainer.appendChild(classButton);

  const abilitiesSubTitle = createTitleElement('⚔️\nSkills', "subtitle");
  const abilitiesButton = createButton(ability,  0.65);
  const classAbilityContainer = document.createElement('div');
  classAbilityContainer.appendChild(abilitiesSubTitle);
  classAbilityContainer.appendChild(abilitiesButton);

  const worldSubTitle = createTitleElement('🔗\nPlay', "subtitle");
  const worldButton = createButton(world, 0.65);
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
   
       hideUI();
       createSettingsMenu();
   }

   const loadingText = createTitleElement(`2025 - Terms and Conditions`, "minititle");
  
  addContainerUI('bottom-container', [miniTitle,todaysContainer,loadingText]);
  todaysContainer.style.cursor = 'pointer';
  loadingText.onclick = () => {
  
      hideUI();
      showToC();
  }

  addContainerUI('TR-container', [web3Title]).onclick = async () => {
      hideUI();
      setTimeout(() => {

          showMainMenu();
      }, 1100);
  }

}

export function showToC() {
  const termsAndConditions = createTitleElement('\nTerms and conditions:\n\n', "title")
  const disclaimer = createTitleElement('Participating in OnChain Survivor as a challenger or survivor\nand interacting with the smart contracts\n is NOT an investment opportunity\n\n   The game is solely for entertainment and experimental purposes\n and participants should not expect financial returns.\n\n By sending any transaction to the smart contract\n you confirm that you are not subject to any country-specific restrictions\n regulatory limitations, or classified as a sanctioned entity.\n\n Special game events may occur that could temporarily over-ride \n the Challenge Queue during which the 7,150 block rule may not apply.\n\n Additionally, game updates might increase or decrease the duration of daily challenges\n to accommodate potential downtimes or inconveniences of the player base.\n\n The rules are subject to modification based on special events, \n updates and unforeseen circumstances\n always in favour of the players. Any changes in timing will be publicl\n communicated in official channels. \n\n Challenges can be edited as many times as desired (fees apply)\n as long as the challenge is still in the queue\n\n Transactions sent into the challenge queue are irreversible\n please doublecheck before sending your challenge. \n\n', "smalltitle")
  const popUpContainer = createContainer(['choose-menu-container']);;
  popUpContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";

  popUpContainer.appendChild(termsAndConditions); 
  popUpContainer.appendChild(disclaimer); 

  const support = createTitleElement('\nYour challenges allow me develop full time! \nthanks.\n\n -the dev\n\n', "subtitle")
  popUpContainer.appendChild(support); 

  addContainerUI('center-container', [popUpContainer]);
  const goBackButton = createTitleElement('\n - Continue -\n\n',  "title");
  goBackButton.style.cursor = 'pointer';
  popUpContainer.appendChild(goBackButton);
      goBackButton.onclick = () => {
          hideUI();
          setupUI();
      };
};

export  function createInfoMenu() {
  const popUpContainer = createContainer(['choose-menu-container']);

  const newChallengesButton = createTitleElement('\n New Challenges \neveryday!', "subtitle");
  popUpContainer.appendChild(newChallengesButton);

  const aboutButton = createTitleElement('Welcome to Onchain Survivor. \n a free to play global  challenge game\n powered by decentralized blockchains!\n\n Today`s Challenge:', "subtitle");
  popUpContainer.appendChild(aboutButton);

  const worldContainer = createContainer(['abilities-grid']); 
  const worldButton = createButton(world, 1);
  worldButton.style.cursor = 'default';
  worldContainer.appendChild(worldButton);
  popUpContainer.appendChild(worldContainer);

  const objectiveText = createTitleElement('\nEach day brings a new Challenge, and \nafter you complete it, inscribe your records \nto the hall of survivors for all of eternity. \n\n Today`s Character Class:', "subtitle");
  popUpContainer.appendChild(objectiveText);

  const todaysPlayerContainer = UI.createContainer(['abilities-grid']); 
  const classButton = createButton(player, 1);
  classButton.style.cursor = 'default';
  todaysPlayerContainer.appendChild(classButton);
  popUpContainer.appendChild(todaysPlayerContainer);

  const instructionsText = createTitleElement('\n As a survivor you can only \n move and Survive! each class  \n  has a different base ability, and stats.\n\n Today`s Ability:', "subtitle");
  popUpContainer.appendChild(instructionsText);

  const todaysAbilityContainer = createContainer(['abilities-grid']); 
  const abilButton = createButton(ability, 1);
  abilButton.style.cursor = 'default';
  todaysAbilityContainer.appendChild(abilButton);
  popUpContainer.appendChild(todaysAbilityContainer);

  const abilText = UI.createTitleElement('\n Install many abilities during your run. Let \nyour creativity and intuition guide you, \n some abilities combine well.  Good luck!\n\n    -the dev (@onchainsurvivor)',  "subtitle");
  popUpContainer.appendChild(abilText);

  const goBackButton = UI.createTitleElement('\n- Go back -\n\n', "title");
  goBackButton.style.cursor = 'pointer';
  
  addContainerUI('center-container', [popUpContainer]);
  goBackButton.onclick = () => {

      hideUI();
      setupUI();
  };
  popUpContainer.appendChild(goBackButton);

}

export function showTransparencyReport() {
  const popUpContainer = createContainer(['choose-menu-container']);;

  const titleButton = createTitleElement('\nTransparency\nReport\n⚖️', "title");
  popUpContainer.appendChild(titleButton);
  const aboutButton = createTitleElement(' You can read and run offline every line \n of code of the onchain survivor client !\n\n Repository:', "subtitle");
  popUpContainer.appendChild(aboutButton);

  const githubContainer = createContainer(['abilities-grid']); 
  const githubButton = createButton({
      title: "Read Onchain Survivor Code",
      description: "Allows you to check the client source code, line by line, public for everyone to verify.",
      thumbnail: 'Media/Abilities/???.png',
      effect(user) { 
          this.update = () => {} 
      },
  }, 1);
  githubContainer.appendChild(githubButton);
  popUpContainer.appendChild(githubContainer);

  const rankingText = createTitleElement('\nYou can verify the Global Ranking smart \n contract powering the survivor system\n\n Ranking Smart Contract:', "subtitle");
  popUpContainer.appendChild(rankingText);

  const rankingContainer = createContainer(['abilities-grid']); 
  const rankingButton = createButton({
      title: "Verify Ranking Smart Contract",
      description: "Allows you to check the Ranking Smart Contract source code, line by line, public for everyone to verify.",
      thumbnail: 'Media/Abilities/???.png',
      effect(user) { 
          this.update = () => {} 
      },
  }, 1);
  rankingContainer.appendChild(rankingButton);
  popUpContainer.appendChild(rankingContainer);

  const sponsorText = UI.createTitleElement('\n You can also verify the Rollup Centric \n Sponsor Contract that settles in Ethereum!\n\n Sponsor Smart Contract:',  "subtitle");
  popUpContainer.appendChild(sponsorText);

  const sponsorContainer = createContainer(['abilities-grid']); 
  const sponsorButton = createButton({
      title: "Verify Sponsor Smart Contract",
      description: "Allows you to check the Sponsor Smart Contract source code, line by line, public for everyone to verify.",
      thumbnail: 'Media/Abilities/???.png',
      effect(user) { 
          this.update = () => {} 
      },
  }, 1);
  sponsorContainer.appendChild(sponsorButton);
  popUpContainer.appendChild(sponsorContainer);

  const disclaimerText = UI.createTitleElement('\n None of the smart contracts hold balance. \n Every sponsor transaction is final. \n Timeframes might change for the players! \n Theres only one social media account.\n\n    -the dev (@onchainsurvivor)',"subtitle");
  popUpContainer.appendChild(disclaimerText);

  const goBackButton = UI.createTitleElement('\n- Go back -\n\n',  "title");
  goBackButton.style.cursor = 'pointer';
  
addContainerUI('center-container', [popUpContainer]);
  goBackButton.onclick = () => {
      hideUI();
       setupUI;
  };
  popUpContainer.appendChild(goBackButton);
}

window.addEventListener('load', async () => {
  // document.documentElement.style.setProperty('--image-filter', 'brightness(130%)');
  // const savedSettings = localStorage.getItem('onchainSurvivorSettings');
  // if (savedSettings) {
  //  const settings = JSON.parse(savedSettings);
  //   document.documentElement.style.setProperty('--image-filter', settings.theme);
  // }

   //Todo: Add contract loading functionality here, for better user experience
   //const storedAddress = localStorage.getItem('metaMaskAddress');
   //if (storedAddress) {
   //    isPaused = true;
   //    hideUI();
   //    showQueueTutorialMenu();
   //}
   
   if ('serviceWorker' in navigator) {
       navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
         console.log('Service Worker registered with scope:', registration.scope);
       }, function(error) {
         console.log('Service Worker registration failed:', error);
       });
 }  

});


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
