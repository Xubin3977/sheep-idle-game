export interface PlayerState {
    coins: number;
    grass: number;
    level: number;
    exp: number;
    stage: number;
}

export type PlayerDataListener = (state: Readonly<PlayerState>) => void;

const MAX_VALUE = 100_000_000;
const INITIAL_PLAYER_STATE: PlayerState = {
    coins: 100,
    grass: 12,
    level: 1,
    exp: 0,
    stage: 1,
};

export class PlayerData {
    private static readonly singleton = new PlayerData();

    static get instance(): PlayerData {
        return PlayerData.singleton;
    }

    private state: PlayerState = { ...INITIAL_PLAYER_STATE };
    private readonly listeners = new Set<PlayerDataListener>();

    private constructor() {}

    get snapshot(): Readonly<PlayerState> {
        return { ...this.state };
    }

    subscribe(listener: PlayerDataListener, notifyImmediately = true): () => void {
        this.listeners.add(listener);
        if (notifyImmediately) {
            listener(this.snapshot);
        }

        return () => {
            this.listeners.delete(listener);
        };
    }

    reset(): void {
        this.replaceState(INITIAL_PLAYER_STATE);
    }

    addCoins(amount: number): void {
        this.patch({
            coins: this.state.coins + this.toNonNegativeInteger(amount),
        });
    }

    spendCoins(amount: number): boolean {
        const cost = this.toNonNegativeInteger(amount);
        if (cost > this.state.coins) {
            return false;
        }

        this.patch({ coins: this.state.coins - cost });
        return true;
    }

    addGrass(amount: number): void {
        this.patch({
            grass: this.state.grass + this.toNonNegativeInteger(amount),
        });
    }

    spendGrass(amount: number): boolean {
        const cost = this.toNonNegativeInteger(amount);
        if (cost > this.state.grass) {
            return false;
        }

        this.patch({ grass: this.state.grass - cost });
        return true;
    }

    addExperience(amount: number): void {
        let level = this.state.level;
        let exp = this.state.exp + this.toNonNegativeInteger(amount);

        while (exp >= this.requiredExperience(level)) {
            exp -= this.requiredExperience(level);
            level += 1;
        }

        this.patch({ level, exp });
    }

    advanceStage(): void {
        this.patch({ stage: this.state.stage + 1 });
    }

    requiredExperience(level = this.state.level): number {
        return Math.min(MAX_VALUE, Math.max(1, level) * 100);
    }

    private patch(patch: Partial<PlayerState>): void {
        this.replaceState({
            ...this.state,
            ...patch,
        });
    }

    private replaceState(nextState: PlayerState): void {
        const normalized: PlayerState = {
            coins: this.clamp(nextState.coins, 0, MAX_VALUE),
            grass: this.clamp(nextState.grass, 0, MAX_VALUE),
            level: this.clamp(nextState.level, 1, 100),
            exp: this.clamp(nextState.exp, 0, MAX_VALUE),
            stage: this.clamp(nextState.stage, 1, MAX_VALUE),
        };

        if (
            normalized.coins === this.state.coins
            && normalized.grass === this.state.grass
            && normalized.level === this.state.level
            && normalized.exp === this.state.exp
            && normalized.stage === this.state.stage
        ) {
            return;
        }

        this.state = normalized;
        const snapshot = this.snapshot;
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.min(maximum, Math.max(minimum, this.toNonNegativeInteger(value)));
    }

    private toNonNegativeInteger(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.floor(value));
    }
}

export const playerData = PlayerData.instance;
