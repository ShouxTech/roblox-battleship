import { KnitServer as Knit, RemoteSignal } from '@rbxts/knit';
import { PhysicsService, Players } from '@rbxts/services';
import { GRID_SIZE } from 'shared/constants';

enum Directions {
    Up = 1,
    Left = 2,
    Down = 3,
    Right = 4
};

interface Position {
    x: number;
    y: number;
};

interface Battleships {
    redShip: ShipData;
    blueShip: ShipData;
    orangeShip: ShipData;
    purpleShip: ShipData;
    yellowShip: ShipData;
};

interface ShipData {
    length: number;
    color: Color3;
    positions: Position[];
    damagedPositions: Position[];
    isDestroyed: boolean;
};

interface ShotData {
    x?: number;
    y?: number;
    didHit?: boolean;
    failed?: boolean;
};

const PLAYERS_NEEDED = 2;
const RED_COLOR = Color3.fromRGB(180, 0, 0);
const BLUE_COLOR = Color3.fromRGB(23, 168, 208);
const ORANGE_COLOR = Color3.fromRGB(238, 146, 17);
const PURPLE_COLOR = Color3.fromRGB(105, 105, 157);
const YELLOW_COLOR = Color3.fromRGB(188, 188, 93);

const battleships: Map<Player, Battleships> = new Map();

const takenPositions: Map<Color3, Position[]> = new Map();

const playAgainVotes: Map<Player, boolean> = new Map();

let currentTurn: Player | undefined;

function getOpponent(plr: Player): Player | undefined {
    for (const player of Players.GetPlayers()) {
        if (player !== plr) {
            return player;
        }
    }
}

function isInGridBounds(position: Position, direction: number): boolean {
    if (direction === Directions.Up) {
        if (position.y < 1) return false;
    } else if (direction === Directions.Left) {
        if (position.x < 1) return false;
    } else if (direction === Directions.Down) {
        if (position.y > GRID_SIZE.height) return false;
    } else if (direction === Directions.Right) {
        if (position.x > GRID_SIZE.width) return false;
    }

    return true;
}

function isPositionTaken(position: Position): boolean {
    for (const [_, shipTakenPositions] of takenPositions) {
        for (const takenPosition of shipTakenPositions) {
            if ((takenPosition.x === position.x) && (takenPosition.y === position.y)) {
                return true;
            }
        }
    }

    return false;
}

function chooseShipPosition(startPosition: Position, direction: number, offset: number): Position {
    let nextPos: Position = {
        x: 0,
        y: 0
    };

    if (direction === Directions.Up) {
        nextPos = {
            x: startPosition.x,
            y: startPosition.y - offset
        };
    } else if (direction === Directions.Left) {
        nextPos = {
            x: startPosition.x - offset,
            y: startPosition.y
        };
    } else if (direction === Directions.Down) {
        nextPos = {
            x: startPosition.x,
            y: startPosition.y + offset
        };
    } else if (direction === Directions.Right) {
        nextPos = {
            x: startPosition.x + offset,
            y: startPosition.y
        };
    }

    return nextPos;
}

function createShip(shipData: ShipData): ShipData {
    shipData.positions.clear();
    takenPositions.delete(shipData.color);

    const startPosition: Position = {
        x: math.random(1, GRID_SIZE.width),
        y: math.random(1, GRID_SIZE.height)
    };
    const direction = math.random(1, 4);

    if (isPositionTaken(startPosition)) {
        return createShip(shipData);
    }

    takenPositions.set(shipData.color, [startPosition]);
    shipData.positions.push(startPosition);

    for (let i = 1; i < shipData.length; i++) {
        const shipPosition = chooseShipPosition(startPosition, direction, i);
        if (!isInGridBounds(shipPosition, direction)) {
            return createShip(shipData);
        }
    }

    for (let i = 1; i < shipData.length; i++) {
        const shipPosition = chooseShipPosition(startPosition, direction, i);
        if (isPositionTaken(shipPosition)) {
            return createShip(shipData);
        }
        takenPositions.get(shipData.color)!.push(shipPosition);
    }

    for (let i = 1; i < shipData.length; i++) {
        const shipPosition = chooseShipPosition(startPosition, direction, i);
        shipData.positions.push(shipPosition);
    }

    return shipData;
}

declare global {
    interface KnitServices {
        BattleshipService: typeof BattleshipService;
    }
}

