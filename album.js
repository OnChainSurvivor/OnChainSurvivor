

/*---------------------------------------------------------------------------
                              Global Variables & Constants
---------------------------------------------------------------------------*/
let player;
let ability;
let world;

let isMainMenu = true;

let animationFrameId;
const clock = new THREE.Clock();
let accumulatedTime = 0;
let cameraAngle = 0;
let cameraRadius = 15;
let web3;

let spinningStates = {
    class: true,
    ability: true,
    world: true
};

const uiContainers = [];

/*---------------------------------------------------------------------------
                              Survivors Blueprint
---------------------------------------------------------------------------*/
import { playerTypes } from './DFcharacterCards.js';

/*---------------------------------------------------------------------------
                              Worlds Blueprints
---------------------------------------------------------------------------*/
const worldTypes = [
{title: 'The Dark Forest',
    description:'Survive in Ethereum, an open, futuristic landscape where data flows freely. Be aware of whats lurking in the dark!',
    thumbnail: 'Media/Worlds/ETHEREUMVERSE.png',
    material:new THREE.ShaderMaterial({
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
        wireframe:true,
    }),
    playerMaterial:new THREE.MeshPhysicalMaterial({
        envMap: null, 
        reflectivity: 1,
        roughness: 0,
        metalness: 1,
        clearcoat: 0.13,
        clearcoatRoughness: 0.1,
        transmission: 0.82,
        ior: 2.75, 
        thickness: 10,
        sheen: 1,
        color: new THREE.Color('transparent'),
        wireframe : true,
        emissive: 0xffffff, 
        emissiveIntensity: 0.25
    }),
    enemyMaterial:new THREE.MeshPhysicalMaterial({
        envMap: null, 
        reflectivity: 1,
        roughness: 0,
        metalness: 1,
        clearcoat: 0.13,
        clearcoatRoughness: 0.1,
        transmission: 0.82,
        ior: 2.75, 
        thickness: 10,
        sheen: 1,
        color: new THREE.Color('white'),
        wireframe : true,
        emissive: 0x0ff00, 
        emissiveIntensity: 2 
    }),
    gridMaterial:null,
    backgroundColor:new THREE.Color(0x000000),
    texturePath:'Media/Textures/ENVTEXTURE.png' ,
    components: ["BloomEnvironment","Octahedron", "MiniOctahedron","NeonGrid"],
    setup: function(scene, camera, renderer) {
        document.documentElement.style.setProperty('--image-filter', 'brightness(130%)');
        this.components.forEach(componentName => {
            worldComponents[componentName].initialize?.(this, scene, camera, renderer);
        });
            const cameraX = 0+ cameraRadius * Math.cos(cameraAngle);
            const cameraZ = 0+ cameraRadius * Math.sin(cameraAngle);
            camera.position.set(cameraX, 0, cameraZ);
            camera.lookAt(0,0,0);
    },
    update: function(scene, camera, renderer) {
        this.components.forEach(componentName => {
            worldComponents[componentName].update?.(this, scene, camera, renderer);
        });
    }
}
];

