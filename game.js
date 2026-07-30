// ==========================================
// 💡【摸鱼小镇 2.0 精致版】自动清理历史严重 Bug
// ==========================================
localStorage.removeItem('pixel_moyu_save'); 

// ==========================================
// 1. 游戏基础配置与画质增强
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 开启像素级抗锯齿，确保像素颗粒精细不模糊
ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 32;       
const MAP_GRID = 50;        
const VIEW_WIDTH = 800;     
const VIEW_HEIGHT = 600;    

let isPaused = false;
let isBossMode = false;
let activeDialog = null;    

// 玩家数据结构（默认出生在空旷区 10, 10）
const player = {
    gridX: 10,             
    gridY: 10,             
    pixelX: 10 * TILE_SIZE,
    pixelY: 10 * TILE_SIZE,
    targetPixelX: 10 * TILE_SIZE,
    targetPixelY: 10 * TILE_SIZE,
    moveSpeed: 4,          
    isMoving: false,       
    direction: 'down',     
    inventory: [],          
    isSitting: false,       
    sitTimer: 0
};

let particles = [];
const keysPressed = {};

// ==========================================
// 2. 世界对象、新 NPC 巡逻与打卡日历数据
// ==========================================
const MAP_REFRESH_INTERVAL = 2 * 60 * 60 * 1000; 

// 🚶‍♀️ 新新增：在地图里随机走动巡逻的小人（小狗狗与散步少女）
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
        "🐱 你看到那只流浪小猫了吗？听说喂它小鱼干它就会一直跟着你！"
    ]
};

let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    // 📅 打卡日历系统：记录月度进入游戏的所有日期 (格式: YYYY-MM-DD)
    checkInDays: [],
    worldObjects: {
        tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
        chair: { gridX: 14, gridY: 8 },
        cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] },
        fountain: { gridX: 30, gridY: 30 },
        bench: { gridX: 11, gridY: 18, isCleaned: false },
        telephone: { gridX: 22, gridY: 7, callCount: 0 },
        guitarist: { gridX: 5, gridY: 25, isTipped: false },
        vendingMachine: { gridX: 15, gridY: 12 },
        clawMachine: { gridX: 25, gridY: 10 },
        mailbox: { gridX: 35, gridY: 15, hasLetter: true },

        // ✨ 5 个全新的趣味互动点：
        coffeeCart: { gridX: 18, gridY: 12, boughtToday: false },  // ☕ 1. 移动咖啡车
        wishingTree: { gridX: 8, gridY: 22, waterCount: 0 },       // 🌳 2. 灵感许愿树
        bakery: { gridX: 28, gridY: 18 },                          // 🥐 3. 街角面包店
        busStop: { gridX: 5, gridY: 8 },                           // 🚏 4. 摸鱼公交站
        birdNest: { gridX: 22, gridY: 32, isFed: false }           // 🐦 5. 树梢鸟窝
    }
};

function isSolid(x, y) {
    const objs = gameState.worldObjects;
    if (x === objs.vendingMachine.gridX && y === objs.vendingMachine.gridY) return true; 
    if (x === objs.clawMachine.gridX && y === objs.clawMachine.gridY) return true; 
    if (x === objs.tv.gridX && y === objs.tv.gridY) return true; 
    if (x === objs.chair.gridX && y === objs.chair.gridY) return true; 
    if (x === objs.fountain.gridX && y === objs.fountain.gridY) return true; 
    if (x === objs.bench.gridX && y === objs.bench.gridY) return true; 
    if (x === objs.telephone.gridX && y === objs.telephone.gridY) return true; 
    if (x === objs.guitarist.gridX && y === objs.guitarist.gridY) return true; 
    if (x === objs.mailbox.gridX && y === objs.mailbox.gridY) return true; 
    if (x === objs.coffeeCart.gridX && y === objs.coffeeCart.gridY) return true;
    if (x === objs.bakery.gridX && y === objs.bakery.gridY) return true;
    if (x === objs.busStop.gridX && y === objs.busStop.gridY) return true;
    return false;
}

