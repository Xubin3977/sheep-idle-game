import { sys } from 'cc';

export interface PlayerState {
    coins: number;
    grass: number;
    level: number;
    exp: number;
    stage: number;
    idleSeconds: number;
    feedCount: number;
    starterTaskClaimed: boolean;
}

export type PlayerDataListener = (state: Readonly<PlayerState>) => void;
export type FeedResult = 'success' | 'no-grass' | 'time-full';
export type PurchaseResult = 'success' | 'not-enough-coins';
export type TaskClaimResult = 'success' | 'not-ready' | 'already-claimed';

interface StoredPlayerData {
    version: number;
    savedAt: number;
    rewardRemainder: number;
    state: PlayerState;
}

const STORAGE_KEY = 'sheep-idle-game.player-data.v2';
const SAVE_VERSION = 2;
const MAX_VALUE = 100_000_000;
const MAX_LEVEL = 100;

export const FEED_GRASS_COST = 1;
export const FEED_SECONDS = 10 * 60;
export const MAX_IDLE_SECONDS = 2 * 60 * 60;
export const REWARD_INTERVAL_SECONDS = 10;
export const REWARD_COINS = 1;
export const REWARD_EXP = 2;
export const SHOP_GRASS_COST = 80;
export const SHOP_GRASS_AMOUNT = 5;
export const STARTER_TASK_REWARD_COINS = 50;
export const STARTER_TASK_REWARD_GRASS = 3;

const INITIAL_PLAYER_STATE: PlayerState = {
    coins: 100,
    grass: 12,
    level: 1,
    exp: 0,
    stage: 1,
    idleSeconds: 0,
    feedCount: 0,
    starterTaskClaimed: false,
};

export class PlayerData {
    private static readonly singleton = new PlayerData();

    static get instance(): PlayerData {
        return PlayerData.singleton;
    }

    private state: PlayerState = { ...INITIAL_PLAYER_STATE };
    private readonly listeners = new Set<PlayerDataListener>();
    private secondAccumulator = 0;
    private rewardRemainder = 0;

    private constructor() {
        this.load();
    }

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

    tick(deltaTime: number): void {
        if (this.state.idleSeconds <= 0 || !Number.isFinite(deltaTime) || deltaTime <= 0) {
            return;
        }

        this.secondAccumulator += deltaTime;
        const elapsedSeconds = Math.floor(this.secondAccumulator);
        if (elapsedSeconds <= 0) {
            return;
        }

        this.secondAccumulator -= elapsedSeconds;
        this.applyIdleProgress(elapsedSeconds);
    }

    feedGrass(): FeedResult {
        if (this.state.idleSeconds >= MAX_IDLE_SECONDS) {
            return 'time-full';
        }
        if (this.state.grass < FEED_GRASS_COST) {
            return 'no-grass';
        }

        this.replaceState({
            ...this.state,
            grass: this.state.grass - FEED_GRASS_COST,
            idleSeconds: Math.min(MAX_IDLE_SECONDS, this.state.idleSeconds + FEED_SECONDS),
            feedCount: this.state.feedCount + 1,
        });
        return 'success';
    }

    purchaseGrass(): PurchaseResult {
        if (this.state.coins < SHOP_GRASS_COST) {
            return 'not-enough-coins';
        }

        this.replaceState({
            ...this.state,
            coins: this.state.coins - SHOP_GRASS_COST,
            grass: this.state.grass + SHOP_GRASS_AMOUNT,
        });
        return 'success';
    }

    claimStarterTask(): TaskClaimResult {
        if (this.state.starterTaskClaimed) {
            return 'already-claimed';
        }
        if (this.state.feedCount < 1) {
            return 'not-ready';
        }

        this.replaceState({
            ...this.state,
            coins: this.state.coins + STARTER_TASK_REWARD_COINS,
            grass: this.state.grass + STARTER_TASK_REWARD_GRASS,
            starterTaskClaimed: true,
        });
        return 'success';
    }

    reset(): void {
        this.secondAccumulator = 0;
        this.rewardRemainder = 0;
        this.replaceState({ ...INITIAL_PLAYER_STATE });
    }

    addCoins(amount: number): void {
        this.patch({ coins: this.state.coins + this.toNonNegativeInteger(amount) });
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
        this.patch({ grass: this.state.grass + this.toNonNegativeInteger(amount) });
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
        const next = this.calculateExperience(this.state.level, this.state.exp, amount);
        this.patch(next);
    }

    advanceStage(): void {
        this.patch({ stage: this.state.stage + 1 });
    }

