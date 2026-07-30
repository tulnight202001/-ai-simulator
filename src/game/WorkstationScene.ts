import Phaser from 'phaser';
import type { Career } from '../core/career';
import { SeededRandom } from '../core/random';
import {
  agentCanProcess,
  answerAddOn,
  createProjectQueue,
  createProject,
  decideNextProject,
  deliverActiveProject,
  enqueueProject,
  offerAddOn,
  outstandingProjects,
  peekNextProject,
  processProject,
  processingMs,
  runtimeLevel,
  tickProjectQueue,
  upgradeEffects,
  validateProjectStep,
  type AgentState,
  type CustomerDecision,
  type ProjectBox,
  type ProjectQueue,
} from '../core/v1Runtime';
import type { ModelDefinition, ResourceKey } from '../data/content';
import type { WorkstationData } from '../data/v1Catalog';
import { getCustomerArtPath, getEraBackgroundPath, getModelArtPath, getStationArtPath } from '../data/artCatalog';

export interface RunResult {
  score: number;
  stars: number;
  delivered: number;
  satisfaction: number;
  complaints: string[];
}

interface StationView {
  data: WorkstationData;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  progress: Phaser.GameObjects.Rectangle;
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

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const RESOURCE_KEYS: ResourceKey[] = ['cpu', 'gpu', 'ram', 'context', 'server'];
const RESOURCE_LABELS: Record<ResourceKey, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  context: 'CTX',
  server: 'NET',
};
const STATION_COLORS: Record<string, number> = {
  counter: 0xffcf66,
  text: 0x49e4ff,
  search: 0x42f5c5,
  document: 0x7cf2a7,
  art: 0xe95cff,
  music: 0xa879ff,
  recording: 0xff6b70,
  studio: 0xffb84d,
  video: 0x4a9dff,
  code: 0xff9f43,
  deploy: 0x41d9ff,
};
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
  private joystickKnob!: Phaser.GameObjects.Arc;
  private decision?: Phaser.GameObjects.Container;
  private decisionProjectId?: string;
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
  private activeStation?: StationView;
  private processStartedAt = 0;
  private processEndsAt = 0;
  private dashUntil = 0;
  private dashReadyAt = 0;
  private skillReadyAt = 0;
  private skillUntil = 0;
  private nextArrivalIn = 0;
  private folderInTransit = false;
  private readonly runtime;
  private readonly effects;
  private readonly rng;
  private readonly agent: AgentState;
  private audioContext?: AudioContext;

  constructor(
    private readonly model: ModelDefinition,
    private readonly career: Career,
    private readonly levelId: string,
    seed: number,
    private readonly onFinish: (result: RunResult) => void,
  ) {
    super('workstation');
    this.runtime = runtimeLevel(levelId);
    this.left = this.runtime.duration;
    this.effects = upgradeEffects(career);
    this.projectQueue = createProjectQueue(this.runtime.maxQueue);
    this.rng = new SeededRandom(seed);
    this.agent = {
      assignment: career.agent.assignment,
      busy: false,
      cooldownUntil: 0,
      load: 0,
    };
  }

  preload() {
    const asset = (path: string) => new URL(path, document.baseURI).toString();
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
    this.cameras.main.setBackgroundColor('#050a18');
    this.input.addPointer(3);
    this.makeBackdrop();
    this.makeHud();
    this.makeCustomers();
    this.makeStations();
    this.makePlayer();
    this.makeControls();
    this.bindKeyboard();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.nextArrivalIn = this.runtime.arrivalSeconds;
    for (let index = 0; index < this.runtime.initialQueue; index += 1) this.spawnCustomer(true);
    this.updateHud();
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
    this.updateProcessingBar();
    this.updateControlState();
  }

  private makeBackdrop() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050a18);
    const backdrop = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, `era-${this.runtime.era}-v2`);
    const coverScale = Math.max(GAME_WIDTH / Math.max(1, backdrop.width), GAME_HEIGHT / Math.max(1, backdrop.height));
    backdrop.setScale(coverScale);
    this.add.rectangle(GAME_WIDTH / 2, 475, GAME_WIDTH, 570, 0x020817, 0.08);

    this.add
      .text(36, 204, `${this.runtime.name.toUpperCase()}  /  ${this.runtime.mapId}`, {
        fontFamily: 'Inter, Noto Sans TC, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#78a9c8',
      })
      .setLetterSpacing(1.4);
  }

  private makeHud() {
    this.add.rectangle(270, 35, 168, 58, 0x07101f, 0.98).setStrokeStyle(2, 0x55e6ef, 0.75);
    this.add.text(226, 15, '⌛', { fontSize: '24px', color: '#5ff4f4' });
    this.timerText = this.add
      .text(302, 35, '', {
        fontFamily: 'Inter, Noto Sans TC, sans-serif',
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add.rectangle(63, 35, 98, 54, 0x0b1729, 0.92).setStrokeStyle(1, 0x6195c5, 0.45);
    this.scoreText = this.add
      .text(63, 35, '', { fontSize: '13px', fontStyle: 'bold', color: '#d8f4ff', align: 'center' })
      .setOrigin(0.5);
    this.add.rectangle(477, 35, 98, 54, 0x0b1729, 0.92).setStrokeStyle(1, 0x6195c5, 0.45);
    this.satisfactionText = this.add
      .text(477, 35, '', { fontSize: '13px', fontStyle: 'bold', color: '#ffe27a', align: 'center' })
      .setOrigin(0.5);

    this.add.text(18, 72, '訂單佇列', { fontSize: '13px', fontStyle: 'bold', color: '#cdefff' });
    this.queueText = this.add
      .text(522, 72, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#7df3e7',
      })
      .setOrigin(1, 0);
    [96, 270, 444].forEach((x, index) => this.makeOrderCard(x, index));

    const barWidth = 68;
    RESOURCE_KEYS.forEach((key, index) => {
      const x = 14 + index * 105;
      this.add.text(x, 186, RESOURCE_LABELS[key], { fontSize: '10px', fontStyle: 'bold', color: '#8ab0c8' });
      this.add.rectangle(x + 30, 191, barWidth, 7, 0x142740, 1).setOrigin(0, 0.5);
      const fill = this.add.rectangle(x + 30, 191, 8, 7, 0x5be7d0, 1).setOrigin(0, 0.5);
      this.loadBars.set(key, fill);
    });

    this.statusText = this.add
      .text(270, 797, '', {
        fontSize: '15px',
        color: '#d9f6ff',
        align: 'center',
        backgroundColor: '#06111fe8',
        padding: { x: 14, y: 8 },
        wordWrap: { width: 470 },
      })
      .setOrigin(0.5)
      .setDepth(1100);

    this.carriedSummaryText = this.add
      .text(270, 762, '', {
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
    const badge = this.add
      .text(-68, -39, `${index + 1}`, {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#06111c',
        backgroundColor: '#73efe4',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5);
    const title = this.add
      .text(0, -33, '', { fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    const state = this.add
      .text(0, 23, '', { fontSize: '11px', fontStyle: 'bold', color: '#8fb8cc', align: 'center' })
      .setOrigin(0.5);
    const iconSlots = [0, 1, 2].map(() => this.makeStepIcon(25, 42));
    iconSlots.forEach((slot) => slot.container.setPosition(0, -5));
    const patienceBack = this.add.rectangle(-66, 40, 132, 8, 0x1b2940, 1).setOrigin(0, 0.5);
    const patienceFill = this.add.rectangle(-66, 40, 132, 8, 0x59e7d2, 1).setOrigin(0, 0.5);
    const container = this.add
      .container(x, 132, [frame, badge, title, state, ...iconSlots.map((slot) => slot.container), patienceBack, patienceFill])
      .setDepth(1200)
      .setVisible(false);
    this.orderCards.push({ container, frame, title, state, iconSlots, patienceFill });
  }

  private stationPosition(station: WorkstationData, index: number) {
    if (station.id === 'counter') return { x: 270, y: 374 };
    const nonCounter = this.runtime.workstations.filter((item) => item.id !== 'counter');
    const itemIndex = nonCounter.findIndex((item) => item.id === station.id);
    const variant = Number(this.runtime.mapId.split('-').at(-1)) || 1;
    const compact = nonCounter.length > 6;
    const rowGap = compact ? 62 : 118;
    const firstY = compact ? 470 : 500;
    const baseRow = Math.floor(itemIndex / 2);
    const rowOrders = [0, 2, 4, 1, 3];
    const row = variant === 3 && compact ? rowOrders[baseRow] ?? baseRow : baseRow;
    const mirrored = variant === 2 || (variant === 3 && baseRow % 2 === 1);
    const isLeft = (itemIndex % 2 === 0) !== mirrored;
    const edgeOffset = variant === 3 && row % 2 === 1 ? 8 : 0;
    return {
      x: isLeft ? 88 + edgeOffset : 452 - edgeOffset,
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
      const alert = this.add
        .text(0, -169, '!', { fontSize: '18px', fontStyle: 'bold', color: '#ff826e' })
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
    const check = this.add
      .text(size * 0.3, size * 0.28, '✓', { fontSize: `${Math.max(8, Math.round(size * 0.42))}px`, fontStyle: 'bold', color: '#f3fff9' })
      .setOrigin(0.5)
      .setVisible(false);
    const more = this.add
      .text(0, 0, '', { fontSize: `${Math.max(8, Math.round(size * 0.46))}px`, fontStyle: 'bold', color: '#d8c7ff' })
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
      icon.check.setVisible(Boolean(step && index < box.stage));
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
      const complete = index < box.stage;
      const active = index === box.stage;
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
      view.folder.setScale(0.86 * position.scale).setVisible(index > 0 || !order.accepted);
      this.updateFolderIcons(view.folderIcons, order);
    });
  }

  private advanceCustomerQueue() {
    const leaving = this.customerViews.shift();
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
      const hitWidth = isCounter ? 492 : 144;
      const hitHeight = isCounter ? 116 : 72;
      const frame = this.add
        .rectangle(0, 0, hitWidth, hitHeight, 0x07101e, 0.025)
        .setStrokeStyle(1, color, 0.16);
      const sprite = this.add.image(0, isCounter ? 0 : compact ? -5 : -12, `station-${station.id}-v3`);
      this.fitImage(sprite, isCounter ? 492 : compact ? 136 : 142, isCounter ? 126 : compact ? 58 : 92);
      const labelY = isCounter ? 36 : compact ? 18 : 19;
      const labelWidth = isCounter ? 164 : compact ? 128 : 132;
      const labelHeight = isCounter ? 28 : compact ? 20 : 24;
      const labelPlate = this.add
        .rectangle(0, labelY, labelWidth, labelHeight, 0x03101c, 0.96)
        .setStrokeStyle(1, color, 0.72);
      const label = this.add
        .text(0, labelY, STATION_SHORT_LABELS[station.id], {
          fontSize: isCounter ? '16px' : '15px',
          fontStyle: 'bold',
          color: '#effbff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setResolution(2);
      const progressY = isCounter ? 53 : 34;
      const progressBack = this.add.rectangle(-48, progressY, 96, 5, 0x07101e, 0.92).setOrigin(0, 0.5);
      const progress = this.add.rectangle(-48, progressY, 0, 5, color, 1).setOrigin(0, 0.5);
      const container = this.add
        .container(x, y, [frame, sprite, labelPlate, label, progressBack, progress])
        .setSize(hitWidth, hitHeight)
        .setDepth(isCounter ? 410 : y)
        .setInteractive({ useHandCursor: true });
      const access = isCounter
        ? new Phaser.Math.Vector2(x, y + 82)
        : new Phaser.Math.Vector2(x < GAME_WIDTH / 2 ? x + 104 : x - 104, y + 18);
      const obstacle = new Phaser.Geom.Rectangle(x - hitWidth / 2, y - hitHeight / 2, hitWidth, hitHeight);
      const view: StationView = { data: station, container, frame, progress, access, obstacle };
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
        const trayIcon = this.add.text(0, -4, '交付', { fontSize: '12px', fontStyle: 'bold', color: '#f8ffff' }).setOrigin(0.5);
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
    const cue = this.add
      .text(0, -116, this.model.glyph, {
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
    this.add.text(86, 947, '移動', { fontSize: '12px', fontStyle: 'bold', color: '#85afc6' }).setOrigin(0.5).setDepth(1002);
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
    const iconText = this.add.text(0, -7, icon, { fontSize: `${Math.max(17, radius * 0.48)}px`, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const labelText = this.add.text(0, radius * 0.42, label, { fontSize: '12px', fontStyle: 'bold', color: '#e7fbff' }).setOrigin(0.5);
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
    if (this.decision || this.finished || this.left <= 0) return;
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
    if (!this.moveTarget || this.decision) return;
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
    const marginX = 24;
    const marginY = 18;
    return !this.stationViews.some(({ obstacle }) =>
      x > obstacle.left - marginX
      && x < obstacle.right + marginX
      && y > obstacle.top - marginY
      && y < obstacle.bottom + marginY,
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

  private showDecision() {
    if (!this.box || this.box.accepted || this.decision) return;
    this.decisionProjectId = this.box.id;
    const choices: Array<[string, CustomerDecision, string]> = [
      ['接受', 'accept', '直接開工'],
      ['追問', 'question', '補齊需求'],
      ['限制作法', 'limits', '先說清楚'],
      ['替代方案', 'alternative', '換條路'],
      ['拒絕', 'reject', '保住算力'],
    ];
    const veil = this.add.rectangle(270, 480, 540, 960, 0x020611, 0.68).setInteractive();
    const panel = this.add.rectangle(0, 0, 500, 470, 0x071323, 0.99).setStrokeStyle(2, 0x70e3ed, 0.85);
    const title = this.add.text(0, -198, this.box.recipe.name, { fontSize: '24px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const subtitle = this.add.text(0, -163, `${this.box.customer.name}　耐心 ${Math.round(this.box.patience)}`, { fontSize: '14px', color: '#9ec8d8', align: 'center' }).setOrigin(0.5);
    const purpose = this.add.text(-218, -116, `◎ 目的　${this.box.recipe.purpose}`, { fontSize: '14px', color: '#dcf8ff', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const action = this.add.text(-218, -74, `➜ 動作　${this.box.recipe.action}`, { fontSize: '14px', color: '#dcf8ff', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const outcome = this.add.text(-218, -32, `◆ 成果　${this.box.recipe.result}`, { fontSize: '14px', color: '#ffe28a', wordWrap: { width: 438 } }).setOrigin(0, 0.5);
    const children: Phaser.GameObjects.GameObject[] = [veil, panel, title, subtitle, purpose, action, outcome];
    choices.forEach(([label, value, detail], index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = index === 4 ? 0 : -120 + column * 240;
      const y = 42 + row * 78;
      const button = this.add.rectangle(x, y, index === 4 ? 220 : 205, 58, 0x173653, 1).setStrokeStyle(2, 0x5ca9c4, 0.55).setInteractive({ useHandCursor: true });
      const buttonText = this.add.text(x, y - 8, label, { fontSize: '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const detailText = this.add.text(x, y + 14, detail, { fontSize: '12px', color: '#9fc9da' }).setOrigin(0.5);
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
      this.setStatus(`${result.message}，滿意度 ${result.satisfaction >= 0 ? '+' : ''}${result.satisfaction}`);
      this.nextArrivalIn = Math.min(this.nextArrivalIn, 2);
    } else {
      this.loads.context += 15;
      this.animateFolderHandoff(result.project);
      this.setStatus(`${result.message}。資料夾已交到你手上，請自行比對委託的顏色與圖案。`);
      this.maybeAgent();
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
    if (this.decision || this.finished || this.left <= 0) return;
    if (!this.nearby) return;
    if (this.processing) return;
    if (this.nearby.data.id === 'counter') {
      if (!this.box) return;
      if (!this.box.accepted) {
        this.showDecision();
        return;
      }
      if (!this.box.complete) return;
      if (this.box.addOn && !this.box.addOn.accepted) {
        this.showAddOn();
        return;
      }
      this.deliver();
      return;
    }
    if (!this.box?.accepted) return;
    const result = validateProjectStep(this.box, this.nearby.data.id);
    if (!result.ok) return;
    this.startProcessing(this.nearby);
  }

  private startProcessing(view: StationView) {
    const duration = processingMs(view.data, this.model, this.loads.server, this.effects);
    this.processing = true;
    this.activeStation = view;
    this.processStartedAt = this.time.now;
    this.processEndsAt = this.time.now + duration;
    this.loads[view.data.resource] += view.data.cost;
    this.loads.server += 18;
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
    this.setStatus(`${view.data.name} 鎖定資料箱，運算中不可改派`);
    this.tone(420, 0.05);
    this.time.delayedCall(duration, () => {
      if (!this.box || this.finished) return;
      const qualityBonus = this.model.id === 'atlas' && this.time.now < this.skillUntil ? 16 : 0;
      const result = processProject(this.box, view.data.id, view.data.quality + this.effects.stability * 10 + qualityBonus);
      this.processing = false;
      this.activeStation = undefined;
      view.progress.width = 0;
      this.loads[view.data.resource] = Math.max(5, this.loads[view.data.resource] - view.data.cost * 0.7);
      this.loads.server = Math.max(12, this.loads.server - 14);
      this.score += 40;
      this.setStatus(this.box.complete
        ? '所有加工階段完成，請回櫃檯交付。'
        : '本階段完成，請再次對照資料夾上的顏色與圖案。');
      this.tone(this.box.complete ? 880 : 620, 0.09);
      navigator.vibrate?.(this.box.complete ? [20, 25, 20] : 18);
      this.updateHud();
    });
  }

  private updateProcessingBar() {
    if (!this.activeStation || !this.processing) return;
    const total = Math.max(1, this.processEndsAt - this.processStartedAt);
    const ratio = Phaser.Math.Clamp((this.time.now - this.processStartedAt) / total, 0, 1);
    this.activeStation.progress.width = 96 * ratio;
  }

  private showAddOn() {
    if (!this.box?.addOn || this.decision) return;
    const veil = this.add.rectangle(270, 480, 540, 960, 0x020611, 0.68).setInteractive();
    const panel = this.add.rectangle(0, 0, 490, 245, 0x1a1024, 0.99).setStrokeStyle(2, 0xff79c3, 0.85);
    const title = this.add.text(0, -82, '⚠ 客戶追加要求', { fontSize: '19px', fontStyle: 'bold', color: '#ffb6dd' }).setOrigin(0.5);
    const request = this.add.text(0, -35, `「${this.box.addOn.label}」`, { fontSize: '16px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    const accept = this.add.rectangle(-112, 58, 190, 62, 0x17615e, 1).setStrokeStyle(2, 0x6cf4df, 0.8).setInteractive({ useHandCursor: true });
    const reject = this.add.rectangle(112, 58, 190, 62, 0x532035, 1).setStrokeStyle(2, 0xff8fb6, 0.8).setInteractive({ useHandCursor: true });
    const acceptText = this.add.text(-112, 58, '接受追加\n重新處理', { fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    const rejectText = this.add.text(112, 58, '拒絕追加\n直接交付', { fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    accept.on('pointerdown', () => this.answerAddOn(true));
    reject.on('pointerdown', () => this.answerAddOn(false));
    this.decision = this.add.container(270, 480, [veil, panel, title, request, accept, reject, acceptText, rejectText]).setDepth(2000);
  }

  private answerAddOn(accept: boolean) {
    if (!this.box) return;
    const result = answerAddOn(this.box, accept);
    this.satisfaction = Phaser.Math.Clamp(this.satisfaction + result.satisfaction, 0, 100);
    this.decision?.destroy();
    this.decision = undefined;
    this.decisionProjectId = undefined;
    this.setStatus(accept ? '已接受追加，資料箱重新開啟！' : '拒絕追加，客戶不太滿意');
    if (!accept) this.deliver(true);
    this.updateHud();
  }

  private deliver(skipAddOn = false) {
    const box = this.projectQueue.active;
    if (!box) return;
    if (!skipAddOn && offerAddOn(box, this.rng.next())) {
      this.showAddOn();
      return;
    }
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
            this.advanceCustomerQueue();
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
          },
        });
      },
    });
  }

  private maybeAgent() {
    if (!this.box || !agentCanProcess(this.agent, this.box, this.time.now)) return;
    this.agent.busy = true;
    this.agent.load = 15;
    this.loads.ram += 15;
    this.loads.server += 12;
    this.setStatus(`Agent 自動接手 ${this.agent.assignment} 單步任務`);
    this.time.delayedCall(3000 / Math.max(1, this.effects.agentLevel), () => {
      if (!this.box || this.finished) return;
      processProject(this.box, this.agent.assignment as 'text' | 'art' | 'code', 65 + this.effects.agentLevel * 5);
      this.agent.busy = false;
      this.agent.cooldownUntil = this.time.now + 5000;
      this.agent.load = 0;
      this.loads.ram = Math.max(5, this.loads.ram - 10);
      this.loads.server = Math.max(12, this.loads.server - 8);
      this.setStatus('Agent 完成輔助處理，進入冷卻');
      this.updateHud();
    });
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
    if (patience.activeExhausted && !this.impatientBoxIds.has(patience.activeExhausted.id)) {
      this.impatientBoxIds.add(patience.activeExhausted.id);
      this.satisfaction = Math.max(0, this.satisfaction - 8);
      this.complaints.push(`${patience.activeExhausted.customer.name} 等待過久`);
      this.flashStatus('手上客戶的耐心耗盡！請立即完成並交付');
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
    if (this.left === 0 && !(this.processing && this.folderInTransit)) this.endRun();
  }

  private endRun() {
    if (this.finished) return;
    this.finished = true;
    this.decision?.destroy();
    this.decision = undefined;
    this.decisionProjectId = undefined;
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
    if (urgent) {
      this.tweens.killTweensOf(this.timerText);
      this.tweens.add({ targets: this.timerText, scale: 1.12, duration: 220, yoyo: true });
    }
    this.scoreText.setText(`SCORE\n${this.score}`);
    this.satisfactionText.setText(`滿意度\n${Math.round(this.satisfaction)}%`);

    const orders = this.outstandingOrders();
    this.queueText.setText(`排隊 ${this.projectQueue.waiting.length}/${this.runtime.maxQueue}`);
    this.orderCards.forEach((card, cardIndex) => {
      const order = orders[cardIndex];
      if (!order) {
        card.container.setVisible(false);
        return;
      }
      card.container.setVisible(true);
      const isActive = this.projectQueue.active === order;
      card.frame.setStrokeStyle(isActive ? 3 : 2, isActive ? 0x6ff5e5 : cardIndex === 0 ? 0xffd16e : 0x538aa4, isActive ? 0.95 : 0.58);
      card.title.setText(order.recipe.name.length > 9 ? `${order.recipe.name.slice(0, 9)}…` : order.recipe.name);
      card.state.setText(isActive ? `手持 ${order.stage}/${order.recipe.runtimeSteps.length}` : cardIndex === 0 ? '櫃檯待接單' : '排隊等待');
      card.state.setColor(isActive ? '#73f2df' : cardIndex === 0 ? '#ffe18b' : '#9abfd0');
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
    if (this.processing) return '處理中';
    if (!this.nearby) return '靠近設備';
    if (this.nearby.data.id === 'counter') {
      if (!this.box) return '等待';
      if (!this.box.accepted) return '回應';
      if (this.box.complete) return '交付';
      return '未完成';
    }
    if (!this.box?.accepted) return '先接單';
    return '處理';
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