function generateRandomItems() {
    const items = [];
    const pool = [
        { type: 'coin', name: '硬币', emoji: '🪙', color: '#f1c40f' },
        { type: 'fish', name: '小鱼干', emoji: '🐟', color: '#3498db' },
        { type: 'trash', name: '废纸团', emoji: '🗑️', color: '#95a5a6' },
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' },
        { type: 'water', name: '露水滴', emoji: '💧', color: '#74b9ff' }
    ];
    
    for (let i = 0; i < 35; i++) {
        let rx = Math.floor(Math.random() * MAP_GRID);
        let ry = Math.floor(Math.random() * MAP_GRID);
        if (!isSolid(rx, ry) && (rx !== 10 || ry !== 10)) {
            const proto = pool[Math.floor(Math.random() * pool.length)];
            items.push({
                id: `item_${Date.now()}_${i}`,
                ...proto,
                gridX: rx,
                gridY: ry
            });
        }
    }
    return items;
}

// 📅 打卡日历维护系统
function handleDailyCheckIn() {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    if (!gameState.checkInDays.includes(today)) {
        gameState.checkInDays.push(today);
        saveGame();
    }
}

function loadOrCreateGame() {
    const saved = localStorage.getItem('pixel_moyu_save_v2');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState = parsed.gameState;
            if (!gameState.checkInDays) gameState.checkInDays = [];
        } catch(e) {
            initNewUniverse();
        }
    } else {
        initNewUniverse();
    }

    handleDailyCheckIn();

    isPaused = false;
    isBossMode = false;
    activeDialog = null;
    player.isSitting = false;

    player.gridX = 10;
    player.gridY = 10;
    player.pixelX = player.gridX * TILE_SIZE;
    player.pixelY = player.gridY * TILE_SIZE;
    player.targetPixelX = player.pixelX;
    player.targetPixelY = player.pixelY;
}

function initNewUniverse() {
    gameState.lastRefreshTime = Date.now();
    gameState.checkInDays = [];
    gameState.gameMap = [];
    for (let y = 0; y < MAP_GRID; y++) {
        gameState.gameMap[y] = [];
        for (let x = 0; x < MAP_GRID; x++) {
            // 地形生成：0 草地，1 石子路，2 鲜花小径
            let rand = Math.random();
            gameState.gameMap[y][x] = rand < 0.1 ? 1 : (rand < 0.18 ? 2 : 0);
        }
    }
    gameState.mapItems = generateRandomItems();
}

function saveGame() {
    const saveData = {
        gameState: gameState,
        player: {
            gridX: player.gridX,
            gridY: player.gridY,
            inventory: player.inventory,
            direction: player.direction
        }
    };
    localStorage.setItem('pixel_moyu_save_v2', JSON.stringify(saveData));
}

// ==========================================
// 3. 随机巡逻 NPC 智能逻辑与连续按键响应
// ==========================================
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
        if (wanderingNpc.moveTimer > 60) { // 每隔一会儿随机向上下左右走动
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

    // 💡 自动碰撞检测：如果玩家跟巡逻小人撞在同一个格子，立刻开启闲聊！
    if (player.gridX === wanderingNpc.gridX && player.gridY === wanderingNpc.gridY && !activeDialog) {
        const text = wanderingNpc.dialogs[Math.floor(Math.random() * wanderingNpc.dialogs.length)];
        createDialogDOM(`🚶‍♀️ 偶遇 ${wanderingNpc.name}`, text);
    }
}

window.addEventListener('keydown', (e) => {
    if (isBossMode) return;
    const key = e.key.toLowerCase();
    
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed[key] = true;
    }

    if (e.key === 'Escape') {
        e.preventDefault();
        toggleBossMode();
        return;
    }

    if (isPaused || player.isSitting || activeDialog) {
        if (activeDialog && (key === 'e' || keysPressed[key])) {
            removeDialogDOM();
        }
        if (player.isSitting && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
            player.isSitting = false;
            player.gridY += 1;
            player.targetPixelY = player.gridY * TILE_SIZE;
            player.pixelY = player.targetPixelY;
        }
        return;
    }

    if (key === 'e') {
        checkInteractions();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed[key] = false;
    }
});

