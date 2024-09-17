# Congratulations, 🔗 Survivor 🏆 !

Survivor! Congratulations on making it this far, You survived every hack, every rug, every fork and every twist in the crypto journey. 🚀💪 Keep pushing forward! 🌟🔥

## Onchain Survivor🔗🏆

Welcome to **OnChain Survivor** Official Repository ! 🌐🎮 The usage of AI in the development of this game is not just encouraged but considered mandatory. Fun, simplicity, decentralization, and openness are the foundational pillars of the project.

## 🌟About the Project🌟

Onchain Survivor is a web-based top-down arena shooter survival roguelite game that utilizes Web3 technologies to enable Open Source, decentralized, peer-to-peer multiSurvivor interactions. Navigate a 3D Blockchained environment to do what they do best... Survive Together!


## Game Overview 🎮

**Title**: Onchain Survivors
**Genre**: Top-Down Arena Shooter, Survival Roguelite
**Platform**: Web
**Technology**: Web3, Blockchain Integration
**Objective**: Complete challenges in a blockchain-themed arena, defeating enemies, leveling up, and upgrading abilities.

Onchain Survivor aims to combine the addictive gameplay of survival roguelite games with the innovative potential of blockchain technology, creating a unique and engaging experience for players. With a variety of classes, enemies, power-ups, and upgrades, players will enjoy a dynamic and challenging survival experience set within the exciting world of blockchain.

### 🔑Key Features🔑

- **Decentralized Gameplay**: Enjoy a truly decentralized multiSurvivor experience with peer-to-peer connections. No central server required.  You can keep a copy of the client and fire it up connecting with a friend!. 
- **Blockchain Integration**: Interact with the dynamic blockchain technology and data, The game uses block data to generate the difficulty.  
- **3D Graphics**: Experience immersive 3D graphics powered by Three.js, in any browser.
- **Cross-Platform**: Survive directly Either desktop or mobile, without the need for additional hardware. Simple is best. You can even play from your wallet!
- **Variable Gameplay**: Every experience is different, Guaranteed. 
- **Meta Progress**: As the game progresses and the user plays more of the game, he discovers unlocks classes, powerups. 
- **Daily Challenges**: The player must complete challenges in an arena filled with enemies.
Leveling Up: Defeating enemies grants experience points (XP). Upon leveling up, players can choose from various abilities.
- **Power-Ups**: Enemies may drop power-ups, very low chances.

## Art Style 🎨

**Top-Down View**: 3D Low poly, varies by chain.
**Color Palette**: Bright and vibrant neon colors to distinguish different elements and enemies.
**Animation**: AI powered animations for characters, enemies, and effects.

## Sound Design 🎵

**Background Music**: Upbeat, electronic AI made music to match the fast-paced gameplay.
**Sound Effects**: Distinct sounds for enemy attacks, power-ups, and level-ups.
**Voiceovers**: Occasional voice lines for level-ups, power-up pickups, and mini-events.

## Blockchain Integration 🔗

**Smart Contracts**: Secure and transparent mechanics for upgrades and power-ups, The blockchain will serve official runs so the player can have their records stored forever.
**Decentralized Multiplayer**: Peer-to-peer multiplayer interactions using Peer to Peer technologies, this is for later in development.

## Development Roadmap 🛠️

Not a roadmap per se, but More or less a loose list of the current development cycle, as certain items are all being executing in parallel in real time.

**Prototype Development**: Basic mechanics, character movement, and enemy AI.
**Core Mechanics**: Implement leveling up, power-ups, and upgrades.
**UI Design**: Develop and integrate the UI elements.
**Blockchain Integration**: Integrate Web3 technologies for decentralized interactions.
**Art and Sound Design**: Develop and integrate art assets and sound effects.
**Testing**: Conduct playtesting and debugging.
**Launch**: Deploy the game on the web platform.
**Constant Content Updates**: Regular updates with new content, events, and features.

## Icons 🖼️

