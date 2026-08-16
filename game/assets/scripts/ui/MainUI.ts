import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    UITransform,
    VerticalTextAlignment,
} from 'cc';
import {
    MAX_IDLE_SECONDS,
    PlayerState,
    SHOP_GRASS_AMOUNT,
    SHOP_GRASS_COST,
    STARTER_TASK_REWARD_COINS,
    STARTER_TASK_REWARD_GRASS,
    playerData,
} from '../data/PlayerData';

const { ccclass } = _decorator;

@ccclass('MainUI')
export class MainUI extends Component {
    private levelValueLabel: Label | null = null;
    private coinValueLabel: Label | null = null;
    private grassValueLabel: Label | null = null;
    private stageTitleLabel: Label | null = null;
    private stageHintLabel: Label | null = null;
    private sheepNameLabel: Label | null = null;
    private experienceLabel: Label | null = null;
    private idleTimeLabel: Label | null = null;
    private idleHintLabel: Label | null = null;
    private taskTextLabel: Label | null = null;
    private taskProgressLabel: Label | null = null;
    private shopCoinLabel: Label | null = null;
    private shopGrassLabel: Label | null = null;
    private toastNode: Node | null = null;
    private toastLabel: Label | null = null;
    private shopOverlay: Node | null = null;
    private unsubscribePlayerData: (() => void) | null = null;

    private readonly colors = {
        background: new Color(255, 250, 232, 255),
        overlay: new Color(61, 70, 55, 175),
        panel: new Color(255, 255, 248, 255),
        panelGreen: new Color(231, 244, 219, 255),
        green: new Color(132, 178, 112, 255),
        greenDark: new Color(74, 111, 67, 255),
        yellow: new Color(247, 218, 132, 255),
        yellowSoft: new Color(255, 240, 190, 255),
        brown: new Color(119, 91, 67, 255),
        ink: new Color(70, 78, 66, 255),
        muted: new Color(126, 135, 116, 255),
        white: new Color(255, 255, 255, 255),
        pink: new Color(239, 174, 166, 255),
        shadow: new Color(181, 195, 164, 100),
    };

    private readonly hideToast = (): void => {
        if (this.toastNode) {
            this.toastNode.active = false;
        }
    };

    start(): void {
        this.build();
        this.unsubscribePlayerData = playerData.subscribe((state) => {
            this.renderPlayerData(state);
        });
    }

    update(deltaTime: number): void {
        playerData.tick(deltaTime);
    }

    onDestroy(): void {
        this.unschedule(this.hideToast);
        if (this.unsubscribePlayerData) {
            this.unsubscribePlayerData();
            this.unsubscribePlayerData = null;
        }
    }

    private build(): void {
        const previous = this.node.getChildByName('MainUIRoot');
        if (previous) {
            previous.destroy();
        }

        const root = this.createNode(this.node, 'MainUIRoot', 0, 0, 720, 1280);
        this.drawRect(root, 720, 1280, this.colors.background);

        this.drawDecorations(root);
        this.createHeader(root);
        this.createTaskBar(root);
        this.createStage(root);
        this.createFeedButton(root);
        this.createNavigation(root);
        this.createToast(root);
        this.createShopOverlay(root);
    }

    private createHeader(root: Node): void {
        this.addLabel(root, 'GameTitle', '羊羊挂机', 0, 585, 360, 58, 38, this.colors.greenDark, true);
        this.addLabel(root, 'Subtitle', '轻松养羊 · 慢慢变强', 0, 545, 360, 34, 22, this.colors.muted);

        const stats = [
            { key: 'level', x: -238, icon: 'LV', value: '1', label: '等级', color: this.colors.panelGreen },
            { key: 'coins', x: 0, icon: '●', value: '100', label: '金币', color: this.colors.yellowSoft },
            { key: 'grass', x: 238, icon: '叶', value: '12', label: '草料', color: this.colors.panelGreen },
        ];

        for (const stat of stats) {
            const card = this.addPanel(root, stat.label + 'Card', stat.x, 470, 204, 86, stat.color, this.colors.greenDark, 12, 3);
            this.addLabel(card, stat.label + 'Icon', stat.icon, -70, 7, 42, 42, 21, this.colors.greenDark, true);
            const valueLabel = this.addLabel(card, stat.label + 'Value', stat.value, 13, 12, 90, 34, 25, this.colors.ink, true);
            if (stat.key === 'level') {
                this.levelValueLabel = valueLabel;
            } else if (stat.key === 'coins') {
                this.coinValueLabel = valueLabel;
            } else {
                this.grassValueLabel = valueLabel;
            }
            this.addLabel(card, stat.label + 'Text', stat.label, 13, -18, 90, 26, 18, this.colors.muted);
        }
    }

