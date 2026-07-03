// ==========================================
// 1. 游戏基础配置与初始化
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 32;       
const MAP_GRID = 100;       
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
    moveSpeed: 4,          // 移动速度（4是32的约数，确保完美对齐网格）
    isMoving: false,       
    direction: 'down',     
    inventory: [],          
    isSitting: false,       
    sitTimer: 0
};

// 各种特效粒子容器
let particles = [];

// 【升级①的核心】：引入键盘按键状态追踪字典，用于支持长按流畅平滑移动
const keysPressed = {};

// ==========================================
// 2. 存档与地图周期刷新系统 (升级③)
// ==========================================
const MAP_REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2小时的毫秒数

// 初始化或读取本地全局数据
let gameState = {
    lastRefreshTime: Date.now(),
    gameMap: [],
    mapItems: [],
    worldObjects: {
        tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
        musicBox: { gridX: 12, gridY: 5, isOn: false }, 
        chair: { gridX: 14, gridY: 8 },
        cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] },
        // 升级②：新增5大交互场景的数据挂载点
        fountain: { gridX: 30, gridY: 30 },
        bench: { gridX: 11, gridY: 18, isCleaned: false },
        telephone: { gridX: 22, gridY: 7, callCount: 0 },
        guitarist: { gridX: 5, gridY: 25, isTipped: false },
        vendingMachine: { gridX: 15, gridY: 12 },
        clawMachine: { gridX: 25, gridY: 10 },
        mailbox: { gridX: 35, gridY: 15, hasLetter: true }
    }
};

