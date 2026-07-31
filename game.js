// ==========================================
// 修复版 game.js - 可直接替换
// 说明：已移除 diff 残留与语法错误，补充缺失常量与 loop()
// ==========================================

// 清理旧数据（按需保留）
try {
    // localStorage.clear(); // 如需彻底清理可打开
    localStorage.removeItem('pixel_moyu_save');
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
        "🐱 你看到那只流浪小猫了吗？喂它小鱼干它就会一直跟着你！"
    ]
};

let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    checkInDays: [],
    worldObjects: {
        bench: { gridX: 9, gridY: 12, isCleaned: false },
        tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
        musicBox: { gridX: 12, gridY: 5, isOn: false },
        chair: { gridX: 14, gridY: 8 },
        cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] },
        fountain: { gridX: 30, gridY: 30 },
        guitarist: { gridX: 5, gridY: 25, isTipped: false },
        vendingMachine: { gridX: 15, gridY: 12 },
        clawMachine: { gridX: 25, gridY: 10 },
        mailbox: { gridX: 35, gridY: 15, hasLetter: true },
        telephone: { gridX: 22, gridY: 20, callCount: 0 },
        // 新增互动点
        coffeeCart: { gridX: 18, gridY: 12, boughtToday: false },
        wishingTree: { gridX: 8, gridY: 22, waterCount: 0 },
        bakery: { gridX: 28, gridY: 18 },
        busStop: { gridX: 5, gridY: 8 },
        birdNest: { gridX: 22, gridY: 32, isFed: false }
    }
};

const puddles = [
    { gridX: 11, gridY: 10 }, { gridX: 14, gridY: 15 }, { gridX: 22, gridY: 25 }, { gridX: 6, gridY: 24 }
];

// =======================
// 辅助与存档
// =======================
function saveGame() {
    const saveData = {
        gameState,
        player: {
            gridX: player.gridX,
            gridY: player.gridY,
            inventory: player.inventory,
            direction: player.direction
        }
    };
    try {
        localStorage.setItem('pixel_moyu_save', JSON.stringify(saveData));
        localStorage.setItem('pixel_moyu_save_v2', JSON.stringify(saveData));
    } catch (e) {
        console.warn('保存失败', e);
    }
}

