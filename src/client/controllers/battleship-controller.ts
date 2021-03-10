import { KnitClient as Knit } from '@rbxts/knit';
import { Players, TweenService } from '@rbxts/services';

interface Position {
    x: number;
    y: number;
};

interface ShotData {
    x?: number;
    y?: number;
    didHit?: boolean;
    failed?: boolean;
};

const DEFAULT_OBJECT_COLOR = Color3.fromRGB(0, 113, 162);
const DEFAULT_CORNER_RADIUS = new UDim(0, 6);
const HIT_COLOR = Color3.fromRGB(255, 193, 7);
const CHOSEN_COLOR = Color3.fromRGB(0, 139, 198);

const battleshipGUI = (Players.LocalPlayer.FindFirstChildOfClass('PlayerGui') as PlayerGui).WaitForChild('BattleshipGUI') as ScreenGui;
const mainFrame = battleshipGUI.WaitForChild('MainFrame') as Frame;
const infoLabel = mainFrame.WaitForChild('InfoLabel') as TextLabel;
const playAgainBtn = mainFrame.WaitForChild('PlayAgainBtn') as TextButton;
const boardFrame = mainFrame.WaitForChild('BoardFrame') as Frame;
const opponentBoardFrame = mainFrame.WaitForChild('OpponentBoardFrame') as Frame;

const components = battleshipGUI.WaitForChild('Components') as Configuration;
const objectFramePrefab = components.WaitForChild('ObjectFrame') as Frame;
const objectBtnPrefab = components.WaitForChild('ObjectBtn') as TextButton;

const sounds = (Players.LocalPlayer.WaitForChild('PlayerScripts') as PlayerScripts).WaitForChild('Sounds') as Folder;
const sea = sounds.WaitForChild('Sea') as Sound;
const beep = sounds.WaitForChild('Beep') as Sound;

const objects = new Map<number, Map<number, Frame>>();
const opponentObjects = new Map<number, Map<number, TextButton>>();

declare global {
    interface KnitControllers {
        BattleshipController: typeof BattleshipController;
    }
}

const BattleshipController = Knit.CreateController({
    Name: 'BattleshipController',

    KnitStart() {
        const BattleshipService = Knit.GetService('BattleshipService');

        sea.Play();

        for (let i = 1; i <= 11; i++) {
            objects.set(i, new Map<number, Frame>());
            opponentObjects.set(i, new Map<number, TextButton>());
            for (let j = 1; j <= 11; j++) {
                const objectFrame = objectFramePrefab.Clone();
                objectFrame.Parent = boardFrame;
                objects.get(i)!.set(j, objectFrame);

                const objectBtn = objectBtnPrefab.Clone();
                objectBtn.Parent = opponentBoardFrame;
                opponentObjects.get(i)!.set(j, objectBtn);
                objectBtn.MouseButton1Click.Connect(() => {
                    if (objectBtn.FindFirstChildOfClass('UICorner')!.CornerRadius !== DEFAULT_CORNER_RADIUS) return;
                    const shotData = BattleshipService.Shoot(i, j);
                    if (shotData.failed) return;
                    if (shotData.didHit) {
                        objectBtn.BackgroundColor3 = HIT_COLOR;
                    } else {
                        objectBtn.BackgroundColor3 = CHOSEN_COLOR;
                    }
                    TweenService.Create(objectBtn.FindFirstChildOfClass('UICorner')!, new TweenInfo(0.23), {CornerRadius: new UDim(0, 20)}).Play();
                });
            }
        }

        BattleshipService.ClearBoards.Connect(() => {
            for (const [_, columns] of objects) {
                for (const [_, object] of columns) {
                    object.BackgroundColor3 = DEFAULT_OBJECT_COLOR;
                    object.FindFirstChildOfClass('UICorner')!.CornerRadius = DEFAULT_CORNER_RADIUS;
                }
            }

            for (const [_, columns] of opponentObjects) {
                for (const [_, object] of columns) {
                    object.BackgroundColor3 = DEFAULT_OBJECT_COLOR;
                    object.FindFirstChildOfClass('UICorner')!.CornerRadius = DEFAULT_CORNER_RADIUS;
                }
            }
        });

        BattleshipService.SetInfo.Connect((text: string) => {
            beep.Play();
            infoLabel.Text = text;
        });

        BattleshipService.SetupBattleship.Connect((color: Color3, positions: Position[]) => {
            for (const position of positions) {
                objects.get(position.x)!.get(position.y)!.BackgroundColor3 = color;
            }
        });

        BattleshipService.ShotAt.Connect((shotData: ShotData) => {
            const objectFrame = objects.get(shotData.x!)!.get(shotData.y!)!;
            if (shotData.didHit) {
                objectFrame.BackgroundColor3 = HIT_COLOR;
            } else {
                objectFrame.BackgroundColor3 = CHOSEN_COLOR;
            }
            TweenService.Create(objectFrame.FindFirstChildOfClass('UICorner')!, new TweenInfo(0.23), {CornerRadius: new UDim(0, 20)}).Play();
        });

        BattleshipService.SetPlayAgainButtonVisibility.Connect((enabled: boolean) => {
            playAgainBtn.Visible = enabled;
            boardFrame.Visible = !enabled;
            opponentBoardFrame.Visible = !enabled;
        });

        playAgainBtn.MouseButton1Click.Connect(() => {
            BattleshipService.PlayAgain.Fire();
        });
    }
});
