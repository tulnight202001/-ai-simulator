import Phaser from 'phaser';
import './style.css';
import { buyUpgrade, createCareer, ensureAgentAvailability, recordLevel, type Career } from './core/career';
import { drawModelChoices } from './core/modelDraw';
import { isLevelUnlocked } from './core/v1Runtime';
import { models, type ModelDefinition } from './data/content';
import { v1Levels, v1Upgrades, type LevelData } from './data/v1Catalog';
import { WorkstationScene, type RunResult } from './game/WorkstationScene';
import { deleteCareer, exportCareer, loadCareers, previewImport, saveCareer } from './services/save';

const app = document.querySelector<HTMLDivElement>('#app')!;
const dailySeed = Math.floor(Date.now() / 86_400_000);
let game: Phaser.Game | undefined;
let chosen: ModelDefinition | undefined;
let activeCareer: Career | undefined;
let selectedLevel: LevelData | undefined;
type RunMode = 'career' | 'trial';
let runMode: RunMode = 'career';

const eraNames = ['', '初生模型期', '多工具模型期', '複合專案期', 'Agent 協作期', '高負載平台期'];
const trialPressure = ['', '熟悉流程', '多工加速', '複合製作', '協作調度', '高峰壓力'];

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!);

function shell(content: string, className = '') {
  app.innerHTML = `<main class="shell ${className}">${content}</main>`;
  window.scrollTo({ top: 0, left: 0 });
}

function hologramMark(model?: ModelDefinition) {
  const color = model ? `#${model.color.toString(16).padStart(6, '0')}` : '#5fe8df';
  const glyph = model?.glyph ?? '◇';
  return `
    <div class="holo-mark" style="--model-color:${color}">
      <span class="holo-scan"></span>
      <span class="holo-head"><i>${glyph}</i><b>•‿•</b></span>
      <span class="holo-body"></span>
      <span class="holo-core">◆</span>
      <span class="holo-ring"></span>
    </div>`;
}

function getModelArtPath(modelId: string) {
  return new URL(`art/generated/v2/ai-${modelId}-v2.png`, document.baseURI).toString();
}

function modelArtwork(model: ModelDefinition, context: 'save' | 'picker' | 'hub') {
  const color = `#${model.color.toString(16).padStart(6, '0')}`;
  return `
    <span class="model-art model-art--${context}" style="--model-color:${color}">
      <img src="${getModelArtPath(model.id)}" alt="${escapeHtml(model.name)}角色圖" draggable="false">
      <i aria-hidden="true"></i>
    </span>`;
}

async function menu() {
  const careers = await loadCareers().catch(() => []);
  shell(`
    <section class="hero">
      <div class="hero-stage">${hologramMark()}</div>
      <p class="eyebrow">AI WORKSTATION / MOBILE BUILD</p>
      <h1>關於我重生為<br><strong>AI 模型的⋯</strong></h1>
      <p class="subtitle">最棒的工作，就是不工作</p>
      <button class="primary" id="start">開始新生涯 <span>→</span></button>
      <button class="secondary" id="import">匯入 JSON 備份</button>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
      ${careers.length ? '<div class="save-heading"><span>本機模型存檔</span><b>LOCAL</b></div>' : ''}
      <div class="save-list">
        ${careers.map((career) => {
          const careerModel = models.find((model) => model.id === career.modelId);
          return `
            <article class="career-row">
              <button class="career" data-id="${career.id}">
                ${careerModel ? modelArtwork(careerModel, 'save') : '<span class="save-core">◆</span>'}
                <span><b>${escapeHtml(career.name)}</b><small>紀元 ${career.era} · ★ ${Object.values(career.levels).reduce((total, level) => total + level.stars, 0)}</small></span>
                <i>繼續</i>
              </button>
              <button class="delete" data-id="${career.id}" aria-label="刪除 ${escapeHtml(career.name)}">×</button>
            </article>`;
        }).join('')}
      </div>
      <p id="import-status" class="form-status" role="status"></p>
      <footer>VERTICAL SLICE v0.4 · 本機存檔 · 可離線遊玩</footer>
    </section>
  `, 'home-shell');

  document.querySelector('#start')!.addEventListener('click', pickModel);
  document.querySelectorAll<HTMLElement>('.career').forEach((element) => {
    element.onclick = () => {
      activeCareer = careers.find((career) => career.id === element.dataset.id);
      chosen = models.find((model) => model.id === activeCareer?.modelId);
      if (chosen) careerHub();
    };
  });
  document.querySelectorAll<HTMLElement>('.delete').forEach((element) => {
    element.onclick = async () => {
      const career = careers.find((item) => item.id === element.dataset.id);
      if (career && confirm(`刪除「${career.name}」？此動作無法復原。`)) {
        await deleteCareer(career.id);
        await menu();
      }
    };
  });

  const input = document.querySelector<HTMLInputElement>('#import-file')!;
  const status = document.querySelector<HTMLElement>('#import-status')!;
  document.querySelector('#import')!.addEventListener('click', () => input.click());
  input.onchange = async () => {
    try {
      const file = input.files?.[0];
      if (!file) return;
      const preview = previewImport(await file.text());
      const modelName = models.find((model) => model.id === preview.modelId)?.name ?? preview.modelId;
      if (!confirm(`匯入「${preview.name}」？\n模型：${modelName}\n更新：${new Date(preview.updatedAt).toLocaleString()}\n\n相同存檔將被覆蓋。`)) return;
      await saveCareer(preview.career);
      status.textContent = '備份已匯入。';
      await menu();
    } catch (error) {
      status.textContent = `匯入失敗：${error instanceof Error ? error.message : '檔案無法讀取'}`;
    }
  };
}

