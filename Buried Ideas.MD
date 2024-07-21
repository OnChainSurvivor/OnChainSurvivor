# Buried Ideas
This unordered list includes ideas scrapped during design or production. They are documented here to keep track of them and serve as a reference in case they are needed in the future. 

## 


## Onchain Execution, Ideal design of Onchain Survivor, fully descentralized vertical stack, Initial basic design 
The ideal final arquitectural design concept of executing the game entirely on-chain was scrapped. Instead, a new design was implemented where cryptographic proof ensures that the game client has not been tampered with. This approach maintains the integrity and security of the game while reducing the complexity and cost associated with full on-chain execution.


```mermaid
sequenceDiagram
    participant User
    participant FrontEnd as Decentralized Front-End
    participant SmartContract as Smart Contracts
    participant AppLogic as Decentralized App Logic
    participant Storage as Decentralized Storage
    participant OnChainData as On-Chain Data
    participant Consensus as Consensus Mechanisms
    participant P2P as P2P Network

    User ->> FrontEnd: Access Game
    FrontEnd ->> SmartContract: Request Game Logic
    SmartContract ->> AppLogic: Execute Game Logic
    AppLogic ->> Storage: Store Game Data
    AppLogic ->> OnChainData: Update On-Chain Data
    Storage ->> Consensus: Verify Data Storage
    OnChainData ->> Consensus: Validate Data
    Consensus ->> P2P: Broadcast Consensus
    P2P ->> SmartContract: Update Network State
    P2P ->> FrontEnd: Update User Interface
    FrontEnd ->> User: Display Game State
```

```mermaid
graph TD
    A[User Interaction Layer]
    A --> B[Decentralized Front-End Interface]

    B --> C[Execution Layer]
    C --> D[Smart Contracts on Blockchain]
    C --> E[Decentralized Application Logic]

    D --> F[Data Layer]
    E --> F
    F --> G[Decentralized Storage Solutions]
    F --> H[On-Chain Data]

    G --> I[Consensus Layer]
    H --> I
    I --> J[Consensus Mechanisms]

    J --> K[Networking Layer]
    K --> L[P2P Network Protocols]
    K --> M[Node Communication]
    
    subgraph Execution Layer
        C
        D
        E
    end
    
    subgraph Data Layer
        F
        G
        H
    end
    
    subgraph Consensus Layer
        I
        J
    end
    
    subgraph Networking Layer
        K
        L
        M
    end
```

```mermaid
sequenceDiagram
Client -> Blockchain*: NFT / Asset List
Blockchain* -->>User: Selection complete ?
Activate User
User->> Blockchain*: Tx / Signature 
Blockchain*-->> Client: Update client
Note left of Blockchain*: Magical gameplay happens....
Blockchain* -> Client: Block Calculated Difficulty data
Client-->>User: Finished Surviving, 30m or less
User->> Blockchain*: Write Results
Client->> Blockchain*: Write Results
```
*Blockchain / RPC

```mermaid
sequenceDiagram
    participant User2 as Survivors friend
    participant User as Survivor Hosting
    participant Client as OffChain Client
    participant SmartContract as Smart Contracts
    participant OnChainData as OnChain Data
    participant Consensus as Consensus Mechanisms
    
    User ->> Client: Access Onchain Survivor
    Client ->> SmartContract: Request hashed Game randomizer
    SmartContract ->> Client: Provide run, Initialize
    User2 ->> User: Join Survivor Run
    Client ->> OnChainData: Update results, Meta Progress
    OnChainData ->> SmartContract: Validate client results integrity
    SmartContract ->> Consensus: Broadcast Consensus
    SmartContract ->> Client: Update User Interface
    Client ->> User: Display Game State
    User ->> User2: Display Game State
```

## Generic NFT Traits and Properties
This document contains generic design elements that were initially drafted for the game. During production, these ideas were deemed too generic and were subsequently replaced with a more specific, onchain survivor class-oriented design.

1. Backgrounds

* Cyber City
* Neon Desert
* Digital Jungle
* Quantum Abyss
* Metaverse Market

2. Characters

* Hacker
* Cyber Samurai
* Space Ranger
* AI Entity
* Bio-enhanced Survivor

3. Outfits

* Stealth Suit
* Battle Armor
* Casual Wear
* Sci-Fi Robes
* Space Suit

4. Weapons

* Laser Sword
* Plasma Rifle
* Quantum Blaster
* Holo-Bow
* Energy Shield

5. Accessories

* Holo-Goggles
* Robotic Arm
* Jetpack
* Data Pad
* Crypto Amulet

6. Power-ups

* Speed Boost
* Shield Generator
* Healing Nanobots
* Invisibility Cloak
* EMP Grenade

7. Expressions

* Determined
* Angry
* Smirking
* Focused
* Battle-Ready


## Old Table of Contents🧩
Old table of contents used in the initial tests. 

1. [Onchain Survivor](#onchain-survivor)
2. [About the Project](#about-the-project)
   - [Key Features](#key-features)
3. [Onchain Survivor Dynamic Difficulty Scaling](#onchain-survivor-dynamic-difficulty-scaling)
4. [Getting Started](#getting-started)
   - [Prerequisites](#%EF%B8%8prerequisites%EF%B8%8F)
   - [Installation](#installation)
5. [How to Play](#how-to-play)
6. [Contributing](#contributing)
   - [Fork the Repository](#fork-the-repository)
   - [Create a New Branch](#create-a-new-branch)
   - [Commit Your Changes](#commit-your-changes)
   - [Push to the Branch](#push-to-the-branch)
   - [Open a Pull Request](#open-a-pull-request)
7. [License](#license)
8. [OnChain Survivor NFT Series, "The Survivors"](#-onchain-survivor-nft-series-the-survivors--)
9. [Basic Interaction Models](#-basic-interaction-models-%EF%B8%8F)
   - [Sequence Diagrams](#sequence-diagrams)
   - [Flowcharts](#flowcharts)
10. [Acknowledgments](#-acknowledgments)
11. [Contact](#-contact)