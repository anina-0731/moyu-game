// ==========================================
// 1. 游戏基础配置与初始化（地图 50 * 50）
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
    gridX: 15,             // 强制初始网格 X
    gridY: 15,             // 强制初始网格 Y
    pixelX: 15 * TILE_SIZE,
    pixelY: 15 * TILE_SIZE,
    targetPixelX: 15 * TILE_SIZE,
    targetPixelY: 15 * TILE_SIZE,
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
// 2. 核心：彻底粉碎旧存档的越界与隐身 Bug
// ==========================================
const MAP_REFRESH_INTERVAL = 2 * 60 * 60 * 1000; 

let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    worldObjects: {
        tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
        musicBox: { gridX: 12, gridY: 5, isOn: false }, 
        chair: { gridX: 14, gridY: 8 },
        cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] },
        fountain: { gridX: 30, gridY: 30 },
        bench: { gridX: 11, gridY: 18, isCleaned: false },
        telephone: { gridX: 22, gridY: 7, callCount: 0 },
        guitarist: { gridX: 5, gridY: 25, isTipped: false },
        vendingMachine: { gridX: 15, gridY: 12 },
        clawMachine: { gridX: 25, gridY: 10 },
        mailbox: { gridX: 35, gridY: 15, hasLetter: true }
    }
};

function isSolid(x, y) {
    const objs = gameState.worldObjects;
    if (x === objs.vendingMachine.gridX && y === objs.vendingMachine.gridY) return true; 
    if (x === 8 && y === 15) return true;  
    if (x === objs.clawMachine.gridX && y === objs.clawMachine.gridY) return true; 
    if (x === objs.tv.gridX && y === objs.tv.gridY) return true; 
    if (x === objs.chair.gridX && y === objs.chair.gridY) return true; 
    if (x === objs.fountain.gridX && y === objs.fountain.gridY) return true; 
    if (x === objs.bench.gridX && y === objs.bench.gridY) return true; 
    if (x === objs.telephone.gridX && y === objs.telephone.gridY) return true; 
    if (x === objs.guitarist.gridX && y === objs.guitarist.gridY) return true; 
    if (x === objs.mailbox.gridX && y === objs.mailbox.gridY) return true; 
    return false;
}

function generateRandomItems() {
    const items = [];
    const pool = [
        { type: 'coin', name: '硬币', emoji: '🪙', color: '#f1c40f' },
        { type: 'fish', name: '小鱼干', emoji: '🐟', color: '#3498db' },
        { type: 'trash', name: '废纸团', emoji: '🗑️', color: '#95a5a6' },
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' }
    ];
    
    for (let i = 0; i < 30; i++) {
        let rx = Math.floor(Math.random() * MAP_GRID);
        let ry = Math.floor(Math.random() * MAP_GRID);
        if (!isSolid(rx, ry) && (rx !== 15 || ry !== 15)) {
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

// 💥【终极杀招】：完全无视本地旧的隐身存档坐标，强制拉回地图中央
function loadOrCreateGame() {
    const savedData = localStorage.getItem('pixel_moyu_save');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            gameState = parsed.gameState;
            player.inventory = parsed.player.inventory || [];
            player.direction = parsed.player.direction || 'down';
        } catch(e) {
            initNewUniverse();
        }
    } else {
        initNewUniverse();
    }

    // 🔒【强行校准】直接将坐标物理焊死在 15,15 安全区，防止一切黑屏和隐身 bug
    player.gridX = 15;
    player.gridY = 15;
    player.pixelX = 15 * TILE_SIZE;
    player.pixelY = 15 * TILE_SIZE;
    player.targetPixelX = player.pixelX;
    player.targetPixelY = player.pixelY;

    if (Date.now() - gameState.lastRefreshTime > MAP_REFRESH_INTERVAL) {
        refreshWorldElements();
    }
}

function initNewUniverse() {
    gameState.lastRefreshTime = Date.now();
    gameState.gameMap = [];
    for (let y = 0; y < MAP_GRID; y++) {
        gameState.gameMap[y] = [];
        for (let x = 0; x < MAP_GRID; x++) {
            gameState.gameMap[y][x] = (Math.random() < 0.15) ? 1 : 0;
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
        player: {
            gridX: player.gridX,
            gridY: player.gridY,
            inventory: player.inventory,
            direction: player.direction
        }
    };
    localStorage.setItem('pixel_moyu_save', JSON.stringify(saveData));
}

// ==========================================
// 3. 高频动态移动监听
// ==========================================
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
            let escapeY = player.gridY + 1;
            if (escapeY < MAP_GRID && !isSolid(player.gridX, escapeY)) {
                player.gridX = escapeY;
                player.targetPixelX = player.gridX * TILE_SIZE;
                player.targetPixelY = player.gridY * TILE_SIZE;
                player.isMoving = true;
            }
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

window.addEventListener('blur', () => {
    for (let key in keysPressed) keysPressed[key] = false;
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

const puddles = [
    { gridX: 11, gridY: 10 }, { gridX: 14, gridY: 15 }, { gridX: 22, gridY: 25 }, { gridX: 6, gridY: 24 }
];

// ==========================================
// 4. 精美 DOM 对话框与悬浮气泡
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

// ==========================================
// 5. 交互判定逻辑
// ==========================================
function checkInteractions() {
    let frontX = player.gridX;
    let frontY = player.gridY;
    if (player.direction === 'up') frontY--;
    if (player.direction === 'down') frontY++;
    if (player.direction === 'left') frontX--;
    if (player.direction === 'right') frontX++;

    const objs = gameState.worldObjects;

    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫香甜地吃下了小鱼干！它现在会一直跟着你走啦！");
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 肚子正咕咕叫。如果能从马路上捡到 [🐟 小鱼干] 喂它就好了。");
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
        } else {
            createDialogDOM("🛋️ 干净的长椅", "长椅现在亮丽如新！");
        }
        return;
    }

    if (frontX === objs.telephone.gridX && frontY === objs.telephone.gridY) {
        objs.telephone.callCount++;
        saveGame();
        const callStories = [
            "喂？是外卖吗？不，这里是像素摸鱼局......",
            "接通了！里面传出了神秘的电台音乐，竟然有一丝治愈的白噪音。",
            "你拨通了一个未知号码：'听听说吗？往路边的喷泉里投硬币，真的能测运势！'",
            "电话里传来一个声音：'别摸鱼了，老板正在提刀赶来的路上！'"
        ];
        createDialogDOM("☎️ 复古电话亭", callStories[objs.telephone.callCount % callStories.length]);
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
        return;
    }

    if (frontX === objs.fountain.gridX && frontY === objs.fountain.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
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
        } else {
            createDialogDOM("自动售货机", "售货机里冰镇着草莓汽水。需要一枚 [硬币] 才能购买。");
        }
        return;
    }

    if (frontX === objs.clawMachine.gridX && frontY === objs.clawMachine.gridY) {
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
        } else {
            createDialogDOM("夹娃娃机", "抓一次娃娃需要消耗一枚 [硬币] 哦。");
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

    const totalCount = player.inventory.reduce((sum, item) => sum + item.count, 0);
    const statsEl = document.getElementById('stats');
    if (statsEl) statsEl.innerText = `收集总数: ${totalCount}`;
}

// ==========================================
// 6. 核心帧更新与 Canvas 渲染
// ==========================================
function update() {
    if (isPaused || isBossMode) return;

    checkContinuousInput();

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
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    let camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    let camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;

    camX = Math.max(0, Math.min(camX, MAP_GRID * TILE_SIZE - VIEW_WIDTH));
    camY = Math.max(0, Math.min(camY, MAP_