function pickModel() {
  const picks = drawModelChoices(dailySeed);
  shell(`
    <section class="selection">
      <header class="section-header">
        <button class="icon-back" id="back" aria-label="返回">←</button>
        <div><p class="eyebrow">BOOT SEQUENCE / 01</p><h2>選擇重生模型</h2></div>
      </header>
      <p class="section-intro">本次核心只會回應三個模型。每個模型都有專長、技能和代價。</p>
      <div class="cards">
        ${picks.map((model) => `
          <button class="model" data-id="${model.id}" style="--model-color:#${model.color.toString(16).padStart(6, '0')}">
            <span class="rarity">${model.rarity === 'rare' ? '稀有訊號' : '標準訊號'}</span>
            ${modelArtwork(model, 'picker')}
            <span class="role">${model.role}</span>
            <h3>${model.name}</h3>
            <q>${model.tagline}</q>
            <span class="chips">${model.strengths.map((strength) => `<i>${strength}</i>`).join('')}</span>
            <small><b>技能 ${model.skillName}</b>${model.skillDescription}</small>
            <small class="weakness">代價：${model.weakness}</small>
            <span class="choose">選擇這個核心 <b>→</b></span>
          </button>`).join('')}
      </div>
    </section>
  `, 'selection-shell');

  document.querySelectorAll<HTMLElement>('.model').forEach((element) => {
    element.onclick = async () => {
      chosen = models.find((model) => model.id === element.dataset.id)!;
      activeCareer = createCareer(chosen.id, Date.now() >>> 0, `${chosen.name} 生涯`);
      await saveCareer(activeCareer);
      careerHub();
    };
  });
  document.querySelector('#back')!.addEventListener('click', menu);
}