    private createTaskBar(root: Node): void {
        const task = this.addPanel(root, 'TaskBar', 0, 380, 656, 64, this.colors.panel, this.colors.green, 10, 3);
        this.addLabel(task, 'TaskIcon', '✓', -286, 0, 42, 42, 22, this.colors.greenDark, true);
        this.taskTextLabel = this.addLabel(
            task,
            'TaskText',
            '新手任务：给小羊喂 1 份草',
            -30,
            0,
            450,
            42,
            19,
            this.colors.ink,
            false,
            HorizontalTextAlignment.LEFT,
        );
        this.taskProgressLabel = this.addLabel(task, 'TaskProgress', '0 / 1', 278, 0, 82, 42, 18, this.colors.greenDark, true);
        this.bindTap(task, () => this.handleTaskTap());
    }

    private createStage(root: Node): void {
        const stage = this.addPanel(root, 'StagePanel', 0, 72, 656, 540, this.colors.panelGreen, this.colors.greenDark, 18, 4);
        this.stageTitleLabel = this.addLabel(stage, 'StageTitle', '第 1 关 · 微风草原', 0, 222, 390, 48, 25, this.colors.greenDark, true);
        this.stageHintLabel = this.addLabel(stage, 'StageHint', '小羊正在休息，喂草后开始冒险', 0, 180, 520, 38, 20, this.colors.muted);

        this.drawGrass(stage, -250, -150);
        this.drawGrass(stage, 238, -130);
        this.drawCloud(stage, -224, 132, 0.72);
        this.drawCloud(stage, 225, 105, 0.58);
        this.drawSheep(stage);

        this.sheepNameLabel = this.addLabel(stage, 'SheepName', '绵绵  Lv.1', 0, -132, 280, 42, 23, this.colors.ink, true);
        this.experienceLabel = this.addLabel(stage, 'ExperienceText', '经验 0 / 100', 0, -166, 300, 28, 17, this.colors.muted, true);

        const status = this.addPanel(stage, 'IdleStatus', 0, -215, 490, 62, this.colors.white, this.colors.green, 11, 3);
        this.idleTimeLabel = this.addLabel(status, 'IdleStatusText', '挂机时间  00:00:00', 0, 7, 430, 30, 19, this.colors.ink, true);
        this.idleHintLabel = this.addLabel(status, 'IdleStatusHint', '暂无草料供给', 0, -17, 430, 28, 18, this.colors.muted);
    }

    private createFeedButton(root: Node): void {
        const button = this.addPanel(root, 'FeedButton', 0, -248, 560, 92, this.colors.yellow, this.colors.brown, 16, 4);
        this.addLabel(button, 'FeedPlus', '＋', -206, 0, 58, 58, 35, this.colors.brown, true);
        this.addLabel(button, 'FeedText', '喂草', -35, 10, 210, 40, 27, this.colors.brown, true);
        this.addLabel(button, 'FeedHint', '消耗 1 份草 · 增加 10 分钟', 35, -24, 310, 30, 18, this.colors.brown);
        this.bindTap(button, () => this.handleFeedTap());
    }

    private createNavigation(root: Node): void {
        const bar = this.addPanel(root, 'BottomBar', 0, -512, 720, 190, this.colors.panel, this.colors.green, 0, 3);
        const items = [
            { x: -270, icon: '店', label: '商城', active: false, action: () => this.openShop() },
            { x: -90, icon: '羊', label: '主页', active: true, action: () => this.closeShop() },
            { x: 90, icon: '战', label: '副本', active: false, action: () => this.showToast('副本将在后续版本开放') },
            { x: 270, icon: '包', label: '背包', active: false, action: () => this.showToast('背包将在后续版本开放') },
        ];

        for (const item of items) {
            const fill = item.active ? this.colors.green : this.colors.white;
            const border = item.active ? this.colors.greenDark : this.colors.green;
            const button = this.addPanel(bar, item.label + 'Nav', item.x, 12, 142, 126, fill, border, 15, 3);
            const textColor = item.active ? this.colors.white : this.colors.greenDark;
            this.addLabel(button, item.label + 'Icon', item.icon, 0, 22, 58, 58, 28, textColor, true);
            this.addLabel(button, item.label + 'Label', item.label, 0, -30, 108, 32, 20, textColor, true);
            this.bindTap(button, item.action);
        }

        this.addLabel(bar, 'VersionText', 'V0.2 · 可玩版', 0, -75, 260, 26, 16, this.colors.muted);
    }