const worldComponents = {
    "NeonGrid": {
        initialize: function(world, scene, camera, renderer) {
        },
        update: function(world) {
        }
    },
    "Octahedron": {
        initialize: function(world, scene) {
            world.rotationIncrement = 0.005;
            world.scaleDecayFactor = 0.95;
            world.meshScaleThreshold = 0.1;

            world.octahedronGeometry = new THREE.OctahedronGeometry(1);
            world.octahedronGeometry.scale(5.6, 5.25, 3.75);
            world.octahedronMesh = new THREE.Mesh(world.octahedronGeometry, world.material);
            scene.add(world.octahedronMesh);
            world.octahedronMesh2 = new THREE.Mesh(world.octahedronGeometry, world.material);
            scene.add(world.octahedronMesh2);

        },
        update: function(world, scene) {
            if (isMainMenu) {
                world.octahedronMesh.rotation.z -= world.rotationIncrement;
                world.octahedronMesh2.rotation.z += world.rotationIncrement;
            } else if (world.miniOctahedrons.length > 1){
                world.octahedronMesh.scale.multiplyScalar(world.scaleDecayFactor);
                world.octahedronMesh2.scale.multiplyScalar(world.scaleDecayFactor);
        
                if (world.octahedronMesh.scale.x <= world.meshScaleThreshold) {
                    scene.remove(world.octahedronMesh, world.octahedronMesh2);
                }
            }
        }
    },
    "MiniOctahedron": {
        initialize: function(world, scene) {
            world.miniOctahedrons = [];
            const miniOctahedronGeometry = new THREE.OctahedronGeometry(0.25);
            miniOctahedronGeometry.scale(0.5, 0.75, 0.5);
            const miniOctahedronMaterial = world.material;
            let numCrystals = 750;

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
                const radius = Math.sqrt(Sqrt - y * y);

                const phi = goldenAngle * i;
                const theta = Math.atan2(radius, y);

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
                world.miniOctahedrons.push(miniOctahedron);
                scene.add(miniOctahedron);

            }
            world.miniRotationIncrement = 0.01;
            world.scaleThreshold = 0.3;
            world.miniScaleSpeed = 0.005;
            world.orbitSpeed = 0.5;
            world.attractionSpeed = 0.025;
        },
        update: function(world, scene) {
            const timeNow = Date.now() * 0.001;
            if (isMainMenu) {
                world.miniOctahedrons.forEach((miniOctahedron, index) => {
                    miniOctahedron.rotation.x += world.miniRotationIncrement;
                    miniOctahedron.rotation.y += world.miniRotationIncrement;

                    const orbitRadius = miniOctahedron.position.distanceTo(world.octahedronMesh.position); 
                    const phi = Math.PI * index / world.miniOctahedrons.length;
                    const theta = Math.sqrt(world.miniOctahedrons.length * Math.PI) * phi;
                    const angle = timeNow * world.orbitSpeed;

                    miniOctahedron.position.set(
                        world.octahedronMesh.position.x + orbitRadius * Math.cos(angle + theta) * Math.sin(phi),
                        world.octahedronMesh.position.y + orbitRadius * Math.cos(phi),
                        world.octahedronMesh.position.z + orbitRadius * Math.sin(angle + theta) * Math.sin(phi)
                    );

                    const direction = miniOctahedron.position.clone().normalize().negate();
                    if (miniOctahedron.position.length() > 1) {
                        miniOctahedron.position.addScaledVector(direction, world.attractionSpeed);
                    }
                });
            } else if (world.miniOctahedrons.length > 1) {
                world.miniOctahedrons.forEach((miniOctahedron, index) => {
                    miniOctahedron.position.addScaledVector(
                        miniOctahedron.position.clone().sub(world.octahedronMesh.position).normalize(), 
                        0.2
                    );
                    miniOctahedron.rotation.x += world.miniRotationIncrement;
                    miniOctahedron.rotation.y += world.miniRotationIncrement;
                    miniOctahedron.scale.multiplyScalar(1 - world.miniScaleSpeed);

                    if (miniOctahedron.scale.x <= world.scaleThreshold) {
                        scene.remove(miniOctahedron);
                        world.miniOctahedrons.splice(index, 1);
                    }
                });
            }
        }
    },
    "BloomEnvironment": {
        initialize: function(world, scene, camera, renderer) {
            scene.background = world.backgroundColor;
            world.renderScene = new THREE.RenderPass(scene, camera);
            world.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .75, .5, 0.01);
            composer.addPass(world.renderScene);
            composer.addPass(world.bloomPass);
            world.pmremGenerator = new THREE.PMREMGenerator(renderer);
            world.pmremGenerator.compileEquirectangularShader();

            new THREE.TextureLoader().load(world.texturePath, texture => {
                world.envMap = world.pmremGenerator.fromEquirectangular(texture).texture;
                world.pmremGenerator.dispose();
                scene.environment = world.envMap;
            });
        },
        update: function(world) {
        },
    },
};
/*---------------------------------------------------------------------------
                              Scene Initialization
---------------------------------------------------------------------------*/
let selectedPlayer = playerTypes[0]; 
let selectedAbility = playerTypes[0];
let selectedWorld = worldTypes[0]; 

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const canvas = document.getElementById('survivorCanvas');
const renderer = new THREE.WebGLRenderer({ canvas});
renderer.setPixelRatio(window.devicePixelRatio || 1);

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
});
const composer = new THREE.EffectComposer(renderer,renderTarget);

function updateRendererSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderTarget.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

updateRendererSize();
window.addEventListener('resize', updateRendererSize);
window.addEventListener('load', updateRendererSize);

world = worldTypes[0];
world.setup(scene,camera,renderer);
ability = playerTypes[0];
player = playerTypes[0];