function careerHub() {
  if (!activeCareer || !chosen) return void menu();
  runMode = 'career';
  if (ensureAgentAvailability(activeCareer)) void saveCareer(activeCareer);
  const upgrades = v1Upgrades.filter((upgrade) => upgrade.era <= activeCareer!.era);
  const totalStars = Object.values(activeCareer.levels).reduce((total, level) => total + level.stars, 0);
  shell(`
    <section class="career-hub">
      <header class="hub-header">
        ${modelArtwork(chosen, 'hub')}
        <div><p class="eyebrow">CAREER SLOT / ERA ${activeCareer.era}</p><h2>${escapeHtml(activeCareer.name)}</h2><span>${chosen.role}</span></div>
      </header>
      <div class="career-stats">
        <span><small>星級</small><b>★ ${totalStars}</b></span>
        <span><small>訂閱</small><b>${activeCareer.subscribers}</b></span>
        <span><small>評價</small><b>${activeCareer.rating.toFixed(1)}</b></span>
        <span><small>算力點</small><b>◈ ${activeCareer.resources}</b></span>
      </div>
      <button class="primary pulse" id="levels">進入正式生涯 <span>→</span></button>
      <button class="trial-entry" id="trial-levels">
        <span><b>五紀元首關試玩</b><small>直接比較後期節奏，不解鎖、不寫入存檔</small></span>
        <strong>試玩 →</strong>
      </button>
      <div class="panel-title"><span>核心與工作區升級</span><b>ERA ${activeCareer.era}</b></div>
      <div class="upgrade-grid">
        ${upgrades.map((upgrade) => {
          const level = activeCareer!.upgrades[upgrade.id] ?? 0;
          const cost = upgrade.cost * (level + 1);
          const maxed = level >= upgrade.maxLevel;
          return `
            <button class="upgrade" data-id="${upgrade.id}" ${maxed || activeCareer!.resources < cost ? 'disabled' : ''}>
              <span>${upgrade.name}<b>Lv.${level}/${upgrade.maxLevel}</b></span>
              <small>${upgrade.effect}${upgrade.tradeoff ? ` · ${upgrade.tradeoff}` : ''}</small>
              <strong>${maxed ? '已滿級' : `◈ ${cost}`}</strong>
            </button>`;
        }).join('')}
      </div>
      ${activeCareer.agent.unlocked ? `
        <div class="agent-setting">
          <span><b>跟隨 Agent Lv.${activeCareer.agent.level}</b><small>關卡中點 Agent 徽章交接資料夾，再帶它到任意機台下指令。</small></span>
          <strong>${activeCareer.era >= 5 && activeCareer.agent.level >= 2 ? '1 名助手／最多 3 台並行' : '1 名助手／最多 2 台並行'}</strong>
        </div>` : ''}
      <p id="shop-status" class="form-status" role="status"></p>
      <div class="button-row">
        <button class="secondary" id="backup">下載 JSON</button>
        <button class="secondary" id="home">切換存檔</button>
      </div>
    </section>
  `, 'hub-shell');

  document.querySelector('#levels')!.addEventListener('click', levelSelect);
  document.querySelector('#trial-levels')!.addEventListener('click', levelSelect);
  document.querySelector('#home')!.addEventListener('click', menu);
  document.querySelectorAll<HTMLElement>('.upgrade').forEach((element) => {
    element.onclick = async () => {
      if (buyUpgrade(activeCareer!, element.dataset.id!)) {
        await saveCareer(activeCareer!);
        careerHub();
      }
    };
  });

  document.querySelector('#backup')!.addEventListener('click', () => {
    const blob = new Blob([exportCareer(activeCareer!)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${activeCareer!.id}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });
}

function levelSelect() {
  if (!activeCareer) return void menu();
  const firstEraLevels = [1, 2, 3, 4, 5]
    .map((era) => v1Levels.find((level) => level.era === era && level.index === 1))
    .filter((level): level is LevelData => Boolean(level));
  shell(`
    <section class="level-select">
      <header class="section-header sticky">
        <button class="icon-back" id="hub">←</button>
        <div><p class="eyebrow">47 LEVEL CAREER</p><h2>選擇工作班次</h2></div>
      </header>
      <section class="trial-panel" aria-labelledby="trial-title">
        <div class="trial-heading">
          <div><p class="eyebrow">ERA PRESSURE TEST / NO SAVE</p><h3 id="trial-title">五紀元首關試玩</h3></div>
          <span>不影響正式進度</span>
        </div>
        <p>直接啟動每個紀元的第一關，快速比較客流、工序與時間壓力。試玩分數只顯示於結算畫面。</p>
        <div class="trial-grid">
          ${firstEraLevels.map((level) => `
            <button class="trial-level" data-id="${level.id}">
              <span>ERA ${level.era}</span>
              <b>${eraNames[level.era]}</b>
              <small>${trialPressure[level.era]} · ${Math.floor(level.duration / 60)}:${String(level.duration % 60).padStart(2, '0')}</small>
            </button>`).join('')}
        </div>
      </section>
      <div class="career-divider"><span>正式生涯關卡</span><small>依星級逐步解鎖並自動存檔</small></div>
      ${[1, 2, 3, 4, 5].map((era) => `
        <section class="era ${era > activeCareer!.era ? 'locked' : ''}">
          <header><span>ERA ${era}</span><h3>${eraNames[era]}</h3></header>
          <div class="level-grid">
            ${v1Levels.filter((level) => level.era === era).map((level) => {
              const unlocked = isLevelUnlocked(activeCareer!, level);
              const progress = activeCareer!.levels[level.id];
              return `
                <button class="level" data-id="${level.id}" ${unlocked ? '' : 'disabled'}>
                  <b>${level.index}</b>
                  <span>${level.name.replace(`${eraNames[era]} `, '')}</span>
                  <small>${progress?.stars ? '★'.repeat(progress.stars) : unlocked ? '開始' : '鎖定'}</small>
                </button>`;
            }).join('')}
          </div>
        </section>`).join('')}
    </section>
  `, 'levels-shell');

  document.querySelectorAll<HTMLElement>('.level:not(:disabled)').forEach((element) => {
    element.onclick = () => {
      runMode = 'career';
      selectedLevel = v1Levels.find((level) => level.id === element.dataset.id);
      startGame();
    };
  });
  document.querySelectorAll<HTMLElement>('.trial-level').forEach((element) => {
    element.onclick = () => {
      runMode = 'trial';
      selectedLevel = firstEraLevels.find((level) => level.id === element.dataset.id);
      startGame();
    };
  });
  document.querySelector('#hub')!.addEventListener('click', careerHub);
}

function startGame() {
  if (!selectedLevel || !activeCareer || !chosen) return void levelSelect();
  app.innerHTML = `
    <main class="game-shell">
      <div id="game" aria-label="即時工作站遊戲區"></div>
      <button id="pause-game" class="pause-game" aria-label="暫停">Ⅱ</button>
      <div id="pause-card" class="pause-card" hidden><b>工作暫停</b><span>點右上角繼續</span><button id="leave-game">離開班次</button></div>
    </main>`;

  window.scrollTo({ top: 0, left: 0 });
  const sceneCareer = runMode === 'trial' ? structuredClone(activeCareer) : activeCareer;
  if (runMode === 'trial' && selectedLevel.era >= 4) {
    sceneCareer.agent.unlocked = true;
    sceneCareer.agent.level = Math.max(sceneCareer.agent.level, selectedLevel.era === 4 ? 1 : 2);
    sceneCareer.agent.assignment = null;
  }
  const sceneSeed = activeCareer.seed + selectedLevel.index + (runMode === 'trial' ? selectedLevel.era * 1_000 : 0);
  const scene = new WorkstationScene(chosen, sceneCareer, selectedLevel.id, sceneSeed, finish);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#050a18',
    scene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 4 },
  });

  const pauseButton = document.querySelector<HTMLButtonElement>('#pause-game')!;
  const pauseCard = document.querySelector<HTMLElement>('#pause-card')!;
  let paused = false;
  pauseButton.onclick = () => {
    paused = !paused;
    if (paused) game?.scene.pause('workstation');
    else game?.scene.resume('workstation');
    pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    pauseCard.hidden = !paused;
  };
  document.querySelector('#leave-game')!.addEventListener('click', () => {
    game?.destroy(true);
    game = undefined;
    levelSelect();
  });
}