    requiredExperience(level = this.state.level): number {
        return Math.min(MAX_VALUE, Math.max(1, level) * 100);
    }

    private applyIdleProgress(elapsedSeconds: number): void {
        const activeSeconds = Math.min(this.toNonNegativeInteger(elapsedSeconds), this.state.idleSeconds);
        if (activeSeconds <= 0) {
            return;
        }

        this.rewardRemainder += activeSeconds;
        const rewardCycles = Math.floor(this.rewardRemainder / REWARD_INTERVAL_SECONDS);
        this.rewardRemainder %= REWARD_INTERVAL_SECONDS;

        const expResult = this.calculateExperience(
            this.state.level,
            this.state.exp,
            rewardCycles * REWARD_EXP,
        );

        this.replaceState({
            ...this.state,
            idleSeconds: this.state.idleSeconds - activeSeconds,
            coins: this.state.coins + rewardCycles * REWARD_COINS,
            level: expResult.level,
            exp: expResult.exp,
        });
    }

    private calculateExperience(level: number, exp: number, amount: number): Pick<PlayerState, 'level' | 'exp'> {
        let nextLevel = this.clamp(level, 1, MAX_LEVEL);
        let nextExp = this.toNonNegativeInteger(exp) + this.toNonNegativeInteger(amount);

        while (nextLevel < MAX_LEVEL && nextExp >= this.requiredExperience(nextLevel)) {
            nextExp -= this.requiredExperience(nextLevel);
            nextLevel += 1;
        }

        if (nextLevel >= MAX_LEVEL) {
            nextExp = Math.min(nextExp, this.requiredExperience(MAX_LEVEL));
        }

        return { level: nextLevel, exp: nextExp };
    }

    private patch(patch: Partial<PlayerState>): void {
        this.replaceState({ ...this.state, ...patch });
    }

    private replaceState(nextState: PlayerState): void {
        const normalized = this.normalizeState(nextState);
        const changed = (
            normalized.coins !== this.state.coins
            || normalized.grass !== this.state.grass
            || normalized.level !== this.state.level
            || normalized.exp !== this.state.exp
            || normalized.stage !== this.state.stage
            || normalized.idleSeconds !== this.state.idleSeconds
            || normalized.feedCount !== this.state.feedCount
            || normalized.starterTaskClaimed !== this.state.starterTaskClaimed
        );

        if (!changed) {
            return;
        }

        this.state = normalized;
        this.save();
        const snapshot = this.snapshot;
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    private normalizeState(state: Partial<PlayerState>): PlayerState {
        return {
            coins: this.clamp(state.coins ?? INITIAL_PLAYER_STATE.coins, 0, MAX_VALUE),
            grass: this.clamp(state.grass ?? INITIAL_PLAYER_STATE.grass, 0, MAX_VALUE),
            level: this.clamp(state.level ?? INITIAL_PLAYER_STATE.level, 1, MAX_LEVEL),
            exp: this.clamp(state.exp ?? INITIAL_PLAYER_STATE.exp, 0, MAX_VALUE),
            stage: this.clamp(state.stage ?? INITIAL_PLAYER_STATE.stage, 1, MAX_VALUE),
            idleSeconds: this.clamp(state.idleSeconds ?? 0, 0, MAX_IDLE_SECONDS),
            feedCount: this.clamp(state.feedCount ?? 0, 0, MAX_VALUE),
            starterTaskClaimed: Boolean(state.starterTaskClaimed),
        };
    }

    private load(): void {
        try {
            const raw = sys.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }

            const stored = JSON.parse(raw) as Partial<StoredPlayerData>;
            if (!stored.state || stored.version !== SAVE_VERSION) {
                return;
            }

            this.state = this.normalizeState(stored.state);
            this.rewardRemainder = this.clamp(
                stored.rewardRemainder ?? 0,
                0,
                REWARD_INTERVAL_SECONDS - 1,
            );

            const savedAt = Number(stored.savedAt);
            if (Number.isFinite(savedAt) && savedAt > 0) {
                const offlineSeconds = Math.floor((Date.now() - savedAt) / 1000);
                this.applyIdleProgress(offlineSeconds);
            }
        } catch (error) {
            console.warn('[PlayerData] Failed to load save data.', error);
            this.state = { ...INITIAL_PLAYER_STATE };
            this.rewardRemainder = 0;
        }
    }

    private save(): void {
        try {
            const stored: StoredPlayerData = {
                version: SAVE_VERSION,
                savedAt: Date.now(),
                rewardRemainder: this.rewardRemainder,
                state: this.state,
            };
            sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (error) {
            console.warn('[PlayerData] Failed to save player data.', error);
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