// 基础碰撞格子定义
function isSolid(x, y) {
    const objs = gameState.worldObjects;
    if (x === objs.vendingMachine.gridX && y === objs.vendingMachine.gridY) return true; 
    if (x === 8 && y === 15) return true;  // NPC小姐姐
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

// 动态生成空地上的随机掉落物
function generateRandomItems() {
    const items = [];
    const pool = [
        { type: 'coin', name: '硬币', emoji: '🪙', color: '#f1c40f' },
        { type: 'fish', name: '小鱼干', emoji: '🐟', color: '#3498db' },
        { type: 'trash', name: '废纸团', emoji: '🗑️', color: '#95a5a6' },
        { type: 'flower', name: '小雏菊', emoji: '🌼', color: '#e67e22' }
    ];
    
    // 在全图随机撒大约60个道具
    for (let i = 0; i < 60; i++) {
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

// 核心：加载保存的进度，并智能判断2小时刷新
function loadOrCreateGame() {
    const savedData = localStorage.getItem('pixel_moyu_save');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            gameState = parsed.gameState;
            // 恢复玩家坐标与背包
            player.gridX = parsed.player.gridX;
            player.gridY = parsed.player.gridY;
            player.pixelX = player.gridX * TILE_SIZE;
            player.pixelY = player.gridY * TILE_SIZE;
            player.targetPixelX = player.pixelX;
            player.targetPixelY = player.pixelY;
            player.inventory = parsed.player.inventory;
            player.direction = parsed.player.direction;
        } catch(e) {
            console.error("读取存档失败，重新初始化", e);
            initNewUniverse();
        }
    } else {
        initNewUniverse();
    }

    // 判断时间是否超过2小时，如果是，则重置地图与掉落物
    if (Date.now() - gameState.lastRefreshTime > MAP_REFRESH_INTERVAL) {
        refreshWorldElements();
    }
}

function initNewUniverse() {
    gameState.lastRefreshTime = Date.now();
    // 随机草地
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
    // 重置部分交互点状态，让世界刷新
    gameState.worldObjects.bench.isCleaned = false;
    gameState.worldObjects.mailbox.hasLetter = Math.random() < 0.7;
    gameState.worldObjects.guitarist.isTipped = false;
    saveGame();
    spawnFloatingBubble("✨ 奇妙摸鱼城已刷新！新道具出现了！");
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
// 3. 升级①：长按支持与单格行进平滑切换机制
// ==========================================
window.addEventListener('keydown', (e) => {
    if (isBossMode) return;
    const key = e.key.toLowerCase();
    keysPressed[key] = true; // 记录按键按下状态

    if (e.key === 'Escape') {
        e.preventDefault();
        toggleBossMode();
        return;
    }

    if (isPaused || player.isSitting || activeDialog) {
        if (activeDialog && (key === 'e' || ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key))) {
            removeDialogDOM();
        }
        if (player.isSitting && ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)) {
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
    keysPressed[key] = false; // 清除按键状态
});

// 在游戏主循环的 update 阶段，如果玩家当前静止，则即时侦测按键状态实现连续平滑移动
function handleContinuousMovement() {
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

// 固定的水坑配置
const puddles = [
    { gridX: 11, gridY: 10 }, { gridX: 14, gridY: 15 }, { gridX: 22, gridY: 25 }, { gridX: 6, gridY: 24 }
];

// ==========================================
// 4. 精美 DOM 对话框与漂浮气泡
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
    
    // 基于屏幕中心 Canvas 视口生成
    bubble.style.left = `${canvas.offsetLeft + VIEW_WIDTH / 2 - 10}px`;
    bubble.style.top = `${canvas.offsetTop + VIEW_HEIGHT / 2 - 40}px`;
    bubble.style.color = '#764ba2';
    
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1500);
}

// ==========================================
// 5. 升级②：全新5大硬核暖心交互场景及投喂流浪猫
// ==========================================
function checkInteractions() {
    let frontX = player.gridX;
    let frontY = player.gridY;
    if (player.direction === 'up') frontY--;
    if (player.direction === 'down') frontY++;
    if (player.direction === 'left') frontX--;
    if (player.direction === 'right') frontX++;

    const objs = gameState.worldObjects;

    // ——【核心投喂】：喂流浪猫 ——
    if (frontX === objs.cat.gridX && frontY === objs.cat.gridY && !objs.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            objs.cat.isFollowing = true;
            updateInventoryUI();
            saveGame();
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫香甜地吃下了小鱼干，在你脚边快乐地打滚！它现在成了你的小尾巴，会一直跟着你走啦！");
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 瘦弱的流浪猫怯生生地看着你，它的肚子正咕咕叫。如果能从马路上捡到 [🐟 小鱼干] 喂它就好了。");
        }
        return;
    }

    // —— 场景1：荒废的长椅（清洁环境互动） ——
    if (frontX === objs.bench.gridX && frontY === objs.bench.gridY) {
        if (!objs.bench.isCleaned) {
            const trashIdx = player.inventory.findIndex(i => i.type === 'trash');
            if (trashIdx !== -1) {
                player.inventory.splice(trashIdx, 1);
                objs.bench.isCleaned = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("🧹 脏污的长椅", "你用捡到的【🗑️ 废纸团】顺手把长椅上的积灰和污渍擦拭得一尘不染！环境变美了，你获得了内心的平静。");
            } else {
                createDialogDOM("🧹 脏污的长椅", "这把公共长椅上落满了灰尘，还有人扔了垃圾。如果你背包里有路边捡到的 [🗑️ 废纸团]，可以顺手把它打扫干净哦。");
            }
        } else {
            createDialogDOM("🛋️ 干净的长椅", "长椅现在亮丽如新，路过的小市民都对你投来赞许的目光！");
        }
        return;
    }

    // —— 场景2：复古英伦红电话亭（隐藏彩蛋八卦） ——
    if (frontX === objs.telephone.gridX && frontY === objs.telephone.gridY) {
        objs.telephone.callCount++;
        saveGame();
        const callStories = [
            "喂？是外卖吗？不，这里是像素摸鱼局......（电话被啪地挂断了）",
            "接通了！里面传出了神秘的电台音乐，竟然有一丝治愈的白噪音。",
            "你拨通了一个未知号码，对面传来悄悄话：'听说了吗？往路边的喷泉里投硬币，真的能测出今天的下班运势！'",
            "电话里传来一个严肃的声音：'别摸鱼了，老板正在提刀赶来的路上！' 吓得你倒吸一口凉气。"
        ];
        createDialogDOM("☎️ 复古电话亭", callStories[objs.telephone.callCount % callStories.length]);
        return;
    }

    // —— 场景3：像素流浪吉他手（音效与打赏机制） ——
    if (frontX === objs.guitarist.gridX && frontY === objs.guitarist.gridY) {
        if (!objs.guitarist.isTipped) {
            const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
            if (coinIdx !== -1) {
                player.inventory.splice(coinIdx, 1);
                objs.guitarist.isTipped = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("🎸 流浪歌手", "你往吉他箱里投掷了一枚【🪙 硬币】。歌手对你微微致意，指尖流转，为你弹奏了一首轻快激昂的像素狂想曲！");
                // 激活动态音符粒子流
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
                createDialogDOM("🎸 流浪歌手", "一个身背旧吉他的像素小哥正在低吟浅唱。如果你有一枚 [🪙 硬币] 打赏给他的话，他会为你倾情弹奏独家曲目。");
            }
        } else {
            createDialogDOM("🎸 流浪歌手", "“感谢你的慷慨，知音！祝你今天摸鱼愉快，无Bug一身轻！”");
        }
        return;
    }

    // —— 场景4：深夜爱心邮箱（寄信与情感树洞） ——
    if (frontX === objs.mailbox.gridX && frontY === objs.mailbox.gridY) {
        if (objs.mailbox.hasLetter) {
            objs.mailbox.hasLetter = false;
            saveGame();
            const letters = [
                "💌 里面有一张明信片：'世界很大，不管今天工作多累，记得按时吃饭，照顾好自己。'",
                "💌 里面有一封匿名小纸条：'我今天向喜欢的女孩子表白成功啦！把好运分享给抽到这封信的你！'",
                "💌 里面写着：'打工人，打工魂！摸鱼的时候记得多喝水，起来扭扭腰。'"
            ];
            createDialogDOM("📬 治愈邮箱", `你伸手从邮箱里掏出了一封未读来信：<br><br><strong>${letters[Math.floor(Math.random() * letters.length)]}</strong>`);
        } else {
            const flowerIdx = player.inventory.findIndex(i => i.type === 'flower');
            if (flowerIdx !== -1) {
                player.inventory.splice(flowerIdx, 1);
                objs.mailbox.hasLetter = true;
                updateInventoryUI();
                saveGame();
                createDialogDOM("📬 治愈邮箱", "你将路边摘下的【🌼 小雏菊】放进了邮箱里。这样下一个路过这里的玩家，就能收获一份专属的植物香气和温柔啦！");
            } else {
                createDialogDOM("📬 治愈邮箱", "这里空空如也。如果你在路上采到了 [🌼 小雏菊]，可以将它作为礼物投进邮箱，为陌生人留下一份小温暖。");
            }
        }
        return;
    }

    // —— 场景5：幸运许愿大喷泉 ——
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
            createDialogDOM("⛲ 许愿喷泉", "波光粼粼的中央喷泉。朝里面扔一块 [🪙 硬币]（按E键），看一看今天的运势吧！");
        }
        return;
    }

    // 原有自动售货机
    if (frontX === objs.vendingMachine.gridX && frontY === objs.vendingMachine.gridY) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('soda', '草莓汽水', '🥤');
            saveGame();
            createDialogDOM("自动售货机", "咚咚咚，获得了一瓶【🥤 草莓汽水】！");
        } else {
            createDialogDOM("自动售货机", "售货机里冰镇着甜爽的草莓汽水。需要一枚 [硬币] 才能购买。");
        }
        return;
    }

    // 原有夹娃娃机
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
        createDialogDOM("👧 路边的小姐姐", "偷偷在这里摸鱼，是只属于我们两个人的秘密哦，绝对不告诉老板！🤫");
    }
}

