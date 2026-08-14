// ==========================================
// 摸鱼小镇 game.js —— 升级版
// 本次升级：
//   1. 日历面板固定到画面右下角常驻，当天打卡日期旁显示动物 emoji
//   2. 新增 10 种互动（书摊/扭蛋/喂鸽/老爷爷/套圈/涂鸦/许愿瓶/占卜/骰子/撸猫）
//   3. 补全原 worldObjects 中无交互的设施（音乐盒/电话/售货机/吉他手/鸟巢/公交站/长椅）
//   4. 真·钓鱼玩法（水域 + 钓鱼点 + 抛竿/上钩/收线 + 加权随机鱼种）
// ==========================================

// 清理旧数据（按需保留）
try {
    localStorage.removeItem('pixel_moyu_save'); // 旧 key 已废弃，清掉避免干扰
} catch (e) {}

// Canvas 与上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.tabIndex = 0; // 使 canvas 可获得焦点

// 基本常量
const TILE_SIZE = 32;
const MAP_GRID = 50;
const VIEW_WIDTH = canvas.width;
const VIEW_HEIGHT = canvas.height;
const MAP_REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2 小时

// 游戏状态与实体
let isPaused = false;
let isBossMode = false;
let activeDialog = null;

// 钓鱼状态（任务 4 + 收线时机小游戏）
const fishing = { active: false, phase: 'idle', timeoutId: null, barPos: 0, barDir: 1 };