/*---------------------------------------------------------------------------
                                UI UTILITIES 
---------------------------------------------------------------------------*/
const UI = {};

UI.createTitleElement = function(text, classCSS) {
    const element = document.createElement('div');
    element.innerText = text;
    element.classList.add(classCSS); 
    element.classList.add('rainbow-text'); 
    return element;
}

UI.createContainer = function(classNames = [], styles = {}) {
    const container = document.createElement('div');
    classNames.forEach(className => container.classList.add(className));
    Object.assign(container.style, styles);
    document.body.appendChild(container);
    return container;
}

UI.createTitleContainer= function (text) {
    const container = document.createElement('div');
    container.classList.add('choose-menu-title');
    const title = UI.createTitleElement(text, "title"); 
    container.appendChild(title);
    return container;
}

function createButton(dataType, scale = 1, onClick) {
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

function addContainerUI(location,uiElements){
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

function hideUI(){
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

/*---------------------------------------------------------------------------
                                GAME TITLE 
---------------------------------------------------------------------------*/
import { abilityTypes } from './DFAbilityCards.js';

async function createGameTitle(){
    const mainTitle = UI.createTitleElement('🏆⚔️🔗\nOnchain Survivor','title');
    const worldTitle = UI.createTitleElement(world.title,"minititle");
    const miniTitle = UI.createTitleElement('New cards everyday! ', "minititle");
    const web3Title = UI.createTitleElement('♦️\nWeb3\n♦️',"subtitle");
    web3Title.style.cursor = 'pointer';
    const todaysContainer = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });

    const challengeTitle = UI.createTitleElement(``, "minititle");

    todaysContainer.appendChild(challengeTitle);

    const classImages = playerTypes.map(player => player.thumbnail);
    const abilityImages = abilityTypes.map(player => player.thumbnail);
    const worldImages = worldTypes.map(world => world.thumbnail);

    const classContainer = document.createElement('div');
    const classSubTitle = UI.createTitleElement('🏆\nSurvivors',  "subtitle")
    const classButton = createButton(selectedPlayer,  0.65);
    classContainer.appendChild(classSubTitle);
    classContainer.appendChild(classButton);

    const abilitiesSubTitle = UI.createTitleElement('⚔️\nSkills', "subtitle");
    const abilitiesButton = createButton(selectedAbility,  0.65);
    const classAbilityContainer = document.createElement('div');
    classAbilityContainer.appendChild(abilitiesSubTitle);
    classAbilityContainer.appendChild(abilitiesButton);

    const worldSubTitle = UI.createTitleElement('🔗\nPlay', "subtitle");
    const worldButton = createButton(selectedWorld, 0.65);
    const worldContainer = document.createElement('div');
    worldContainer.appendChild(worldSubTitle);
    worldContainer.appendChild(worldButton);

    const menuButtonsContainer =  UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(3, auto)' });
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

    const aboutTitle = UI.createTitleElement('\n⚙️\n', "subtitle");

    addContainerUI('top-container', [mainTitle,worldTitle]);

    addContainerUI('BR-container', [aboutTitle]);
     aboutTitle.style.cursor = 'pointer';
     aboutTitle.onclick = () => {
         isPaused = true;
         hideUI();
         createSettingsMenu();
     }

     const loadingText = UI.createTitleElement(`2025 - Terms and Conditions`, "minititle");
    
    addContainerUI('bottom-container', [miniTitle,todaysContainer,loadingText]);
    todaysContainer.style.cursor = 'pointer';
    loadingText.onclick = () => {
        isPaused = true; 
        hideUI();
        showToC();
    }

    addContainerUI('TR-container', [web3Title]).onclick = async () => {
        hideUI();
        setTimeout(() => {
            isPaused = true;
            showMainMenu();
        }, 1100);
    }
};

createGameTitle();
/*---------------------------------------------------------------------------
                        Generic Choose Menu
---------------------------------------------------------------------------*/

function createChooseMenu(entityList, text, type) {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;
    const titleContainer = UI.createTitleContainer(text);
    const gridContainer = UI.createContainer(['choose-menu-grid']); 
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
        selectedPlayer = entity;
        hideUI();
        createGameTitle();//showMainMenu();
    } else if (type === "Ability") {
        selectedAbility = entity;
        hideUI();
        createGameTitle();//showMainMenu();
    } else if (type === "World") {
        selectedWorld = entity;
        hideUI();
        createGameTitle();//showMainMenu();
    }
}
/*---------------------------------------------------------------------------
                                    WEB3 Options  Menu
---------------------------------------------------------------------------*/

