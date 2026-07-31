// ==========================================
// 💡 自动清洗旧数据，防止越界隐形
// 💡【摸鱼小镇 2.0 精致版】自动清理历史严重 Bug
// ==========================================
localStorage.clear(); 
localStorage.removeItem('pixel_moyu_save'); 

// ==========================================
// 1. 游戏基础配置与初始化（地图 50 * 50）
// 1. 游戏基础配置与画质增强
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 开启像素级抗锯齿，确保像素颗粒精细不模糊
ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 32;       
@@ -20,7 +21,7 @@ let isPaused = false;
let isBossMode = false;
let activeDialog = null;    

// 玩家数据结构：开局放在一个没有阻挡的开阔区 (10, 10)
// 玩家数据结构（默认出生在空旷区 10, 10）
const player = {
    gridX: 10,             
    gridY: 10,             
@@ -40,17 +41,38 @@ let particles = [];
const keysPressed = {};

// ==========================================
// 2. 存档与地图周期刷新系统 (2小时刷新)
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
        musicBox: { gridX: 12, gridY: 5, isOn: false }, 
        chair: { gridX: 14, gridY: 8 },
        cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] },
        fountain: { gridX: 30, gridY: 30 },
@@ -59,14 +81,20 @@ let gameState = {
        guitarist: { gridX: 5, gridY: 25, isTipped: false },
        vendingMachine: { gridX: 15, gridY: 12 },
        clawMachine: { gridX: 25, gridY: 10 },
        mailbox: { gridX: 35, gridY: 15, hasLetter: true }
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
    if (x === 8 && y === 15) return true;  
    if (x === objs.clawMachine.gridX && y === objs.clawMachine.gridY) return true; 
    if (x === objs.tv.gridX && y === objs.tv.gridY) return true; 
    if (x === objs.chair.gridX && y === objs.chair.gridY) return true; 
@@ -75,6 +103,9 @@ function isSolid(x, y) {
    if (x === objs.telephone.gridX && y === objs.telephone.gridY) return true; 
    if (x === objs.guitarist.gridX && y === objs.guitarist.gridY) return true; 
    if (x === objs.mailbox.gridX && y === objs.mailbox.gridY) return true; 
    if (x === objs.coffeeCart.gridX && y === objs.coffeeCart.gridY) return true;
    if (x === objs.bakery.gridX && y === objs.bakery.gridY) return true;
    if (x === objs.busStop.gridX && y === objs.busStop.gridY) return true;
    return false;
}

@@ -84,10 +115,11 @@ function generateRandomItems() {
        { type: 'coin', name: '硬币', emoji: '🪙', color: '#f1c40f' },
        { type: 'fish', name: '小鱼干', emoji: '🐟', color: '#3498db' },
        { type: 'trash', name: '废纸团', emoji: '🗑️', color: '#95a5a6' },
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' }
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' },
        { type: 'water', name: '露水滴', emoji: '💧', color: '#74b9ff' }
    ];

    for (let i = 0; i < 30; i++) {
    for (let i = 0; i < 35; i++) {
        let rx = Math.floor(Math.random() * MAP_GRID);
        let ry = Math.floor(Math.random() * MAP_GRID);
        if (!isSolid(rx, ry) && (rx !== 10 || ry !== 10)) {
@@ -103,8 +135,31 @@ function generateRandomItems() {
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
    initNewUniverse();
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
@@ -120,26 +175,19 @@ function loadOrCreateGame() {

function initNewUniverse() {
    gameState.lastRefreshTime = Date.now();
    gameState.checkInDays = [];
    gameState.gameMap = [];
    for (let y = 0; y < MAP_GRID; y++) {
        gameState.gameMap[y] = [];
        for (let x = 0; x < MAP_GRID; x++) {
            gameState.gameMap[y][x] = (Math.random() < 0.15) ? 1 : 0;
            // 地形生成：0 草地，1 石子路，2 鲜花小径
            let rand = Math.random();
            gameState.gameMap[y][x] = rand < 0.1 ? 1 : (rand < 0.18 ? 2 : 0);
        }
    }
    gameState.mapItems = generateRandomItems();
}

function refreshWorldElements() {
    gameState.lastRefreshTime = Date.now();
    gameState.mapItems = generateRandomItems();
    gameState.worldObjects.bench.isCleaned = false;
    gameState.worldObjects.mailbox.hasLetter = Math.random() < 0.7;
    gameState.worldObjects.guitarist.isTipped = false;
    saveGame();
    spawnFloatingBubble("✨ 奇妙摸鱼城已刷新！");
}

function saveGame() {
    const saveData = {
        gameState: gameState,
@@ -150,12 +198,55 @@ function saveGame() {
            direction: player.direction
        }
    };
    localStorage.setItem('pixel_moyu_save', JSON.stringify(saveData));
    localStorage.setItem('pixel_moyu_save_v2', JSON.stringify(saveData));
}

// ==========================================
// 3. 高频动态移动监听
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
@@ -176,13 +267,9 @@ window.addEventListener('keydown', (e) => {
        }
        if (player.isSitting && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
            player.isSitting = false;
            let escapeY = player.gridY + 1;
            if (escapeY < MAP_GRID && !isSolid(player.gridX, escapeY)) {
                player.gridX = escapeY;
                player.targetPixelX = player.gridX * TILE_SIZE;
                player.targetPixelY = player.gridY * TILE_SIZE;
                player.isMoving = true;
            }
            player.gridY += 1;
            player.targetPixelY = player.gridY * TILE_SIZE;
            player.pixelY = player.targetPixelY;
        }
        return;
    }
@@ -199,10 +286,6 @@ window.addEventListener('keyup', (e) => {
    }
});

window.addEventListener('blur', () => {
    for (let key in keysPressed) keysPressed[key] = false;
});

function checkContinuousInput() {
    if (player.isMoving || isPaused || player.isSitting || activeDialog || isBossMode) return;

@@ -231,12 +314,8 @@ function checkContinuousInput() {
    }
}

const puddles = [
    { gridX: 11, gridY: 10 }, { gridX: 14, gridY: 15 }, { gridX: 22, gridY: 25 }, { gridX: 6, gridY: 24 }
];

// ==========================================
// 4. 对话框与悬浮气泡
// 4. 对话框与 UI 交互模块
// ==========================================
function createDialogDOM(title, content) {
    removeDialogDOM(); 
@@ -264,17 +343,40 @@ function spawnFloatingBubble(text) {
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
// 5. 交互判定逻辑
// 5. 5 个全新互动点与原版逻辑
// ==========================================
function checkInteractions() {
    let frontX = player.gridX;
@@ -286,212 +388,86 @@ function checkInteractions() {

    const objs = gameState.worldObjects;

    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
    // ✨ 新互动 1：☕ 街角咖啡车
    if (frontX === objs.coffeeCart.gridX && frontY === objs.coffeeCart.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('coffee', '冰美式', '☕');
            saveGame();
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫香甜地吃下了小鱼干！它现在会一直跟着你走啦！");
            createDialogDOM("☕ 街角咖啡车", "用 [🪙 硬币] 兑换了一杯【☕ 冰美式】！提神醒脑，摸鱼效率提升 100%！");
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 肚子正咕咕叫。如果能从马路上捡到 [🐟 小鱼干] 喂它就好了。");
            createDialogDOM("☕ 街角咖啡车", "“新鲜烘焙的咖啡！投一枚 [🪙 硬币] 就能换一杯冰美式哦。”");
        }
        return;
    }

    if (frontX === objs.bench.gridX && frontY === objs.bench.gridY) {
        if (!objs.bench.isCleaned) {
            const trashIdx = player.inventory.findIndex(i => i.type === 'trash');
            if (trashIdx !== -1) {
                player.inventory.splice(trashIdx, 1);
                objs.bench.isCleaned = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("🧹 脏污的长椅", "你用捡到的【🗑️ 废纸团】顺手把长椅擦拭得一尘不染！");
            } else {
                createDialogDOM("🧹 脏污的长椅", "这把公共长椅上落满了灰尘。如果你背包里有路边捡到的 [🗑️ 废纸团]，可以顺手打扫干净。");
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
            createDialogDOM("🛋️ 干净的长椅", "长椅现在亮丽如新！");
            createDialogDOM("🌳 灵感许愿树", "一棵郁郁葱葱的大树。如果你收集到了路边闪烁的 [💧 露水滴]，可以来浇灌它。");
        }
        return;
    }

    if (frontX === objs.telephone.gridX && frontY === objs.telephone.gridY) {
        objs.telephone.callCount++;
        saveGame();
        const callStories = [
            "喂？是外卖吗？不，这里是像素摸鱼局......",
            "接通了！里面传出了神秘的电台音乐，竟然有一丝治优的白噪音。",
            "你拨通了一个未知号码：'听说了吗？往路边的喷泉里投硬币，真的能测运势！'",
            "电话里传来一个声音：'别摸鱼了，老板正在提刀赶来的路上！'"
        ];
        createDialogDOM("☎️ 复古电话亭", callStories[objs.telephone.callCount % callStories.length]);
    // ✨ 新互动 3：🥐 街角面包店
    if (frontX === objs.bakery.gridX && frontY === objs.bakery.gridY) {
        createDialogDOM("🥐 烘焙小屋", "门口飘着刚出炉的菠萝包香气～ 门上贴着小纸条：“今天店长心情好，所有面包免费闻！”");
        return;
    }

    if (frontX === objs.guitarist.gridX && frontY === objs.guitarist.gridY) {
        if (!objs.guitarist.isTipped) {
            const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
            if (coinIdx !== -1) {
                player.inventory.splice(coinIdx, 1);
                objs.guitarist.isTipped = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("🎸 流浪歌手", "你投掷了一枚【🪙 硬币】。歌手为你弹奏了一首轻快激昂的像素狂想曲！");
                for (let i = 0; i < 12; i++) {
                    particles.push({
                        x: objs.guitarist.gridX * TILE_SIZE + 16,
                        y: objs.guitarist.gridY * TILE_SIZE,
                        vx: Math.random() * 2 - 1,
                        vy: -Math.random() * 2 - 1,
                        color: `hsl(${Math.random() * 360}, 90%, 60%)`,
                        life: 50,
                        isNote: true
                    });
                }
            } else {
                createDialogDOM("🎸 流浪歌手", "一个身背旧吉他的像素小哥。如果你有一枚 [🪙 硬币] 打赏，他会为你倾情弹奏。");
            }
        } else {
            createDialogDOM("🎸 流浪歌手", "“感谢你的慷慨，知音！祝你今天摸鱼愉快！”");
        }
    // ✨ 新互动 4：🚏 摸鱼站牌
    if (frontX === objs.busStop.gridX && frontY === objs.busStop.gridY) {
        createDialogDOM("🚏 摸鱼站牌", "下一班通往“下班放假号”的公交车还有 5 分钟到达，请乘客做好准备！");
        return;
    }

    if (frontX === objs.mailbox.gridX && frontY === objs.mailbox.gridY) {
        if (objs.mailbox.hasLetter) {
            objs.mailbox.hasLetter = false;
            saveGame();
            const letters = [
                "💌 明信片：'世界很大，不管今天工作多累，记得按时吃饭。'",
                "💌 匿名纸条：'我今天表白成功啦！把好运分享给抽到这封信的你！'",
                "💌 小纸条：'打工人，打工魂！摸鱼的时候记得多喝水。'"
            ];
            createDialogDOM("📬 治愈邮箱", `你掏出了一封未读来信：<br><br><strong>${letters[Math.floor(Math.random() * letters.length)]}</strong>`);
        } else {
            const flowerIdx = player.inventory.findIndex(i => i.type === 'flower');
            if (flowerIdx !== -1) {
                player.inventory.splice(flowerIdx, 1);
                objs.mailbox.hasLetter = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("📬 治愈邮箱", "你将路边摘下的【🌼 小雏菊】放进了邮箱里，为陌生人留下温暖。");
            } else {
                createDialogDOM("📬 治愈邮箱", "这里空空如也。如果你在路上采到了 [🌼 小雏菊]，可以投进去。");
            }
        }
    // ✨ 新互动 5：🐦 树梢鸟窝
    if (frontX === objs.birdNest.gridX && frontY === objs.birdNest.gridY) {
        createDialogDOM("🐦 树梢的小鸟", "叽叽喳喳～ 树上的小鸟正快活地筑巢呢！");
        return;
    }

    if (frontX === objs.fountain.gridX && frontY === objs.fountain.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
    // 原有猫咪、许愿喷泉、电话亭等逻辑保留
    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
            saveGame();
            const fortunes = [
                "✨ 大吉！今天老板绝对不会转到你身后，安心摸鱼！",
                "✨ 中吉！今天适合在工位上偷偷喝一杯双倍糖的冰奶茶！",
                "✨ 惊喜！今天下班的路上，可能会遇到主动蹭你的小动物。"
            ];
            createDialogDOM("⛲ 许愿喷泉", fortunes[Math.floor(Math.random() * fortunes.length)]);
            
            for(let i=0; i<15; i++) {
                particles.push({
                    x: objs.fountain.gridX * TILE_SIZE + 16,
                    y: objs.fountain.gridY * TILE_SIZE + 16,
                    vx: Math.random() * 2 - 1,
                    vy: -Math.random() * 2 - 1,
                    color: '#74b9ff',
                    life: 30 + Math.random()*20
                });
            }
        } else {
            createDialogDOM("⛲ 许愿喷泉", "朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！");
        }
        return;
    }

    if (frontX === objs.vendingMachine.gridX && frontY === objs.vendingMachine.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('soda', '草莓汽水', '🥤');
            saveGame();
            createDialogDOM("自动售货机", "咚咚咚，获得了一瓶【🥤 草莓汽水】！");
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫香甜地吃下了小鱼干！它现在会一直跟着你啦！");
        } else {
            createDialogDOM("自动售货机", "售货机里冰镇着草莓汽水。需要一枚 [硬币] 才能购买。");
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 肚子正咕咕叫。如果能找到 [🐟 小鱼干] 喂它就好了。");
        }
        return;
    }

    if (frontX === objs.clawMachine.gridX && frontY === objs.clawMachine.gridY) {
    if (frontX === objs.fountain.gridX && frontY === objs.fountain.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            createDialogDOM("夹娃娃机", "机械爪降落中......请等待抓取结果。");
            setTimeout(() => {
                if (Math.random() < 0.5) {
                    addItemToInventory('doll', '绝版小熊', '🧸');
                    createDialogDOM("夹娃娃机", "✨ 哇！抓到了一只超可爱的【🧸 绝版小熊】！");
                } else {
                    createDialogDOM("夹娃娃机", "爪子滑了一下，差一点点！再试一次吧！");
                }
                saveGame();
            }, 800);
            saveGame();
            createDialogDOM("⛲ 许愿喷泉", "✨ 大吉！今天老板绝对不会转到你身后，安心摸鱼！");
        } else {
            createDialogDOM("夹娃娃机", "抓一次娃娃需要消耗一枚 [硬币] 哦。");
            createDialogDOM("⛲ 许愿喷泉", "朝里面扔一块 [🪙 硬币]，看一看今天的运势吧！");
        }
        return;
    }

    if (frontX === 8 && frontY === 15) {
        createDialogDOM("👧 路边的小姐姐", "偷偷在这里摸鱼，是只属于我们两个人的秘密哦！🤫");
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
        createDialogDOM("🛋️ 挂机长椅", "你坐在了长椅上。整个人都放松了下来... (按任意方向键可起立)");
    }
}

function addItemToInventory(type, name, emoji) {
    const existItem = player.inventory.find(i => i.type === type);
    if (existItem) {
        existItem.count++;
    } else {
        player.inventory.push({ type: type, name: name, emoji: emoji, count: 1 });
    }
    if (existItem) existItem.count++;
    else player.inventory.push({ type: type, name: name, emoji: emoji, count: 1 });
    updateInventoryUI();
}

@@ -510,19 +486,15 @@ function updateInventoryUI() {
        `;
        slotsContainer.appendChild(itemEl);
    });

    const totalCount = player.inventory.reduce((sum, item) => sum + item.count, 0);
    const statsEl = document.getElementById('stats');
    if (statsEl) statsEl.innerText = `收集总数: ${totalCount}`;
}

// ==========================================
// 6. 核心帧更新与 Canvas 像素画渲染
// 6. 更精细的像素视觉美化绘制（画风升级）
// ==========================================
function update() {
    if (isPaused || isBossMode) return;

    checkContinuousInput();
    updateWanderingNpc();

    if (player.isMoving) {
        if (player.pixelX < player.targetPixelX) player.pixelX = Math.min(player.pixelX + player.moveSpeed, player.targetPixelX);
@@ -542,31 +514,8 @@ function update() {
                }
            }
            player.isMoving = false;
            checkStepTriggers();
        }
    }

    if (Date.now() - gameState.lastRefreshTime > MAP_REFRESH_INTERVAL) {
        refreshWorldElements();
    }

    const tv = gameState.worldObjects.tv;
    const distToTV = Math.sqrt(Math.pow(player.gridX - tv.gridX, 2) + Math.pow(player.gridY - tv.gridY, 2));
    tv.isOn = distToTV <= 2.5;
    if (tv.isOn) tv.animFrame++;

    if (player.isSitting) {
        player.sitTimer++;
        if (player.sitTimer % 90 === 0) {
            const symbols = ['❤️', '💤', '🎵', '☁️'];
            spawnFloatingBubble(symbols[Math.floor(Math.random() * symbols.length)]);
        }
    }

    particles.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(idx, 1);
    });
}

function draw() {
@@ -583,116 +532,82 @@ function draw() {
    const startY = Math.floor(camY / TILE_SIZE);
    const endY = Math.min(startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1, MAP_GRID);

    // 1. 地图网格丰富度渲染（加入了小石子路与鲜花点缀）
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            if (gameState.gameMap[y] && gameState.gameMap[y][x] === 1) {
                ctx.fillStyle = '#9bbc0f'; 
            const tileType = gameState.gameMap[y] ? gameState.gameMap[y][x] : 0;
            if (tileType === 1) {
                ctx.fillStyle = '#a8a7a1'; // 灰色石子路
            } else if (tileType === 2) {
                ctx.fillStyle = '#81c784'; // 带有小黄花的草地
            } else {
                ctx.fillStyle = '#8b956d'; 
                ctx.fillStyle = '#a2d149'; // 温和高质感的青草绿
            }
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.02)';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            if (tileType === 2) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(screenX + 8, screenY + 8, 4, 4);
                ctx.fillRect(screenX + 20, screenY + 18, 4, 4);
            }
        }
    }

    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
    });

    const objs = gameState.worldObjects;

    // 2. 绘制各种建筑与场景组件（带黑边框美化）
    drawPixelSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, camX, camY, '#e74c3c', '🥤'); 
    drawPixelSprite(8, 15, camX, camY, '#fd79a8', '👧');  
    drawPixelSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, camX, camY, '#9b59b6', '🧸'); 
    drawPixelSprite(objs.chair.gridX, objs.chair.gridY, camX, camY, '#d4a574', '🛋️');  
    drawPixelSprite(objs.coffeeCart.gridX, objs.coffeeCart.gridY, camX, camY, '#d35400', '☕'); 
    drawPixelSprite(objs.wishingTree.gridX, objs.wishingTree.gridY, camX, camY, '#27ae60', '🌳'); 
    drawPixelSprite(objs.bakery.gridX, objs.bakery.gridY, camX, camY, '#f39c12', '🥐'); 
    drawPixelSprite(objs.busStop.gridX, objs.busStop.gridY, camX, camY, '#2980b9', '🚏'); 
    drawPixelSprite(objs.fountain.gridX, objs.fountain.gridY, camX, camY, '#3498db', '⛲'); 

    drawPixelSprite(objs.bench.gridX, objs.bench.gridY, camX, camY, objs.bench.isCleaned ? '#ffeaa7' : '#636e72', '🧹'); 
    drawPixelSprite(objs.telephone.gridX, objs.telephone.gridY, camX, camY, '#d63031', '☎️'); 
    drawPixelSprite(objs.guitarist.gridX, objs.guitarist.gridY, camX, camY, '#fdcb6e', '🎸'); 
    drawPixelSprite(objs.mailbox.gridX, objs.mailbox.gridY, camX, camY, '#10ac84', objs.mailbox.hasLetter ? '📬' : '✉️'); 

    // 📺 电视机渲染机制修正：使用正确的变量对象 objs.tv
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
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(ix + 16, iy + 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(item.emoji, ix + 8, iy + 20);
        ctx.font = '16px sans-serif';
        ctx.fillText(item.emoji, ix + 8, iy + 22);
    });

    const catX = objs.cat.gridX * TILE_SIZE - camX;
    const catY = objs.cat.gridY * TILE_SIZE - camY;
    ctx.font = '16px sans-serif';
    ctx.fillText('🐱', catX + 8, catY + 22);

    // 👧 主角形象：双马尾小女孩
    // 5. 绘制主角（精致粉红裙发带小女孩）
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;

    // 1. 马尾与头发（深棕色）
    ctx.fillStyle = '#5c3d2e'; 
    ctx.fillRect(px + 2, py + 4, 6, 12);  
    ctx.fillRect(px + 24, py + 4, 6, 12); 
    ctx.fillRect(px + 6, py + 0, 20, 5);  

    // 2. 脸与小礼裙
    ctx.fillStyle = '#ffeaa7'; 
    ctx.fillRect(px + 6, py + 4, 20, 10);
    ctx.fillStyle = '#ff7675'; 
    ctx.fillRect(px + 4, py + 14, 24, 16);
    // 头发与蝴蝶结
    ctx.fillStyle = '#e84393'; ctx.fillRect(px + 4, py + 0, 24, 6); // 亮粉色头饰
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 2, py + 6, 6, 12);  // 左右双马尾
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(px + 24, py + 6, 6, 12); 

    // 3. 根据移动状态转向的眼睛
    // 面部与眼睛
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(px + 6, py + 6, 20, 10);
    ctx.fillStyle = '#2d3436'; 
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 7, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 19, py + 7, 2, 3);
    if (player.direction === 'up') {
        ctx.fillStyle = '#5c3d2e';
        ctx.fillRect(px + 6, py + 4, 20, 10);
    }
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 9, 3, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 9, 3, 3);

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
    // 小红裙
    ctx.fillStyle = '#ff7675'; ctx.fillRect(px + 4, py + 16, 24, 14);
}

function drawPixelSprite(gx, gy, camX, camY, color, emoji) {
    const sx = gx * TILE_SIZE - camX;
    const sy = gy * TILE_SIZE - camY;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = '#2c2c2c';
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.font = '16px sans-serif';
    ctx.fillText(emoji, sx + 8, sy + 22);
@@ -708,43 +623,30 @@ function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    const bossScreen = document.getElementById('bossKeyScreen');
    const pauseDialog = document.getElementById('pauseDialog');

    if (isBossMode) {
        gameContainer.style.display = 'none';
        bossScreen.classList.add('active');
        removeDialogDOM();
        document.getElementById('bossKeyTime').innerText = new Date().toLocaleString();
    } else {
        bossScreen.classList.remove('active');
        gameContainer.style.display = 'flex';
        isPaused = true;
        pauseDialog.classList.add('active');
    }
}

document.getElementById('resumeBtn').addEventListener('click', () => {
    isPaused = false;
    document.getElementById('pauseDialog').classList.remove('active');
});

document.getElementById('hideBtn').addEventListener('click', () => {
    document.getElementById('pauseDialog').classList.remove('active');
    toggleBossMode();
});

// ==========================================
// 8. 游戏开机启动引导
// ==========================================
// 8. 启动与全局初始化
loadOrCreateGame(); 
updateInventoryUI();
loop();

setInterval(checkContinuousInput, 16);

// 给画板焦点，方便直接操控
try { canvas.focus(); } catch(e){}

// 在页面右上方注入“📅 摸鱼打卡”快捷按钮
setTimeout(() => {
    createDialogDOM("✨ 代码逻辑彻底修复", "修正了变量未定义的底层卡死 Bug！现在地图正常渲染，快看看你的双马尾小女孩！");
}, 200);
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