    private createToast(root: Node): void {
        this.toastNode = this.addPanel(root, 'Toast', 0, -390, 500, 64, this.colors.greenDark, this.colors.white, 14, 2);
        this.toastLabel = this.addLabel(this.toastNode, 'ToastText', '', 0, 0, 450, 42, 20, this.colors.white, true);
        this.toastNode.active = false;
    }

    private createShopOverlay(root: Node): void {
        this.shopOverlay = this.addPanel(root, 'ShopOverlay', 0, 0, 720, 1280, this.colors.overlay, this.colors.overlay, 0, 0);
        this.shopOverlay.addComponent(BlockInputEvents);
        const panel = this.addPanel(this.shopOverlay, 'ShopPanel', 0, 60, 620, 760, this.colors.panel, this.colors.greenDark, 22, 4);

        this.addLabel(panel, 'ShopTitle', '草料商城', 0, 310, 300, 58, 34, this.colors.greenDark, true);
        this.addLabel(panel, 'ShopSubtitle', '用挂机金币补充小羊的草料', 0, 262, 420, 34, 20, this.colors.muted);

        const close = this.addPanel(panel, 'ShopClose', 254, 320, 62, 62, this.colors.panelGreen, this.colors.green, 12, 3);
        this.addLabel(close, 'ShopCloseText', '×', 0, 2, 44, 44, 30, this.colors.greenDark, true);
        this.bindTap(close, () => this.closeShop());

        const wallet = this.addPanel(panel, 'ShopWallet', 0, 190, 510, 100, this.colors.panelGreen, this.colors.green, 14, 3);
        this.shopCoinLabel = this.addLabel(wallet, 'ShopCoins', '金币：100', -120, 0, 220, 48, 22, this.colors.ink, true);
        this.shopGrassLabel = this.addLabel(wallet, 'ShopGrass', '草料：12', 120, 0, 220, 48, 22, this.colors.ink, true);

        const product = this.addPanel(panel, 'GrassProduct', 0, 18, 510, 190, this.colors.yellowSoft, this.colors.brown, 16, 3);
        this.addLabel(product, 'GrassProductIcon', '叶', -182, 28, 70, 70, 38, this.colors.greenDark, true);
        this.addLabel(product, 'GrassProductTitle', '新鲜草料 × ' + SHOP_GRASS_AMOUNT, 22, 44, 310, 46, 25, this.colors.ink, true);
        this.addLabel(product, 'GrassProductDesc', '可增加 ' + (SHOP_GRASS_AMOUNT * 10) + ' 分钟挂机时间', 22, 4, 330, 34, 18, this.colors.muted);

        const buyButton = this.addPanel(product, 'BuyGrassButton', 42, -56, 320, 62, this.colors.yellow, this.colors.brown, 12, 3);
        this.addLabel(buyButton, 'BuyGrassText', SHOP_GRASS_COST + ' 金币购买', 0, 0, 270, 40, 21, this.colors.brown, true);
        this.bindTap(buyButton, () => this.handlePurchaseTap());

        this.addLabel(panel, 'ShopTip', '挂机每 10 秒获得 1 金币与 2 经验', 0, -135, 500, 38, 19, this.colors.muted);
        this.addLabel(panel, 'ShopSaveTip', '游戏进度会自动保存在当前设备', 0, -190, 500, 38, 18, this.colors.greenDark);

        this.shopOverlay.active = false;
    }

    private handleFeedTap(): void {
        const result = playerData.feedGrass();
        if (result === 'success') {
            this.showToast('喂草成功：挂机时间增加 10 分钟');
        } else if (result === 'no-grass') {
            this.showToast('草料不足，请前往商城购买');
        } else {
            this.showToast('挂机时间已达到 2 小时上限');
        }
    }

    private handleTaskTap(): void {
        const result = playerData.claimStarterTask();
        if (result === 'success') {
            this.showToast('任务奖励：+' + STARTER_TASK_REWARD_COINS + ' 金币，+' + STARTER_TASK_REWARD_GRASS + ' 草料');
        } else if (result === 'not-ready') {
            this.showToast('先给小羊喂 1 份草吧');
        } else {
            this.showToast('新手任务奖励已经领取');
        }
    }