function checkContinuousInput() {
    if (player.isMoving || isPaused || player.isSitting || activeDialog || isBossMode) return;

    let nextGridX = player.gridX;
    let nextGridY = player.gridY;
    let newDir = player.direction;
    let wantsToMove = false;

    if (keysPressed['w'] || keysPressed['arrowup']) { nextGridY--; newDir = 'up'; wantsToMove = true; }
    else if (keysPressed['s'] || keysPressed['arrowdown']) { nextGridY++; newDir = 'down'; wantsToMove = true; }
    else if (keysPressed['a'] || keysPressed['arrowleft']) { nextGridX--; newDir = 'left'; wantsToMove = true; }
    else if (keysPressed['d'] || keysPressed['arrowright']) { nextGridX++; newDir = 'right'; wantsToMove = true; }

    if (!wantsToMove) return;

    player.direction = newDir;

    if (nextGridX >= 0 && nextGridX < MAP_GRID && nextGridY >= 0 && nextGridY < MAP_GRID) {
        if (!isSolid(nextGridX, nextGridY)) {
            player.gridX = nextGridX;
            player.gridY = nextGridY;
            player.targetPixelX = player.gridX * TILE_SIZE;
            player.targetPixelY = player.gridY * TILE_SIZE;
            player.isMoving = true; 
        }
    }
}

// ==========================================
// 4. 对话框与 UI 交互模块
// ==========================================
function createDialogDOM(title, content) {
    removeDialogDOM(); 
    activeDialog = content;

    const dialog = document.createElement('div');
    dialog.className = 'pixel-dialog';
    dialog.id = 'activePixelDialog';

    dialog.innerHTML = `
        <div class="pixel-dialog-title">${title}</div>
        <div class="pixel-dialog-content">${content}</div>
        <button class="pixel-dialog-close" onclick="removeDialogDOM()">确认 (E)</button>
    `;
    document.body.appendChild(dialog);
}

function removeDialogDOM() {
    const dialog = document.getElementById('activePixelDialog');
    if (dialog) dialog.remove();
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

// 📅 打开“本月摸鱼打卡日历”窗口
function openCalendarModal() {
    const daysCount = gameState.checkInDays.length;
    let daysHtml = '';
    
    // 生成当月 30 天的打卡网格
    for (let i = 1; i <= 30; i++) {
        let isChecked = i <= daysCount; // 模拟亮起状态
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

// ==========================================
// 5. 5 个全新互动点与原版逻辑
// ==========================================
function checkInteractions() {
    let frontX = player.gridX;
    let frontY = player.gridY;
    if (player.direction === 'up') frontY--;
    if (player.direction === 'down') frontY++;
    if (player.direction === 'left') frontX--;
    if (player.direction === 'right') frontX++;

    const objs = gameState.worldObjects;

    // ✨ 新互动 1：☕ 街角咖啡车
    if (frontX === objs.coffeeCart.gridX && frontY === objs.coffeeCart.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('coffee', '冰美式', '☕');
            saveGame();
            createDialogDOM("☕ 街角咖啡车", "用 [🪙 硬币] 兑换了一杯【☕ 冰美式】！提神醒脑，摸鱼效率提升 100%！");
        } else {
            createDialogDOM("☕ 街角咖啡车", "“新鲜烘焙的咖啡！投一枚 [🪙 硬币] 就能换一杯冰美式哦。”");
        }
        return;
    }

    // ✨ 新互动 2：🌳 灵感许愿树
    if (frontX === objs.wishingTree.gridX && frontY === objs.wishingTree.gridY) {
        const waterIdx = player.inventory.findIndex(i => i.type === 'water');
        if (waterIdx !== -1) {
            player.inventory.splice(waterIdx, 1);
            objs.wishingTree.waterCount++;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🌳 灵感许愿树", "你用【💧 露水滴】浇灌了许愿树。树叶发出了柔和的金光！灵感+999！");
        } else {
            createDialogDOM("🌳 灵感许愿树", "一棵郁郁葱葱的大树。如果你收集到了路边闪烁的 [💧 露水滴]，可以来浇灌它。");
        }
        return;
    }

    // ✨ 新互动 3：🥐 街角面包店
    if (frontX === objs.bakery.gridX && frontY === objs.bakery.gridY) {
        createDialogDOM("🥐 烘焙小屋", "门口飘着刚出炉的菠萝包香气～ 门上贴着小纸条：“今天店长心情好，所有面包免费闻！”");
        return;
    }

    // ✨ 新互动 4：🚏 摸鱼站牌
    if (frontX === objs.busStop.gridX && frontY === objs.busStop.gridY) {
        createDialogDOM("🚏 摸鱼站牌", "下一班通往“下班放假号”的公交车还有 5 分钟到达，请乘客做好准备！");
        return;
    }

    // ✨ 新互动 5：🐦 树梢鸟窝
    if (frontX === objs.birdNest.gridX && frontY === objs.birdNest.gridY) {
        createDialogDOM("🐦 树梢的小鸟", "叽叽喳喳～ 树上的小鸟正快活地筑巢呢！");
        return;
    }

    // 原有猫咪、许愿喷泉、电话亭等逻辑保留
    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫香甜地吃下了小鱼干！它现在会一直跟着你啦！");
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 肚子正咕咕叫。如果能找到 [🐟 小鱼干] 喂它就好了。");
        }
        return;
    }

    if (frontX === objs.fountain.gridX && frontY === objs.fountain.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            saveGame();
            createDialogDOM("⛲ 许愿喷泉", "✨ 大吉！今天老板绝对不会转到你身后，安心摸鱼！");
        } else {
            createDialogDOM("⛲ 许愿喷泉", "朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！");
        }
        return;
    }
}

