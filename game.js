// ==========================================
// 💡【摸鱼小镇 2.0 精致版】自动清理历史严重 Bug
// ==========================================
localStorage.removeItem('pixel_moyu_save'); 

// ==========================================
// 1. 游戏基础配置与画质增强
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 32;       
const MAP_GRID = 50;        
const VIEW_WIDTH = 800;     
const VIEW_HEIGHT = 600;    

let isPaused = false;
let isBossMode = false;
let activeDialog = null;    

// 玩家数据结构
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

const keysPressed = {};

// ==========================================
// 2. 世界对象、新 NPC 巡逻与打卡日历数据
// ==========================================
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
        "🌸 嗨！今天培训课程准备得怎么样啦？要和我一起散步放松下吗？",
        "🤫 我听说地图最右上角藏着神奇的许愿池哦！",
        "☕ 累了的话，可以去路边的咖啡车买杯冰美式恢复精神！",
        "🐱 你看到那只流浪小猫了吗？听说喂它小鱼干它就会一直跟着你！"
    ]
};

let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    checkInDays: [], // 存储打卡日期 (YYYY-MM-DD)
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

        coffeeCart: { gridX: 18, gridY: 12, boughtToday: false },
        wishingTree: { gridX: 8, gridY: 22, waterCount: 0 },
        bakery: { gridX: 28, gridY: 18 },
        busStop: { gridX: 5, gridY: 8 },
        birdNest: { gridX: 22, gridY: 32, isFed: false }
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

// 📅 打卡系统处理
function handleDailyCheckIn() {
    const today = new Date().toISOString().split('T')[0];
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
            if (parsed.player && parsed.player.inventory) {
                player.inventory = parsed.player.inventory;
            }
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
// 3. 随机巡逻 NPC 逻辑与键盘按键
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

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (e.key === 'Escape') {
        e.preventDefault();
        toggleBossMode();
        return;
    }

    if (isBossMode) return;

    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed[key] = true;
    }

    if (isPaused || player.isSitting || activeDialog) {
    if (isPaused || activeDialog) {
        if (activeDialog && (key === 'e' || keysPressed[key])) {
            removeDialogDOM();
        }
        return;
    }

    // 歇息/坐下状态按任意移动键或 E 站起
    if (player.isSitting) {
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e'].includes(key)) {
            player.isSitting = false;
            createDialogDOM("🧍 站起", "你伸了个懒腰，重新站了起来！");
            return;
        }
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

// 📅 将日历直接绘制/更新在侧边栏右下方
function renderEmbeddedCalendar() {
    let sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        // 如果没有侧边栏结构，动态构建右侧面板
        const gameContainer = document.getElementById('gameContainer') || document.body;
        sidebar = document.createElement('div');
        sidebar.id = 'sidebar';
        sidebar.style.cssText = 'width:240px;background:#2d3436;color:#fff;padding:15px;display:flex;flex-direction:column;gap:15px;box-sizing:border-box;border-left:4px solid #000;';
        gameContainer.appendChild(sidebar);
    }

    let calendarContainer = document.getElementById('embeddedCalendar');
    if (!calendarContainer) {
        calendarContainer = document.createElement('div');
        calendarContainer.id = 'embeddedCalendar';
        calendarContainer.style.cssText = 'background:#353b48;padding:10px;border-radius:8px;border:2px solid #57606f;margin-top:auto;';
        sidebar.appendChild(calendarContainer);
    }

    const animalEmojis = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐻', '🐥'];
    const todayEmoji = animalEmojis[new Date().getDate() % animalEmojis.length];

    const totalDays = gameState.checkInDays.length;
    let daysGridHtml = '';

    for (let i = 1; i <= 30; i++) {
        let isChecked = i <= totalDays;
        let isToday = i === totalDays; // 假设最新登录的这天为今天
        let isToday = i === totalDays; 

        let displaySymbol = '';
        if (isChecked) {
            displaySymbol = isToday ? todayEmoji : '✨';
        } else {
            displaySymbol = i;
        }

        daysGridHtml += `<div style="
            aspect-ratio:1;
            background:${isChecked ? (isToday ? '#6c5ce7' : '#00b894') : '#2f3542'};
            color:#fff;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:11px;
            font-weight:bold;
            border-radius:4px;
            border:${isToday ? '2px solid #fdcb6e' : 'none'};
        ">${displaySymbol}</div>`;
    }

    calendarContainer.innerHTML = `
        <div style="font-size:13px;font-weight:bold;margin-bottom:8px;color:#f1c40f;display:flex;justify-content:space-between;align-items:center;">
            <span>📅 摸鱼签到日历</span>
            <span style="font-size:11px;color:#a4b0be;">已到镇 ${totalDays} 天</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:4px;">
            ${daysGridHtml}
        </div>
    `;
}

