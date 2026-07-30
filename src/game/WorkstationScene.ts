import Phaser from 'phaser';
import type { Career } from '../core/career';
import { SeededRandom } from '../core/random';
import {
  answerAddOn,
  createProjectQueue,
  createProject,
  decideCustomer,
  decideNextProject,
  delegateActiveProject,
  deliverActiveProject,
  deliverDelegatedProject,
  enqueueProject,
  isProjectStepComplete,
  offerAddOn,
  outstandingProjects,
  peekNextProject,
  processProject,
  processingMs,
  reclaimDelegatedProject,
  runtimeLevel,
  tickProjectQueue,
  upgradeEffects,
  validateProjectStep,
  type CustomerDecision,
  type ProjectBox,
  type ProjectQueue,
} from '../core/v1Runtime';
import type { ModelDefinition, ResourceKey } from '../data/content';
import type { WorkstationData, WorkstationId } from '../data/v1Catalog';
import { getCustomerArtPath, getEraBackgroundPath, getModelArtPath, getStationArtPath } from '../data/artCatalog';

export interface RunResult {
  score: number;
  stars: number;
  delivered: number;
  satisfaction: number;
  complaints: string[];
}

export interface GameLoadState {
  phase: 'loading' | 'decoding' | 'ready' | 'error';
  progress: number;
  label: string;
  loaded?: number;
  total?: number;
}

interface StationView {
  data: WorkstationData;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  progress: Phaser.GameObjects.Rectangle;
  progressMax: number;
  access: Phaser.Math.Vector2;
  obstacle: Phaser.Geom.Rectangle;
}

interface OrderCardView {
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  state: Phaser.GameObjects.Text;
  iconSlots: StepIconView[];
  patienceFill: Phaser.GameObjects.Rectangle;
}

interface CustomerView {
  container: Phaser.GameObjects.Container;
  avatar: Phaser.GameObjects.Image;
  folder: Phaser.GameObjects.Container;
  folderIcons: StepIconView[];
  patienceFill: Phaser.GameObjects.Rectangle;
  alert: Phaser.GameObjects.Text;
}

interface StepIconView {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Arc;
  glyph: Phaser.GameObjects.Graphics;
  check: Phaser.GameObjects.Text;
  more: Phaser.GameObjects.Text;
  size: number;
  spread: number;
}

interface StationJob {
  box: ProjectBox;
  view: StationView;
  owner: 'player' | 'agent';
  startedAt: number;
  endsAt: number;
  folder: Phaser.GameObjects.Container;
  folderIcons: StepIconView[];
  complete: boolean;
}

interface HelperAgentView {
  container: Phaser.GameObjects.Container;
  avatar: Phaser.GameObjects.Image;
  folder: Phaser.GameObjects.Container;
  folderIcons: StepIconView[];
  selectionRing: Phaser.GameObjects.Arc;
  stateText: Phaser.GameObjects.Text;
  box?: ProjectBox;
  busy: boolean;
  selected: boolean;
}

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const PLAYER_STATION_MARGIN_X = 24;
const PLAYER_STATION_MARGIN_Y = 18;
const STATION_ACCESS_CLEARANCE = 8;
const RESOURCE_KEYS: ResourceKey[] = ['cpu', 'gpu', 'ram', 'context', 'server'];
const RESOURCE_LABELS: Record<ResourceKey, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  context: 'CTX',
  server: 'NET',
};
const STATION_COLORS = {
  counter: 0xffd166,
  text: 0x57d7ff,
  search: 0xb6f04a,
  document: 0x46e09a,
  art: 0xff5db1,
  music: 0xc56cff,
  recording: 0xff5864,
  studio: 0xff9f43,
  video: 0x4f78ff,
  code: 0xf2f5ff,
  deploy: 0x3be2d0,
} satisfies Record<WorkstationData['id'], number>;
const STATION_SHORT_LABELS = {
  counter: '需求櫃台',
  text: '文字寫作',
  search: '搜尋資料',
  document: '文件表格',
  art: '圖像繪製',
  music: '音樂編曲',
  recording: '聲音錄製',
  studio: '攝影棚',
  video: '影片剪輯',
  code: '程式開發',
  deploy: '部署伺服器',
} satisfies Record<WorkstationData['id'], string>;
const STATION_OUTPUT_LABELS = {
  counter: '專案資料夾',
  text: '文字稿',
  search: '查證資料',
  document: '文件／表格',
  art: '圖像素材',
  music: '音樂編曲',
  recording: '錄音素材',
  studio: '拍攝素材',
  video: '完成影片',
  code: '程式成果',
  deploy: '上線版本',
} satisfies Record<WorkstationData['id'], string>;
const UI_FONT_FAMILY = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Segoe UI", sans-serif';
const UI_TEXT_RESOLUTION = 2;