function addItemToInventory(type, name, emoji) {
    const existItem = player.inventory.find(i => i.type === type);
    if (existItem) existItem.count++;
    else player.inventory.push({ type: type, name: name, emoji: emoji, count: 1 });
    updateInventoryUI();
}

function updateInventoryUI() {
    const slotsContainer = document.getElementById('inventorySlots');
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    
    player.inventory.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'inventory-item';
        itemEl.innerHTML = `
            <span class="inventory-item-emoji">${item.emoji}</span>
            <span>${item.name}</span>
            <span class="inventory-item-count">${item.count}</span>
        `;
        slotsContainer.appendChild(itemEl);
    });
}

// ==========================================
// 6. 更精细的像素视觉美化绘制（画风升级）
// ==========================================
function update() {
    if (isPaused || isBossMode) return;
    checkContinuousInput();
    updateWanderingNpc();

    if (player.isMoving) {
        if (player.pixelX < player.targetPixelX) player.pixelX = Math.min(player.pixelX + player.moveSpeed, player.targetPixelX);
        else if (player.pixelX > player.targetPixelX) player.pixelX = Math.max(player.pixelX - player.moveSpeed, player.targetPixelX);

        if (player.pixelY < player.targetPixelY) player.pixelY = Math.min(player.pixelY + player.moveSpeed, player.targetPixelY);
        else if (player.pixelY > player.targetPixelY) player.pixelY = Math.max(player.pixelY - player.moveSpeed, player.targetPixelY);

        if (player.pixelX === player.targetPixelX && player.pixelY === player.targetPixelY) {
            const cat = gameState.worldObjects.cat;
            if (cat.isFollowing) {
                cat.history.push({ x: player.gridX, y: player.gridY });
                if (cat.history.length > 1) {
                    const trail = cat.history.shift();
                    cat.gridX = trail.x;
                    cat.gridY = trail.y;
                }
            }
            player.isMoving = false;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    let camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    let camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;

    camX = Math.max(0, Math.min(camX, MAP_GRID * TILE_SIZE - VIEW_WIDTH));
    camY = Math.max(0, Math.min(camY, MAP_GRID * TILE_SIZE - VIEW_HEIGHT));

    const startX = Math.floor(camX / TILE_SIZE);
    const endX = Math.min(startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1, MAP_GRID);
    const startY = Math.floor(camY / TILE_SIZE);
    const endY = Math.min(startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1, MAP_GRID);

    // 1. 地图网格丰富度渲染（加入了小石子路与鲜花点缀）
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            const tileType = gameState.gameMap[y] ? gameState.gameMap[y][x] : 0;
            if (tileType === 1) {
                ctx.fillStyle = '#a8a7a1'; // 灰色石子路
            } else if (tileType === 2) {
                ctx.fillStyle = '#81c784'; // 带有小黄花的草地
            } else {
                ctx.fillStyle = '#a2d149'; // 温和高质感的青草绿
            }
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            if (tileType === 2) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(screenX + 8, screenY + 8, 4, 4);
                ctx.fillRect(screenX + 20, screenY + 18, 4, 4);
            }
        }
    }

    const objs = gameState.worldObjects;

    // 2. 绘制各种建筑与场景组件（带黑边框美化）
    drawPixelSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, camX, camY, '#e74c3c', '🥤'); 
    drawPixelSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, camX, camY, '#9b59b6', '🧸'); 
    drawPixelSprite(objs.coffeeCart.gridX, objs.coffeeCart.gridY, camX, camY, '#d35400', '☕'); 
    drawPixelSprite(objs.wishingTree.gridX, objs.wishingTree.gridY, camX, camY, '#27ae60', '🌳'); 
    drawPixelSprite(objs.bakery.gridX, objs.bakery.gridY, camX, camY, '#f39c12', '🥐'); 
    drawPixelSprite(objs.busStop.gridX, objs.busStop.gridY, camX, camY, '#2980b9', '🚏'); 
    drawPixelSprite(objs.fountain.gridX, objs.fountain.gridY, camX, camY, '#3498db', '⛲'); 

    // 3. 绘制巡逻小人 (散步的小葵 - 带有黄色小帽子)
    const wnx = wanderingNpc.pixelX - camX;
    const wny = wanderingNpc.pixelY - camY;
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(wnx + 6, wny + 2, 20, 6); // 遮阳帽
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(wnx + 8, wny + 8, 16, 8); // 脸
    ctx.fillStyle = '#74b9ff'; ctx.fillRect(wnx + 6, wny + 16, 20, 14); // 蓝裙子

    // 4. 绘制地面拾取物品
    gameState.mapItems.forEach(item => {
        const ix = item.gridX * TILE_SIZE - camX;
        const iy = item.gridY * TILE_SIZE - camY;
        ctx.font = '16px sans-serif';
        ctx.fillText(item.emoji, ix + 8, iy + 22);
    });

    // 5. 绘制主角（精致粉红裙发带小女孩）
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;

    // 头发与蝴蝶结
    ctx.fillStyle = '#e84393'; ctx.fillRect(px + 4, py + 0, 24, 6); // 亮粉色头饰
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 2, py + 6, 6, 12);  // 左右双马尾
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 24, py + 6, 6, 12); 

    // 面部与眼睛
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(px + 6, py + 6, 20, 10);
    ctx.fillStyle = '#2d3436'; 
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 9, 3, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 9, 3, 3);

    // 小红裙
    ctx.fillStyle = '#ff7675'; ctx.fillRect(px + 4, py + 16, 24, 14);
}