function loadOrCreateGame() {
    initNewUniverse();
    try {
        const saved = localStorage.getItem('pixel_moyu_save_v2') || localStorage.getItem('pixel_moyu_save');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.gameState) {
                gameState = Object.assign(gameState, parsed.gameState);
                if (!gameState.checkInDays) gameState.checkInDays = [];
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

// 检测是否为阻挡格子
function isSolid(x, y) {
    const objs = gameState.worldObjects;
    if (x < 0 || y < 0 || x >= MAP_GRID || y >= MAP_GRID) return true;
    const blockObjs = ['vendingMachine','clawMachine','tv','chair','bench','telephone','guitarist','mailbox','coffeeCart','bakery','busStop','fountain','cat'];
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

function openCalendarModal() {
    const daysCount = gameState.checkInDays.length;
    let daysHtml = '';
    for (let i = 1; i <= 30; i++) {
        let isChecked = i <= daysCount;
        daysHtml += `<div class="calendar-day ${isChecked ? 'active' : ''}">${i}${isChecked ? '✨' : ''}</div>`;
    }
    const modal = document.createElement('div');
    modal.className = 'pixel-dialog calendar-modal';
    modal.id = 'calendarModal';
    modal.innerHTML = `
        <div class="pixel-dialog-title">📅 摸鱼打卡日历</div>
        <div class="pixel-dialog-content">
            <p>本月你已经连续来到摸鱼小镇 <strong>${daysCount}</strong> 天啦！</p>
            <div class="calendar-grid">${daysHtml}</div>
        </div>
        <button class="pixel-dialog-close" onclick="document.getElementById('calendarModal').remove()">收起日历</button>
    `;
    document.body.appendChild(modal);
}

// =======================
// 交互逻辑
// =======================
function addItemToInventory(type, name, emoji) {
    const existItem = player.inventory.find(i => i.type === type);
    if (existItem) {
        existItem.count++;
    } else {
        player.inventory.push({ type, name, emoji, count: 1 });
    }
    updateInventoryUI();
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

function checkInteractions() {
    if (activeDialog) return;
    let frontX = player.gridX;
    let frontY = player.gridY;
    // 面向判断（简单：判断当下格子）
    const objs = gameState.worldObjects;

    // 猫咪喂养
    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫现在会一直跟着你啦！");
            return;
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 肚子饿。如果你能找到 [🐟 小鱼干] 喂它就好了。");
            return;
        }
    }

    // 咖啡车
    if (frontX === objs.coffeeCart.gridX && frontY === objs.coffeeCart.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('coffee', '冰美式', '☕');
            saveGame();
            createDialogDOM("☕ 街角咖啡车", "用 [🪙 硬币] 兑换了一杯【☕ 冰美式】！");
        } else {
            createDialogDOM("☕ 街角咖啡车", "投一枚 [🪙 硬币] 就能换一杯冰美式哦。");
        }
        return;
    }

    // 许愿树
    if (frontX === objs.wishingTree.gridX && frontY === objs.wishingTree.gridY) {
        const waterIdx = player.inventory.findIndex(i => i.type === 'water');
        if (waterIdx !== -1) {
            player.inventory.splice(waterIdx, 1);
            objs.wishingTree.waterCount++;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🌳 灵感许愿树", "你用【💧 露水滴】浇灌了许愿树，灵感+999！");
        } else {
            createDialogDOM("🌳 灵感许愿树", "如果你收集到了 [💧 露水滴]，可以来浇灌它。");
        }
        return;
    }

    // 面包店
    if (frontX === objs.bakery.gridX && frontY === objs.bakery.gridY) {
        createDialogDOM("🥐 烘焙小屋", "门口飘着刚出炉的香气～ 今日面包可免费“闻”哦。");
        return;
    }

    // 夹娃娃机
    if (frontX === objs.clawMachine.gridX && frontY === objs.clawMachine.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            createDialogDOM("夹娃娃机", "机械爪在移动……");
            setTimeout(() => {
                if (Math.random() < 0.5) {
                    addItemToInventory('doll', '绝版小熊', '🧸');
                    createDialogDOM("夹娃娃机", "✨ 哇！抓到了一只【🧸 绝版小熊】！");
                } else {
                    createDialogDOM("夹娃娃机", "爪子滑了一下，差一点点！再试一次吧！");
                }
                saveGame();
            }, 800);
        } else {
            createDialogDOM("夹娃娃机", "抓一次娃娃需要一枚 [🪙 硬币]。");
        }
        return;
    }

    // 邮箱
    if (frontX === objs.mailbox.gridX && frontY === objs.mailbox.gridY) {
        if (objs.mailbox.hasLetter) {
            objs.mailbox.hasLetter = false;
            saveGame();
            const letters = [
                "💌 明信片：'世界很大，不要忘记吃饭。'",
                "💌 匿名纸条：'好运会降临给你。'",
                "💌 小纸条：'摸鱼也要注意身体噢。'"
            ];
            createDialogDOM("📬 治愈邮箱", `<strong>${letters[Math.floor(Math.random() * letters.length)]}</strong>`);
        } else {
            const flowerIdx = player.inventory.findIndex(i => i.type === 'flower');
            if (flowerIdx !== -1) {
                player.inventory.splice(flowerIdx, 1);
                objs.mailbox.hasLetter = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("📬 治愈邮箱", "你把花放进了邮箱，为陌生人留下温暖。");
            } else {
                createDialogDOM("📬 治愈邮箱", "空空如也，如果你有 [🌼 小雏菊] 可以放进去。");
            }
        }
        return;
    }

    // 喷泉
    if (frontX === objs.fountain.gridX && frontY === objs.fountain.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            saveGame();
            const fortunes = [
                "✨ 大吉！今天适合温柔摸鱼。",
                "✨ 中吉！小心老板的巡视。",
                "✨ 小确幸：会遇见温暖的事。"
            ];
            createDialogDOM("⛲ 许愿喷泉", fortunes[Math.floor(Math.random() * fortunes.length)]);
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
            createDialogDOM("⛲ 许愿喷泉", "朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！");
        }
        return;
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
        createDialogDOM("🛋️ 挂机长椅", "你坐在了长椅上。整个人放松了... (按任意方向键可起立)");
    }
}