// 踩格子自动触发
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

    // 【升级①的核心】：在玩家静止时，每帧检查是否有方向键长按，从而实现连续丝滑过格
    handleContinuousMovement();

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

    // 智能刷新检测：在游戏运行过程中如果满2小时也会即时触发刷新
    if (Date.now() - gameState.lastRefreshTime > MAP_REFRESH_INTERVAL) {
        refreshWorldElements();
    }

    // 电视机距离感应
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

    // 1. 渲染草地/街道
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

    // 2. 绘制反光水坑
    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
    });

    const objs = gameState.worldObjects;

    // 3. 渲染升级后的交互建筑群（包含新增5大标志建筑）
    drawPixelSprite(objs.vendingMachine.gridX, objs.vendingMachine.gridY, camX, camY, '#e74c3c', '🥤'); 
    drawPixelSprite(8, 15, camX, camY, '#fd79a8', '👧');  
    drawPixelSprite(objs.clawMachine.gridX, objs.clawMachine.gridY, camX, camY, '#9b59b6', '🧸'); 
    drawPixelSprite(objs.chair.gridX, objs.chair.gridY, camX, camY, '#d4a574', '🛋️');  
    drawPixelSprite(objs.fountain.gridX, objs.fountain.gridY, camX, camY, '#3498db', '⛲'); 

    // 新场景标志物重绘
    drawPixelSprite(objs.bench.gridX, objs.bench.gridY, camX, camY, objs.bench.isCleaned ? '#ffeaa7' : '#636e72', '🧹'); 
    drawPixelSprite(objs.telephone.gridX, objs.telephone.gridY, camX, camY, '#d63031', '☎️'); 
    drawPixelSprite(objs.guitarist.gridX, objs.guitarist.gridY, camX, camY, '#fdcb6e', '🎸'); 
    drawPixelSprite(objs.mailbox.gridX, objs.mailbox.gridY, camX, camY, '#10ac84', objs.mailbox.hasLetter ? '📬' : '✉️'); 

    // 电视机雷达动态绘制
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

    // 4. 绘制地图动态刷新出的掉落道具
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

    // 5. 绘制流浪猫
    const catX = objs.cat.gridX * TILE_SIZE - camX;
    const catY = objs.cat.gridY * TILE_SIZE - camY;
    ctx.font = '16px sans-serif';
    ctx.fillText('🐱', catX + 8, catY + 22);

    // 6. 绘制玩家
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;
    ctx.fillStyle = '#ff7675'; 
    ctx.fillRect(px + 4, py + 8, 24, 22);
    ctx.fillStyle = '#ffeaa7'; 
    ctx.fillRect(px + 8, py + 2, 16, 10);
    ctx.fillStyle = '#2d3436'; 
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 10, py + 5, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 5, 2, 3);

    // 7. 渲染粒子
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

// ==========================================
// 7. 老板键与双向挂机监听
// ==========================================
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
loadOrCreateGame(); // 载入本地持久化存档与判断刷新时间
updateInventoryUI();
loop();

setTimeout(() => {
    createDialogDOM("🎮 摸鱼城 2.0 升级成功", "1. 支持长按上下左右流畅飞奔了！<br>2. 新增了 5 大隐藏交互建筑，快去满地图捡道具和它们互动吧！<br>3. 游玩记录已接入浏览器本地持久化，每 2 小时地图生态会长出全新的道具哦！");
}, 200);