// ==========================================
// 5. 互动逻辑与物品更新
// ==========================================
function checkInteractions() {
    // 1. 优先检查捡拾脚下或前方的地面物品
    const currentItemIdx = gameState.mapItems.findIndex(i => 
        (i.gridX === player.gridX && i.gridY === player.gridY)
    );
    if (currentItemIdx !== -1) {
        const item = gameState.mapItems.splice(currentItemIdx, 1)[0];
        addItemToInventory(item.type, item.name, item.emoji);
        saveGame();
        createDialogDOM("✨ 拾取物品", `你在地上捡到了【${item.emoji} ${item.name}】！已放入背包。`);
        return;
    }

    let frontX = player.gridX;
    let frontY = player.gridY;
    if (player.direction === 'up') frontY--;
    if (player.direction === 'down') frontY++;
    if (player.direction === 'left') frontX--;
    if (player.direction === 'right') frontX++;

    const frontItemIdx = gameState.mapItems.findIndex(i => i.gridX === frontX && i.gridY === frontY);
    if (frontItemIdx !== -1) {
        const item = gameState.mapItems.splice(frontItemIdx, 1)[0];
        addItemToInventory(item.type, item.name, item.emoji);
        saveGame();
        createDialogDOM("✨ 拾取物品", `你在面前捡到了【${item.emoji} ${item.name}】！已放入背包。`);
        return;
    }

    const objs = gameState.worldObjects;

    // 2. 交互判定
    if (frontX === objs.coffeeCart.gridX && frontY === objs.coffeeCart.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            player.inventory[coinIdx].count--;
            if (player.inventory[coinIdx].count <= 0) player.inventory.splice(coinIdx, 1);
            addItemToInventory('coffee', '冰美式', '☕');
            saveGame();
            createDialogDOM("☕ 街角咖啡车", "用 [🪙 硬币] 兑换了一杯【☕ 冰美式】！提神醒脑，写培训 PPT 效率提升 100%！");
        } else {
            createDialogDOM("☕ 街角咖啡车", "“新鲜烘焙的咖啡！投一枚 [🪙 硬币] 就能换一杯冰美式哦。”");
        }
        return;
    }

    if (frontX === objs.wishingTree.gridX && frontY === objs.wishingTree.gridY) {
        const waterIdx = player.inventory.findIndex(i => i.type === 'water');
        if (waterIdx !== -1) {
            player.inventory.splice(waterIdx, 1);
            player.inventory[waterIdx].count--;
            if (player.inventory[waterIdx].count <= 0) player.inventory.splice(waterIdx, 1);
            objs.wishingTree.waterCount++;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🌳 灵感许愿树", "你用【💧 露水滴】浇灌了许愿树。培训课件的灵感爆发！");
        } else {
            createDialogDOM("🌳 灵感许愿树", "一棵郁郁葱葱的大树。用 [💧 露水滴] 浇灌它能获得满满灵感！");
        }
        return;
    }

    if (frontX === objs.bakery.gridX && frontY === objs.bakery.gridY) {
        createDialogDOM("🥐 烘焙小屋", "门口飘着刚出炉的菠萝包香气～ 门上贴着小纸条：“今天店长心情好，所有面包免费闻！”");
        return;
    }

    if (frontX === objs.busStop.gridX && frontY === objs.busStop.gridY) {
        createDialogDOM("🚏 摸鱼站牌", "下一班通往“下班放假号”的公交车还有 5 分钟到达，请乘客做好准备！");
        return;
    }

    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            player.inventory[fishIdx].count--;
            if (player.inventory[fishIdx].count <= 0) player.inventory.splice(fishIdx, 1);
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
            player.inventory[coinIdx].count--;
            if (player.inventory[coinIdx].count <= 0) player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            saveGame();
            createDialogDOM("⛲ 许愿喷泉", "✨ 大吉！今天的培训讲座学员满意度将高达 100%！");
        } else {
            createDialogDOM("⛲ 许愿喷泉", "朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！");
        }
        return;
    }

    if (frontX === objs.vendingMachine.gridX && frontY === objs.vendingMachine.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory[coinIdx].count--;
            if (player.inventory[coinIdx].count <= 0) player.inventory.splice(coinIdx, 1);
            addItemToInventory('soda', '冰汽水', '🥤');
            saveGame();
            createDialogDOM("🥤 自动售货机", "投进【🪙 硬币】，叮咚~ 掉落了一瓶【🥤 冰汽水】！整个人都冰爽了起来。");
        } else {
            createDialogDOM("🥤 自动售货机", "售货机里摆满冰镇饮料。投一枚 [🪙 硬币] 就能购买。");
        }
        return;
    }

    if (frontX === objs.clawMachine.gridX && frontY === objs.clawMachine.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory[coinIdx].count--;
            if (player.inventory[coinIdx].count <= 0) player.inventory.splice(coinIdx, 1);
            addItemToInventory('doll', '可爱公仔', '🧸');
            saveGame();
            createDialogDOM("🧸 抓娃娃机", "机械爪一阵猛摇... 竟然真的抓到了【🧸 可爱公仔】！太幸运了！");
        } else {
            createDialogDOM("🧸 抓娃娃机", "充满童趣的娃娃机！需要投入 [🪙 硬币] 才能试一把。");
        }
        return;
    }

    if (frontX === objs.tv.gridX && frontY === objs.tv.gridY) {
        objs.tv.isOn = !objs.tv.isOn;
        saveGame();
        if (objs.tv.isOn) {
            createDialogDOM("📺 怀旧电视机", "电视机咔哒一声打开了！正播放着《摸鱼大师的修养》纪录片。");
        } else {
            createDialogDOM("📺 怀旧电视机", "电视机已关闭，屏幕呈一片漆黑。");
        }
        return;
    }

    if ((frontX === objs.chair.gridX && frontY === objs.chair.gridY) || 
        (frontX === objs.bench.gridX && frontY === objs.bench.gridY)) {
        player.isSitting = true;
        createDialogDOM("🪑 歇息片刻", "你舒服地坐了下来，感到浑身疲惫一扫而空...（按 WASD 或 E 键可站起）");
        return;
    }

    if (frontX === objs.telephone.gridX && frontY === objs.telephone.gridY) {
        objs.telephone.callCount++;
        saveGame();
        createDialogDOM("📞 街头电话亭", `嘟... 嘟... 电话那头发出了声音：“喂？这里是全国摸鱼热线，您是第 ${objs.telephone.callCount} 位拨通的幸运用户！”`);
        return;
    }

    if (frontX === objs.guitarist.gridX && frontY === objs.guitarist.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory[coinIdx].count--;
            if (player.inventory[coinIdx].count <= 0) player.inventory.splice(coinIdx, 1);
            objs.guitarist.isTipped = true;
            saveGame();
            createDialogDOM("🎸 流浪吉他手", "你打赏了一枚【🪙 硬币】。吉他手弹奏了一曲极为悠扬舒缓的民谣曲调，令人沉醉~");
        } else {
            createDialogDOM("🎸 流浪吉他手", "“嗨朋友，给点打赏 [🪙 硬币]，为你弹一首小镇抒情曲吧！”");
        }
        return;
    }

    if (frontX === objs.mailbox.gridX && frontY === objs.mailbox.gridY) {
        createDialogDOM("📮 复古邮箱", "打开邮箱看了一眼，里面有一封【摸鱼协会】寄来的感谢信：“感谢你为小镇繁荣做出的贡献！”");
        return;
    }

    if (frontX === objs.birdNest.gridX && frontY === objs.birdNest.gridY) {
        const flowerIdx = player.inventory.findIndex(i => i.type === 'flower');
        if (flowerIdx !== -1) {
            player.inventory[flowerIdx].count--;
            if (player.inventory[flowerIdx].count <= 0) player.inventory.splice(flowerIdx, 1);
            objs.birdNest.isFed = true;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🪹 树顶鸟巢", "你在鸟巢旁放下了一朵【🌼 小雏菊】，小鸟快乐地叽叽喳喳叫了起来！");
        } else {
            createDialogDOM("🪹 树顶鸟巢", "树上的小鸟正唧唧喳喳地筑巢。送它一朵 [🌼 小雏菊] 装饰小家吧！");
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
// 6. 绘图与更新渲染循环
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

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            const tileType = gameState.gameMap[y] ? gameState.gameMap[y][x] : 0;
            if (tileType === 1) ctx.fillStyle = '#a8a7a1';
            else if (tileType === 2) ctx.fillStyle = '#81c784';
            else ctx.fillStyle = '#a2d149';

            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            if (tileType === 2) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(screenX + 8, screenY + 8, 4, 4);
                ctx.fillRect(screenX + 20, screenY + 18, 4, 4);
            }
        }
    }

    const objs = gameState.worldObjects;

    // 绘制所有场景地图设施对象
    drawPixelSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, camX, camY, '#e74c3c', '🥤'); 
    drawPixelSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, camX, camY, '#9b59b6', '🧸'); 
    drawPixelSprite(objs.coffeeCart.gridX, objs.coffeeCart.gridY, camX, camY, '#d35400', '☕'); 
    drawPixelSprite(objs.wishingTree.gridX, objs.wishingTree.gridY, camX, camY, '#27ae60', '🌳'); 
    drawPixelSprite(objs.bakery.gridX, objs.bakery.gridY, camX, camY, '#f39c12', '🥐'); 
    drawPixelSprite(objs.busStop.gridX, objs.busStop.gridY, camX, camY, '#2980b9', '🚏'); 
    drawPixelSprite(objs.fountain.gridX, objs.fountain.gridY, camX, camY, '#3498db', '⛲'); 
    drawPixelSprite(objs.tv.gridX, objs.tv.gridY, camX, camY, '#34495e', objs.tv.isOn ? '📺' : '🖥️'); 
    drawPixelSprite(objs.chair.gridX, objs.chair.gridY, camX, camY, '#e67e22', '🪑'); 
    drawPixelSprite(objs.bench.gridX, objs.bench.gridY, camX, camY, '#d35400', '🪑'); 
    drawPixelSprite(objs.telephone.gridX, objs.telephone.gridY, camX, camY, '#c0392b', '📞'); 
    drawPixelSprite(objs.guitarist.gridX, objs.guitarist.gridY, camX, camY, '#f39c12', '🎸'); 
    drawPixelSprite(objs.mailbox.gridX, objs.mailbox.gridY, camX, camY, '#27ae60', '📮'); 
    drawPixelSprite(objs.birdNest.gridX, objs.birdNest.gridY, camX, camY, '#16a085', '🪹'); 

    // 绘制小猫
    const cx = objs.cat.gridX * TILE_SIZE - camX;
    const cy = objs.cat.gridY * TILE_SIZE - camY;
    ctx.font = '16px sans-serif';
    ctx.fillText('🐱', cx + 8, cy + 22);

    // 绘制 NPC
    // 绘制 NPC (散步的小葵)
    const wnx = wanderingNpc.pixelX - camX;
    const wny = wanderingNpc.pixelY - camY;
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(wnx + 6, wny + 2, 20, 6);
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(wnx + 8, wny + 8, 16, 8);
    ctx.fillStyle = '#74b9ff'; ctx.fillRect(wnx + 6, wny + 16, 20, 14);

    // 绘制地面物品
    // 绘制地面掉落物品
    gameState.mapItems.forEach(item => {
        const ix = item.gridX * TILE_SIZE - camX;
        const iy = item.gridY * TILE_SIZE - camY;
        ctx.font = '16px sans-serif';
        ctx.fillText(item.emoji, ix + 8, iy + 22);
    });

    // 绘制主角
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;

    ctx.fillStyle = '#e84393'; ctx.fillRect(px + 4, py + 0, 24, 6);
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 2, py + 6, 6, 12);
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 24, py + 6, 6, 12); 
    if (player.isSitting) {
        // 坐下姿势
        ctx.fillStyle = '#ffeaa7'; ctx.fillRect(px + 6, py + 10, 20, 10);
        ctx.fillStyle = '#2d3436'; ctx.fillRect(px + 10, py + 13, 3, 3); ctx.fillRect(px + 17, py + 13, 3, 3);
        ctx.fillStyle = '#ff7675'; ctx.fillRect(px + 4, py + 20, 24, 10);
    } else {
        // 正常站立姿势
        ctx.fillStyle = '#e84393'; ctx.fillRect(px + 4, py + 0, 24, 6);
        ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 2, py + 6, 6, 12);
        ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 24, py + 6, 6, 12); 

    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(px + 6, py + 6, 20, 10);
    ctx.fillStyle = '#2d3436'; 
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 9, 3, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 9, 3, 3);
        ctx.fillStyle = '#ffeaa7'; ctx.fillRect(px + 6, py + 6, 20, 10);
        ctx.fillStyle = '#2d3436'; 
        if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 9, 3, 3);
        if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 9, 3, 3);

    ctx.fillStyle = '#ff7675'; ctx.fillRect(px + 4, py + 16, 24, 14);
        ctx.fillStyle = '#ff7675'; ctx.fillRect(px + 4, py + 16, 24, 14);
    }
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