// ---- 音效系统（WebAudio 合成，无需外部文件）----
const Sound = (() => {
    let ctx = null;
    function ensure() {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    function tone(freq, dur, type, vol) {
        const c = ensure(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square'; o.frequency.value = freq;
        g.gain.value = vol || 0.05;
        o.connect(g); g.connect(c.destination);
        const t = c.currentTime;
        o.start(t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.stop(t + dur);
    }
    return {
        step:   () => tone(200, 0.04, 'square', 0.02),
        pickup: () => { tone(660, 0.08, 'triangle', 0.05); setTimeout(() => tone(880, 0.08, 'triangle', 0.05), 60); },
        dialog: () => tone(520, 0.07, 'sine', 0.04),
        coin:   () => tone(990, 0.1, 'square', 0.05),
        bite:   () => { tone(880, 0.1, 'square', 0.05); setTimeout(() => tone(1175, 0.12, 'square', 0.05), 100); },
        catch:  () => { tone(523, 0.1, 'sine', 0.05); setTimeout(() => tone(784, 0.12, 'sine', 0.05), 90); setTimeout(() => tone(1047, 0.14, 'sine', 0.05), 180); },
        miss:   () => tone(160, 0.2, 'sawtooth', 0.05)
    };
})();

const player = {
    gridX: 10,
    gridY: 10,
    pixelX: 10 * TILE_SIZE,
    pixelY: 10 * TILE_SIZE,
    targetPixelX: 10 * TILE_SIZE,
    targetPixelY: 10 * TILE_SIZE,
    isMoving: false,
    moveSpeed: 4,
    direction: 'down',
    isSitting: false,
    sitTimer: 0,
    inventory: []
};

let particles = [];
const keysPressed = {};

let wanderingNpc = {
    gridX: 12,
    gridY: 12,
    pixelX: 12 * TILE_SIZE,
    pixelY: 12 * TILE_SIZE,
    targetPixelX: 12 * TILE_SIZE,
    targetPixelY: 12 * TILE_SIZE,
    direction: 'down',
    isMoving: false,
    moveTimer: 0,
    name: "散步的小葵",
    dialogs: [
        "🌸 嗨！今天阳光真好，要和我一起去喷泉边散步吗？",
        "🤫 我听说地图最右上角藏着神奇的许愿池哦！",
        "☕ 累了的话，可以去路边的椅子上坐一会儿，能恢复心情！",
        "🐱 你看到那只流浪小猫了吗？喂它小鱼干它就会一直跟着你！",
        "🎣 湖边新开了个钓鱼点，听说能钓到迷你鲨鱼呢~",
        "📚 街角书摊老板人超好，借书不收钱只要一枚硬币！"
    ]
};

// 水域（不可进入），钓鱼点在其岸边
const ponds = [
    { x: 39, y: 39, w: 5, h: 5 } // 右下角湖泊
];

// 世界设施默认值（含原设施 + 本次新增）。单独抽出，便于新存档兼容旧存档
const DEFAULT_WORLD = {
    bench:        { gridX: 9,  gridY: 12, isCleaned: false },
    tv:           { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
    musicBox:     { gridX: 12, gridY: 5,  isOn: false },
    chair:        { gridX: 14, gridY: 8 },
    cat:          { gridX: 17, gridY: 14, isFollowing: false, history: [] },
    fountain:     { gridX: 30, gridY: 30 },
    guitarist:    { gridX: 5,  gridY: 25, isTipped: false },
    vendingMachine: { gridX: 15, gridY: 12, lastItem: null },
    clawMachine:  { gridX: 25, gridY: 10 },
    mailbox:      { gridX: 35, gridY: 15, hasLetter: true },
    telephone:    { gridX: 22, gridY: 20, callCount: 0 },
    coffeeCart:   { gridX: 18, gridY: 12, boughtToday: false },
    wishingTree:  { gridX: 8,  gridY: 22, waterCount: 0 },
    bakery:       { gridX: 28, gridY: 18 },
    busStop:      { gridX: 5,  gridY: 8 },
    birdNest:     { gridX: 22, gridY: 32, isFed: false },
    // ---- 本次新增设施 ----
    bookstall:    { gridX: 13, gridY: 18 },
    gacha:        { gridX: 26, gridY: 14 },
    pigeon:       { gridX: 10, gridY: 28, fed: 0 },
    sage:         { gridX: 32, gridY: 12 },
    ringToss:     { gridX: 19, gridY: 22 },
    graffiti:     { gridX: 7,  gridY: 16, painted: false },
    messageBottle:{ gridX: 33, gridY: 33 },
    crystalBall:  { gridX: 11, gridY: 30 },
    diceGame:     { gridX: 21, gridY: 8 },
    fishingSpot:  { gridX: 38, gridY: 41 }
};

let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    checkInDays: [],
    worldObjects: Object.assign({}, DEFAULT_WORLD)
};

const puddles = [
    { gridX: 11, gridY: 10 }, { gridX: 14, gridY: 15 }, { gridX: 22, gridY: 25 }, { gridX: 6, gridY: 24 }
];

// =======================
// 辅助与存档
// =======================
function saveGame() {
    const saveData = {
        gameState: {
            lastRefreshTime: gameState.lastRefreshTime,
            gameMap: gameState.gameMap,
            mapItems: gameState.mapItems,
            checkInDays: gameState.checkInDays,
            worldObjects: gameState.worldObjects
        },
        player: {
            gridX: player.gridX,
            gridY: player.gridY,
            inventory: player.inventory,
            direction: player.direction
        }
    };
    try {
        localStorage.setItem('pixel_moyu_save_v2', JSON.stringify(saveData));
    } catch (e) {
        console.warn('保存失败', e);
    }
}

function loadOrCreateGame() {
    initNewUniverse();
    try {
        const saved = localStorage.getItem('pixel_moyu_save_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.gameState) {
                const ps = parsed.gameState;
                gameState.lastRefreshTime = ps.lastRefreshTime || Date.now();
                gameState.gameMap = ps.gameMap || [];
                gameState.mapItems = ps.mapItems || [];
                gameState.checkInDays = ps.checkInDays || [];
                // 关键：用默认值打底，再让存档覆盖，保证新增设施键始终存在
                gameState.worldObjects = Object.assign({}, DEFAULT_WORLD, ps.worldObjects || {});
            }
            if (parsed.player && parsed.player.inventory) {
                player.inventory = parsed.player.inventory;
            }
        }
    } catch (e) {
        console.warn('读取存档失败，已初始化新世界', e);
        initNewUniverse();
    }
    handleDailyCheckIn();
    isPaused = false;
    isBossMode = false;
    activeDialog = null;
}

function initNewUniverse() {
    gameState.lastRefreshTime = Date.now();
    gameState.checkInDays = gameState.checkInDays || [];
    gameState.gameMap = [];
    for (let y = 0; y < MAP_GRID; y++) {
        gameState.gameMap[y] = [];
        for (let x = 0; x < MAP_GRID; x++) {
            const rand = Math.random();
            gameState.gameMap[y][x] = rand < 0.1 ? 1 : (rand < 0.18 ? 2 : 0); // 0 草地，1 石子路，2 鲜花小径
        }
    }
    gameState.mapItems = generateRandomItems();
    gameState.worldObjects = Object.assign({}, DEFAULT_WORLD);
}

// 生成地图拾取物品
function generateRandomItems() {
    const items = [
        { type: 'coin', name: '硬币', emoji: '🪙', color: '#f1c40f' },
        { type: 'fish', name: '小鱼干', emoji: '🐟', color: '#3498db' },
        { type: 'trash', name: '废纸团', emoji: '🗑️', color: '#95a5a6' },
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' },
        { type: 'water', name: '露水滴', emoji: '💧', color: '#74b9ff' }
    ];
    const placed = [];
    for (let i = 0; i < 35; i++) {
        let rx = Math.floor(Math.random() * MAP_GRID);
        let ry = Math.floor(Math.random() * MAP_GRID);
        if (!isSolid(rx, ry) && (rx !== player.gridX || ry !== player.gridY)) {
            const base = items[Math.floor(Math.random() * items.length)];
            placed.push({ gridX: rx, gridY: ry, type: base.type, name: base.name, emoji: base.emoji, color: base.color });
        }
    }
    return placed;
}

function handleDailyCheckIn() {
    const today = new Date().toISOString().split('T')[0];
    if (!gameState.checkInDays.includes(today)) {
        gameState.checkInDays.push(today);
        saveGame();
    }
}

// 检测是否为阻挡格子（含水域）
function isSolid(x, y) {
    if (x < 0 || y < 0 || x >= MAP_GRID || y >= MAP_GRID) return true;
    // 水域不可进入
    for (const pd of ponds) {
        if (x >= pd.x && x < pd.x + pd.w && y >= pd.y && y < pd.y + pd.h) return true;
    }
    const objs = gameState.worldObjects;
    const blockObjs = [
        'vendingMachine', 'clawMachine', 'tv', 'chair', 'bench', 'telephone', 'guitarist',
        'mailbox', 'coffeeCart', 'bakery', 'busStop', 'fountain', 'cat', 'musicBox',
        'bookstall', 'gacha', 'sage', 'ringToss', 'graffiti', 'messageBottle', 'crystalBall', 'diceGame', 'birdNest'
    ];
    for (let k of blockObjs) {
        if (objs[k] && objs[k].gridX === x && objs[k].gridY === y) return true;
    }
    return false;
}

// =======================
// 界面与对话
// =======================
function createDialogDOM(title, content) {
    removeDialogDOM();
    const modal = document.createElement('div');
    modal.className = 'pixel-dialog';
    modal.id = 'pixelDialog';
    modal.innerHTML = `
        <div class="pixel-dialog-title">${title}</div>
        <div class="pixel-dialog-content">${content}</div>
        <button class="pixel-dialog-close" id="closeDialogBtn">确定</button>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeDialogBtn').addEventListener('click', removeDialogDOM);
    activeDialog = modal;
    Sound.dialog();
}

function removeDialogDOM() {
    const existing = document.getElementById('pixelDialog');
    if (existing) existing.remove();
    activeDialog = null;
}

function spawnFloatingBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'floating-bubble';
    bubble.innerText = text;
    bubble.style.left = `${canvas.offsetLeft + VIEW_WIDTH / 2 - 10}px`;
    bubble.style.top = `${canvas.offsetTop + VIEW_HEIGHT / 2 - 40}px`;
    bubble.style.color = '#764ba2';
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1500);
}

// 日历面板：固定到画面右下角，当天打卡的日期旁显示动物 emoji
function getEmojiForDate(dateStr) {
    const animals = ['🐱','🐶','🐰','🐼','🦊','🐻','🐨','🐯','🐸','🦁','🦄','🦉','🐵','🐤','🐺','🐙'];
    let sum = 0;
    for (let i = 0; i < dateStr.length; i++) sum += dateStr.charCodeAt(i);
    return animals[sum % animals.length];
}

function renderCalendarInPanel() {
    const target = document.getElementById('calendarPanel');
    if (!target) return;
    target.classList.add('pixel-calendar-panel');
    target.innerHTML = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-index
    const monthLabel = `${year} - ${String(month + 1).padStart(2, '0')} ${now.toLocaleString('default', { month: 'long' })}`;

    const header = document.createElement('div');
    header.className = 'pixel-calendar-header';
    header.innerHTML = `<div>${monthLabel}</div><div><button id="closeCalendarSmall" title="收起日历">×</button></div>`;
    target.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'pixel-calendar-grid';
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(w => {
        const wd = document.createElement('div');
        wd.className = 'pixel-calendar-weekday';
        wd.innerText = w;
        grid.appendChild(wd);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'pixel-calendar-cell';
        const hasChecked = Array.isArray(gameState.checkInDays) && gameState.checkInDays.includes(dateStr);
        let emojiHtml = '';
        if (hasChecked) emojiHtml = `<span style="margin-left:6px;">${getEmojiForDate(dateStr)}</span>`;
        cell.innerHTML = `<div class="date">${d}${emojiHtml}</div><div class="sub">${dateStr.slice(5)}</div>`;
        grid.appendChild(cell);
    }

    target.appendChild(grid);

    const closeBtn = target.querySelector('#closeCalendarSmall');
    if (closeBtn) closeBtn.addEventListener('click', () => { target.style.display = 'none'; });
    target.style.display = 'block';
}

// =======================
// 物品与交互辅助
// =======================
function addItemToInventory(type, name, emoji) {
    const existItem = player.inventory.find(i => i.type === type);
    if (existItem) {
        existItem.count++;
    } else {
        player.inventory.push({ type, name, emoji, count: 1 });
    }
    updateInventoryUI();
    Sound.pickup();
}

function updateInventoryUI() {
    const slotsContainer = document.getElementById('inventorySlots');
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    player.inventory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'inventory-item';
        itemEl.innerHTML = `<span class="inventory-item-emoji">${item.emoji}</span><div>${item.name}</div><div class="inventory-item-count">${item.count}</div>`;
        slotsContainer.appendChild(itemEl);
    });
    const totalCount = player.inventory.reduce((s, it) => s + it.count, 0);
    const statsEl = document.getElementById('stats');
    if (statsEl) statsEl.innerText = `收集总数: ${totalCount}`;
}

// 消耗一个指定类型道具，成功返回 true
function takeItem(type) {
    const idx = player.inventory.findIndex(i => i.type === type);
    if (idx === -1) return false;
    player.inventory.splice(idx, 1);
    updateInventoryUI();
    return true;
}

function hasItem(type) {
    return player.inventory.some(i => i.type === type);
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// =======================
// 各类设施交互（返回 true 表示已处理）
// =======================

// 流浪小猫：喂鱼干跟随；跟随后可撸猫
function interactCat() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.cat.gridX || player.gridY !== objs.cat.gridY) return false;
    if (objs.cat.isFollowing) {
        createDialogDOM('🐱 你的小跟班', randomPick([
            '🐱 小猫蹭了蹭你的腿：「最喜欢和你一起摸鱼啦~」',
            '🐱 小猫打了个滚：「今天也要开开心心哦！」',
            '🐱 小猫喵喵叫：「再多陪我一会儿嘛~」'
        ]));
        return true;
    }
    if (takeItem('fish')) {
        objs.cat.isFollowing = true;
        saveGame();
        createDialogDOM('🐱 流浪小猫咪', '咪呜~❤ 小猫现在会一直跟着你啦！');
    } else {
        createDialogDOM('🐱 流浪小猫咪', '喵呜... 肚子饿。如果你能找到 [🐟 小鱼干] 喂它就好了。');
    }
    return true;
}

// 街角咖啡车：投币换冰美式
function interactCoffeeCart() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.coffeeCart.gridX || player.gridY !== objs.coffeeCart.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('☕ 街角咖啡车', '投一枚 [🪙 硬币] 就能换一杯冰美式哦。');
        return true;
    }
    addItemToInventory('coffee', '冰美式', '☕');
    saveGame();
    createDialogDOM('☕ 街角咖啡车', '用 [🪙 硬币] 兑换了一杯【☕ 冰美式】！');
    return true;
}

// 灵感许愿树：露水浇灌
function interactWishingTree() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.wishingTree.gridX || player.gridY !== objs.wishingTree.gridY) return false;
    if (takeItem('water')) {
        objs.wishingTree.waterCount++;
        saveGame();
        createDialogDOM('🌳 灵感许愿树', '你用【💧 露水滴】浇灌了许愿树，灵感+999！');
    } else {
        createDialogDOM('🌳 灵感许愿树', '如果你收集到了 [💧 露水滴]，可以来浇灌它。');
    }
    return true;
}

// 烘焙小屋：闻香气
function interactBakery() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.bakery.gridX || player.gridY !== objs.bakery.gridY) return false;
    createDialogDOM('🥐 烘焙小屋', '门口飘着刚出炉的香气～ 今日面包可免费“闻”哦。');
    return true;
}

// 夹娃娃机：投币 50% 概率出小熊
function interactClawMachine() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.clawMachine.gridX || player.gridY !== objs.clawMachine.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('夹娃娃机', '抓一次娃娃需要一枚 [🪙 硬币]。');
        return true;
    }
    createDialogDOM('夹娃娃机', '机械爪在移动……');
    setTimeout(() => {
        if (Math.random() < 0.5) {
            addItemToInventory('doll', '绝版小熊', '🧸');
            createDialogDOM('夹娃娃机', '✨ 哇！抓到了一只【🧸 绝版小熊】！');
        } else {
            createDialogDOM('夹娃娃机', '爪子滑了一下，差一点点！再试一次吧！');
        }
        saveGame();
    }, 800);
    return true;
}

// 治愈邮箱：取信 / 放花
function interactMailbox() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.mailbox.gridX || player.gridY !== objs.mailbox.gridY) return false;
    if (objs.mailbox.hasLetter) {
        objs.mailbox.hasLetter = false;
        saveGame();
        const letters = [
            "💌 明信片：'世界很大，不要忘记吃饭。'",
            "💌 匿名纸条：'好运会降临给你。'",
            "💌 小纸条：'摸鱼也要注意身体噢。'"
        ];
        createDialogDOM('📬 治愈邮箱', `<strong>${randomPick(letters)}</strong>`);
    } else if (takeItem('flower')) {
        objs.mailbox.hasLetter = true;
        saveGame();
        createDialogDOM('📬 治愈邮箱', '你把花放进了邮箱，为陌生人留下温暖。');
    } else {
        createDialogDOM('📬 治愈邮箱', '空空如也，如果你有 [🌼 小雏菊] 可以放进去。');
    }
    return true;
}

// 许愿喷泉：投币看运势 + 粒子
function interactFountain() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.fountain.gridX || player.gridY !== objs.fountain.gridY) return false;
    if (takeItem('coin')) {
        saveGame();
        const fortunes = [
            "✨ 大吉！今天适合温柔摸鱼。",
            "✨ 中吉！小心老板的巡视。",
            "✨ 小确幸：会遇见温暖的事。"
        ];
        createDialogDOM('⛲ 许愿喷泉', randomPick(fortunes));
        for (let i = 0; i < 12; i++) {
            particles.push({
                x: objs.fountain.gridX * TILE_SIZE + 16 + Math.random() * 10 - 5,
                y: objs.fountain.gridY * TILE_SIZE + 16,
                vx: Math.random() * 2 - 1,
                vy: -Math.random() * 2 - 1,
                color: '#74b9ff',
                life: 30 + Math.random() * 20
            });
        }
    } else {
        createDialogDOM('⛲ 许愿喷泉', '朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！');
    }
    return true;
}

// 真·钓鱼：站钓鱼点按 E 抛竿 / 进入时机窗口后把握收线（任务 4）
function interactFishing() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.fishingSpot.gridX || player.gridY !== objs.fishingSpot.gridY) return false;
    if (!fishing.active) {
        startFishing();
    } else if (fishing.phase === 'timing') {
        reelIn();
    } else if (fishing.phase === 'wait') {
        createDialogDOM('🎣 钓鱼中', '浮标还静悄悄的…耐心等鱼上钩！');
    }
    return true;
}

function startFishing() {
    fishing.active = true;
    fishing.phase = 'wait';
    fishing.barPos = 0;
    fishing.barDir = 1;
    spawnFloatingBubble('🎣 抛竿！');
    Sound.bite();
    const wait = 1500 + Math.random() * 2500;
    fishing.timeoutId = setTimeout(() => {
        if (!fishing.active) return;
        fishing.phase = 'timing'; // 进入收线时机窗口
        spawnFloatingBubble('❗ 上钩了！快收线！');
        Sound.bite();
    }, wait);
}

// 指针越靠近中点(0.5)收线质量越高
function judgeQuality() {
    const dist = Math.abs(fishing.barPos - 0.5);
    if (dist <= 0.08) return 'perfect';
    if (dist <= 0.22) return 'good';
    return 'miss';
}

function reelIn() {
    const quality = judgeQuality();
    clearTimeout(fishing.timeoutId);
    fishing.active = false;
    fishing.phase = 'idle';

    // 不同质量对应不同鱼种权重
    const pools = {
        perfect: [
            { type: 'shark', name: '迷你鲨鱼', emoji: '🦈', w: 28 },
            { type: 'octopus', name: '小章鱼', emoji: '🐙', w: 28 },
            { type: 'squid', name: '鱿鱼', emoji: '🦑', w: 22 },
            { type: 'tropical', name: '热带鱼', emoji: '🐠', w: 22 }
        ],
        good: [
            { type: 'tropical', name: '热带鱼', emoji: '🐠', w: 32 },
            { type: 'squid', name: '鱿鱼', emoji: '🦑', w: 25 },
            { type: 'fish', name: '小鱼干', emoji: '🐟', w: 30 },
            { type: 'octopus', name: '小章鱼', emoji: '🐙', w: 10 },
            { type: 'boot', name: '旧靴子', emoji: '🥾', w: 3 }
        ],
        miss: [
            { type: 'boot', name: '旧靴子', emoji: '🥾', w: 75 },
            { type: 'fish', name: '小鱼干', emoji: '🐟', w: 25 }
        ]
    };
    const pool = pools[quality];
    const total = pool.reduce((s, f) => s + f.w, 0);
    let r = Math.random() * total;
    let caught = pool[pool.length - 1];
    for (const f of pool) { if (r < f.w) { caught = f; break; } r -= f.w; }

    if (caught.type === 'boot') {
        Sound.miss();
        const why = quality === 'miss' ? '时机没抓好，鱼跑掉啦…再试一次！' : '哎呀，是只旧靴子🥾…';
        createDialogDOM('🎣 钓上来了', why);
    } else {
        Sound.catch();
        const tag = quality === 'perfect' ? ' 完美收线！🎯' : '';
        createDialogDOM('🎣 收获！', `你钓到了【${caught.emoji} ${caught.name}】！放进桶里啦~${tag}`);
    }
    if (caught.type !== 'boot') addItemToInventory(caught.type, caught.name, caught.emoji);
    saveGame();
}

function cancelFishing() {
    if (!fishing.active) return;
    clearTimeout(fishing.timeoutId);
    fishing.active = false;
    fishing.phase = 'idle';
}

// ---- 任务 3：补全原遗留设施交互 ----

// 音乐盒：开关 + 音符粒子
function interactMusicBox() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.musicBox.gridX || player.gridY !== objs.musicBox.gridY) return false;
    objs.musicBox.isOn = !objs.musicBox.isOn;
    if (objs.musicBox.isOn) {
        for (let i = 0; i < 6; i++) {
            particles.push({
                x: objs.musicBox.gridX * TILE_SIZE + 16,
                y: objs.musicBox.gridY * TILE_SIZE + 10,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 1.5 - 0.5,
                color: '#fff', isNote: true, life: 40 + Math.random() * 20
            });
        }
        createDialogDOM('🎵 八音盒', '叮叮咚咚~ 音乐盒开始转动，整个人都轻快了！');
    } else {
        createDialogDOM('🎵 八音盒', '你轻轻合上了音乐盒，余音绕梁。');
    }
    saveGame();
    return true;
}

// 红色电话亭：随机语音
function interactTelephone() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.telephone.gridX || player.gridY !== objs.telephone.gridY) return false;
    objs.telephone.callCount++;
    const lines = [
        '☎️ 电话那头：「喂？…（其实是你自己家的座机，尴尬）」',
        '☎️ 陌生声音：「恭喜你成为第 999 位摸鱼达人！」',
        '☎️ 语音信箱：「记得喝水、记得伸懒腰~」',
        '☎️ 老板？！（吓一跳）…原来是彩铃。'
    ];
    createDialogDOM('☎️ 红色电话亭', randomPick(lines));
    saveGame();
    return true;
}

// 自动售货机：投币随机饮料
function interactVending() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.vendingMachine.gridX || player.gridY !== objs.vendingMachine.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('🥤 自动售货机', '投一枚 [🪙 硬币] 就能出货哦。');
        return true;
    }
    const drinks = [
        { type: 'cola', name: '快乐水', emoji: '🥤' },
        { type: 'juice', name: '鲜橙汁', emoji: '🧃' },
        { type: 'energy', name: '能量饮', emoji: '⚡' }
    ];
    const d = randomPick(drinks);
    addItemToInventory(d.type, d.name, d.emoji);
    objs.vendingMachine.lastItem = d.name;
    saveGame();
    createDialogDOM('🥤 自动售货机', `哐当！掉出一瓶【${d.emoji} ${d.name}】！`);
    return true;
}

// 街头吉他手：投币打赏 + 音符粒子
function interactGuitarist() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.guitarist.gridX || player.gridY !== objs.guitarist.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('🎸 街头吉他手', '「想点首歌？投一枚 [🪙 硬币] 就行~」');
        return true;
    }
    objs.guitarist.isTipped = true;
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: objs.guitarist.gridX * TILE_SIZE + 16,
            y: objs.guitarist.gridY * TILE_SIZE + 10,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2 - 0.5,
            color: '#f1c40f', isNote: true, life: 40 + Math.random() * 20
        });
    }
    const songs = ['🎸 「摸鱼进行曲」🎵', '🎸 「老板看不见我」♪', '🎸 「下午三点的阳光」🎶'];
    createDialogDOM('🎸 街头吉他手', '吉他手向你眨眨眼，弹起了 ' + randomPick(songs));
    saveGame();
    return true;
}

// 鸟巢：用小雏菊喂养
function interactBirdNest() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.birdNest.gridX || player.gridY !== objs.birdNest.gridY) return false;
    if (objs.birdNest.isFed) {
        createDialogDOM('🪹 鸟巢', '鸟妈妈正在孵蛋，嘘——轻声点。');
        return true;
    }
    if (!takeItem('flower')) {
        createDialogDOM('🪹 鸟巢', '鸟妈妈饿了，喂它一朵 [🌼 小雏菊] 吧。');
        return true;
    }
    objs.birdNest.isFed = true;
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: objs.birdNest.gridX * TILE_SIZE + 16,
            y: objs.birdNest.gridY * TILE_SIZE,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2 - 0.5,
            color: '#fff', isNote: true, life: 40
        });
    }
    saveGame();
    createDialogDOM('🪹 鸟巢', '鸟妈妈叼着花飞走了，过会儿会回来孵蛋，谢谢你~');
    return true;
}

// 公交站台：等车对话
function interactBusStop() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.busStop.gridX || player.gridY !== objs.busStop.gridY) return false;
    const mins = Math.floor(Math.random() * 15) + 1;
    const lines = [
        `🚏 到站提示：下一班公交还有约 ${mins} 分钟，先发会儿呆吧。`,
        '🚏 公交缓缓进站，但你并不着急——反正摸鱼最重要。',
        '🚏 司机朝你挥手：「上来不？」你笑着摇头。'
    ];
    createDialogDOM('🚏 公交站台', randomPick(lines));
    return true;
}

// 公园长椅：用废纸团清扫后可坐
function interactBench() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.bench.gridX || player.gridY !== objs.bench.gridY) return false;
    if (!objs.bench.isCleaned) {
        if (!takeItem('trash')) {
            createDialogDOM('🪑 公园长椅', '长椅有点脏，用 [🗑️ 废纸团] 擦一擦就能坐得更舒服。');
            return true;
        }
        objs.bench.isCleaned = true;
        saveGame();
        createDialogDOM('🪑 公园长椅', '你把长椅擦得锃亮，这下能舒舒服服地发呆啦！');
        return true;
    }
    player.isSitting = true;
    createDialogDOM('🪑 干净的公园长椅', '你坐在擦干净的长椅上，微风拂面，惬意~（按方向键起身）');
    return true;
}

// ---- 任务 2：新增 10 种互动 ----

// 书摊：投币借书
function interactBookstall() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.bookstall.gridX || player.gridY !== objs.bookstall.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('📚 流浪书摊', '摊主：「投一枚 [🪙 硬币] 就能借走一本书。」');
        return true;
    }
    const books = [
        { type: 'book', name: '神秘读物', emoji: '📖' },
        { type: 'book', name: '摸鱼哲学', emoji: '📕' },
        { type: 'book', name: '发呆指南', emoji: '📘' }
    ];
    const b = randomPick(books);
    addItemToInventory(b.type, b.name, b.emoji);
    saveGame();
    createDialogDOM('📚 流浪书摊', `你借到了《${b.name}》，知识+1，困意+1。`);
    return true;
}

// 扭蛋机：投币随机玩具
function interactGacha() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.gacha.gridX || player.gridY !== objs.gacha.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('🎰 扭蛋机', '扭一次要一枚 [🪙 硬币]，看看运气~');
        return true;
    }
    const toys = [
        { type: 'doll', name: '绝版小熊', emoji: '🧸' },
        { type: 'ball', name: '弹力球', emoji: '🪀' },
        { type: 'crystal', name: '许愿星', emoji: '🔮' },
        { type: 'kitty', name: '招财猫', emoji: '🐱' }
    ];
    const t = randomPick(toys);
    addItemToInventory(t.type, t.name, t.emoji);
    saveGame();
    createDialogDOM('🎰 扭蛋机', `骨碌碌…扭出了一只【${t.emoji} ${t.name}】！`);
    return true;
}

// 喂鸽子：用废纸团当面包屑
function interactPigeon() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.pigeon.gridX || player.gridY !== objs.pigeon.gridY) return false;
    if (!takeItem('trash')) {
        createDialogDOM('🕊️ 广场鸽群', '鸽子咕咕叫，掰点 [🗑️ 废纸团] 当面包屑喂喂它们？');
        return true;
    }
    objs.pigeon.fed = (objs.pigeon.fed || 0) + 1;
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: objs.pigeon.gridX * TILE_SIZE + 16 + Math.random() * 16,
            y: objs.pigeon.gridY * TILE_SIZE,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2 - 0.5,
            color: '#fff', isNote: false, life: 30
        });
    }
    saveGame();
    createDialogDOM('🕊️ 广场鸽群', '鸽子们扑棱棱围过来，咕咕咕，像在说谢谢~');
    return true;
}

// 树下老爷爷：纯对话
function interactSage() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.sage.gridX || player.gridY !== objs.sage.gridY) return false;
    const tips = [
        '🧓 老爷爷：「年轻人，摸鱼不是偷懒，是给脑子放个假。」',
        '🧓 老爷爷：「该忙时忙，该闲时闲，才是长久之道。」',
        '🧓 老爷爷：「你看那朵云，它什么也不做，却最自在。」',
        '🧓 老爷爷：「记得按时吃饭，按时摸鱼。」'
    ];
    createDialogDOM('🧓 树下的老爷爷', randomPick(tips));
    return true;
}

// 套圈摊：投币套圈
function interactRingToss() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.ringToss.gridX || player.gridY !== objs.ringToss.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('🎯 套圈摊', '老板：「一枚 [🪙 硬币] 三个圈，套中就归你！」');
        return true;
    }
    if (Math.random() < 0.5) {
        const prizes = [
            { type: 'doll', name: '陶瓷娃娃', emoji: '🎎' },
            { type: 'ball', name: '彩虹圈', emoji: '🌈' }
        ];
        const p = randomPick(prizes);
        addItemToInventory(p.type, p.name, p.emoji);
        saveGame();
        createDialogDOM('🎯 套圈摊', `漂亮！套中了【${p.emoji} ${p.name}】！`);
    } else {
        createDialogDOM('🎯 套圈摊', '圈圈擦着瓶子滚走了…差一点点！');
    }
    return true;
}

// 涂鸦墙：用小雏菊作画
function interactGraffiti() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.graffiti.gridX || player.gridY !== objs.graffiti.gridY) return false;
    if (objs.graffiti.painted) {
        createDialogDOM('🪧 涂鸦墙', '这面墙已经被你画得五彩斑斓啦，真好看！');
        return true;
    }
    if (!takeItem('flower')) {
        createDialogDOM('🪧 涂鸦墙', '拿一朵 [🌼 小雏菊] 当画笔，在墙上留下你的涂鸦吧。');
        return true;
    }
    objs.graffiti.painted = true;
    saveGame();
    createDialogDOM('🪧 涂鸦墙', '你用花汁在墙上画了个小太阳🌞，路过的人都笑了。');
    return true;
}

// 海滩许愿瓶：读随机寄语
function interactMessageBottle() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.messageBottle.gridX || player.gridY !== objs.messageBottle.gridY) return false;
    const msgs = [
        '⚓ 瓶中信：「致未来的你：要一直自由自在呀。」',
        '⚓ 瓶中信：「海的那边，也有人在摸鱼哦。」',
        '⚓ 瓶中信：「别担心，好事正在路上。」',
        '⚓ 瓶中信：「今天也要好好吃饭、好好发呆。」'
    ];
    createDialogDOM('⚓ 海滩许愿瓶', randomPick(msgs));
    return true;
}

// 占卜水晶：用露水滴占卜
function interactCrystalBall() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.crystalBall.gridX || player.gridY !== objs.crystalBall.gridY) return false;
    if (!takeItem('water')) {
        createDialogDOM('🔮 占卜水晶', '占卜师：「一滴 [💧 露水滴] 献给水晶，我便为你窥探运势。」');
        return true;
    }
    const fortunes = [
        '🔮 水晶闪烁：今日宜摸鱼，忌加班。',
        '🔮 水晶低语：你会遇见一个小惊喜。',
        '🔮 水晶朦胧：保持好奇，好运自来。',
        '🔮 水晶炸裂（开玩笑的）：大吉！'
    ];
    createDialogDOM('🔮 占卜水晶', randomPick(fortunes));
    saveGame();
    return true;
}

// 骰子摊：投币掷骰，5/6 点赢小鱼干
function interactDiceGame() {
    const objs = gameState.worldObjects;
    if (player.gridX !== objs.diceGame.gridX || player.gridY !== objs.diceGame.gridY) return false;
    if (!takeItem('coin')) {
        createDialogDOM('🎲 骰子摊', '庄家：「押一枚 [🪙 硬币]，掷出 5 或 6 就赢 [🐟 小鱼干]！」');
        return true;
    }
    const roll = Math.floor(Math.random() * 6) + 1;
    if (roll >= 5) {
        addItemToInventory('fish', '小鱼干', '🐟');
        saveGame();
        createDialogDOM('🎲 骰子摊', `你掷出 ${roll} 点！赢了 [🐟 小鱼干] 一条~`);
    } else {
        createDialogDOM('🎲 骰子摊', `你掷出 ${roll} 点，差一点点，下次好运！`);
    }
    return true;
}

// 调度所有交互
function checkInteractions() {
    if (activeDialog) return;
    const handlers = [
        interactCat, interactCoffeeCart, interactWishingTree, interactBakery,
        interactClawMachine, interactMailbox, interactFountain, interactFishing,
        interactMusicBox, interactTelephone, interactVending, interactGuitarist,
        interactBirdNest, interactBusStop, interactBench,
        interactBookstall, interactGacha, interactPigeon, interactSage,
        interactRingToss, interactGraffiti, interactMessageBottle, interactCrystalBall, interactDiceGame
    ];
    for (const fn of handlers) {
        if (fn()) return;
    }
}

function checkStepTriggers() {
    const items = gameState.mapItems;
    const itemIdx = items.findIndex(i => i.gridX === player.gridX && i.gridY === player.gridY);
    if (itemIdx !== -1) {
        const item = items[itemIdx];
        addItemToInventory(item.type, item.name, item.emoji);
        items.splice(itemIdx, 1);
        saveGame();
        spawnFloatingBubble(`+1 ${item.name}`);
    }

    const inPuddle = puddles.some(p => p.gridX === player.gridX && p.gridY === player.gridY);
    if (inPuddle) {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: player.pixelX + 16,
                y: player.pixelY + 28,
                vx: Math.random() * 3 - 1.5,
                vy: -Math.random() * 1.5 - 0.5,
                color: '#74b9ff',
                life: 15 + Math.random() * 10
            });
        }
    }

    const objs = gameState.worldObjects;
    if (player.gridX === objs.chair.gridX && player.gridY === objs.chair.gridY) {
        player.isSitting = true;
        createDialogDOM('🛋️ 挂机长椅', '你坐在了长椅上。整个人放松了... (按任意方向键可起立)');
    }
}

// =======================
// 输入与巡逻 NPC 行为
// =======================
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'escape') {
        // 钓鱼中按 Esc 先收竿，再切老板键
        cancelFishing();
        toggleBossMode();
        return;
    }
    keysPressed[key] = true;
    if ([' ', 'enter', 'e'].includes(key)) {
        checkInteractions();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keysPressed[key] = false;
});

window.addEventListener('blur', () => {
    for (let k in keysPressed) keysPressed[k] = false;
});

function checkContinuousInput() {
    if (player.isMoving || isPaused || player.isSitting || activeDialog || isBossMode || fishing.active) return;
    const moveMap = {
        'arrowup': { dx: 0, dy: -1, dir: 'up' },
        'w': { dx: 0, dy: -1, dir: 'up' },
        'arrowdown': { dx: 0, dy: 1, dir: 'down' },
        's': { dx: 0, dy: 1, dir: 'down' },
        'arrowleft': { dx: -1, dy: 0, dir: 'left' },
        'a': { dx: -1, dy: 0, dir: 'left' },
        'arrowright': { dx: 1, dy: 0, dir: 'right' },
        'd': { dx: 1, dy: 0, dir: 'right' }
    };
    for (let k in moveMap) {
        if (keysPressed[k]) {
            const m = moveMap[k];
            const nx = player.gridX + m.dx;
            const ny = player.gridY + m.dy;
            if (!isSolid(nx, ny) && nx >= 0 && ny >= 0 && nx < MAP_GRID && ny < MAP_GRID) {
                player.gridX = nx;
                player.gridY = ny;
                player.targetPixelX = player.gridX * TILE_SIZE;
                player.targetPixelY = player.gridY * TILE_SIZE;
                player.isMoving = true;
                player.direction = m.dir;
            }
            break;
        }
    }
}

function updateWanderingNpc() {
    if (wanderingNpc.isMoving) {
        if (wanderingNpc.pixelX < wanderingNpc.targetPixelX) wanderingNpc.pixelX += 2;
        else if (wanderingNpc.pixelX > wanderingNpc.targetPixelX) wanderingNpc.pixelX -= 2;
        if (wanderingNpc.pixelY < wanderingNpc.targetPixelY) wanderingNpc.pixelY += 2;
        else if (wanderingNpc.pixelY > wanderingNpc.targetPixelY) wanderingNpc.pixelY -= 2;
        if (wanderingNpc.pixelX === wanderingNpc.targetPixelX && wanderingNpc.pixelY === wanderingNpc.targetPixelY) {
            wanderingNpc.isMoving = false;
        }
    } else {
        wanderingNpc.moveTimer++;
        if (wanderingNpc.moveTimer > 60) {
            wanderingNpc.moveTimer = 0;
            const dirs = [
                { dx: 0, dy: -1, dir: 'up' },
                { dx: 0, dy: 1, dir: 'down' },
                { dx: -1, dy: 0, dir: 'left' },
                { dx: 1, dy: 0, dir: 'right' }
            ];
            const move = dirs[Math.floor(Math.random() * dirs.length)];
            let nx = wanderingNpc.gridX + move.dx;
            let ny = wanderingNpc.gridY + move.dy;
            if (nx >= 2 && nx < MAP_GRID - 2 && ny >= 2 && ny < MAP_GRID - 2 && !isSolid(nx, ny)) {
                wanderingNpc.gridX = nx;
                wanderingNpc.gridY = ny;
                wanderingNpc.targetPixelX = nx * TILE_SIZE;
                wanderingNpc.targetPixelY = ny * TILE_SIZE;
                wanderingNpc.direction = move.dir;
                wanderingNpc.isMoving = true;
            }
        }
    }
    if (player.gridX === wanderingNpc.gridX && player.gridY === wanderingNpc.gridY && !activeDialog) {
        const text = wanderingNpc.dialogs[Math.floor(Math.random() * wanderingNpc.dialogs.length)];
        createDialogDOM(`🚶‍♀️ 偶遇 ${wanderingNpc.name}`, text);
    }
}

// =======================
// 游戏逻辑更新与渲染
// =======================
function update() {
    if (isPaused || isBossMode) return;
    checkContinuousInput();
    updateWanderingNpc();

    // 小猫跟随玩家身后一格
    const objs = gameState.worldObjects;
    if (objs.cat.isFollowing) {
        const off = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[player.direction] || [0, 0];
        objs.cat.gridX = player.gridX + off[0];
        objs.cat.gridY = player.gridY + off[1];
    }

    // 平滑移动
    if (player.isMoving) {
        if (player.pixelX < player.targetPixelX) player.pixelX = Math.min(player.pixelX + player.moveSpeed, player.targetPixelX);
        if (player.pixelX > player.targetPixelX) player.pixelX = Math.max(player.pixelX - player.moveSpeed, player.targetPixelX);
        if (player.pixelY < player.targetPixelY) player.pixelY = Math.min(player.pixelY + player.moveSpeed, player.targetPixelY);
        if (player.pixelY > player.targetPixelY) player.pixelY = Math.max(player.pixelY - player.moveSpeed, player.targetPixelY);
        if (player.pixelX === player.targetPixelX && player.pixelY === player.targetPixelY) {
            player.isMoving = false;
            checkStepTriggers();
        }
    }

    if (Date.now() - gameState.lastRefreshTime > MAP_REFRESH_INTERVAL) {
        refreshWorldElements();
    }

    // 电视机自动开关示例
    const tv = objs.tv;
    const distToTV = Math.hypot(player.gridX - tv.gridX, player.gridY - tv.gridY);
    tv.isOn = distToTV <= 2.5;
    if (tv.isOn) tv.animFrame++;

    if (player.isSitting) {
        player.sitTimer++;
        if (player.sitTimer % 90 === 0) {
            const symbols = ['❤️', '💤', '🎵', '☁️'];
            spawnFloatingBubble(symbols[Math.floor(Math.random() * symbols.length)]);
        }
    }

    // 钓鱼收线时机条推进
    if (fishing.active && fishing.phase === 'timing') {
        fishing.barPos += fishing.barDir * 0.035;
        if (fishing.barPos >= 1) { fishing.barPos = 1; fishing.barDir = -1; }
        if (fishing.barPos <= 0) { fishing.barPos = 0; fishing.barDir = 1; }
    }

    // 粒子更新
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function refreshWorldElements() {
    gameState.lastRefreshTime = Date.now();
    gameState.mapItems = generateRandomItems();
    if (gameState.worldObjects.bench) gameState.worldObjects.bench.isCleaned = false;
    if (gameState.worldObjects.mailbox) gameState.worldObjects.mailbox.hasLetter = Math.random() < 0.7;
    if (gameState.worldObjects.guitarist) gameState.worldObjects.guitarist.isTipped = false;
    saveGame();
    spawnFloatingBubble('✨ 奇妙摸鱼城已刷新！');
}

// 绘制
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#a6d8ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 相机使角色居中
    const camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    const camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;
    const startX = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endX = Math.min(MAP_GRID, startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1);
    const endY = Math.min(MAP_GRID, startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1);

    // 水域（不可进入）
    ponds.forEach(pd => {
        for (let yy = pd.y; yy < pd.y + pd.h; yy++) {
            for (let xx = pd.x; xx < pd.x + pd.w; xx++) {
                const sx = xx * TILE_SIZE - camX;
                const sy = yy * TILE_SIZE - camY;
                ctx.fillStyle = '#4a69bd';
                ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 16);
            }
        }
    });

    // 地图绘制
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;
            const tileType = gameState.gameMap[y] ? gameState.gameMap[y][x] : 0;
            if (tileType === 1) ctx.fillStyle = '#a8a7a1';
            else if (tileType === 2) ctx.fillStyle = '#81c784';
            else ctx.fillStyle = '#a2d149';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.03)';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            if (tileType === 2) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(screenX + 8, screenY + 8, 4, 4);
                ctx.fillRect(screenX + 20, screenY + 18, 4, 4);
            }
        }
    }

    // 小水洼
    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
    });

    const objs = gameState.worldObjects;

    // 通用绘制函数
    function drawSprite(gx, gy, color, icon) {
        const sx = gx * TILE_SIZE - camX;
        const sy = gy * TILE_SIZE - camY;
        ctx.fillStyle = color;
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(icon, sx + 8, sy + 22);
    }

    // 原有设施
    drawSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, '#e74c3c', '🥤');
    drawSprite(8, 15, '#fd79a8', '👧'); // 装饰：小女孩
    drawSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, '#9b59b6', '🧸');
    drawSprite(objs.chair.gridX, objs.chair.gridY, '#d4a574', '🛋️');
    drawSprite(objs.coffeeCart.gridX, objs.coffeeCart.gridY, '#d35400', '☕');
    drawSprite(objs.wishingTree.gridX, objs.wishingTree.gridY, '#27ae60', '🌳');
    drawSprite(objs.bakery.gridX, objs.bakery.gridY, '#f39c12', '🥐');
    drawSprite(objs.busStop.gridX, objs.busStop.gridY, '#2980b9', '🚏');
    drawSprite(objs.fountain.gridX, objs.fountain.gridY, '#3498db', '⛲');

    // 任务 3 补全绘制的设施
    drawSprite(objs.musicBox.gridX, objs.musicBox.gridY, '#8e44ad', '🎵');
    drawSprite(objs.telephone.gridX, objs.telephone.gridY, '#c0392b', '☎️');
    drawSprite(objs.guitarist.gridX, objs.guitarist.gridY, '#16a085', '🎸');
    drawSprite(objs.birdNest.gridX, objs.birdNest.gridY, '#d35400', '🪹');
    drawSprite(objs.bench.gridX, objs.bench.gridY, objs.bench.isCleaned ? '#bdc3c7' : '#7f8c8d', '🪑');

    // 任务 2 新增设施
    drawSprite(objs.bookstall.gridX, objs.bookstall.gridY, '#8e44ad', '📚');
    drawSprite(objs.gacha.gridX, objs.gacha.gridY, '#e67e22', '🎰');
    drawSprite(objs.sage.gridX, objs.sage.gridY, '#7f8c8d', '🧓');
    drawSprite(objs.ringToss.gridX, objs.ringToss.gridY, '#16a085', '🎯');
    drawSprite(objs.graffiti.gridX, objs.graffiti.gridY, objs.graffiti.painted ? '#e84393' : '#2c3e50', '🪧');
    drawSprite(objs.messageBottle.gridX, objs.messageBottle.gridY, '#00cec9', '⚓');
    drawSprite(objs.crystalBall.gridX, objs.crystalBall.gridY, '#6c5ce7', '🔮');
    drawSprite(objs.diceGame.gridX, objs.diceGame.gridY, '#d63031', '🎲');

    // 鸽群（画多只）
    const pgx = objs.pigeon.gridX * TILE_SIZE - camX;
    const pgy = objs.pigeon.gridY * TILE_SIZE - camY;
    ctx.font = '14px sans-serif';
    ctx.fillText('🕊️', pgx + 4, pgy + 14);
    ctx.fillText('🕊️', pgx + 16, pgy + 22);
    ctx.fillText('🕊️', pgx + 10, pgy + 28);

    // 钓鱼点（木栈道 + 鱼竿标记）
    const fsx = objs.fishingSpot.gridX * TILE_SIZE - camX;
    const fsy = objs.fishingSpot.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(fsx, fsy, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(fishing.active ? (fishing.phase === 'timing' ? '🆘' : '🎣') : '🎣', fsx + 8, fsy + 22);

    // 电视
    const tvX = objs.tv.gridX * TILE_SIZE - camX;
    const tvY = objs.tv.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(tvX, tvY, TILE_SIZE, TILE_SIZE);
    if (objs.tv.isOn) {
        ctx.fillStyle = (Math.floor(objs.tv.animFrame / 15) % 2 === 0) ? '#1abc9c' : '#f1c40f';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    }

    // 巡逻 NPC 小葵
    const wnx = wanderingNpc.pixelX - camX;
    const wny = wanderingNpc.pixelY - camY;
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(wnx + 6, wny + 2, 20, 6);
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(wnx + 8, wny + 8, 16, 8);
    ctx.fillStyle = '#74b9ff'; ctx.fillRect(wnx + 6, wny + 16, 20, 14);

    // 地面物品
    gameState.mapItems.forEach(item => {
        const ix = item.gridX * TILE_SIZE - camX;
        const iy = item.gridY * TILE_SIZE - camY;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(ix + 16, iy + 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(item.emoji, ix + 8, iy + 20);
    });

    // 猫
    const catX = objs.cat.gridX * TILE_SIZE - camX;
    const catY = objs.cat.gridY * TILE_SIZE - camY;
    ctx.font = '16px sans-serif';
    ctx.fillText(objs.cat.isFollowing ? '😺' : '🐱', catX + 8, catY + 22);

    // 主角
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(px + 6, py + 0, 20, 6);
    ctx.fillStyle = '#ffeaa7';
    ctx.fillRect(px + 6, py + 4, 20, 10);
    ctx.fillStyle = '#ff7675';
    ctx.fillRect(px + 4, py + 14, 24, 16);
    ctx.fillStyle = '#2d3436';
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 7, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 19, py + 7, 2, 3);

    // 粒子
    particles.forEach(p => {
        const psx = p.x - camX;
        const psy = p.y - camY;
        ctx.fillStyle = p.color;
        if (p.isNote) {
            ctx.font = '12px sans-serif';
            ctx.fillText('🎵', psx, psy);
        } else {
            ctx.fillRect(psx, psy, 4, 4);
        }
    });

    // 钓鱼 UI 提示 + 收线时机条
    if (fishing.active) {
        const barY = VIEW_HEIGHT - 44;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, barY, VIEW_WIDTH, 44);
        ctx.textAlign = 'center';
        ctx.font = '15px sans-serif';
        if (fishing.phase === 'wait') {
            ctx.fillStyle = '#fff';
            ctx.fillText('🎣 抛竿中…耐心等鱼上钩（按 Esc 收竿）', VIEW_WIDTH / 2, barY + 28);
        } else if (fishing.phase === 'timing') {
            const bw = 300, bh = 18;
            const bx = VIEW_WIDTH / 2 - bw / 2, by = barY + 14;
            ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
            const yx = bx + bw * (0.5 - 0.22), yw = bw * 0.44;
            const gx = bx + bw * (0.5 - 0.08), gw = bw * 0.16;
            ctx.fillStyle = 'rgba(241,196,15,0.5)'; ctx.fillRect(yx, by, yw, bh);   // 黄区（good）
            ctx.fillStyle = 'rgba(46,204,113,0.85)'; ctx.fillRect(gx, by, gw, bh);  // 绿区（perfect）
            const px = bx + bw * fishing.barPos;
            ctx.fillStyle = '#fff'; ctx.fillRect(px - 2, by - 5, 4, bh + 10);       // 指针
            ctx.fillStyle = '#fff';
            ctx.fillText('❗ 上钩了！绿色区按 E / 空格 收线', VIEW_WIDTH / 2, by - 8);
        }
        ctx.textAlign = 'left';
    }
}

// 主循环
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// 老板键功能
function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    const bossScreen = document.getElementById('bossKeyScreen');
    const pauseDialog = document.getElementById('pauseDialog');

    if (isBossMode) {
        if (gameContainer) gameContainer.style.display = 'none';
        if (bossScreen) bossScreen.classList.add('active');
        removeDialogDOM();
        const timeEl = document.getElementById('bossKeyTime');
        if (timeEl) timeEl.innerText = new Date().toLocaleString();
    } else {
        if (bossScreen) bossScreen.classList.remove('active');
        if (gameContainer) gameContainer.style.display = 'flex';
        isPaused = true;
        if (pauseDialog) pauseDialog.classList.add('active');
    }
}

// 暂停对话按钮绑定
const resumeBtn = document.getElementById('resumeBtn');
if (resumeBtn) resumeBtn.addEventListener('click', () => {
    isPaused = false;
    const pd = document.getElementById('pauseDialog');
    if (pd) pd.classList.remove('active');
});

const hideBtn = document.getElementById('hideBtn');
if (hideBtn) hideBtn.addEventListener('click', () => {
    const pd = document.getElementById('pauseDialog');
    if (pd) pd.classList.remove('active');
    toggleBossMode();
});

// 启动初始化
loadOrCreateGame();
updateInventoryUI();
loop();
setInterval(checkContinuousInput, 16);

// 启动后：右下角日历常驻 + 开场公告
setTimeout(() => {
    renderCalendarInPanel();
    createDialogDOM('✨ 摸鱼小镇 大升级！',
        '1. 探索地图，寻找随机走动的小葵！<br>' +
        '2. 右下角【📅 摸鱼日历】记录你的每日打卡~<br>' +
        '3. 新增钓鱼🎣、扭蛋🎰、套圈🎯、占卜🔮等超多互动，去玩吧！');
}, 300);