    private handlePurchaseTap(): void {
        const result = playerData.purchaseGrass();
        if (result === 'success') {
            this.showToast('购买成功：获得 ' + SHOP_GRASS_AMOUNT + ' 份草料');
        } else {
            this.showToast('金币不足，需要 ' + SHOP_GRASS_COST + ' 金币');
        }
    }

    private openShop(): void {
        if (this.shopOverlay) {
            this.shopOverlay.active = true;
        }
    }

    private closeShop(): void {
        if (this.shopOverlay) {
            this.shopOverlay.active = false;
        }
    }

    private showToast(message: string): void {
        if (!this.toastNode || !this.toastLabel) {
            return;
        }
        this.toastLabel.string = message;
        this.toastNode.active = true;
        this.toastNode.setSiblingIndex(this.toastNode.parent ? this.toastNode.parent.children.length - 1 : 0);
        this.unschedule(this.hideToast);
        this.scheduleOnce(this.hideToast, 1.8);
    }

    private renderPlayerData(state: Readonly<PlayerState>): void {
        if (this.levelValueLabel) {
            this.levelValueLabel.string = String(state.level);
        }
        if (this.coinValueLabel) {
            this.coinValueLabel.string = String(state.coins);
        }
        if (this.grassValueLabel) {
            this.grassValueLabel.string = String(state.grass);
        }
        if (this.stageTitleLabel) {
            this.stageTitleLabel.string = '第 ' + state.stage + ' 关 · 微风草原';
        }
        if (this.stageHintLabel) {
            this.stageHintLabel.string = state.idleSeconds > 0
                ? '小羊正在冒险，挂机奖励持续累积中'
                : '小羊正在休息，喂草后开始冒险';
        }
        if (this.sheepNameLabel) {
            this.sheepNameLabel.string = '绵绵  Lv.' + state.level;
        }
        if (this.experienceLabel) {
            this.experienceLabel.string = '经验 ' + state.exp + ' / ' + playerData.requiredExperience(state.level);
        }
        if (this.idleTimeLabel) {
            this.idleTimeLabel.string = '挂机时间  ' + this.formatTime(state.idleSeconds);
        }
        if (this.idleHintLabel) {
            this.idleHintLabel.string = state.idleSeconds > 0
                ? '每 10 秒获得 1 金币与 2 经验'
                : '暂无草料供给';
        }
        if (this.taskTextLabel && this.taskProgressLabel) {
            if (state.starterTaskClaimed) {
                this.taskTextLabel.string = '新手任务完成：奖励已领取';
                this.taskProgressLabel.string = '已完成';
            } else if (state.feedCount >= 1) {
                this.taskTextLabel.string = '任务完成！点击领取 50 金币与 3 草料';
                this.taskProgressLabel.string = '领取';
            } else {
                this.taskTextLabel.string = '新手任务：给小羊喂 1 份草';
                this.taskProgressLabel.string = '0 / 1';
            }
        }
        if (this.shopCoinLabel) {
            this.shopCoinLabel.string = '金币：' + state.coins;
        }
        if (this.shopGrassLabel) {
            this.shopGrassLabel.string = '草料：' + state.grass;
        }
    }

    private formatTime(totalSeconds: number): string {
        const seconds = Math.max(0, Math.min(MAX_IDLE_SECONDS, Math.floor(totalSeconds)));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;
        return this.padTime(hours) + ':' + this.padTime(minutes) + ':' + this.padTime(remainder);
    }

    private padTime(value: number): string {
        return value < 10 ? '0' + value : String(value);
    }

    private bindTap(node: Node, callback: () => void): void {
        node.on(Node.EventType.TOUCH_END, callback, this);
    }