// ==========================================
// 7. 老板键（Training 培训师专业看板 + 实时系统时间 + 返回按钮）
// ==========================================
function updateBossTime() {
    const timeEl = document.getElementById('bossClock');
    if (timeEl) {
        const now = new Date();
        timeEl.innerText = now.toLocaleTimeString();
    }
}
setInterval(updateBossTime, 1000);

function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    let bossScreen = document.getElementById('bossKeyScreen');

    if (isBossMode) {
        gameContainer.style.display = 'none';
        if (gameContainer) gameContainer.style.display = 'none';

        if (!bossScreen) {
            bossScreen = document.createElement('div');
            bossScreen.id = 'bossKeyScreen';
            document.body.appendChild(bossScreen);
        }

        bossScreen.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#f4f6f9;z-index:99999;padding:30px;font-family:Segoe UI, sans-serif;color:#2c3e50;box-sizing:border-box;overflow-y:auto;';

        bossScreen.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:15px;margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">🎓</span>
                    <div>
                        <h2 style="margin:0;font-size:20px;color:#1e293b;">企业培训与学员发展管理系统 (Enterprise Training LMS)</h2>
                        <span style="font-size:12px;color:#64748b;">培训部门 · 内部课件与学员考勤看板</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:20px;">
                    <div style="text-align:right;">
                        <div style="font-size:12px;color:#64748b;">系统当前时间</div>
                        <div id="bossClock" style="font-size:18px;font-weight:bold;color:#0f172a;">${new Date().toLocaleTimeString()}</div>
                    </div>
                    <button onclick="toggleBossMode()" style="background:#3b82f6;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        ↩ 返回工作面板 (Esc)
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:15px;margin-bottom:25px;">
                <div style="background:#fff;padding:15px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;color:#64748b;">本月已排培训课时</div>
                    <div style="font-size:22px;font-weight:bold;color:#1e293b;margin-top:5px;">48 课时</div>
                </div>
                <div style="background:#fff;padding:15px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;color:#64748b;">参训学员覆盖率</div>
                    <div style="font-size:22px;font-weight:bold;color:#10b981;margin-top:5px;">94.2%</div>
                </div>
                <div style="background:#fff;padding:15px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;color:#64748b;">课程满意度评分 (NPS)</div>
                    <div style="font-size:22px;font-weight:bold;color:#3b82f6;margin-top:5px;">4.85 / 5.0</div>
                </div>
                <div style="background:#fff;padding:15px;border-radius:8px;border:1px solid #e2e8f0;">
                    <div style="font-size:12px;color:#64748b;">待批改学员作业/考核</div>
                    <div style="font-size:22px;font-weight:bold;color:#f59e0b;margin-top:5px;">12 份</div>
                </div>
            </div>

            <div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:20px;">
                <h3 style="margin-top:0;font-size:16px;color:#334155;">📚 2026 年三季度培训课程排期与进度跟踪</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
                    <thead>
                        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;color:#475569;">
                            <th style="padding:10px;">课程名称</th>
                            <th style="padding:10px;">目标学员</th>
                            <th style="padding:10px;">培训讲师</th>
                            <th style="padding:10px;">课程状态</th>
                            <th style="padding:10px;">完播/练习率</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:12px;">【新员工入职】企业文化与合规培训 2026 版</td>
                            <td>Q3 集中入职新员工</td>
                            <td>Training 组</td>
                            <td><span style="background:#dcfce7;color:#15803d;padding:3px 8px;border-radius:12px;font-size:11px;">进行中</span></td>
                            <td>98%</td>
                        </tr>
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:12px;">【领导力提升】中层管理者沟通与跨部门协作工作坊</td>
                            <td>各部门 Team Lead</td>
                            <td>外部特聘专家</td>
                            <td><span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:12px;font-size:11px;">开发筹备中</span></td>
                            <td>45%</td>
                        </tr>
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:12px;">【专业技能】AI 工具赋能日常办公效率实战讲座</td>
                            <td>全公司员工 (自愿报名)</td>
                            <td>Training 组</td>
                            <td><span style="background:#dcfce7;color:#15803d;padding:3px 8px;border-radius:12px;font-size:11px;">进行中</span></td>
                            <td>88%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        bossScreen.style.display = 'block';
    } else {
        if (bossScreen) bossScreen.style.display = 'none';
        gameContainer.style.display = 'flex';
        if (gameContainer) gameContainer.style.display = 'flex';
    }
}

// 8. 启动与全局初始化
loadOrCreateGame(); 
updateInventoryUI();
renderEmbeddedCalendar();
loop();
setInterval(checkContinuousInput, 16);