- **Upgrades:** AI generated Icons representing different upgrade types (e.g., a footprint for Onchain Trail).
- **Power-Ups:** 3D models in the arena representing different power-ups (e.g., a hatch on the floor for the Exit hatch Ability).

## Arena Design 🏟️
For the initial survivors arena, 
- **Theme:** Blockchain-themed elements (e.g., nodes, blocks, chains).
- **Obstacles:** Various blockchain-related obstacles (e.g., smart contracts, consensus mechanisms).
- **Environmental Hazards:** Dynamic elements such as gas clouds, electric fields, and node failures that add challenges.

## Marketing Strategy 📈
Product is still in development, but as it gains more shape, there are many plans to expand the playerbase!
- **Peer to Peer, Word of mouth**: The best of the best method to gain users. a fun game that everyone wants to play with friends. 
- **Community Engagement:** Leverage blockchain and their communities for promotion.
- **Social Media:** Utilize social media platforms to share updates and engage with players.
- **Partnerships:** Collaborate with blockchain projects and influencers for cross-promotion.
- **Content Creators:** Engage streamers and content creators to showcase gameplay and mechanics.
- **Events:** Host in-game events and challenges with other Communities.

### 🥇 Phase 1 🥇: Daily Game Challenges, by players for players!

This  system integrates both L1 (Ethereum) and L2 blockchains, allowing users from these networks to add their challenges to the queue. The  system is competitive, with each user placing their challengesaiming for the top positions on the leaderboard. The structure is dynamic and ONLY the number one in the queue becomes the main challenge.

Queue Process

**Bidding**: Users from Ethereum (L1) and various L2 blockchains submit bids into the centralized bid pool. The bid values determine the ranking, where the highest bid secures the first position and the game state, while the second-highest becomes the next in line, and so on until all ranks are fille,  ensuring opportunities for all participants.

**Daily Reset**: At midnight, the top-ranked challenge in the queue becomes the game state for the set period of time, making room for the second-highest to claim the number one spot. All other positions advance one spot too!

**Adding**: If the previous day's top-ranked in the Challenge Queue wants to secure the first rank again, they must re add with a higher amount to reclaim their position and set the game Challenge for consecutive days.

This system ensures fairness by regularly refreshing the queue, preventing any one user from monopolizing the top position.

### Phase 2: NFT Communities compete for Control the Game 
### Phase 3: Players compete for the Hall of Survivors

## 😈👺Onchain Survivor Dynamic Difficulty Scaling👺😈

The *Onchain Survivor Dynamic Difficulty Scaling  function* will be satisfying gameplay up until minute 30. We'll assume the difficulty increases exponentially until the end. Depending on several accounting factors related to both the Players $P$ and the blockchain $B$. Let  $D(t)$  be the difficulty at time  $t$.   The final difficulty can be modeled as:

$D(t) = D_0 e^{kt} +α(Pavg​−P(t)+βB(t))$

where:

-   $D0$  is the initial difficulty at  $t=0$,
-   $k$  is a constant that determines the rate of difficulty increase.
-   $α$  is a scaling factor for the performance adjustment,
-   $Pavg​$  is the average expected performance,
-   $P(t)$  is the player's performance at time  $t$.
- $β$  is a scaling factor for the blockchain-derived difficulty,
- $B(t)$  is the difficulty factor extracted from the latest blockchain block.

Note:  Random difficulty factor $B(t)$ that is extracted from the latest block in the blockchain. The factor $B(t)$ could be based on various metrics from the blockchain, such as transaction volume, block size, or other relevant activities. The term $βB(t)$ allows the difficulty to adapt dynamically based on real-time blockchain data, adding an element of unpredictability and aligning with the decentralized nature of blockchain games. 

##  📚  Interaction Models 🕹️

As frictionless and simple as possible, No wallet required to play, the game's first priority is FUN. If the game is not fun then it will not be sustainable! 