const BattleshipService = Knit.CreateService({
    Name: 'BattleshipService',

    Client: {
        ClearBoards: new RemoteSignal<() => void>(),
        SetInfo: new RemoteSignal<(text: string) => void>(),
        SetupBattleship: new RemoteSignal<(color: Color3, positions: Position[]) => void>(),
        ShotAt: new RemoteSignal<(shotData: ShotData) => void>(),
        GameEnded: new RemoteSignal<(winnerName: string) => void>(),
        SetPlayAgainButtonVisibility: new RemoteSignal<(enabled: boolean) => void>(),
        PlayAgain: new RemoteSignal<() => void>(),

        Shoot(plr: Player, x: number, y: number) {
            return Knit.Services.BattleshipService.shoot(plr, x, y);
        }
    },

    shoot(plr: Player, x: number, y: number): ShotData {
        if (plr !== currentTurn) return {failed: true};

        const opponent = getOpponent(plr);
        if (!opponent) return {failed: true};

        currentTurn = undefined;

        let shotData: ShotData = {};

        const opponentBattleships = battleships.get(opponent)!;
        let destroyedFullBattleship = false;

        for (const [_, battleship] of pairs(opponentBattleships)) {
            if (battleship.isDestroyed) continue;
            for (const position of battleship.positions) {
                if ((x === position.x) && (y === position.y)) {
                    if (battleship.damagedPositions.some((damagedPosition) => damagedPosition === position)) {
                        currentTurn = plr;
                        return {failed: true};
                    }
                    shotData = {didHit: true};
                    battleship.damagedPositions.push(position);
                    if (battleship.damagedPositions.size() === battleship.length) {
                        battleship.isDestroyed = true;
                        destroyedFullBattleship = true;
                    }
                }
            }
        }

        shotData = shotData || {didHit: false};
        this.Client.ShotAt.Fire(opponent, {
            x: x,
            y: y,
            didHit: shotData.didHit
        });
        currentTurn = opponent;
        this.Client.SetInfo.FireAll(`${currentTurn.Name}'s turn`);

        if (destroyedFullBattleship) {
            let destroyedAllBattleships = true;
            for (const [_, battleship] of pairs(opponentBattleships)) {
                if (!battleship.isDestroyed) {
                    destroyedAllBattleships = false;
                    break;
                }
            }
            if (destroyedAllBattleships) {
                this.endGame(plr.Name);
            }
        }

        return shotData;
    },

    characterAdded(char: Model, plr: Player) {
        (char.WaitForChild('HumanoidRootPart') as BasePart).Anchored = true;
        if (!plr.HasAppearanceLoaded()) plr.CharacterAppearanceLoaded.Wait();
        for (const part of char.GetDescendants()) {
            if (part.IsA('BasePart')) {
                PhysicsService.SetPartCollisionGroup(part, 'Characters');
            }
        }
    },

    startGame() {
        this.Client.SetPlayAgainButtonVisibility.FireAll(false);

        for (const plr of Players.GetPlayers()) {
            currentTurn = Players.GetPlayers()[0];
            this.Client.SetInfo.Fire(plr, `${currentTurn.Name}'s turn`);

            const plrBattleships: Battleships = {
                redShip: createShip({
                    length: 6,
                    color: RED_COLOR,
                    positions: [],
                    damagedPositions: [],
                    isDestroyed: false
                }),
                blueShip: createShip({
                    length: 5,
                    color: BLUE_COLOR,
                    positions: [],
                    damagedPositions: [],
                    isDestroyed: false
                }),
                orangeShip: createShip({
                    length: 4,
                    color: ORANGE_COLOR,
                    positions: [],
                    damagedPositions: [],
                    isDestroyed: false
                }),
                purpleShip: createShip({
                    length: 3,
                    color: PURPLE_COLOR,
                    positions: [],
                    damagedPositions: [],
                    isDestroyed: false
                }),
                yellowShip: createShip({
                    length: 2,
                    color: YELLOW_COLOR,
                    positions: [],
                    damagedPositions: [],
                    isDestroyed: false
                })
            };

            battleships.set(plr, plrBattleships);

            for (let [_, battleship] of pairs(plrBattleships)) {
                this.Client.SetupBattleship.Fire(plr, battleship.color, battleship.positions);
            }

            takenPositions.clear();
        }
    },

    endGame(winnerName?: string) {
        currentTurn = undefined;
        battleships.clear();
        for (const plr of Players.GetPlayers()) {
            let infoText = 'Waiting for opponent...';
            if (winnerName) {
                infoText = `${winnerName} won! Waiting for opponent...`;
            }
            this.Client.SetInfo.Fire(plr, infoText);
            this.Client.SetPlayAgainButtonVisibility.Fire(plr, winnerName ? true : false);
            this.Client.ClearBoards.Fire(plr);
        }
    },

    playAgain(plr: Player) {
        playAgainVotes.set(plr, true);
        if (playAgainVotes.size() === 2) {
            playAgainVotes.clear();
            this.startGame();
        }
    },

    playerAdded(plr: Player) {
        plr.CharacterAdded.Connect((char) => {
            this.characterAdded(char, plr);
        });

        if (Players.GetPlayers().size() === PLAYERS_NEEDED) {
            this.startGame();
        } else {
            const targetPlr = getOpponent(plr) || plr;
            this.Client.SetInfo.Fire(targetPlr, 'Waiting for opponent...');
            this.Client.ClearBoards.Fire(targetPlr);
        }
    },

    playerRemoving(plr: Player) {
        if (Players.GetPlayers().size() !== PLAYERS_NEEDED) {
            this.endGame();
        }
    },

    KnitStart() {
        for (const plr of Players.GetPlayers()) {
            this.playerAdded(plr);
        }

        Players.PlayerAdded.Connect((plr) => {
            this.playerAdded(plr)
        });

        Players.PlayerRemoving.Connect((plr) => {
            this.playerRemoving(plr);
        });

        this.Client.PlayAgain.Connect((plr) => {
            this.playAgain(plr);
        });
    },

    KnitInit() {

    }
});

export = BattleshipService;