export class WorkstationScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerAvatar!: Phaser.GameObjects.Image;
  private carriedBox!: Phaser.GameObjects.Container;
  private carriedBoxIcons: StepIconView[] = [];
  private deliveryTray!: Phaser.GameObjects.Container;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private satisfactionText!: Phaser.GameObjects.Text;
  private queueText!: Phaser.GameObjects.Text;
  private carriedSummaryText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionLabel!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Container;
  private skillButton!: Phaser.GameObjects.Container;
  private dashButton!: Phaser.GameObjects.Container;
  private agentButton?: Phaser.GameObjects.Container;
  private agentButtonLabel?: Phaser.GameObjects.Text;
  private joystickKnob!: Phaser.GameObjects.Arc;
  private decision?: Phaser.GameObjects.Container;
  private orderDetail?: Phaser.GameObjects.Container;
  private decisionProjectId?: string;
  private addOnBox?: ProjectBox;
  private addOnSource?: 'player' | 'agent';
  private nearby?: StationView;
  private readonly projectQueue: ProjectQueue;
  private processing = false;
  private finished = false;
  private left: number;
  private score = 0;
  private delivered = 0;
  private satisfaction = 65;
  private complaints: string[] = [];
  private readonly impatientBoxIds = new Set<string>();
  private readonly loads: Record<ResourceKey, number> = {
    cpu: 5,
    gpu: 5,
    ram: 5,
    context: 5,
    server: 12,
  };
  private readonly loadBars = new Map<ResourceKey, Phaser.GameObjects.Rectangle>();
  private readonly stationViews: StationView[] = [];
  private readonly orderCards: OrderCardView[] = [];
  private readonly customerViews: CustomerView[] = [];
  private readonly joystickVector = new Phaser.Math.Vector2();
  private joystickPointerId?: number;
  private moveTarget?: { x: number; y: number; view: StationView };
  private movePath: Array<{ x: number; y: number }> = [];
  private readonly stationJobs = new Map<WorkstationId, StationJob>();
  private helperAgent?: HelperAgentView;
  private readonly maxParallelJobs: number;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private skillReadyAt = 0;
  private skillUntil = 0;
  private nextArrivalIn = 0;
  private folderInTransit = false;
  private readonly runtime;
  private readonly effects;
  private readonly rng;
  private audioContext?: AudioContext;
  private assetLoadFailures = 0;

  constructor(
    private readonly model: ModelDefinition,
    private readonly career: Career,
    private readonly levelId: string,
    seed: number,
    private readonly onFinish: (result: RunResult) => void,
    private readonly onLoadState: (state: GameLoadState) => void = () => undefined,
  ) {
    super('workstation');
    this.runtime = runtimeLevel(levelId);
    this.left = this.runtime.duration;
    this.effects = upgradeEffects(career);
    this.projectQueue = createProjectQueue(this.runtime.maxQueue);
    this.rng = new SeededRandom(seed);
    this.maxParallelJobs = Math.min(3, Math.max(
      this.effects.caseSlots,
      this.effects.agentLevel > 0 ? 2 : 1,
      this.effects.agentLevel >= 2 && this.runtime.era >= 5 ? 3 : 1,
    ));
  }

  preload() {
    const asset = (path: string) => new URL(path, document.baseURI).toString();
    const total = 2 + this.runtime.customers.length + this.runtime.workstations.length;
    let loaded = 0;
    let currentLabel = '正在載入工作室場景';
    const labelFor = (key: string) => {
      if (key.startsWith('ai-')) return '正在載入 AI 角色';
      if (key.startsWith('customer-')) return '正在載入客戶角色';
      if (key.startsWith('station-')) return '正在載入工作機台';
      return '正在載入工作室場景';
    };
    const report = (progress: number, label = currentLabel) => this.onLoadState({
      phase: 'loading',
      progress,
      label,
      loaded,
      total,
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      currentLabel = labelFor(file.key);
      report(this.load.progress, currentLabel);
    });
    this.load.on('filecomplete', (key: string) => {
      loaded = Math.min(total, loaded + 1);
      currentLabel = labelFor(key);
      report(this.load.progress, currentLabel);
    });
    this.load.on('progress', (progress: number) => report(progress));
    this.load.on('loaderror', () => {
      this.assetLoadFailures += 1;
      this.onLoadState({
        phase: 'error',
        progress: this.load.progress,
        label: '部分美術素材無法載入，請檢查網路後重試。',
        loaded,
        total,
      });
    });
    this.load.on('complete', () => {
      if (this.assetLoadFailures > 0) return;
      this.onLoadState({ phase: 'decoding', progress: 1, label: '正在組裝工作站', loaded: total, total });
    });

    report(0);
    this.load.image(`era-${this.runtime.era}-v2`, asset(getEraBackgroundPath(this.runtime.era)));
    this.load.image(`ai-${this.model.id}-v2`, asset(getModelArtPath(this.model.id)));
    this.runtime.customers.forEach((customer) => {
      this.load.image(`customer-${customer.id}-v3`, asset(getCustomerArtPath(customer.id)));
    });
    this.runtime.workstations.forEach((station) => {
      this.load.image(`station-${station.id}-v3`, asset(getStationArtPath(station.id)));
    });
  }

  create() {
    if (this.assetLoadFailures > 0) return;
    this.cameras.main.setBackgroundColor('#050a18');
    this.input.addPointer(3);
    this.makeBackdrop();
    this.makeHud();
    this.makeCustomers();
    this.makeStations();
    this.makePlayer();
    this.makeHelperAgent();
    this.makeControls();
    this.bindKeyboard();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.nextArrivalIn = this.runtime.arrivalSeconds;
    for (let index = 0; index < this.runtime.initialQueue; index += 1) this.spawnCustomer(true);
    this.updateHud();
    this.onLoadState({ phase: 'ready', progress: 1, label: '工作站已就緒' });
  }

  update(_time: number, delta: number) {
    if (this.finished) return;

    let dx = this.joystickVector.x;
    let dy = this.joystickVector.y;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;

    if (dx || dy) {
      this.cancelAutoMovement();
      const length = Math.max(1, Math.hypot(dx, dy));
      const dashMultiplier = this.time.now < this.dashUntil ? 1.9 : 1;
      const skillMultiplier = this.model.id === 'nova' && this.time.now < this.skillUntil ? 1.35 : 1;
      const speed = delta * 0.18 * dashMultiplier * skillMultiplier;
      this.move((dx / length) * speed, (dy / length) * speed);
    } else {
      this.updateAutoMovement(delta);
      if (!this.moveTarget) this.playerAvatar.setAngle(Phaser.Math.Linear(this.playerAvatar.angle, 0, 0.18));
    }

    this.findNearbyStation();
    this.updateStationJobs();
    this.updateHelperAgent(delta);
    this.updateControlState();
  }

  private uiText(
    x: number,
    y: number,
    text: string | string[],
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) {
    return this.add.text(x, y, text, {
      ...style,
      fontFamily: UI_FONT_FAMILY,
      resolution: UI_TEXT_RESOLUTION,
    });
  }

  private makeBackdrop() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050a18);
    const backdrop = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, `era-${this.runtime.era}-v2`);
    const coverScale = Math.max(GAME_WIDTH / Math.max(1, backdrop.width), GAME_HEIGHT / Math.max(1, backdrop.height));
    backdrop.setScale(coverScale);
    this.add.rectangle(GAME_WIDTH / 2, 475, GAME_WIDTH, 570, 0x020817, 0.08);

    const levelNumber = Number(this.levelId.split('-').at(-1)) || 1;
    this.uiText(36, 204, `ERA ${this.runtime.era}｜${this.runtime.name}｜第 ${levelNumber} 關`, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#78a9c8',
      })
      .setLetterSpacing(1.4);
  }

  private makeHud() {
    this.add.rectangle(270, 35, 168, 58, 0x07101f, 0.98).setStrokeStyle(2, 0x55e6ef, 0.75);
    this.uiText(226, 15, '⌛', { fontSize: '24px', color: '#5ff4f4' });
    this.timerText = this.uiText(302, 35, '', {
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add.rectangle(63, 35, 98, 54, 0x0b1729, 0.92).setStrokeStyle(1, 0x6195c5, 0.45);
    this.scoreText = this.uiText(63, 35, '', { fontSize: '16px', fontStyle: 'bold', color: '#d8f4ff', align: 'center' })
      .setOrigin(0.5);
    this.add.rectangle(477, 35, 98, 54, 0x0b1729, 0.92).setStrokeStyle(1, 0x6195c5, 0.45);
    this.satisfactionText = this.uiText(477, 35, '', { fontSize: '16px', fontStyle: 'bold', color: '#ffe27a', align: 'center' })
      .setOrigin(0.5);

    this.uiText(18, 72, '訂單佇列', { fontSize: '14px', fontStyle: 'bold', color: '#cdefff' });
    this.queueText = this.uiText(522, 72, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#7df3e7',
      })
      .setOrigin(1, 0);
    [96, 270, 444].forEach((x, index) => this.makeOrderCard(x, index));

    const barWidth = 68;
    RESOURCE_KEYS.forEach((key, index) => {
      const x = 14 + index * 105;
      this.uiText(x, 186, RESOURCE_LABELS[key], { fontSize: '14px', fontStyle: 'bold', color: '#8ab0c8' });
      this.add.rectangle(x + 30, 191, barWidth, 7, 0x142740, 1).setOrigin(0, 0.5);
      const fill = this.add.rectangle(x + 30, 191, 8, 7, 0x5be7d0, 1).setOrigin(0, 0.5);
      this.loadBars.set(key, fill);
    });

    this.statusText = this.uiText(270, 797, '', {
        fontSize: '15px',
        color: '#d9f6ff',
        align: 'center',
        backgroundColor: '#06111fe8',
        padding: { x: 14, y: 8 },
        wordWrap: { width: 470 },
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.carriedSummaryText = this.uiText(270, 762, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f1feff',
        align: 'center',
        backgroundColor: '#0b2238e8',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(1090)
      .setVisible(false);
  }

  private makeOrderCard(x: number, index: number) {
    const frame = this.add.rectangle(0, 0, 160, 98, 0x0b1728, 0.96).setStrokeStyle(2, 0x4e829c, 0.45);
    const badge = this.uiText(-68, -39, `${index + 1}`, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#06111c',
        backgroundColor: '#73efe4',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5);
    const title = this.uiText(10, -33, '', { fontSize: '16px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    const state = this.uiText(0, 23, '', { fontSize: '14px', fontStyle: 'bold', color: '#8fb8cc', align: 'center' })
      .setOrigin(0.5);
    const iconSlots = [0, 1, 2].map(() => this.makeStepIcon(25, 42));
    iconSlots.forEach((slot) => slot.container.setPosition(0, -5));
    const patienceBack = this.add.rectangle(-66, 40, 132, 8, 0x1b2940, 1).setOrigin(0, 0.5);
    const patienceFill = this.add.rectangle(-66, 40, 132, 8, 0x59e7d2, 1).setOrigin(0, 0.5);
    const container = this.add
      .container(x, 132, [frame, badge, title, state, ...iconSlots.map((slot) => slot.container), patienceBack, patienceFill])
      .setSize(160, 98)
      .setDepth(1200)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      const order = this.outstandingOrders()[index];
      if (order) this.showOrderDetails(order);
    });
    this.orderCards.push({ container, frame, title, state, iconSlots, patienceFill });
  }

  private stationPosition(station: WorkstationData, index: number) {
    if (station.id === 'counter') return { x: 270, y: 374 };
    const nonCounter = this.runtime.workstations.filter((item) => item.id !== 'counter');
    const itemIndex = nonCounter.findIndex((item) => item.id === station.id);
    const variant = Number(this.runtime.mapId.split('-').at(-1)) || 1;
    const compact = nonCounter.length > 6;
    const rowGap = compact ? 77 : 118;
    const firstY = compact ? 450 : 500;
    const baseRow = Math.floor(itemIndex / 2);
    const rowOrders = [0, 2, 4, 1, 3];
    const row = variant === 3 && compact ? rowOrders[baseRow] ?? baseRow : baseRow;
    const mirrored = variant === 2 || (variant === 3 && baseRow % 2 === 1);
    const isLeft = (itemIndex % 2 === 0) !== mirrored;
    const edgeOffset = variant === 3 && row % 2 === 1 ? 8 : 0;
    return {
      x: isLeft ? 82 + edgeOffset : 458 - edgeOffset,
      y: firstY + row * rowGap,
    };
  }

  private makeCustomers() {
    const firstCustomer = this.runtime.customers[0];
    for (let index = 0; index < 5; index += 1) {
      const avatar = this.add.image(0, 0, `customer-${firstCustomer.id}-v3`).setOrigin(0.5, 1);
      this.fitImage(avatar, 102, 138);
      const patienceBack = this.add.rectangle(-38, -151, 76, 8, 0x17243a, 0.98).setOrigin(0, 0.5);
      const patienceFill = this.add.rectangle(-38, -151, 76, 8, 0x62ead5, 1).setOrigin(0, 0.5);
      const alert = this.uiText(0, -169, '!', { fontSize: '18px', fontStyle: 'bold', color: '#ff826e' })
        .setOrigin(0.5)
        .setVisible(false);
      const container = this.add.container(270, 354, [avatar, patienceBack, patienceFill, alert]).setDepth(354).setVisible(false);
      const folderVisual = this.makeFolderVisual(58, 42);
      folderVisual.container.setVisible(false).setDepth(413);
      this.customerViews.push({
        container,
        avatar,
        folder: folderVisual.container,
        folderIcons: folderVisual.icons,
        patienceFill,
        alert,
      });
      this.tweens.add({
        targets: avatar,
        y: -3,
        duration: 820 + index * 90,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private makeFolderVisual(width: number, height: number) {
    const base = this.add.rectangle(0, 0, width, height, 0x102d4e, 0.98).setStrokeStyle(2, 0x74efff, 0.9);
    const tab = this.add.rectangle(-width * 0.24, -height * 0.54, width * 0.38, height * 0.18, 0x1c5177, 1).setStrokeStyle(1, 0x74efff, 0.75);
    const icons = [0, 1, 2].map(() => this.makeStepIcon(Math.max(14, height * 0.42), width * 0.25));
    icons.forEach((icon) => icon.container.setPosition(0, 1));
    return { container: this.add.container(0, 0, [base, tab, ...icons.map((icon) => icon.container)]), icons };
  }

  private makeStepIcon(size: number, spread: number): StepIconView {
    const plate = this.add.circle(0, 0, size * 0.5, 0x061421, 0.98).setStrokeStyle(Math.max(1, size * 0.08), 0x6f96a8, 0.45);
    const glyph = this.add.graphics();
    const check = this.uiText(size * 0.3, size * 0.28, '✓', { fontSize: `${Math.max(8, Math.round(size * 0.42))}px`, fontStyle: 'bold', color: '#f3fff9' })
      .setOrigin(0.5)
      .setVisible(false);
    const more = this.uiText(0, 0, '', { fontSize: `${Math.max(8, Math.round(size * 0.46))}px`, fontStyle: 'bold', color: '#d8c7ff' })
      .setOrigin(0.5)
      .setVisible(false);
    const container = this.add.container(0, 0, [plate, glyph, check, more]).setVisible(false);
    return { container, plate, glyph, check, more, size, spread };
  }

  private drawStationGlyph(graphics: Phaser.GameObjects.Graphics, stationId: WorkstationData['id'], size: number, color: number) {
    const r = size * 0.29;
    const stroke = Math.max(1.4, size * 0.09);
    graphics.clear().lineStyle(stroke, color, 1).fillStyle(color, 1);
    switch (stationId) {
      case 'text':
        graphics.beginPath().moveTo(0, -r).lineTo(r, 0).lineTo(0, r).lineTo(-r, 0).closePath().strokePath();
        graphics.lineBetween(-r * 0.42, -r * 0.12, r * 0.42, -r * 0.12);
        graphics.lineBetween(-r * 0.34, r * 0.28, r * 0.2, r * 0.28);
        break;
      case 'search':
        graphics.strokeCircle(-r * 0.15, -r * 0.12, r * 0.58);
        graphics.lineBetween(r * 0.28, r * 0.32, r * 0.82, r * 0.82);
        graphics.fillCircle(-r * 0.34, -r * 0.18, stroke * 0.62);
        graphics.fillCircle(r * 0.02, r * 0.08, stroke * 0.62);
        break;
      case 'document':
        graphics.strokeRect(-r * 0.68, -r * 0.72, r * 1.15, r * 1.35);
        graphics.strokeRect(-r * 0.35, -r * 0.48, r * 1.02, r * 1.18);
        graphics.lineBetween(-r * 0.14, -r * 0.08, r * 0.42, -r * 0.08);
        graphics.lineBetween(-r * 0.14, r * 0.26, r * 0.42, r * 0.26);
        break;
      case 'art':
        graphics.strokeCircle(r * 0.42, -r * 0.42, r * 0.22);
        graphics.fillTriangle(-r * 0.9, r * 0.62, -r * 0.2, -r * 0.2, r * 0.28, r * 0.62);
        graphics.fillTriangle(-r * 0.08, r * 0.62, r * 0.42, r * 0.08, r * 0.92, r * 0.62);
        break;
      case 'music':
        graphics.fillCircle(-r * 0.48, r * 0.48, r * 0.24);
        graphics.fillCircle(r * 0.42, r * 0.3, r * 0.24);
        graphics.lineBetween(-r * 0.28, r * 0.4, -r * 0.28, -r * 0.62);
        graphics.lineBetween(r * 0.62, r * 0.22, r * 0.62, -r * 0.8);
        graphics.lineBetween(-r * 0.28, -r * 0.62, r * 0.62, -r * 0.8);
        break;
      case 'recording':
        graphics.strokeRoundedRect(-r * 0.42, -r * 0.86, r * 0.84, r * 1.18, r * 0.38);
        graphics.beginPath().moveTo(-r * 0.7, r * 0.02).lineTo(-r * 0.7, r * 0.24).arc(0, r * 0.24, r * 0.7, Math.PI, 0).lineTo(r * 0.7, r * 0.02).strokePath();
        graphics.lineBetween(0, r * 0.92, 0, r * 0.54);
        graphics.lineBetween(-r * 0.42, r * 0.92, r * 0.42, r * 0.92);
        break;
      case 'studio':
        graphics.strokeRoundedRect(-r * 0.86, -r * 0.52, r * 1.72, r * 1.12, r * 0.18);
        graphics.strokeCircle(0, 0, r * 0.42);
        graphics.fillCircle(r * 0.56, -r * 0.66, stroke * 0.72);
        graphics.lineBetween(r * 0.56, -r * 0.98, r * 0.56, -r * 0.78);
        graphics.lineBetween(r * 0.28, -r * 0.66, r * 0.4, -r * 0.66);
        break;
      case 'video':
        graphics.strokeRoundedRect(-r * 0.88, -r * 0.62, r * 1.76, r * 1.24, r * 0.16);
        graphics.fillTriangle(-r * 0.18, -r * 0.38, -r * 0.18, r * 0.38, r * 0.52, 0);
        graphics.fillCircle(-r * 0.65, -r * 0.36, stroke * 0.48);
        graphics.fillCircle(-r * 0.65, r * 0.36, stroke * 0.48);
        break;
      case 'code':
        graphics.beginPath().moveTo(-r * 0.12, -r * 0.68).lineTo(-r * 0.82, 0).lineTo(-r * 0.12, r * 0.68).strokePath();
        graphics.beginPath().moveTo(r * 0.12, -r * 0.68).lineTo(r * 0.82, 0).lineTo(r * 0.12, r * 0.68).strokePath();
        graphics.fillCircle(0, 0, stroke * 0.72);
        break;
      case 'deploy':
        graphics.strokeCircle(-r * 0.38, r * 0.1, r * 0.4);
        graphics.strokeCircle(r * 0.08, -r * 0.18, r * 0.54);
        graphics.strokeCircle(r * 0.55, r * 0.12, r * 0.34);
        graphics.lineBetween(-r * 0.72, r * 0.42, r * 0.82, r * 0.42);
        graphics.lineBetween(0, r * 0.68, 0, -r * 0.72);
        graphics.fillTriangle(0, -r, -r * 0.34, -r * 0.54, r * 0.34, -r * 0.54);
        break;
      case 'counter':
      default:
        graphics.fillCircle(-r * 0.42, -r * 0.35, r * 0.24);
        graphics.fillCircle(r * 0.32, -r * 0.25, r * 0.2);
        graphics.strokeRoundedRect(-r * 0.82, 0, r * 1.55, r * 0.78, r * 0.22);
        break;
    }
  }

  private outstandingOrders() {
    return outstandingProjects(this.projectQueue);
  }

  private get box() {
    return this.projectQueue.active ?? peekNextProject(this.projectQueue);
  }

  private updateFolderIcons(icons: StepIconView[], box: ProjectBox) {
    const steps = box.recipe.runtimeSteps;
    const hasMore = steps.length > 3;
    const visibleCount = Math.min(3, hasMore ? 2 : steps.length);
    const spread = icons[0]?.spread ?? 20;
    const positions = hasMore
      ? [-spread, 0]
      : visibleCount === 1
        ? [0]
        : visibleCount === 2
          ? [-spread * 0.5, spread * 0.5]
          : [-spread, 0, spread];
    icons.forEach((icon, index) => {
      const isMore = hasMore && index === 2;
      const step = index < visibleCount ? steps[index] : undefined;
      if (!step && !isMore) {
        icon.container.setVisible(false);
        return;
      }
      icon.container.setVisible(true).setPosition(isMore ? spread : positions[index] ?? 0, icon.container.y);
      icon.glyph.setVisible(!isMore);
      icon.check.setVisible(Boolean(step && isProjectStepComplete(box, step)));
      icon.more.setVisible(isMore).setText(isMore ? `+${steps.length - 2}` : '');
      if (isMore) {
        icon.plate.setFillStyle(0x1b1533, 0.98).setStrokeStyle(Math.max(1, icon.size * 0.08), 0xb799ff, 0.88);
        icon.container.setAlpha(0.92);
        return;
      }
      if (!step) {
        icon.container.setVisible(false);
        return;
      }
      const color = STATION_COLORS[step.stationId] ?? 0x8edfff;
      const complete = isProjectStepComplete(box, step);
      const active = box.recipe.sequenceMode === 'ordered' ? index === box.stage : !complete;
      icon.plate
        .setFillStyle(0x061421, 0.98)
        .setStrokeStyle(Math.max(1, icon.size * (active ? 0.12 : 0.08)), color, active ? 1 : 0.76);
      this.drawStationGlyph(icon.glyph, step.stationId, icon.size, color);
      icon.container.setAlpha(complete ? 0.58 : active ? 1 : 0.78);
    });
  }

  private updateCustomerViews() {
    const positions = [
      { x: 270, y: 382, scale: 1 },
      { x: 176, y: 382, scale: 0.9 },
      { x: 364, y: 382, scale: 0.9 },
      { x: 76, y: 364, scale: 0.76 },
      { x: 464, y: 364, scale: 0.76 },
    ];
    const orders = this.outstandingOrders();
    this.customerViews.forEach((view, index) => {
      const order = orders[index];
      if (!order) {
        view.container.setVisible(false);
        view.folder.setVisible(false);
        return;
      }
      const position = positions[index];
      const wasVisible = view.container.visible;
      view.avatar.setTexture(`customer-${order.customer.id}-v3`);
      this.fitImage(view.avatar, 102, 138);
      view.avatar.setScale(view.avatar.scaleX * position.scale, view.avatar.scaleY * position.scale);
      if (wasVisible && Phaser.Math.Distance.Between(view.container.x, view.container.y, position.x, position.y) > 4) {
        this.tweens.killTweensOf(view.container);
        this.tweens.killTweensOf(view.folder);
        this.tweens.add({ targets: view.container, x: position.x, y: position.y, duration: 260, ease: 'Sine.Out' });
        this.tweens.add({ targets: view.folder, x: position.x + 34 * position.scale, y: position.y - 50 * position.scale, duration: 260, ease: 'Sine.Out' });
      } else if (!wasVisible) {
        view.container.setPosition(position.x, position.y);
        view.folder.setPosition(position.x + 34 * position.scale, position.y - 50 * position.scale);
      }
      view.container.setDepth(position.y).setVisible(true);
      const patienceRatio = Phaser.Math.Clamp(order.patience / Math.max(1, order.customer.patience), 0, 1);
      view.patienceFill.width = 76 * patienceRatio;
      view.patienceFill.fillColor = patienceRatio < 0.25 ? 0xff6f61 : patienceRatio < 0.5 ? 0xffc45f : 0x62ead5;
      view.alert.setVisible(patienceRatio < 0.3);
      view.folder.setScale(0.86 * position.scale).setVisible(!order.accepted);
      this.updateFolderIcons(view.folderIcons, order);
    });
  }

  private advanceCustomerQueue(index = 0) {
    const [leaving] = this.customerViews.splice(Math.max(0, index), 1);
    if (!leaving) return;
    leaving.container.setVisible(false);
    leaving.folder.setVisible(false);
    this.customerViews.push(leaving);
  }

  private makeStations() {
    const compact = this.runtime.workstations.filter((item) => item.id !== 'counter').length > 6;
    this.runtime.workstations.forEach((station, index) => {
      const { x, y } = this.stationPosition(station, index);
      const color = STATION_COLORS[station.id] ?? 0x65d9e8;
      const isCounter = station.id === 'counter';
      const hitWidth = isCounter ? 224 : compact ? 132 : 150;
      const hitHeight = isCounter ? 148 : compact ? 82 : 106;
      const frame = this.add
        .rectangle(0, 0, hitWidth, hitHeight, 0x07101e, 0.025)
        .setStrokeStyle(1, color, 0.16);
      const glow = this.add
        .ellipse(0, isCounter ? 20 : compact ? 13 : 17, isCounter ? 176 : compact ? 92 : 116, isCounter ? 78 : compact ? 48 : 66, color, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD);
      const sprite = this.add.image(0, isCounter ? -4 : compact ? -3 : -10, `station-${station.id}-v3`);
      this.fitImage(sprite, isCounter ? 220 : compact ? 122 : 148, isCounter ? 156 : compact ? 86 : 104);
      const labelY = isCounter ? 55 : compact ? 33 : 40;
      const labelWidth = isCounter ? 142 : compact ? 94 : 116;
      const labelHeight = isCounter ? 24 : compact ? 17 : 21;
      const labelPlate = this.add
        .rectangle(0, labelY, labelWidth, labelHeight, 0x03101c, compact && !isCounter ? 0.76 : 0.9)
        .setStrokeStyle(1, color, 0.72)
        .setVisible(!compact || isCounter);
      const label = this.uiText(0, labelY, STATION_SHORT_LABELS[station.id], {
          fontSize: isCounter ? '15px' : compact ? '12px' : '14px',
          fontStyle: 'bold',
          color: '#effbff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setVisible(!compact || isCounter);
      const progressWidth = isCounter ? 112 : compact ? 82 : 98;
      const progressY = isCounter ? 70 : compact ? 43 : 52;
      const progressBack = this.add.rectangle(-progressWidth / 2, progressY, progressWidth, 4, 0x07101e, 0.92).setOrigin(0, 0.5);
      const progress = this.add.rectangle(-progressWidth / 2, progressY, 0, 4, color, 1).setOrigin(0, 0.5);
      const container = this.add
        .container(x, y, [frame, glow, sprite, labelPlate, label, progressBack, progress])
        .setSize(hitWidth, hitHeight)
        .setDepth(isCounter ? 410 : y)
        .setInteractive({ useHandCursor: true });
      const access = isCounter
        ? new Phaser.Math.Vector2(x, y + hitHeight / 2 + PLAYER_STATION_MARGIN_Y + STATION_ACCESS_CLEARANCE)
        : new Phaser.Math.Vector2(x < GAME_WIDTH / 2 ? x + 104 : x - 104, y + 18);
      const obstacle = new Phaser.Geom.Rectangle(x - hitWidth / 2, y - hitHeight / 2, hitWidth, hitHeight);
      const view: StationView = { data: station, container, frame, progress, progressMax: progressWidth, access, obstacle };
      container.setData('stationView', view);
      container.on('pointerdown', () => {
        this.goToStation(view);
      });
      container.on('pointerover', () => frame.setStrokeStyle(2, color, 0.58));
      container.on('pointerout', () => {
        if (this.nearby !== view && this.moveTarget?.view !== view) frame.setStrokeStyle(1, color, 0.16);
      });
      this.stationViews.push(view);

      if (isCounter) {
        const trayGlow = this.add.ellipse(0, -3, 126, 34, 0x76efff, 0.2).setStrokeStyle(2, 0x9bfbff, 0.75);
        const trayCore = this.add.ellipse(0, -3, 88, 18, 0x071727, 0.95).setStrokeStyle(2, 0xffd46d, 0.75);
        const trayIcon = this.uiText(0, -4, '交付', { fontSize: '12px', fontStyle: 'bold', color: '#f8ffff' }).setOrigin(0.5);
        this.deliveryTray = this.add.container(x, y - 2, [trayGlow, trayCore, trayIcon]).setDepth(414);
        this.tweens.add({ targets: trayGlow, alpha: 0.42, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      }
    });
  }

  private makePlayer() {
    const color = this.model.color;
    const shadow = this.add.ellipse(0, 48, 76, 24, 0x000000, 0.42);
    this.playerAvatar = this.add.image(0, -27, `ai-${this.model.id}-v2`);
    this.fitImage(this.playerAvatar, 118, 158);
    const cue = this.uiText(0, -116, this.model.glyph, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#07111ec7',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5)
      .setStroke(Phaser.Display.Color.IntegerToColor(color).rgba, 1);

    const carriedFolder = this.makeFolderVisual(60, 44);
    this.carriedBox = carriedFolder.container.setPosition(43, 3).setAngle(-7);
    this.carriedBoxIcons = carriedFolder.icons;
    this.carriedBox.setVisible(false);

    this.player = this.add.container(270, 662, [shadow, this.playerAvatar, cue, this.carriedBox]);
    this.player.setDepth(662);
    this.tweens.add({ targets: this.playerAvatar, y: -32, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  }

  private makeHelperAgent() {
    if (this.effects.agentLevel < 1) return;
    const selectionRing = this.add
      .circle(0, 42, 40, 0x9f7cff, 0.12)
      .setStrokeStyle(3, 0xc6afff, 0.95)
      .setVisible(false);
    const shadow = this.add.ellipse(0, 40, 58, 18, 0x000000, 0.38);
    const avatar = this.add.image(0, -16, `ai-${this.model.id}-v2`).setAlpha(0.9).setTint(0xcbb8ff);
    this.fitImage(avatar, 78, 104);
    const folderVisual = this.makeFolderVisual(48, 35);
    const folder = folderVisual.container.setPosition(29, 2).setAngle(-8).setVisible(false);
    const stateText = this.uiText(0, -82, 'AGENT 待命', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#efeaff',
        backgroundColor: '#251d42dd',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5);
    const container = this.add
      .container(this.player.x - 58, this.player.y + 36, [selectionRing, shadow, avatar, folder, stateText])
      .setSize(90, 118)
      .setDepth(this.player.y + 36)
      .setInteractive({ useHandCursor: true });
    this.helperAgent = {
      container,
      avatar,
      folder,
      folderIcons: folderVisual.icons,
      selectionRing,
      stateText,
      busy: false,
      selected: false,
    };
    container.on('pointerdown', () => this.toggleHelperAgent());
    this.tweens.add({ targets: avatar, y: -20, duration: 820, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const scale = Math.min(maxWidth / Math.max(1, image.width), maxHeight / Math.max(1, image.height));
    image.setScale(scale);
    return image;
  }

  private makeControls() {
    this.add.rectangle(270, 890, 540, 140, 0x050b16, 0.98).setStrokeStyle(1, 0x37657a, 0.55).setDepth(980);

    const joystickBase = this.add.circle(86, 890, 50, 0x0e2037, 0.95).setStrokeStyle(2, 0x5aa4be, 0.55).setDepth(1000);
    this.add.circle(86, 890, 31, 0x102c47, 0.8).setStrokeStyle(1, 0x73dff1, 0.35).setDepth(1001);
    this.joystickKnob = this.add.circle(86, 890, 22, 0x6be9eb, 0.86).setStrokeStyle(3, 0xdfffff, 0.7).setDepth(1002);
    this.uiText(86, 947, '移動', { fontSize: '12px', fontStyle: 'bold', color: '#85afc6' }).setOrigin(0.5).setDepth(1002);
    joystickBase.setInteractive(new Phaser.Geom.Circle(50, 50, 50), Phaser.Geom.Circle.Contains);
    joystickBase.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerId) this.updateJoystick(pointer);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.joystickPointerId) this.resetJoystick();
    });

    this.dashButton = this.makeRoundButton(340, 916, 32, '➤', '衝刺', 0x274a66, () => this.dash());
    this.skillButton = this.makeRoundButton(370, 850, 34, this.model.glyph, this.model.skillName, this.model.color, () => this.activateSkill());
    if (this.helperAgent) {
      this.agentButton = this.makeRoundButton(258, 890, 34, 'A', '交給', 0x9f7cff, () => this.toggleHelperAgent());
      this.agentButtonLabel = this.agentButton.getAt(3) as Phaser.GameObjects.Text;
    }
    this.actionButton = this.makeRoundButton(466, 890, 52, 'E', '互動', 0x0f8ea3, () => this.interact());
    this.actionLabel = this.actionButton.getAt(3) as Phaser.GameObjects.Text;
  }

  private makeRoundButton(
    x: number,
    y: number,
    radius: number,
    icon: string,
    label: string,
    color: number,
    callback: () => void,
  ) {
    const shadow = this.add.circle(0, 5, radius + 5, 0x000000, 0.4);
    const outer = this.add.circle(0, 0, radius + 3, 0x10243a, 1).setStrokeStyle(2, color, 0.9);
    const inner = this.add.circle(0, 0, radius - 6, color, 0.72);
    const iconText = this.uiText(0, -7, icon, { fontSize: `${Math.max(17, radius * 0.48)}px`, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const labelText = this.uiText(0, radius * 0.42, label, { fontSize: '12px', fontStyle: 'bold', color: '#e7fbff' }).setOrigin(0.5);
    const container = this.add.container(x, y, [shadow, outer, inner, labelText, iconText]).setSize(radius * 2.1, radius * 2.1).setDepth(1010);
    container.setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);
    container.on('pointerdown', () => {
      container.setScale(0.92);
      callback();
    });
    container.on('pointerup', () => container.setScale(1));
    container.on('pointerout', () => container.setScale(1));
    return container;
  }

  private toggleHelperAgent() {
    const helper = this.helperAgent;
    if (!helper || helper.busy || this.folderInTransit || this.finished) return;
    if (!helper.box) {
      if (!this.projectQueue.active) {
        helper.selected = false;
        this.setStatus('Agent 正在待命；接單後可把資料夾交給它。');
        return;
      }
      const delegated = delegateActiveProject(this.projectQueue, this.maxParallelJobs);
      if (!delegated.ok) return;
      helper.box = delegated.project;
      helper.selected = true;
      helper.folder.setVisible(true);
      this.updateFolderIcons(helper.folderIcons, delegated.project);
      this.setStatus(`已把「${delegated.project.recipe.name}」交給 Agent；點任意機台後下指令。`);
      this.updateHud();
      return;
    }
    helper.selected = !helper.selected;
    this.setStatus(helper.selected
      ? `已選取 Agent 的「${helper.box.recipe.name}」；點任意機台下指令。`
      : '已切回玩家手上的資料夾。');
    this.updateHud();
  }

  private updateHelperAgent(delta: number) {
    const helper = this.helperAgent;
    if (!helper) return;
    if (!helper.busy) {
      const side = this.player.x < GAME_WIDTH / 2 ? 1 : -1;
      const targetX = Phaser.Math.Clamp(this.player.x + side * 58, 45, 495);
      const targetY = Phaser.Math.Clamp(this.player.y + 38, 450, 785);
      const follow = Math.min(1, delta * 0.0075);
      helper.container.x = Phaser.Math.Linear(helper.container.x, targetX, follow);
      helper.container.y = Phaser.Math.Linear(helper.container.y, targetY, follow);
    }
    helper.container.setDepth(Math.round(helper.container.y));
    helper.selectionRing.setVisible(helper.selected);
    helper.folder.setVisible(Boolean(helper.box) && !helper.busy);
    if (helper.box && !helper.busy) this.updateFolderIcons(helper.folderIcons, helper.box);
    helper.stateText.setText(helper.busy
      ? 'AGENT 運算中'
      : helper.box
        ? `AGENT ${helper.box.stage}/${helper.box.recipe.runtimeSteps.length}`
        : 'AGENT 待命');
    if (this.agentButtonLabel) {
      this.agentButtonLabel.setText(helper.busy ? '忙碌' : helper.box ? helper.selected ? '已選' : '指令' : '交給');
    }
    this.agentButton?.setAlpha(helper.busy ? 0.55 : 1);
  }

  private bindKeyboard() {
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.on('keydown-E', () => this.interact());
    keyboard.on('keydown-SPACE', () => this.interact());
    keyboard.on('keydown-Q', () => this.activateSkill());
    keyboard.on('keydown-SHIFT', () => this.dash());
  }

  private updateJoystick(pointer: Phaser.Input.Pointer) {
    const dx = pointer.worldX - 86;
    const dy = pointer.worldY - 890;
    const distance = Math.min(38, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    this.joystickKnob.setPosition(86 + x, 890 + y);
    this.joystickVector.set(x / 38, y / 38);
  }

  private resetJoystick() {
    this.joystickPointerId = undefined;
    this.joystickVector.set(0, 0);
    this.joystickKnob.setPosition(86, 890);
  }

  private goToStation(view: StationView) {
    if (this.decision || this.orderDetail || this.finished || this.left <= 0) return;
    if (this.moveTarget && this.moveTarget.view !== view) {
      const previousColor = STATION_COLORS[this.moveTarget.view.data.id] ?? 0x65d9e8;
      this.moveTarget.view.frame.setStrokeStyle(1, previousColor, 0.16);
    }
    const targetX = view.access.x;
    const targetY = view.access.y;
    this.moveTarget = { x: targetX, y: targetY, view };
    const laneX = GAME_WIDTH / 2;
    this.movePath = [];
    const addPoint = (x: number, y: number) => {
      const previous = this.movePath.at(-1) ?? { x: this.player.x, y: this.player.y };
      if (Phaser.Math.Distance.Between(previous.x, previous.y, x, y) > 8) this.movePath.push({ x, y });
    };
    addPoint(laneX, this.player.y);
    addPoint(laneX, targetY);
    addPoint(targetX, targetY);
    view.frame.setStrokeStyle(3, STATION_COLORS[view.data.id] ?? 0x65d9e8, 0.72);
    this.setStatus(`前往 ${view.data.name}…`);
    this.tone(520, 0.04);
  }

  private updateAutoMovement(delta: number) {
    if (!this.moveTarget || this.decision || this.orderDetail) return;
    const waypoint = this.movePath[0] ?? this.moveTarget;
    const dx = waypoint.x - this.player.x;
    const dy = waypoint.y - this.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 7) {
      this.player.setPosition(waypoint.x, waypoint.y).setDepth(Math.round(waypoint.y));
      if (this.movePath.length > 1) {
        this.movePath.shift();
        return;
      }
      const target = this.moveTarget;
      this.movePath = [];
      this.moveTarget = undefined;
      this.nearby = target.view;
      this.interact();
      return;
    }
    const dashMultiplier = this.time.now < this.dashUntil ? 1.9 : 1;
    const speed = Math.min(distance, delta * 0.27 * dashMultiplier);
    this.move((dx / distance) * speed, (dy / distance) * speed);
  }

  private move(x: number, y: number) {
    const nextX = Phaser.Math.Clamp(this.player.x + x, 42, 498);
    const nextY = Phaser.Math.Clamp(this.player.y + y, 442, 780);
    if (this.canOccupy(nextX, this.player.y)) this.player.x = nextX;
    if (this.canOccupy(this.player.x, nextY)) this.player.y = nextY;
    this.player.setDepth(Math.round(this.player.y));
    this.playerAvatar.setAngle(Phaser.Math.Clamp(x * 0.65, -7, 7));
  }

  private canOccupy(x: number, y: number) {
    return !this.stationViews.some(({ obstacle }) =>
      x > obstacle.left - PLAYER_STATION_MARGIN_X
      && x < obstacle.right + PLAYER_STATION_MARGIN_X
      && y > obstacle.top - PLAYER_STATION_MARGIN_Y
      && y < obstacle.bottom + PLAYER_STATION_MARGIN_Y,
    );
  }

  private cancelAutoMovement() {
    if (this.moveTarget) {
      const color = STATION_COLORS[this.moveTarget.view.data.id] ?? 0x65d9e8;
      this.moveTarget.view.frame.setStrokeStyle(1, color, 0.16);
    }
    this.moveTarget = undefined;
    this.movePath = [];
  }

  private findNearbyStation() {
    let closest: { view: StationView; distance: number } | undefined;
    this.stationViews.forEach((view) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, view.access.x, view.access.y);
      if (!closest || distance < closest.distance) closest = { view, distance };
    });
    const nextNearby = closest && closest.distance < 76 ? closest.view : undefined;
    if (nextNearby !== this.nearby) {
      this.nearby?.frame.setStrokeStyle(1, STATION_COLORS[this.nearby.data.id] ?? 0x65d9e8, 0.16);
      nextNearby?.frame.setStrokeStyle(3, STATION_COLORS[nextNearby.data.id] ?? 0x65d9e8, 0.72);
      this.nearby = nextNearby;
    }
  }

  private spawnCustomer(initial = false) {
    if (this.outstandingOrders().length >= this.runtime.maxQueue || this.left < 10 || this.finished) return;
    const recipe = this.rng.pick(this.runtime.recipes);
    const customer = this.rng.pick(this.runtime.customers);
    const project = createProject(`box-${this.delivered}-${this.time.now}-${this.outstandingOrders().length}`, recipe, customer);
    const result = enqueueProject(this.projectQueue, project);
    if (!result.ok) return;
    this.updateHud();
    const view = this.customerViews[this.outstandingOrders().length - 1];
    if (view) {
      view.container.setAlpha(0).setScale(0.82);
      view.folder.setAlpha(0);
      this.tweens.add({ targets: view.container, alpha: 1, scale: 1, duration: 280, ease: 'Back.Out' });
      this.tweens.add({ targets: view.folder, alpha: 1, duration: 220 });
    }
    if (!initial) {
      this.setStatus(`${customer.name} 加入排隊：${recipe.purpose}`);
      this.tone(560, 0.05);
    }
  }

  private showOrderDetails(order: ProjectBox) {
    if (this.decision || this.orderDetail || this.finished) return;
    this.cancelAutoMovement();
    const veil = this.add.rectangle(0, 0, 540, 960, 0x020611, 0.78).setInteractive();
    const panel = this.add.rectangle(0, 0, 500, 700, 0x071323, 0.995).setStrokeStyle(3, 0x70e3ed, 0.9);
    const title = this.uiText(0, -316, order.recipe.name, { fontSize: '28px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    const customer = this.uiText(0, -278, `${order.customer.name}　耐心 ${Math.round(order.patience)}`, { fontSize: '16px', color: '#9fc8d9', align: 'center' })
      .setOrigin(0.5);
    const modeText = order.recipe.sequenceMode === 'ordered'
      ? '固定順序　依 1 → 2 → 3 完成'
      : '自由順序　所有項目完成即可';
    const mode = this.uiText(0, -241, modeText, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: order.recipe.sequenceMode === 'ordered' ? '#ffd166' : '#73efe4',
        backgroundColor: '#13243b',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
    const purpose = this.uiText(-220, -201, `目的｜${order.recipe.purpose}`, { fontSize: '16px', color: '#dff9ff', wordWrap: { width: 440 } })
      .setOrigin(0, 0);
    const action = this.uiText(-220, -161, `要做｜${order.recipe.action}`, { fontSize: '16px', color: '#dff9ff', wordWrap: { width: 440 } })
      .setOrigin(0, 0);
    const result = this.uiText(-220, -121, `交付｜${order.recipe.result}`, { fontSize: '16px', fontStyle: 'bold', color: '#ffe28a', wordWrap: { width: 440 } })
      .setOrigin(0, 0);
    const children: Phaser.GameObjects.GameObject[] = [veil, panel, title, customer, mode, purpose, action, result];
    const stepStartY = -62;
    order.recipe.runtimeSteps.slice(0, 6).forEach((step, index) => {
      const rowY = stepStartY + index * 52;
      const color = STATION_COLORS[step.stationId];
      const complete = isProjectStepComplete(order, step);
      const icon = this.makeStepIcon(34, 0);
      icon.container.setPosition(-205, rowY).setVisible(true).setAlpha(complete ? 0.62 : 1);
      icon.plate.setFillStyle(0x061421, 1).setStrokeStyle(3, color, 1);
      this.drawStationGlyph(icon.glyph, step.stationId, 34, color);
      icon.check.setVisible(complete);
      const number = this.uiText(-166, rowY, order.recipe.sequenceMode === 'ordered' ? `${index + 1}` : '•', {
          fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        })
        .setOrigin(0.5);
      const station = this.uiText(-145, rowY - 10, STATION_SHORT_LABELS[step.stationId], { fontSize: '16px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5);
      const output = this.uiText(-145, rowY + 12, STATION_OUTPUT_LABELS[step.stationId], { fontSize: '14px', color: '#8fb5c8' })
        .setOrigin(0, 0.5);
      const state = complete
        ? '已完成'
        : order.recipe.sequenceMode === 'flexible'
          ? '可自由安排'
          : index === order.stage
            ? '目前工序'
            : '後續工序';
      const stateText = this.uiText(214, rowY, state, { fontSize: '14px', fontStyle: 'bold', color: complete ? '#69e6a7' : '#b6d6e5' })
        .setOrigin(1, 0.5);
      children.push(icon.container, number, station, output, stateText);
    });
    const impact = order.decisionImpact
      ? `${order.decisionImpact.label}｜${order.decisionImpact.summary}`
      : '尚未接單｜前往櫃檯選擇處理方式';
    const footer = this.uiText(0, 255, `${impact}\n報酬 ${order.recipe.reward}　品質門檻 ${order.recipe.qualityTarget}`, {
        fontSize: '14px', color: '#c9e9f4', align: 'center', wordWrap: { width: 430 },
      })
      .setOrigin(0.5);
    const close = this.add.rectangle(0, 315, 210, 54, 0x174158, 1).setStrokeStyle(2, 0x6cece5, 0.7).setInteractive({ useHandCursor: true });
    const closeText = this.uiText(0, 315, '關閉訂單詳情', { fontSize: '16px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    children.push(footer, close, closeText);
    const closeDetails = () => {
      this.orderDetail?.destroy();
      this.orderDetail = undefined;
    };
    close.on('pointerdown', closeDetails);
    veil.on('pointerdown', closeDetails);
    this.orderDetail = this.add.container(270, 480, children).setDepth(2200);
  }

  private showDecision() {
    if (!this.box || this.box.accepted || this.decision) return;
    this.decisionProjectId = this.box.id;
    const choices: Array<[string, CustomerDecision]> = [
      ['接受原單', 'accept'],
      ['追問規格', 'question'],
      ['限制範圍', 'limits'],
      ['替代方案', 'alternative'],
      ['拒絕委託', 'reject'],
    ];
    const veil = this.add.rectangle(0, 0, 540, 960, 0x020611, 0.84).setInteractive();
    const panel = this.add.rectangle(0, 0, 500, 760, 0x071323, 0.99).setStrokeStyle(2, 0x70e3ed, 0.85);
    const title = this.uiText(0, -334, this.box.recipe.name, { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const subtitle = this.uiText(0, -296, `${this.box.customer.name}　耐心 ${Math.round(this.box.patience)}`, { fontSize: '17px', color: '#c8e6ef', align: 'center' }).setOrigin(0.5);
    const purpose = this.uiText(-218, -250, `◎ 目的　${this.box.recipe.purpose}`, { fontSize: '17px', color: '#dcf8ff', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const action = this.uiText(-218, -208, `➜ 動作　${this.box.recipe.action}`, { fontSize: '17px', color: '#dcf8ff', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const outcome = this.uiText(-218, -166, `◆ 成果　${this.box.recipe.result}`, { fontSize: '17px', color: '#ffe28a', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const children: Phaser.GameObjects.GameObject[] = [veil, panel, title, subtitle, purpose, action, outcome];
    choices.forEach(([label, value], index) => {
      const preview = decideCustomer(structuredClone(this.box!), value).impact;
      const detail = preview.details.slice(0, 2).join('｜');
      const y = -95 + index * 72;
      const button = this.add.rectangle(0, y, 440, 62, 0x173653, 1).setStrokeStyle(2, 0x5ca9c4, 0.55).setInteractive({ useHandCursor: true });
      const buttonText = this.uiText(0, y - 10, label, { fontSize: '19px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const detailText = this.uiText(0, y + 14, detail, { fontSize: '15px', color: '#d4edf6', align: 'center', wordWrap: { width: 410 } })
        .setOrigin(0.5);
      button.on('pointerdown', () => this.choose(value));
      children.push(button, buttonText, detailText);
    });
    this.decision = this.add.container(270, 480, children).setDepth(2000);
  }

  private choose(decision: CustomerDecision) {
    const candidate = peekNextProject(this.projectQueue);
    if (!candidate || candidate.id !== this.decisionProjectId) {
      this.decision?.destroy();
      this.decision = undefined;
      this.decisionProjectId = undefined;
      this.flashStatus('這位客戶已離開隊伍，請重新接待下一位。');
      return;
    }
    const result = decideNextProject(this.projectQueue, decision);
    if (!result.ok) {
      this.flashStatus(result.reason);
      return;
    }
    this.satisfaction = Phaser.Math.Clamp(this.satisfaction + result.satisfaction, 0, 100);
    this.decision?.destroy();
    this.decision = undefined;
    this.decisionProjectId = undefined;
    this.tone(result.accepted ? 640 : 220, 0.08);
    if (!result.accepted) {
      this.advanceCustomerQueue();
      this.setStatus(`${result.impact.label}｜${result.impact.details.join('・')}`);
      this.nextArrivalIn = Math.min(this.nextArrivalIn, 2);
    } else {
      this.loads.context += 15;
      this.animateFolderHandoff(result.project);
      this.setStatus(`${result.impact.label}｜${result.impact.details.slice(0, 2).join('・')}`);
    }
    this.updateHud();
  }

  private animateFolderHandoff(box: ProjectBox) {
    const folderVisual = this.makeFolderVisual(62, 46);
    folderVisual.container.setPosition(304, 332).setDepth(1600);
    this.updateFolderIcons(folderVisual.icons, box);
    this.folderInTransit = true;
    this.carriedBox.setVisible(false);
    this.tweens.add({
      targets: folderVisual.container,
      x: this.player.x + 43,
      y: this.player.y + 3,
      angle: -7,
      scale: 0.96,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => {
        folderVisual.container.destroy();
        this.folderInTransit = false;
        this.carriedBox.setVisible(true);
        this.updateFolderIcons(this.carriedBoxIcons, box);
        this.tweens.add({ targets: this.carriedBox, scale: 1.12, duration: 90, yoyo: true });
      },
    });
  }

  private interact() {
    if (this.decision || this.orderDetail || this.finished || this.left <= 0) return;
    if (!this.nearby) return;
    if (this.processing) return;
    const stationJob = this.stationJobs.get(this.nearby.data.id);
    if (stationJob) {
      if (stationJob.complete && stationJob.owner === 'player' && !this.projectQueue.active) {
        this.reclaimStationJob(stationJob);
      }
      return;
    }
    if (this.nearby.data.id === 'counter') {
      if (this.helperAgent?.selected && this.helperAgent.box) {
        if (this.helperAgent.box.complete) this.deliverHelperProject();
        return;
      }
      if (!this.box) return;
      if (!this.box.accepted) {
        this.showDecision();
        return;
      }
      if (!this.box.complete) return;
      if (this.box.addOn?.accepted === undefined) {
        this.showAddOn(this.box, 'player');
        return;
      }
      this.deliver();
      return;
    }
    if (this.helperAgent?.selected && this.helperAgent.box && !this.helperAgent.busy) {
      const result = validateProjectStep(this.helperAgent.box, this.nearby.data.id);
      if (!result.ok) return;
      this.startStationJob(this.helperAgent.box, this.nearby, 'agent');
      return;
    }
    const playerBox = this.projectQueue.active;
    if (!playerBox?.accepted) return;
    const result = validateProjectStep(playerBox, this.nearby.data.id);
    if (!result.ok) return;
    this.startStationJob(playerBox, this.nearby, 'player');
  }

  private startStationJob(box: ProjectBox, view: StationView, owner: 'player' | 'agent') {
    if (this.stationJobs.has(view.data.id) || this.stationJobs.size >= this.maxParallelJobs) return;
    if (owner === 'player') {
      const delegated = delegateActiveProject(this.projectQueue, this.maxParallelJobs);
      if (!delegated.ok || delegated.project.id !== box.id) return;
    } else if (!this.helperAgent || this.helperAgent.box?.id !== box.id) {
      return;
    }
    const baseDuration = processingMs(view.data, this.model, this.loads.server, this.effects);
    const agentSpeed = owner === 'agent' ? 1 + this.effects.agentLevel * 0.18 : 1;
    const duration = baseDuration / agentSpeed;
    this.loads[view.data.resource] += view.data.cost;
    this.loads.server += owner === 'agent' ? 22 : 18;
    const folderVisual = this.makeFolderVisual(50, 36);
    const folder = folderVisual.container
      .setPosition(view.container.x, view.container.y - 8)
      .setDepth(view.container.depth + 8);
    this.updateFolderIcons(folderVisual.icons, box);
    const job: StationJob = {
      box,
      view,
      owner,
      startedAt: this.time.now,
      endsAt: this.time.now + duration,
      folder,
      folderIcons: folderVisual.icons,
      complete: false,
    };
    this.stationJobs.set(view.data.id, job);
    view.progress.width = 0;
    if (owner === 'agent' && this.helperAgent) {
      this.helperAgent.busy = true;
      this.helperAgent.selected = false;
      this.helperAgent.folder.setVisible(false);
      this.tweens.add({
        targets: this.helperAgent.container,
        x: Phaser.Math.Clamp(view.access.x + (view.access.x < GAME_WIDTH / 2 ? -78 : 78), 48, 492),
        y: Phaser.Math.Clamp(view.access.y + 44, 452, 770),
        duration: 220,
        ease: 'Sine.Out',
      });
    }
    const workPulse = this.add
      .circle(view.container.x, view.container.y, 24, STATION_COLORS[view.data.id] ?? 0x65d9e8, 0.24)
      .setDepth(view.container.depth + 1);
    this.tweens.add({
      targets: workPulse,
      scale: 2.4,
      alpha: 0,
      duration: Math.min(720, duration),
      repeat: Math.max(0, Math.ceil(duration / 720) - 1),
      onComplete: () => workPulse.destroy(),
    });
    this.tweens.add({ targets: view.container, scale: 1.04, duration: 130, yoyo: true, repeat: 1 });
    this.setStatus(`${owner === 'agent' ? 'Agent 已放入' : '已放入'}「${box.recipe.name}」；機台開始獨立運算。`);
    this.tone(420, 0.05);
    this.updateHud();
  }

  private updateStationJobs() {
    this.stationJobs.forEach((job) => {
      if (job.complete) return;
      const total = Math.max(1, job.endsAt - job.startedAt);
      const ratio = Phaser.Math.Clamp((this.time.now - job.startedAt) / total, 0, 1);
      job.view.progress.width = job.view.progressMax * ratio;
      if (ratio >= 1) this.finishStationJob(job);
    });
  }

  private finishStationJob(job: StationJob) {
    if (job.complete || this.finished) return;
    const agentQuality = job.owner === 'agent' ? -8 + this.effects.agentLevel * 5 : 0;
    const skillQuality = this.model.id === 'atlas' && this.time.now < this.skillUntil ? 16 : 0;
    const result = processProject(
      job.box,
      job.view.data.id,
      job.view.data.quality + this.effects.stability * 10 + skillQuality + agentQuality,
    );
    if (!result.ok) return;
    job.complete = true;
    job.view.progress.width = job.view.progressMax;
    this.loads[job.view.data.resource] = Math.max(5, this.loads[job.view.data.resource] - job.view.data.cost * 0.7);
    this.loads.server = Math.max(12, this.loads.server - (job.owner === 'agent' ? 17 : 14));
    this.score += 40;
    this.updateFolderIcons(job.folderIcons, job.box);
    if (job.owner === 'agent' && this.helperAgent) {
      job.folder.destroy();
      job.view.progress.width = 0;
      this.stationJobs.delete(job.view.data.id);
      this.helperAgent.busy = false;
      this.helperAgent.box = job.box;
      this.helperAgent.folder.setVisible(true);
      this.updateFolderIcons(this.helperAgent.folderIcons, job.box);
      this.setStatus(`Agent 完成「${STATION_SHORT_LABELS[job.view.data.id]}」，已抱回資料夾。`);
    } else {
      job.folder.setAlpha(1).setScale(1.08);
      this.setStatus(`${STATION_SHORT_LABELS[job.view.data.id]}完成；回到機台取回資料夾。`);
    }
    this.tone(job.box.complete ? 880 : 620, 0.09);
    navigator.vibrate?.(job.box.complete ? [20, 25, 20] : 18);
    this.updateHud();
  }

  private reclaimStationJob(job: StationJob) {
    const reclaimed = reclaimDelegatedProject(this.projectQueue, job.box.id);
    if (!reclaimed.ok) return;
    job.folder.destroy();
    job.view.progress.width = 0;
    this.stationJobs.delete(job.view.data.id);
    this.setStatus(reclaimed.project.complete
      ? '已取回完成資料夾；可回櫃檯交付。'
      : '已取回資料夾；可自行安排下一道工序。');
    this.updateHud();
  }

  private showAddOn(box = this.box, source: 'player' | 'agent' = 'player') {
    if (!box?.addOn || this.decision) return;
    this.addOnBox = box;
    this.addOnSource = source;
    const veil = this.add.rectangle(0, 0, 540, 960, 0x020611, 0.68).setInteractive();
    const panel = this.add.rectangle(0, 0, 490, 245, 0x1a1024, 0.99).setStrokeStyle(2, 0xff79c3, 0.85);
    const title = this.uiText(0, -82, '⚠ 客戶追加要求', { fontSize: '22px', fontStyle: 'bold', color: '#ffb6dd' }).setOrigin(0.5);
    const request = this.uiText(0, -35, `「${box.addOn.label}」`, { fontSize: '17px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    const accept = this.add.rectangle(-112, 58, 190, 62, 0x17615e, 1).setStrokeStyle(2, 0x6cf4df, 0.8).setInteractive({ useHandCursor: true });
    const reject = this.add.rectangle(112, 58, 190, 62, 0x532035, 1).setStrokeStyle(2, 0xff8fb6, 0.8).setInteractive({ useHandCursor: true });
    const acceptText = this.uiText(-112, 58, '接受追加\n重新處理', { fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    const rejectText = this.uiText(112, 58, '拒絕追加\n直接交付', { fontSize: '15px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    accept.on('pointerdown', () => this.answerAddOn(true));
    reject.on('pointerdown', () => this.answerAddOn(false));
    this.decision = this.add.container(270, 480, [veil, panel, title, request, accept, reject, acceptText, rejectText]).setDepth(2000);
  }

  private answerAddOn(accept: boolean) {
    const box = this.addOnBox;
    const source = this.addOnSource ?? 'player';
    if (!box) return;
    const result = answerAddOn(box, accept);
    this.satisfaction = Phaser.Math.Clamp(this.satisfaction + result.satisfaction, 0, 100);
    this.decision?.destroy();
    this.decision = undefined;
    this.decisionProjectId = undefined;
    this.addOnBox = undefined;
    this.addOnSource = undefined;
    this.setStatus(accept ? '已接受追加，資料箱重新開啟！' : '拒絕追加，客戶不太滿意');
    if (!accept) {
      if (source === 'agent') this.deliverHelperProject(true);
      else this.deliver(true);
    }
    this.updateHud();
  }

  private deliver(skipAddOn = false) {
    const box = this.projectQueue.active;
    if (!box) return;
    if (!skipAddOn) {
      if (box.addOn?.accepted === undefined || offerAddOn(box, this.rng.next())) {
        this.showAddOn(box, 'player');
        return;
      }
    }
    const customerIndex = this.outstandingOrders().findIndex((order) => order.id === box.id);
    this.processing = true;
    this.folderInTransit = true;
    this.carriedBox.setVisible(false);
    const deliveryFolder = this.makeFolderVisual(62, 46);
    deliveryFolder.container.setPosition(this.player.x + 43, this.player.y + 3).setAngle(-7).setDepth(1700);
    this.updateFolderIcons(deliveryFolder.icons, box);
    this.setStatus('把完成資料夾放上交付盤…');
    this.tweens.add({
      targets: deliveryFolder.container,
      x: this.deliveryTray.x,
      y: this.deliveryTray.y,
      angle: 0,
      duration: 280,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.tweens.add({ targets: this.deliveryTray, scale: 1.12, duration: 90, yoyo: true });
        this.tweens.add({
          targets: deliveryFolder.container,
          y: 318,
          scale: 0.7,
          alpha: 0,
          duration: 240,
          ease: 'Cubic.In',
          onComplete: () => {
            deliveryFolder.container.destroy();
            const deliveredResult = deliverActiveProject(this.projectQueue);
            this.processing = false;
            this.folderInTransit = false;
            if (!deliveredResult.ok) {
              this.flashStatus(deliveredResult.reason);
              this.updateHud();
              if (this.left === 0) this.endRun();
              return;
            }
            this.settleDelivery(box, customerIndex);
          },
        });
      },
    });
  }

  private deliverHelperProject(skipAddOn = false) {
    const helper = this.helperAgent;
    const box = helper?.box;
    if (!helper || !box || !box.complete || this.processing) return;
    if (!skipAddOn) {
      if (box.addOn?.accepted === undefined || offerAddOn(box, this.rng.next())) {
        this.showAddOn(box, 'agent');
        return;
      }
    }
    const customerIndex = this.outstandingOrders().findIndex((order) => order.id === box.id);
    this.processing = true;
    helper.busy = true;
    helper.selected = false;
    helper.folder.setVisible(false);
    const deliveryFolder = this.makeFolderVisual(58, 42);
    deliveryFolder.container
      .setPosition(helper.container.x + 29, helper.container.y + 2)
      .setAngle(-8)
      .setDepth(1700);
    this.updateFolderIcons(deliveryFolder.icons, box);
    this.setStatus('Agent 把完成資料夾放上交付盤…');
    this.tweens.add({
      targets: deliveryFolder.container,
      x: this.deliveryTray.x,
      y: this.deliveryTray.y,
      angle: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.tweens.add({ targets: this.deliveryTray, scale: 1.12, duration: 90, yoyo: true });
        this.tweens.add({
          targets: deliveryFolder.container,
          y: 318,
          scale: 0.7,
          alpha: 0,
          duration: 240,
          ease: 'Cubic.In',
          onComplete: () => {
            deliveryFolder.container.destroy();
            const deliveredResult = deliverDelegatedProject(this.projectQueue, box.id);
            this.processing = false;
            helper.busy = false;
            if (!deliveredResult.ok) {
              helper.folder.setVisible(true);
              helper.selected = true;
              this.flashStatus(deliveredResult.reason);
              this.updateHud();
              if (this.left === 0) this.endRun();
              return;
            }
            helper.box = undefined;
            this.settleDelivery(box, customerIndex);
          },
        });
      },
    });
  }

  private settleDelivery(box: ProjectBox, customerIndex: number) {
    this.advanceCustomerQueue(customerIndex);
    const average = box.quality / Math.max(1, box.outputs.length);
    this.score += box.recipe.reward + Math.round(average);
    this.satisfaction = Math.min(100, this.satisfaction + 5);
    this.delivered += 1;
    this.loads.context = Math.max(5, this.loads.context - 15);
    this.setStatus(`完整交付「${box.recipe.result}」！下一位客戶已往櫃檯前進。`);
    this.tone(1040, 0.14);
    navigator.vibrate?.([25, 30, 35]);
    this.cameras.main.flash(160, 70, 235, 214, false);
    this.nextArrivalIn = Math.min(this.nextArrivalIn, 2);
    this.updateHud();
    if (this.left === 0) this.endRun();
  }

  private dash() {
    if (this.finished || this.time.now < this.dashReadyAt) return;
    this.dashUntil = this.time.now + 280;
    this.dashReadyAt = this.time.now + 2200;
    this.tone(760, 0.04);
    this.tweens.add({ targets: this.player, alpha: 0.45, duration: 80, yoyo: true, repeat: 2 });
  }

  private activateSkill() {
    if (this.finished || this.time.now < this.skillReadyAt) return;
    this.skillReadyAt = this.time.now + 14_000;
    this.skillUntil = this.time.now + 5_000;
    switch (this.model.id) {
      case 'relay':
        this.loads.server = Math.max(12, this.loads.server - 24);
        this.loads.context = Math.max(5, this.loads.context - 12);
        break;
      case 'atlas':
        this.satisfaction = Math.min(100, this.satisfaction + 4);
        break;
      case 'muse':
        this.loads.gpu = Math.max(5, this.loads.gpu - 28);
        break;
      case 'forge':
        this.loads.ram = Math.max(5, this.loads.ram - 25);
        this.loads.cpu = Math.max(5, this.loads.cpu - 12);
        break;
      case 'abyss':
        RESOURCE_KEYS.forEach((key) => (this.loads[key] = Math.max(key === 'server' ? 12 : 5, this.loads[key] - 14)));
        break;
      default:
        break;
    }
    this.setStatus(`${this.model.skillName} 啟動！${this.model.skillDescription}`);
    this.tone(940, 0.1);
    this.cameras.main.flash(120, (this.model.color >> 16) & 255, (this.model.color >> 8) & 255, this.model.color & 255, false);
    this.updateHud();
  }

  private tick() {
    if (this.finished || this.left <= 0) return;
    this.left -= 1;
    if (this.left > 10) {
      this.nextArrivalIn -= 1;
      if (this.nextArrivalIn <= 0) {
        if (this.outstandingOrders().length < this.runtime.maxQueue) {
          this.spawnCustomer();
          this.nextArrivalIn = this.runtime.arrivalSeconds;
        } else {
          this.nextArrivalIn = 1;
        }
      }
    }
    const patience = this.decision
      ? { exhausted: [], abandoned: [], activeExhausted: undefined }
      : tickProjectQueue(this.projectQueue, 1, this.runtime.patienceDrain);
    patience.abandoned.forEach((project) => {
      this.satisfaction = Math.max(0, this.satisfaction - 6);
      this.complaints.push(`${project.customer.name} 排隊過久後離開`);
    });
    const acceptedExhausted = patience.exhausted.filter((project) => project.accepted && !this.impatientBoxIds.has(project.id));
    acceptedExhausted.forEach((project) => {
      this.impatientBoxIds.add(project.id);
      this.satisfaction = Math.max(0, this.satisfaction - 8);
      this.complaints.push(`${project.customer.name} 等待過久`);
    });
    if (acceptedExhausted.length) {
      this.flashStatus('手上或機台裡的訂單已失去耐心；仍可完成，但滿意度已下降。');
    } else if (patience.abandoned.length) {
      this.flashStatus(`${patience.abandoned.length} 位客戶等太久離隊，滿意度下降`);
    }
    RESOURCE_KEYS.forEach((key) => {
      this.loads[key] = Math.max(key === 'server' ? 12 : 5, this.loads[key] - 0.7);
    });
    this.updateHud();
    if (this.left === 30) {
      this.setStatus('最後 30 秒！完成手上的訂單！');
      navigator.vibrate?.([40, 60, 40]);
    }
    if (this.left === 0 && !this.processing) this.endRun();
  }

  private endRun() {
    if (this.finished) return;
    this.finished = true;
    this.decision?.destroy();
    this.decision = undefined;
    this.orderDetail?.destroy();
    this.orderDetail = undefined;
    this.decisionProjectId = undefined;
    this.addOnBox = undefined;
    this.addOnSource = undefined;
    this.resetJoystick();
    const [one, two, three] = this.runtime.stars;
    const stars = this.score >= three ? 3 : this.score >= two ? 2 : this.score >= one ? 1 : 0;
    this.setStatus('時間到！停止接收新客戶，正在結算成果。');
    this.time.delayedCall(450, () => {
      this.onFinish({
        score: this.score,
        stars,
        delivered: this.delivered,
        satisfaction: Math.round(this.satisfaction),
        complaints: this.complaints,
      });
    });
  }

  private updateHud() {
    const urgent = this.left <= 30;
    this.timerText.setText(`${Math.floor(this.left / 60)}:${String(this.left % 60).padStart(2, '0')}`);
    this.timerText.setColor(urgent ? '#ff806c' : '#ffffff');
    this.tweens.killTweensOf(this.timerText);
    this.timerText.setScale(1).setAlpha(1);
    if (urgent) {
      this.tweens.add({ targets: this.timerText, alpha: 0.62, duration: 220, yoyo: true });
    }
    this.scoreText.setText(`SCORE\n${this.score}`);
    this.satisfactionText.setText(`滿意度\n${Math.round(this.satisfaction)}%`);

    const orders = this.outstandingOrders();
    this.queueText.setText(`排隊 ${this.projectQueue.waiting.length}　運算 ${this.stationJobs.size}/${this.maxParallelJobs}`);
    this.orderCards.forEach((card, cardIndex) => {
      const order = orders[cardIndex];
      if (!order) {
        card.container.setVisible(false);
        return;
      }
      card.container.setVisible(true);
      const isActive = this.projectQueue.active === order;
      const helperOwns = this.helperAgent?.box?.id === order.id;
      const stationJob = [...this.stationJobs.values()].find((job) => job.box.id === order.id);
      const isWaiting = this.projectQueue.waiting.includes(order);
      const frameColor = stationJob
        ? STATION_COLORS[stationJob.view.data.id]
        : helperOwns
          ? 0xb69cff
          : isActive
            ? 0x6ff5e5
            : isWaiting && cardIndex === 0
              ? 0xffd16e
              : 0x538aa4;
      card.frame.setStrokeStyle(isActive || helperOwns || Boolean(stationJob) ? 3 : 2, frameColor, isActive || helperOwns || stationJob ? 0.95 : 0.58);
      card.title.setText(order.recipe.name.length > 7 ? `${order.recipe.name.slice(0, 7)}…` : order.recipe.name);
      const orderState = stationJob
        ? stationJob.complete
          ? `${STATION_SHORT_LABELS[stationJob.view.data.id]}完成・待取回`
          : `${stationJob.owner === 'agent' ? 'Agent・' : ''}${STATION_SHORT_LABELS[stationJob.view.data.id]}運算中`
        : helperOwns
          ? `Agent 持有 ${order.stage}/${order.recipe.runtimeSteps.length}`
          : isActive
            ? `玩家持有 ${order.stage}/${order.recipe.runtimeSteps.length}`
            : cardIndex === 0
              ? '櫃檯待接單・點開詳情'
              : '排隊等候・點開詳情';
      card.state.setText(orderState);
      card.state.setColor(stationJob ? '#ffffff' : helperOwns ? '#d9ccff' : isActive ? '#73f2df' : cardIndex === 0 ? '#ffe18b' : '#9abfd0');
      this.updateFolderIcons(card.iconSlots, order);
      const patienceRatio = Phaser.Math.Clamp(order.patience / Math.max(1, order.customer.patience), 0, 1);
      card.patienceFill.width = 132 * patienceRatio;
      card.patienceFill.fillColor = patienceRatio < 0.25 ? 0xff685b : patienceRatio < 0.5 ? 0xffc15a : 0x59e7d2;
    });
    this.updateCustomerViews();

    RESOURCE_KEYS.forEach((key) => {
      const ratio = Phaser.Math.Clamp(this.loads[key] / this.effects.capacity[key], 0, 1.2);
      const bar = this.loadBars.get(key)!;
      bar.width = 68 * Math.min(1, ratio);
      bar.fillColor = ratio >= 0.9 ? 0xff765f : ratio >= 0.7 ? 0xffc85d : 0x5be7d0;
    });
    const active = this.projectQueue.active;
    this.carriedBox.setVisible(Boolean(active) && !this.folderInTransit);
    this.carriedSummaryText.setVisible(Boolean(active));
    if (active) {
      this.updateFolderIcons(this.carriedBoxIcons, active);
      this.carriedSummaryText.setText(active.complete
        ? '資料夾成果齊全　→　回櫃檯放上交付盤'
        : `手持資料夾 ${active.stage}/${active.recipe.runtimeSteps.length}　對照委託的顏色與圖案`);
    }
  }

  private updateControlState() {
    const action = this.actionState();
    this.actionLabel.setText(action);
    const skillRemaining = Math.max(0, Math.ceil((this.skillReadyAt - this.time.now) / 1000));
    const dashRemaining = Math.max(0, Math.ceil((this.dashReadyAt - this.time.now) / 1000));
    const skillLabel = this.skillButton.getAt(3) as Phaser.GameObjects.Text;
    const dashLabel = this.dashButton.getAt(3) as Phaser.GameObjects.Text;
    skillLabel.setText(skillRemaining ? `${skillRemaining}s` : this.model.skillName);
    dashLabel.setText(dashRemaining ? `${dashRemaining}s` : '衝刺');
    this.skillButton.setAlpha(skillRemaining ? 0.52 : 1);
    this.dashButton.setAlpha(dashRemaining ? 0.52 : 1);
  }

  private actionState() {
    if (this.processing) return '交付中';
    if (!this.nearby) return '選擇機台';
    const stationJob = this.stationJobs.get(this.nearby.data.id);
    if (stationJob) {
      if (stationJob.complete && stationJob.owner === 'player' && !this.projectQueue.active) return '取回資料夾';
      return stationJob.complete ? '機台已完成' : '機台運算中';
    }
    if (this.nearby.data.id === 'counter') {
      if (this.helperAgent?.selected && this.helperAgent.box) {
        return this.helperAgent.box.complete ? '交付 Agent' : 'Agent 尚未完成';
      }
      if (!this.box) return '接待';
      if (!this.box.accepted) return '接單';
      if (this.box.complete) return '交付';
      return '尚未完成';
    }
    if (this.helperAgent?.selected && this.helperAgent.box && !this.helperAgent.busy) return '指派 Agent';
    if (!this.box?.accepted) return '沒有資料夾';
    return '放入機台';
  }

  private setStatus(message: string) {
    this.statusText.setText(message);
    this.statusText.setAlpha(1);
  }

  private flashStatus(message: string) {
    this.setStatus(message);
    this.tweens.killTweensOf(this.statusText);
    this.tweens.add({ targets: this.statusText, alpha: 0.45, duration: 90, yoyo: true, repeat: 2 });
  }

  private tone(frequency: number, duration: number) {
    try {
      this.audioContext ??= new AudioContext();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
      oscillator.connect(gain).connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch {
      // Audio is optional; browsers may block it until a gesture is received.
    }
  }
}