    private drawSheep(parent: Node): void {
        const sheep = this.createNode(parent, 'Sheep', 0, 38, 280, 270);
        const g = sheep.addComponent(Graphics);
        g.lineWidth = 5;
        g.strokeColor = this.colors.brown;

        g.fillColor = this.colors.shadow;
        g.ellipse(0, -105, 92, 20);
        g.fill();

        g.fillColor = this.colors.brown;
        g.roundRect(-70, -93, 30, 72, 12);
        g.roundRect(40, -93, 30, 72, 12);
        g.fill();

        g.fillColor = this.colors.white;
        const wool = [
            [-65, 10, 55], [-35, 48, 62], [12, 55, 64],
            [58, 30, 58], [68, -18, 54], [32, -48, 62],
            [-24, -52, 65], [-70, -30, 55],
        ];
        for (const tuft of wool) {
            g.circle(tuft[0], tuft[1], tuft[2]);
            g.fill();
            g.circle(tuft[0], tuft[1], tuft[2]);
            g.stroke();
        }

        g.fillColor = new Color(251, 224, 188, 255);
        g.roundRect(-58, -40, 116, 112, 42);
        g.fill();
        g.roundRect(-58, -40, 116, 112, 42);
        g.stroke();

        g.fillColor = new Color(251, 224, 188, 255);
        g.moveTo(-50, 38);
        g.lineTo(-92, 62);
        g.lineTo(-72, 14);
        g.close();
        g.fill();
        g.stroke();
        g.moveTo(50, 38);
        g.lineTo(92, 62);
        g.lineTo(72, 14);
        g.close();
        g.fill();
        g.stroke();

        g.fillColor = this.colors.ink;
        g.circle(-21, 22, 6);
        g.circle(21, 22, 6);
        g.fill();

        g.strokeColor = this.colors.brown;
        g.lineWidth = 4;
        g.moveTo(-16, -4);
        g.quadraticCurveTo(0, -20, 16, -4);
        g.stroke();

        g.fillColor = this.colors.pink;
        g.circle(-38, -3, 8);
        g.circle(38, -3, 8);
        g.fill();
    }

    private drawCloud(parent: Node, x: number, y: number, scale: number): void {
        const cloud = this.createNode(parent, 'Cloud', x, y, 160, 90);
        cloud.setScale(scale, scale, 1);
        const g = cloud.addComponent(Graphics);
        g.fillColor = new Color(255, 255, 255, 155);
        g.circle(-42, 0, 28);
        g.circle(-8, 17, 38);
        g.circle(34, 2, 31);
        g.roundRect(-64, -19, 126, 39, 18);
        g.fill();
    }

    private drawGrass(parent: Node, x: number, y: number): void {
        const grass = this.createNode(parent, 'Grass', x, y, 90, 50);
        const g = grass.addComponent(Graphics);
        g.strokeColor = this.colors.green;
        g.lineWidth = 7;
        g.moveTo(-24, -16);
        g.lineTo(-30, 15);
        g.moveTo(-8, -16);
        g.lineTo(-2, 22);
        g.moveTo(10, -16);
        g.lineTo(25, 12);
        g.moveTo(26, -16);
        g.lineTo(43, 5);
        g.stroke();
    }

    private drawDecorations(root: Node): void {
        const dots = [
            [-330, 318, this.colors.yellow], [320, 338, this.colors.green],
            [-318, -365, this.colors.green], [326, -345, this.colors.yellow],
            [-340, 105, this.colors.green], [338, 135, this.colors.yellow],
        ];
        for (let i = 0; i < dots.length; i += 1) {
            const dot = this.createNode(root, 'Pixel' + i, dots[i][0] as number, dots[i][1] as number, 14, 14);
            this.drawRect(dot, 14, 14, dots[i][2] as Color, undefined, 2);
        }
    }

    private addPanel(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fill: Color,
        stroke: Color,
        radius: number,
        lineWidth: number,
    ): Node {
        const node = this.createNode(parent, name, x, y, width, height);
        this.drawRect(node, width, height, fill, stroke, radius, lineWidth);
        return node;
    }

    private drawRect(
        node: Node,
        width: number,
        height: number,
        fill: Color,
        stroke?: Color,
        radius = 0,
        lineWidth = 0,
    ): void {
        const g = node.addComponent(Graphics);
        g.fillColor = fill;
        if (radius > 0) {
            g.roundRect(-width / 2, -height / 2, width, height, radius);
        } else {
            g.rect(-width / 2, -height / 2, width, height);
        }
        g.fill();

        if (stroke && lineWidth > 0) {
            g.lineWidth = lineWidth;
            g.strokeColor = stroke;
            if (radius > 0) {
                g.roundRect(-width / 2, -height / 2, width, height, radius);
            } else {
                g.rect(-width / 2, -height / 2, width, height);
            }
            g.stroke();
        }
    }

    private addLabel(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        bold = false,
        align: HorizontalTextAlignment = HorizontalTextAlignment.CENTER,
    ): Label {
        const node = this.createNode(parent, name, x, y, width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.25);
        label.color = color;
        label.isBold = bold;
        label.horizontalAlign = align;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = true;
        return label;
    }

    private createNode(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        return node;
    }
}
