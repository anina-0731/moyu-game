// ==========================================
// 💡【终极降维打击】自动强擦旧存档，防止越界隐形
// ==========================================
localStorage.clear(); 

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

// 玩家数据结构：改到 (10, 10) 的绝对空旷安全区
const player = {
    gridX: 10,             // 改成 10
    gridY: 10,             // 改成 10
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
// 2. 存档与地图周期刷新系统 (2小时刷新)
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

function loadOrCreateGame() {
    initNewUniverse();
    
    // 💡 强行重置所有锁定状态，确保开局能动！
    isPaused = false;
    isBossMode = false;
    activeDialog = null;
    player.isSitting = false;

    player.gridX = 10; // 顺便移到安全的 10, 10
    player.gridY = 10;
    player.pixelX = player.gridX * TILE_SIZE;
    player.pixelY = player.gridY * TILE_SIZE;
    player.targetPixelX = player.pixelX;
    player.targetPixelY = player.pixelY;
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
            "你拨通了一个未知号码：'听说了吗？往路边的喷泉里投硬币，真的能测运势！'",
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
        createDialogDOM("👧 路边的小姐打个招呼", "偷偷在这里摸鱼，是只属于我们两个人的秘密哦！🤫");
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
// 6. 核心帧更新与 Canvas 像素画渲染
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
    camY = Math.max(0, Math.min(camY, MAP_GRID * TILE_SIZE - VIEW_HEIGHT));

    const startX = Math.floor(camX / TILE_SIZE);
    const endX = Math.min(startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1, MAP_GRID);
    const startY = Math.floor(camY / TILE_SIZE);
    const endY = Math.min(startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1, MAP_GRID);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            if (gameState.gameMap[y] && gameState.gameMap[y][x] === 1) {
                ctx.fillStyle = '#9bbc0f'; 
            } else {
                ctx.fillStyle = '#8b956d'; 
            }
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.02)';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }

    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
    });

    const objs = gameState.worldObjects;

    drawPixelSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, camX, camY, '#e74c3c', '🥤'); 
    drawPixelSprite(8, 15, camX, camY, '#fd79a8', '👧');  
    drawPixelSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, camX, camY, '#9b59b6', '🧸'); 
    drawPixelSprite(objs.chair.gridX, objs.chair.gridY, camX, camY, '#d4a574', '🛋️');  
    drawPixelSprite(objs.fountain.gridX, objs.fountain.gridY, camX, camY, '#3498db', '⛲'); 

    drawPixelSprite(objs.bench.gridX, objs.bench.gridY, camX, camY, objs.bench.isCleaned ? '#ffeaa7' : '#636e72', '🧹'); 
    drawPixelSprite(objs.telephone.gridX, objs.telephone.gridY, camX, camY, '#d63031', '☎️'); 
    drawPixelSprite(objs.guitarist.gridX, objs.guitarist.gridY, camX, camY, '#fdcb6e', '🎸'); 
    drawPixelSprite(objs.mailbox.gridX, objs.mailbox.gridY, camX, camY, '#10ac84', objs.mailbox.hasLetter ? '📬' : '✉️'); 

    const tvX = objs.tv.gridX * TILE_SIZE - camX;
    const tvY = objs.tv.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(tvX, tvY, TILE_SIZE, TILE_SIZE);
    if (tv.isOn) {
        ctx.fillStyle = (Math.floor(tv.animFrame / 15) % 2 === 0) ? '#1abc9c' : '#f1c40f';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    }

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
    });

    const catX = objs.cat.gridX * TILE_SIZE - camX;
    const catY = objs.cat.gridY * TILE_SIZE - camY;
    ctx.font = '16px sans-serif';
    ctx.fillText('🐱', catX + 8, catY + 22);

    // 💡【新主角形象绘制区域】精致的双马尾小女孩！
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;

    // 1. 绘制小女孩的长发/双马尾（深棕色）
    ctx.fillStyle = '#5c3d2e'; 
    ctx.fillRect(px + 2, py + 4, 6, 12);  // 左马尾
    ctx.fillRect(px + 24, py + 4, 6, 12); // 右马尾
    ctx.fillRect(px + 6, py + 0, 20, 5);  // 头顶刘海

    // 2. 脸部裙装
    ctx.fillStyle = '#ffeaa7'; // 肤色
    ctx.fillRect(px + 6, py + 4, 20, 10);
    ctx.fillStyle = '#ff7675'; // 漂亮的珊瑚红小裙子
    ctx.fillRect(px + 4, py + 14, 24, 16);

    // 3. 灵动的眼睛（根据走动方向调整视线）
    ctx.fillStyle = '#2d3436'; 
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 9, py + 7, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 19, py + 7, 2, 3);
    if (player.direction === 'up') {
        // 后脑勺视角：全部画上棕色头发覆盖
        ctx.fillStyle = '#5c3d2e';
        ctx.fillRect(px + 6, py + 4, 20, 10);
    }

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

function drawPixelSprite(gx, gy, camX, camY, color, emoji) {
    const sx = gx * TILE_SIZE - camX;
    const sy = gy * TILE_SIZE - camY;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = '#2c2c2c';
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
loadOrCreateGame(); 
updateInventoryUI();
loop();

setInterval(checkContinuousInput, 16);

// 💡 强制网页一打开，就把焦点给到游戏画布
canvas.focus();

setTimeout(() => {
    createDialogDOM("👧 小女孩皮肤已装配！", "本地冲突旧存档已被永久洗去。这一次你绝对能闪现回广场正中心，看清自己的可爱双马尾了！");
}, 200);