```mermaid
graph TD
A[Welcome Screen] -->B[Quick Free to play mode]
A[Welcome Screen] --> D{Connect Wallet}
A --> C[Join a peer survivor Run]
D --> E[Request/Bid  a Run]
D --> z[Sponsor Official Run]
D --> G[Write run records]
```

Rank based auction system with periodic reset model, giving chances for all the supported chains to be able to write into the Hall of survivors!

```mermaid
graph TD
    A[ L1 and L2 Players] -->|Place Bids to own the game state| B{Bid Pool}
    B -->|Sorted by Global Bid Value| C{Daily Ranked List}
    C --> D1[1st Place chain]
    C --> D2[2nd Place]
    C --> D3[3rd Place]
  
    C --> D12[11th...12th... N chain]
    
    %% At midnight reset logic
    D1 -->| Owns the game for a day | E[Resets at midnight, other chains gain a rank]
    E -->|Winner Becomes Last, must bid or wait his turn| C

    F[Rebidding Process] -->|Outbid to Regain #1| B
```
Final design of onchain survivor, a peer-to-peer multiplayer, trustless, descentralized  game that keeps the survivors honest cryptography! 

```mermaid
   sequenceDiagram
    participant User as Survivor
    participant Client as Survivor Host
    participant SmartContract as Smart Contract
    participant OnChainData as OnChain Record
    participant Consensus as Consensus Mechanisms
    Client ->> SmartContract: Request Game Run
    User ->> Client: Access Onchain Survivor
    SmartContract ->> Client: Provide run, Initialize
    User -> Client: Finish, Verify Integrity
    Client ->> OnChainData: Update results, Meta Progress
    OnChainData ->> SmartContract: Validate client integrity
    SmartContract ->> Consensus: Broadcast Results
    SmartContract ->> Client: Update UI
    Client -> User: Display Final Results
```

## 🚀Getting Started🚀 

Follow these steps to set up Onchain Survivor on your local machine:

### ⏱️Prerequisites⏱️
- Currently tests should run in 4 years old hardware. Optimization is always an ongoing process, so please be patient.

### 💿Installation💿
- Download the client release and open index.html in your local server, or visit https://onchainsurvivor.pages.dev.

A Web3 Wallet is required to participate in the ranks!

## 🎮How to Survive🎮

-   **Connect wallet, and Request a run from the Hall of survivors**
-   **OR Join a run**: Enter an address and click "Join Room" to connect with survivor currenly playing.
-   **Move Your survivor**: Use the arrow keys, on screen joystick, WASD or IJKL to move your character around the 3D environment.
-   **Upgrade, evolve, fork, Survive**: Your movements and decisions will be broadcast to your partner in real-time. Every choice affects your gameplay. Every Ability you choose is significant, so choose wisely.

## 🤝Contributing🤝

Contributions from everyone are welcomed! You can contact me directly, make a proposal directly in github. I am really focusing adding content into the game, but you can ping me on twitter to notify me about your contribution. 

1.  **Fork the Repository**
2.  **Create a New Branch**
3.  **Commit Your Changes**
4.  **Push to the Branch**
5.  **Open a Pull Request**

## 📜License📜 

This project license is currently [TBD]. 

## 🙏 Acknowledgments ❤️

-   **Three js**: For the amazing engine ❤️.
-   **Web3 js**: For simplifying blockchain interactions ❤️.
-   **OpenAI ChatGPT**: For making development great again ❤️.
-   **Microsoft Copilot**: Best Artist i've ever known ❤️.
-   **Adobe Mixamo**: Best 3D Animator ❤️.
-   **Meshy.ai**: Best 3D Modeler ever ❤️, under the https://creativecommons.org/licenses/by/4.0/ License

## 📬 Contact

Have questions? Feel free to reach out!

-   **Twitter**:  [@OnChainSurvivor](https://twitter.com/onchainsurvivor)

Thank you for visiting our repository! We hope you enjoy Onchain Survivor as much as we enjoy developing it. Happy surviving! 🌍🎮