function showToC() {
    const termsAndConditions = UI.createTitleElement('\nTerms and conditions:\n\n', "title")
    const disclaimer = UI.createTitleElement('Participating in OnChain Survivor as a challenger or survivor\nand interacting with the smart contracts\n is NOT an investment opportunity\n\n   The game is solely for entertainment and experimental purposes\n and participants should not expect financial returns.\n\n By sending any transaction to the smart contract\n you confirm that you are not subject to any country-specific restrictions\n regulatory limitations, or classified as a sanctioned entity.\n\n Special game events may occur that could temporarily over-ride \n the Challenge Queue during which the 7,150 block rule may not apply.\n\n Additionally, game updates might increase or decrease the duration of daily challenges\n to accommodate potential downtimes or inconveniences of the player base.\n\n The rules are subject to modification based on special events, \n updates and unforeseen circumstances\n always in favour of the players. Any changes in timing will be publicl\n communicated in official channels. \n\n Challenges can be edited as many times as desired (fees apply)\n as long as the challenge is still in the queue\n\n Transactions sent into the challenge queue are irreversible\n please doublecheck before sending your challenge. \n\n', "smalltitle")
    const popUpContainer = UI.createContainer(['choose-menu-container']);;
    popUpContainer.style.backgroundColor = "rgba(0, 0, 0, 0.8)";

    popUpContainer.appendChild(termsAndConditions); 
    popUpContainer.appendChild(disclaimer); 

    const support = UI.createTitleElement('\nYour challenges allow me develop full time! \nthanks.\n\n -the dev\n\n', "subtitle")
    popUpContainer.appendChild(support); 

    addContainerUI('center-container', [popUpContainer]);
    const goBackButton = UI.createTitleContainer('\n - Continue -',  "subtitle");
    goBackButton.style.cursor = 'pointer';
    popUpContainer.appendChild(goBackButton);
        goBackButton.onclick = () => {
            hideUI();
            createGameTitle();
        };
};
/*---------------------------------------------------------------------------
                                   In Game UI
---------------------------------------------------------------------------*/

function createSettingsMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);
    const statusButton = UI.createTitleContainer('\n Settings',  "subtitle");
    popUpContainer.appendChild(statusButton);

    const volumesTitle = UI.createTitleElement('- Volume -\n\n', "subtitle");
    popUpContainer.appendChild(volumesTitle);

  const volumesContainer =UI.createContainer(['abilities-grid']);
  const fxVolumeSlider = document.createElement('input');
  fxVolumeSlider.type = 'range'
  fxVolumeSlider.min = '0';
  fxVolumeSlider.max = '100';
  fxVolumeSlider.value = '50'; 
  fxVolumeSlider.id = 'fxVolumeSlider';
  fxVolumeSlider.classList.add('rainbow-slider');

  const fxVolumeTitle = UI.createTitleElement("FX",  "subtitle");
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

  const vaVolumeTitle = UI.createTitleElement("Voices",  "subtitle");
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
  
  const VolumeTitle = UI.createTitleElement("Music", "subtitle");
  VolumeTitle.htmlFor = 'volumeSlider';
  volumesContainer.appendChild(VolumeTitle);

  volumesContainer.appendChild(volumeSlider);
  popUpContainer.appendChild(volumesContainer); 
  
  const themeContainer = document.createElement('div');
  const themesTitle = UI.createTitleElement('\n - Themes -\n\n', "subtitle");
  themeContainer.appendChild(themesTitle);
  
  const themeOptions = [
      { id: 'rainbowCheckbox', label: 'Chroma', filter: 'brightness(130%)' }, 
      { id: 'goldCheckbox', label: 'Gold', filter: 'brightness(130%) sepia(100%) hue-rotate(15deg) saturate(180%)' },
      { id: 'silverCheckbox', label: 'Silver', filter: 'brightness(130%) grayscale(100%)' },
      { id: 'bronzeCheckbox', label: 'Bronze', filter: 'brightness(130%) sepia(100%) hue-rotate(5deg)' }
  ];
  const themesContainerGrid = UI.createContainer(['abilities-grid'], { gridTemplateColumns: 'repeat(4, auto)' });
  const checkboxes=[];
  themeOptions.forEach(option => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = option.id;
      checkbox.classList.add('rainbow-checkbox'); 
      const themeTitle = UI.createTitleElement(option.label, "subtitle");
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
  const langTitle = UI.createTitleElement('\n - Language -\n\n', "subtitle");
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
  const goBackButton = UI.createTitleContainer('\n- Go back -', "subtitle");
  goBackButton.style.cursor = 'pointer';
  
addContainerUI('center-container', [popUpContainer]);
  goBackButton.onclick = () => {
    hideUI();
    createGameTitle();
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

async function createInfoMenu() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);

    const newChallengesButton = UI.createTitleContainer('\n New Challenges \neveryday!', "subtitle");
    popUpContainer.appendChild(newChallengesButton);

    const aboutButton = UI.createTitleElement('Welcome to Onchain Survivor. \n a free to play global  challenge game\n powered by decentralized blockchains!\n\n Today`s Challenge:', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const worldContainer = UI.createContainer(['abilities-grid']); 
    const worldButton = createButton(world, 1);
    worldButton.style.cursor = 'default';
    worldContainer.appendChild(worldButton);
    popUpContainer.appendChild(worldContainer);

    const objectiveText = UI.createTitleElement('\nEach day brings a new Challenge, and \nafter you complete it, inscribe your records \nto the hall of survivors for all of eternity. \n\n Today`s Character Class:', "subtitle");
    popUpContainer.appendChild(objectiveText);

    const todaysPlayerContainer = UI.createContainer(['abilities-grid']); 
    const classButton = createButton(player, 1);
    classButton.style.cursor = 'default';
    todaysPlayerContainer.appendChild(classButton);
    popUpContainer.appendChild(todaysPlayerContainer);

    const instructionsText = UI.createTitleElement('\n As a survivor you can only \n move and Survive! each class  \n  has a different base ability, and stats.\n\n Today`s Ability:', "subtitle");
    popUpContainer.appendChild(instructionsText);

    const todaysAbilityContainer = UI.createContainer(['abilities-grid']); 
    const abilButton = createButton(ability, 1);
    abilButton.style.cursor = 'default';
    todaysAbilityContainer.appendChild(abilButton);
    popUpContainer.appendChild(todaysAbilityContainer);

    const abilText = UI.createTitleElement('\n Install many abilities during your run. Let \nyour creativity and intuition guide you, \n some abilities combine well.  Good luck!\n\n    -the dev (@onchainsurvivor)',  "subtitle");
    popUpContainer.appendChild(abilText);

    const goBackButton = UI.createTitleContainer('\n- Go back -', "subtitle");
    goBackButton.style.cursor = 'pointer';
    
    addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        isPaused = true;
        hideUI();
        createGameTitle();
    };
    popUpContainer.appendChild(goBackButton);

}

function showTransparencyReport() {
    const popUpContainer = UI.createContainer(['choose-menu-container']);;

    const titleButton = UI.createTitleContainer('\nTransparency\nReport\n⚖️', "subtitle");
    popUpContainer.appendChild(titleButton);
    const aboutButton = UI.createTitleElement(' You can read and run offline every line \n of code of the onchain survivor client !\n\n Repository:', "subtitle");
    popUpContainer.appendChild(aboutButton);

    const githubContainer = UI.createContainer(['abilities-grid']); 
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

    const rankingText = UI.createTitleElement('\nYou can verify the Global Ranking smart \n contract powering the survivor system\n\n Ranking Smart Contract:', "subtitle");
    popUpContainer.appendChild(rankingText);

    const rankingContainer = UI.createContainer(['abilities-grid']); 
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

    const sponsorContainer = UI.createContainer(['abilities-grid']); 
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

    const goBackButton = UI.createTitleContainer('\n- Go back -',  "subtitle");
    goBackButton.style.cursor = 'pointer';
    
addContainerUI('center-container', [popUpContainer]);
    goBackButton.onclick = () => {
        isPaused = true;
        hideUI();
        showMainMenu();
    };
    popUpContainer.appendChild(goBackButton);
}

/*---------------------------------------------------------------------------
                        Load Settings 
---------------------------------------------------------------------------*/
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
/*---------------------------------------------------------------------------
                            Main loop
---------------------------------------------------------------------------*/

function animate() {
    animationFrameId = requestAnimationFrame(animate);
    accumulatedTime += clock.getDelta();
    world.update(scene,camera,renderer);
    composer.render();
}

animate();