// =======================
// 输入与巡逻 NPC 行为
// =======================
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'escape') {
        toggleBossMode();
        return;
    }
    keysPressed[key] = true;
    // 交互键：空格 或 enter 或 e
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
    if (player.isMoving || isPaused || player.isSitting || activeDialog || isBossMode) return;
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
    const tv = gameState.worldObjects.tv;
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
    spawnFloatingBubble("✨ 奇妙摸鱼城已刷新！");
}

// 绘制
function draw() {
    // 清空背景（index.html 的 canvas 背景色会被覆盖）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 简单背景色
    ctx.fillStyle = '#a6d8ff'; // 天空蓝
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 相机使角色居中
    const camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    const camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;
    const startX = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endX = Math.min(MAP_GRID, startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1);
    const endY = Math.min(MAP_GRID, startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1);

    // 地图绘制
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;
            const tileType = gameState.gameMap[y] ? gameState.gameMap[y][x] : 0;
            if (tileType === 1) ctx.fillStyle = '#a8a7a1'; // 石子
            else if (tileType === 2) ctx.fillStyle = '#81c784'; // 花地
            else ctx.fillStyle = '#a2d149'; // 草地
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

    // 绘制物件（简化图形）
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

    drawSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, '#e74c3c', '🥤');
    drawSprite(8, 15, '#fd79a8', '👧');
    drawSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, '#9b59b6', '🧸');
    drawSprite(objs.chair.gridX, objs.chair.gridY, '#d4a574', '🛋️');
    drawSprite(objs.coffeeCart.gridX, objs.coffeeCart.gridY, '#d35400', '☕');
    drawSprite(objs.wishingTree.gridX, objs.wishingTree.gridY, '#27ae60', '🌳');
    drawSprite(objs.bakery.gridX, objs.bakery.gridY, '#f39c12', '🥐');
    drawSprite(objs.busStop.gridX, objs.busStop.gridY, '#2980b9', '🚏');
    drawSprite(objs.fountain.gridX, objs.fountain.gridY, '#3498db', '⛲');

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

    // 绘制巡逻 NPC（小葵）
    const wnx = wanderingNpc.pixelX - camX;
    const wny = wanderingNpc.pixelY - camY;
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(wnx + 6, wny + 2, 20, 6); // 帽
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(wnx + 8, wny + 8, 16, 8); // 脸
    ctx.fillStyle = '#74b9ff'; ctx.fillRect(wnx + 6, wny + 16, 20, 14); // 衣

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
    ctx.fillText('🐱', catX + 8, catY + 22);

    // 主角绘制（像素化简化版）
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;
    ctx.fillStyle = '#5c3d2e'; // 头发
    ctx.fillRect(px + 6, py + 0, 20, 6);
    ctx.fillStyle = '#ffeaa7';
    ctx.fillRect(px + 6, py + 4, 20, 10); // 脸
    ctx.fillStyle = '#ff7675';
    ctx.fillRect(px + 4, py + 14, 24, 16); // 衣裙
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

// 在页面右上角注入“📅 摸鱼打卡”按钮（若不存在）
setTimeout(() => {
    if (!document.getElementById('calendarBtn')) {
        const btn = document.createElement('button');
        btn.id = 'calendarBtn';
        btn.innerHTML = '📅 摸鱼日历';
        btn.style.cssText = 'position:fixed;top:15px;right:15px;padding:8px 15px;background:#6c5ce7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;z-index:9999;box-shadow:0 4px 8px rgba(0,0,0,0.2);';
        btn.onclick = openCalendarModal;
        document.body.appendChild(btn);
    }
    createDialogDOM("✨ 摸鱼小镇 2.0 大升级！", "1. 探索地图，寻找随机走动的小葵吧！<br>2. 点击右上角的【📅 摸鱼日历】可查看你的月度连续打卡！");
}, 300);
