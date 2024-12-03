
// File: @openzeppelin/contracts/utils/Context.sol


// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol


// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: contracts/ChallengerQueue.sol


pragma solidity ^0.8.0;


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

    function addChallenge(uint8[3] memory _parameters) public payable {
        require(msg.value > 0.001 ether, "Challenge amount must be greater than 0.00035 ether");

        // Check if it's time to declare a winner
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

        // Reorganize the array by descending order of amount
        _sortChallenges();

        // Transfer ETH to dev wallet
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

    //Added events for more  transparency
    event ChallengeWalletUpdated(address indexed previousWallet, address indexed newWallet);
    event ChallengeIntervalUpdated(uint256 previousInterval, uint256 newInterval);

    function setChallengeRoundBlockInterval(uint256 _interval) public onlyOwner {
        require(_interval >= 300, "Interval cannot be less than 1 hour");
        emit ChallengeIntervalUpdated(challengeRoundBlockInterval, _interval);
        challengeRoundBlockInterval = _interval;
    }

    function setChallengeWallet(address _newWallet) public onlyOwner {
        emit ChallengeWalletUpdated(challengeWallet, _newWallet);
        challengeWallet = _newWallet;
    }

    // Internal helper to sort Queue by amount in descending order
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

    // Internal helper to remove a challenge at a specific index
    function _removeChallenge(uint256 index) internal {
        require(index < challenges.length, "Index out of bounds");
        challenges[index] = challenges[challenges.length - 1];
        challenges.pop();
    }
}