function drawPixelSprite(gx, gy, camX, camY, color, emoji) {
    const sx = gx * TILE_SIZE - camX;
    const sy = gy * TILE_SIZE - camY;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.font = '16px sans-serif';
    ctx.fillText(emoji, sx + 8, sy + 22);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    const bossScreen = document.getElementById('bossKeyScreen');
    if (isBossMode) {
        gameContainer.style.display = 'none';
        bossScreen.classList.add('active');
    } else {
        bossScreen.classList.remove('active');
        gameContainer.style.display = 'flex';
    }
}

// 8. 启动与全局初始化
loadOrCreateGame(); 
updateInventoryUI();
loop();
setInterval(checkContinuousInput, 16);

// 在页面右上方注入“📅 摸鱼打卡”快捷按钮
setTimeout(() => {
    if (!document.getElementById('calendarBtn')) {
        const btn = document.createElement('button');
        btn.id = 'calendarBtn';
        btn.innerHTML = '📅 摸鱼日历';
        btn.style.cssText = 'position:fixed;top:15px;right:15px;padding:8px 15px;background:#6c5ce7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;z-index:99;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
        btn.onclick = openCalendarModal;
        document.body.appendChild(btn);
    }
    createDialogDOM("✨ 摸鱼小镇 2.0 大升级！", "1. 探索地图，寻找随机走动的小葵吧！<br>2. 点击右顶部的【📅 摸鱼日历】可查看你的月度连续打卡！");
}, 300);
