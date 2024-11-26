pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ChallengeQueue is Ownable {
      constructor() Ownable(msg.sender) { } 

    struct Challenge {
        address challenger;
        uint256 amount;
        uint8[3] parameters;
    }

    Challenge[] public challenges; // Challenge Queue, ordered by total amount
    Challenge[] public pastRoundWinners; // Hall of Chalengers, in order

    uint256 public challengeRoundBlockInterval = 7200; // Interval for winner selection (in blocks)
    uint256 public lastWinnerBlock; // Block number of the last winner declaration
    address public challengeWallet = 0xBC321C9EcBd7FC3A5867DE8db50f38AEe9011415;

    event ChallengeAdded(address indexed challenger, uint256 amount, uint8[3] parameters);
    event WinnerDeclared(address indexed winner, uint256 amount, uint8[3] parameters,uint256 winningBlock);
    event ChallengeWalletUpdated(address indexed previousWallet, address indexed newWallet);
    event ChallengeIntervalUpdated(uint256 previousInterval, uint256 newInterval);

    function addChallenge(uint8[3] memory _parameters) public payable {
        require(msg.value > 0.00035 ether, "Challenge amount must be greater than 0.00035 ether");

        if (block.number >= lastWinnerBlock + challengeRoundBlockInterval && challenges.length > 0) {
             declareWinner();
        }

        bool found = false;

        // Check if the challenger already exists in the array
        for (uint256 i = 0; i < challenges.length; i++) {
            if (challenges[i].challenger == msg.sender) {
                // Update the existing challenge
                challenges[i].amount += msg.value;
                challenges[i].parameters = _parameters;
                found = true;
                break;
            }
        }

        // If no existing challenge is found, add a new one
        if (!found) {
            challenges.push(Challenge({
                challenger: msg.sender,
                amount: msg.value,
                parameters: _parameters
            }));
        }

        _sortChallenges();

        (bool sent, ) = challengeWallet.call{value: msg.value}(""); 
        require(sent, "Failed to send Ether");

        emit ChallengeAdded(msg.sender, msg.value, _parameters);
    }

    function blocksUntilNextWinner() public view returns (uint256) {
        if (block.number >= lastWinnerBlock + challengeRoundBlockInterval) {
            return 0; // The interval has already passed, a winner can be declared now.
        }
        return (lastWinnerBlock + challengeRoundBlockInterval) - block.number;
    }

    function declareWinner() public {
        require(block.number >= lastWinnerBlock + challengeRoundBlockInterval, "Interval not reached");
        require(challenges.length > 0, "No challenge in the queue");

        // Winner is the first challenge in the sorted array
        Challenge memory winningChallenge = challenges[0];

        // Push the winner to the past winners array
        pastRoundWinners.push(winningChallenge);
 
        // Remove the winner from Queue
        _removeChallenge(0);

        // Update the block number of the last winner declaration
        lastWinnerBlock = block.number;

        emit WinnerDeclared(winningChallenge.challenger, winningChallenge.amount, winningChallenge.parameters,lastWinnerBlock);
    }

    function getChallenges() public view returns (Challenge[] memory) {
        return challenges;
    }

    function getPastWinners() public view returns (Challenge[] memory) {
        return pastRoundWinners;
    }

    function setChallengeRoundBlockInterval(uint256 _interval) public onlyOwner {
        require(_interval >= 300, "Interval cannot be less than 1 hour");
        emit ChallengeIntervalUpdated(challengeRoundBlockInterval, _interval);
        challengeRoundBlockInterval = _interval;
    }

    function setChallengeWallet(address _newWallet) public onlyOwner {
        emit ChallengeWalletUpdated(challengeWallet, _newWallet);
        challengeWallet = _newWallet;
    }

    function _sortChallenges() internal {
        uint256 length = challenges.length;
        for (uint256 i = 1; i < length; i++) {
            Challenge memory key = challenges[i];
            int256 j = int256(i) - 1;

            while (j >= 0 && challenges[uint256(j)].amount < key.amount) {
                challenges[uint256(j + 1)] = challenges[uint256(j)];
                j--;
            }
            challenges[uint256(j + 1)] = key;
        }
    }

    function _removeChallenge(uint256 index) internal {
        require(index < challenges.length, "Index out of bounds");
        challenges[index] = challenges[challenges.length - 1];
        challenges.pop();
    }
}