async function finish(result: RunResult) {
  game?.destroy(true);
  game = undefined;
  if (!activeCareer || !chosen || !selectedLevel) return void menu();
  const isTrial = runMode === 'trial';
  if (!isTrial) {
    recordLevel(activeCareer, selectedLevel.id, result.score, result.stars, result.satisfaction, result.complaints[0]);
    await saveCareer(activeCareer);
  }
  const failureReason = result.complaints[0] ?? (result.delivered === 0 ? '沒有完成任何完整訂單；先確認資料箱下一步圖示。' : '分數尚未達一星門檻；縮短空跑動線並優先完成手上訂單。');
  shell(`
    <section class="result ${result.stars ? 'success' : 'needs-retry'} ${isTrial ? 'trial-result' : ''}">
      <div class="result-core">${result.stars ? '✓' : '↻'}</div>
      <p class="eyebrow">${isTrial ? `ERA ${selectedLevel.era} TRIAL / NO SAVE` : result.stars ? 'SHIFT COMPLETE' : 'SHIFT REVIEW'}</p>
      <h2>${selectedLevel.name}</h2>
      ${isTrial ? '<div class="trial-result-note"><b>試玩結算</b><span>本次結果不會解鎖關卡，也不會寫入生涯存檔。</span></div>' : ''}
      <div class="stars">${[1, 2, 3].map((number) => `<span class="${number <= result.stars ? 'on' : ''}">★</span>`).join('')}</div>
      <p class="big">${result.score}</p>
      <div class="result-grid">
        <span><small>完整交付</small><b>${result.delivered}</b></span>
        <span><small>滿意度</small><b>${result.satisfaction}%</b></span>
        <span><small>客訴</small><b>${result.complaints.length}</b></span>
      </div>
      <div class="quote">${result.stars ? '「伺服器終於可以休息。你也是。」' : escapeHtml(failureReason)}</div>
      <button class="primary" id="again">立即再試一次</button>
      <button class="secondary" id="choose">${isTrial ? '試玩其他紀元' : '選擇其他班次'}</button>
      <button class="text-button" id="hub">返回生涯中心</button>
    </section>
  `, 'result-shell');
  document.querySelector('#again')!.addEventListener('click', startGame);
  document.querySelector('#choose')!.addEventListener('click', levelSelect);
  document.querySelector('#hub')!.addEventListener('click', () => {
    runMode = 'career';
    careerHub();
  });
}

void menu();
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // 開發伺服器不得被先前的 PWA 快取蓋住，否則手機會看到已淘汰的介面。
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const wasControlled = Boolean(navigator.serviceWorker.controller);
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if (wasControlled) window.location.reload();
    });
  } else {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register(new URL('./sw.js', window.location.href));
    });
  }
}
