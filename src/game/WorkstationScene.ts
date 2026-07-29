import Phaser from 'phaser';
import type { Career } from '../core/career';
import { SeededRandom } from '../core/random';
import {
  agentCanProcess,
  answerAddOn,
  createProject,
  decideCustomer,
  offerAddOn,
  processProject,
  processingMs,
  runtimeLevel,
  upgradeEffects,
  type AgentState,
  type CustomerDecision,
  type ProjectBox,
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
const ICONS: Record<string, string> = {
  counter: '◇',
  text: '文',
  search: '搜',
  document: '表',
  art: '畫',
  music: '♪',
  recording: '聲',
  studio: '攝',
  video: '剪',
  code: '</>',
  deploy: '雲',
};
const STATION_COLORS: Record<string, number> = {
  counter: 0xffcf66,
  text: 0x55dcff,
  search: 0x75b7ff,
  document: 0x67d9be,
  art: 0xff73bf,
  music: 0xba8cff,
  recording: 0xff8998,
  studio: 0xffad68,
  video: 0x849fff,
  code: 0x7af59e,
  deploy: 0x5ee8ca,
};

export class WorkstationScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerAvatar!: Phaser.GameObjects.Image;
  private carriedBox!: Phaser.GameObjects.Container;
  private customer!: Phaser.GameObjects.Container;
  private customerAvatar!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private satisfactionText!: Phaser.GameObjects.Text;
  private orderTitle!: Phaser.GameObjects.Text;
  private orderSteps!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private actionLabel!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Container;
  private skillButton!: Phaser.GameObjects.Container;
  private dashButton!: Phaser.GameObjects.Container;
  private joystickKnob!: Phaser.GameObjects.Arc;
  private decision?: Phaser.GameObjects.Container;
  private nearby?: StationView;
  private box?: ProjectBox;
  private processing = false;
  private finished = false;
  private left: number;
  private score = 0;
  private delivered = 0;
  private satisfaction = 65;
  private complaints: string[] = [];
  private impatientBoxId?: string;
  private readonly loads: Record<ResourceKey, number> = {
    cpu: 5,
    gpu: 5,
    ram: 5,
    context: 5,
    server: 12,
  };
  private readonly loadBars = new Map<ResourceKey, Phaser.GameObjects.Rectangle>();
  private readonly stationViews: StationView[] = [];
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
      this.load.image(`customer-${customer.id}-v2`, asset(getCustomerArtPath(customer.id)));
    });
    this.runtime.workstations.forEach((station) => {
      this.load.image(`station-${station.id}-v2`, asset(getStationArtPath(station.id)));
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#050a18');
    this.input.addPointer(3);
    this.makeBackdrop();
    this.makeHud();
    this.makeStations();
    this.makeCustomer();
    this.makePlayer();
    this.makeControls();
    this.bindKeyboard();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.spawnCustomer();
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

    this.add.rectangle(270, 110, 504, 82, 0x0a1528, 0.96).setStrokeStyle(2, 0x5a9db8, 0.38);
    this.orderTitle = this.add.text(36, 80, '等待客戶連線…', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.orderSteps = this.add.text(36, 108, '', {
      fontSize: '12px',
      color: '#9fc7da',
      wordWrap: { width: 455 },
    });

    const barWidth = 76;
    RESOURCE_KEYS.forEach((key, index) => {
      const x = 30 + index * 101;
      this.add.text(x, 154, RESOURCE_LABELS[key], { fontSize: '9px', fontStyle: 'bold', color: '#7395ad' });
      this.add.rectangle(x + 19, 174, barWidth, 6, 0x142740, 1).setOrigin(0, 0.5);
      const fill = this.add.rectangle(x + 19, 174, 8, 6, 0x5be7d0, 1).setOrigin(0, 0.5);
      this.loadBars.set(key, fill);
    });

    this.statusText = this.add
      .text(270, 754, '', {
        fontSize: '13px',
        color: '#d9f6ff',
        align: 'center',
        backgroundColor: '#06111fe8',
        padding: { x: 14, y: 9 },
        wordWrap: { width: 470 },
      })
      .setOrigin(0.5)
      .setDepth(1100);
  }

  private stationPosition(station: WorkstationData, index: number) {
    if (station.id === 'counter') return { x: 270, y: 245 };
    const nonCounter = this.runtime.workstations.filter((item) => item.id !== 'counter');
    const itemIndex = nonCounter.findIndex((item) => item.id === station.id);
    const variant = Number(this.runtime.mapId.split('-').at(-1)) || 1;
    const compact = nonCounter.length > 6;
    const rowGap = compact ? 86 : 132;
    const firstY = compact ? 342 : 382;
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

  private makeStations() {
    this.runtime.workstations.forEach((station, index) => {
      const { x, y } = this.stationPosition(station, index);
      const color = STATION_COLORS[station.id] ?? 0x65d9e8;
      const isCounter = station.id === 'counter';
      const hitWidth = isCounter ? 210 : 144;
      const hitHeight = isCounter ? 88 : 82;
      const frame = this.add
        .rectangle(0, 0, hitWidth, hitHeight, 0x07101e, 0.025)
        .setStrokeStyle(1, color, 0.16);
      const sprite = this.add.image(0, isCounter ? -3 : -5, `station-${station.id}-v2`);
      this.fitImage(sprite, isCounter ? 198 : 136, isCounter ? 88 : 78);
      const tapCue = this.add
        .text(0, isCounter ? -48 : -45, '點擊前往', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#eaffff',
          backgroundColor: '#07111ed9',
          padding: { x: 7, y: 3 },
        })
        .setOrigin(0.5);
      const label = this.add
        .text(0, isCounter ? 46 : 43, station.name, {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#effbff',
          backgroundColor: '#06111feb',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5);
      const progressBack = this.add.rectangle(-48, isCounter ? 35 : 33, 96, 5, 0x07101e, 0.9).setOrigin(0, 0.5);
      const progress = this.add.rectangle(-48, isCounter ? 35 : 33, 0, 5, color, 1).setOrigin(0, 0.5);
      const container = this.add
        .container(x, y, [frame, sprite, tapCue, label, progressBack, progress])
        .setSize(hitWidth, hitHeight)
        .setDepth(y)
        .setInteractive({ useHandCursor: true });
      const access = isCounter
        ? new Phaser.Math.Vector2(x, y + 74)
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
    });
  }

  private makeCustomer() {
    const firstCustomer = this.runtime.customers[0];
    this.customerAvatar = this.add.image(0, 0, `customer-${firstCustomer.id}-v2`);
    this.fitImage(this.customerAvatar, 92, 118);
    this.customer = this.add.container(270, 222, [this.customerAvatar]).setDepth(244);
    this.customer.setVisible(false);
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

    this.carriedBox = this.add.container(0, 10, [
      this.add.rectangle(0, 0, 30, 24, 0x102b48, 0.96).setStrokeStyle(2, 0x8ef5ff, 0.9),
      this.add.polygon(0, 0, [0, -7, 7, 0, 0, 7, -7, 0], 0x78efff, 0.85),
    ]);
    this.carriedBox.setVisible(false);

    this.player = this.add.container(270, 650, [shadow, this.playerAvatar, cue, this.carriedBox]);
    this.player.setDepth(650);
    this.tweens.add({ targets: this.playerAvatar, y: -32, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const scale = Math.min(maxWidth / Math.max(1, image.width), maxHeight / Math.max(1, image.height));
    image.setScale(scale);
    return image;
  }

  private makeControls() {
    this.add.rectangle(270, 857, 540, 206, 0x050b16, 0.98).setStrokeStyle(1, 0x37657a, 0.55).setDepth(980);

    const joystickBase = this.add.circle(88, 865, 60, 0x0e2037, 0.95).setStrokeStyle(2, 0x5aa4be, 0.55).setDepth(1000);
    this.add.circle(88, 865, 36, 0x102c47, 0.8).setStrokeStyle(1, 0x73dff1, 0.35).setDepth(1001);
    this.joystickKnob = this.add.circle(88, 865, 24, 0x6be9eb, 0.86).setStrokeStyle(3, 0xdfffff, 0.7).setDepth(1002);
    this.add.text(88, 935, 'MOVE', { fontSize: '9px', fontStyle: 'bold', color: '#6089a0' }).setOrigin(0.5).setDepth(1002);
    joystickBase.setInteractive(new Phaser.Geom.Circle(60, 60, 60), Phaser.Geom.Circle.Contains);
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

    this.dashButton = this.makeRoundButton(332, 884, 38, '➤', '衝刺', 0x274a66, () => this.dash());
    this.skillButton = this.makeRoundButton(386, 798, 39, this.model.glyph, this.model.skillName, this.model.color, () => this.activateSkill());
    this.actionButton = this.makeRoundButton(456, 870, 61, 'E', '互動', 0x0f8ea3, () => this.interact());
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
    const labelText = this.add.text(0, radius * 0.42, label, { fontSize: '10px', fontStyle: 'bold', color: '#e7fbff' }).setOrigin(0.5);
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
    const dx = pointer.worldX - 88;
    const dy = pointer.worldY - 865;
    const distance = Math.min(42, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    this.joystickKnob.setPosition(88 + x, 865 + y);
    this.joystickVector.set(x / 42, y / 42);
  }

  private resetJoystick() {
    this.joystickPointerId = undefined;
    this.joystickVector.set(0, 0);
    this.joystickKnob.setPosition(88, 865);
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
    const nextY = Phaser.Math.Clamp(this.player.y + y, 292, 724);
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

  private spawnCustomer() {
    if (this.box || this.left < 10 || this.finished) return;
    const recipe = this.rng.pick(this.runtime.recipes);
    const customer = this.rng.pick(this.runtime.customers);
    this.box = createProject(`box-${this.delivered}-${this.time.now}`, recipe, customer);
    this.impatientBoxId = undefined;
    this.customerAvatar.setTexture(`customer-${customer.id}-v2`);
    this.fitImage(this.customerAvatar, 92, 118);
    this.customer.setVisible(true).setAlpha(0).setY(205);
    this.tweens.add({ targets: this.customer, y: 217, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.setStatus(`${customer.name} 帶來「${recipe.name}」！到櫃台快速判斷需求。`);
    this.updateHud();
  }

  private showDecision() {
    if (!this.box || this.box.accepted || this.decision) return;
    const choices: Array<[string, CustomerDecision, string]> = [
      ['接受', 'accept', '直接開工'],
      ['追問', 'question', '補齊需求'],
      ['限制作法', 'limits', '先說清楚'],
      ['替代方案', 'alternative', '換條路'],
      ['拒絕', 'reject', '保住算力'],
    ];
    const veil = this.add.rectangle(270, 480, 540, 960, 0x020611, 0.68).setInteractive();
    const panel = this.add.rectangle(0, 0, 500, 330, 0x071323, 0.99).setStrokeStyle(2, 0x70e3ed, 0.85);
    const title = this.add.text(0, -126, this.box.recipe.name, { fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const subtitle = this.add.text(0, -94, `${this.box.customer.name}\n耐心 ${Math.round(this.box.patience)} · 請選擇回應`, { fontSize: '12px', color: '#9ec8d8', align: 'center' }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [veil, panel, title, subtitle];
    choices.forEach(([label, value, detail], index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = index === 4 ? 0 : -120 + column * 240;
      const y = -35 + row * 78;
      const button = this.add.rectangle(x, y, index === 4 ? 220 : 205, 58, 0x173653, 1).setStrokeStyle(2, 0x5ca9c4, 0.55).setInteractive({ useHandCursor: true });
      const buttonText = this.add.text(x, y - 8, label, { fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const detailText = this.add.text(x, y + 13, detail, { fontSize: '10px', color: '#8fb7c9' }).setOrigin(0.5);
      button.on('pointerdown', () => this.choose(value));
      children.push(button, buttonText, detailText);
    });
    this.decision = this.add.container(270, 480, children).setDepth(2000);
  }

  private choose(decision: CustomerDecision) {
    if (!this.box) return;
    const result = decideCustomer(this.box, decision);
    this.satisfaction = Phaser.Math.Clamp(this.satisfaction + result.satisfaction, 0, 100);
    this.decision?.destroy();
    this.decision = undefined;
    this.tone(result.accepted ? 640 : 220, 0.08);
    if (!result.accepted) {
      this.customer.setVisible(false);
      this.box = undefined;
      this.setStatus(`${result.message}，滿意度 ${result.satisfaction >= 0 ? '+' : ''}${result.satisfaction}`);
      this.time.delayedCall(650, () => this.spawnCustomer());
    } else {
      this.loads.context += 15;
      this.setStatus(`${result.message}。資料箱已具現，前往第一個工作區！`);
      this.maybeAgent();
    }
    this.updateHud();
  }

  private interact() {
    if (this.decision || this.finished || this.left <= 0) return;
    if (!this.nearby) {
      this.flashStatus('靠近發光設備後再互動');
      return;
    }
    if (this.processing) {
      this.flashStatus('設備正在運算，先規劃下一步動線');
      return;
    }
    if (this.nearby.data.id === 'counter') {
      if (!this.box) {
        this.flashStatus('目前沒有等待客戶');
        return;
      }
      if (!this.box.accepted) {
        this.showDecision();
        return;
      }
      if (!this.box.complete) {
        this.flashStatus(`還缺 ${this.box.recipe.runtimeSteps.length - this.box.stage} 個處理階段`);
        return;
      }
      if (this.box.addOn && !this.box.addOn.accepted) {
        this.showAddOn();
        return;
      }
      this.deliver();
      return;
    }
    if (!this.box?.accepted) {
      this.flashStatus('先到需求櫃台接單');
      return;
    }
    const result = processProject(this.box, this.nearby.data.id, this.nearby.data.quality);
    if (!result.ok) {
      this.tone(180, 0.1);
      navigator.vibrate?.(35);
      this.flashStatus(result.reason);
      return;
    }
    this.box.stage -= 1;
    this.box.outputs.pop();
    this.box.complete = false;
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
      this.setStatus(result.reason);
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
    this.setStatus(accept ? '已接受追加，資料箱重新開啟！' : '拒絕追加，客戶不太滿意');
    if (!accept) this.deliver(true);
    this.updateHud();
  }

  private deliver(skipAddOn = false) {
    if (!this.box) return;
    if (!skipAddOn && offerAddOn(this.box, this.rng.next())) {
      this.showAddOn();
      return;
    }
    const average = this.box.quality / Math.max(1, this.box.outputs.length);
    this.score += this.box.recipe.reward + Math.round(average);
    this.satisfaction = Math.min(100, this.satisfaction + 5);
    this.delivered += 1;
    this.box = undefined;
    this.customer.setVisible(false);
    this.loads.context = Math.max(5, this.loads.context - 15);
    this.setStatus('完整交付！資料與成果都安全送達。');
    this.tone(1040, 0.14);
    navigator.vibrate?.([25, 30, 35]);
    this.cameras.main.flash(160, 70, 235, 214, false);
    this.time.delayedCall(650, () => this.spawnCustomer());
    this.updateHud();
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
    if (this.box) {
      this.box.patience = Math.max(0, this.box.patience - 1);
      if (this.box.patience === 0 && this.impatientBoxId !== this.box.id) {
        this.impatientBoxId = this.box.id;
        this.satisfaction = Math.max(0, this.satisfaction - 8);
        this.complaints.push(`${this.box.customer.name} 等待過久`);
        this.flashStatus('客戶耐心耗盡！滿意度下降');
      }
    }
    RESOURCE_KEYS.forEach((key) => {
      this.loads[key] = Math.max(key === 'server' ? 12 : 5, this.loads[key] - 0.7);
    });
    this.updateHud();
    if (this.left === 30) {
      this.setStatus('最後 30 秒！完成手上的訂單！');
      navigator.vibrate?.([40, 60, 40]);
    }
    if (this.left === 0) this.endRun();
  }

  private endRun() {
    if (this.finished) return;
    this.finished = true;
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

    if (this.box) {
      const patience = Math.round(this.box.patience);
      this.orderTitle.setText(`${this.box.accepted ? '▣' : '◆'} ${this.box.recipe.name}　耐心 ${patience}`);
      const steps = this.box.recipe.runtimeSteps
        .map((step, index) => `${index < this.box!.stage ? '✓' : index === this.box!.stage ? '▶' : '○'} ${ICONS[step.stationId]} ${step.label.split('：')[0]}`)
        .join('  ');
      this.orderSteps.setText(this.box.accepted ? steps : '前往需求櫃台，選擇接受、追問、限制、替代方案或拒絕。');
    } else {
      this.orderTitle.setText('等待下一位客戶連線…');
      this.orderSteps.setText(`已交付 ${this.delivered} 份 · Agent ${this.agent.busy ? '處理中' : this.agent.assignment ?? '休息'}`);
    }

    RESOURCE_KEYS.forEach((key) => {
      const ratio = Phaser.Math.Clamp(this.loads[key] / this.effects.capacity[key], 0, 1.2);
      const bar = this.loadBars.get(key)!;
      bar.width = 76 * Math.min(1, ratio);
      bar.fillColor = ratio >= 0.9 ? 0xff765f : ratio >= 0.7 ? 0xffc85d : 0x5be7d0;
    });
    this.carriedBox.setVisible(Boolean(this.box?.accepted));
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
