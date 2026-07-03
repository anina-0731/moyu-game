// ==========================================
// 1. 游戏基础配置与初始化
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 禁用平滑缩放，完美呈现纯正的像素风 (Pixel Art)
ctx.imageSmoothingEnabled = false;

const TILE_SIZE = 32;       // 每个格子 32x32 像素
const MAP_GRID = 100;       // 100 * 100 网格
const VIEW_WIDTH = 800;     // 视口宽
const VIEW_HEIGHT = 600;    // 视口高

// 游戏状态控制
let isPaused = false;
let isBossMode = false;
let activeDialog = null;    // 当前弹出的对话框内容

// 玩家数据结构
const player = {
    gridX: 10,             // 初始网格坐标 X
    gridY: 10,             // 初始网格坐标 Y
    pixelX: 10 * TILE_SIZE,
    pixelY: 10 * TILE_SIZE,
    targetPixelX: 10 * TILE_SIZE,
    targetPixelY: 10 * TILE_SIZE,
    moveSpeed: 4,          // 像素平滑移动速度
    isMoving: false,       // 核心：锁定单次网格移动的标志位
    direction: 'down',     // 朝向：up, down, left, right
    inventory: [],          // 物品栏容器
    isSitting: false,       // 是否在长椅上挂机
    sitTimer: 0
};

// 各种特效粒子容器
let particles = [];

// ==========================================
// 2. 核心 Bug 修复：严格的回合制单格移动系统
// ==========================================
window.addEventListener('keydown', (e) => {
    if (isBossMode) return;
    
    // 老板键检测
    if (e.key === 'Escape') {
        e.preventDefault();
        toggleBossMode();
        return;
    }

    // 弹窗或挂机状态下的特殊输入拦截
    if (isPaused || player.isSitting || activeDialog) {
        // 如果正在对话，按 E 或者方向键关闭弹窗
        if (activeDialog && (e.key === 'e' || e.key === 'E' || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key.toLowerCase()))) {
            removeDialogDOM();
        }
        // 如果在长椅挂机，按任意方向键站起来
        if (player.isSitting && ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(e.key.toLowerCase())) {
            player.isSitting = false;
            // 往下方移动一格离开长椅，防止卡死
            let escapeY = player.gridY + 1;
            if (escapeY < MAP_GRID && !isSolid(player.gridX, escapeY)) {
                player.gridY = escapeY;
                player.targetPixelX = player.gridX * TILE_SIZE;
                player.targetPixelY = player.gridY * TILE_SIZE;
                player.isMoving = true;
            }
        }
        return;
    }

    const key = e.key.toLowerCase();
    
    // 【关键修复核心】：如果角色正在一格一格移动中，直接拦截新的输入，绝不滑行多格
    if (player.isMoving) return;

    let nextGridX = player.gridX;
    let nextGridY = player.gridY;
    let newDir = player.direction;

    if (key === 'w' || e.key === 'ArrowUp') { nextGridY--; newDir = 'up'; }
    else if (key === 's' || e.key === 'ArrowDown') { nextGridY++; newDir = 'down'; }
    else if (key === 'a' || e.key === 'ArrowLeft') { nextGridX--; newDir = 'left'; }
    else if (key === 'd' || e.key === 'ArrowRight') { nextGridX++; newDir = 'right'; }
    else if (key === 'e') {
        checkInteractions();
        return;
    } else {
        return; 
    }

    player.direction = newDir;

    // 地图边界控制及建筑碰撞检测
    if (nextGridX >= 0 && nextGridX < MAP_GRID && nextGridY >= 0 && nextGridY < MAP_GRID) {
        if (!isSolid(nextGridX, nextGridY)) {
            player.gridX = nextGridX;
            player.gridY = nextGridY;
            player.targetPixelX = player.gridX * TILE_SIZE;
            player.targetPixelY = player.gridY * TILE_SIZE;
            player.isMoving = true; // 激活移动锁，确保平滑移到目标格前无法再次触发键入
        }
    }
});

// ==========================================
// 3. 地图、建筑与生态元素配置
// ==========================================
const gameMap = [];
for (let y = 0; y < MAP_GRID; y++) {
    gameMap[y] = [];
    for (let x = 0; x < MAP_GRID; x++) {
        gameMap[y][x] = (Math.random() < 0.15) ? 1 : 0; // 1: 草地, 0: 道路
    }
}

// 设定静态阻挡建筑物坐标
function isSolid(x, y) {
    if (x === 15 && y === 12) return true; // 自动售货机
    if (x === 8 && y === 15) return true;  // NPC小姐姐固定桩
    if (x === 20 && y === 20) return true; // 复古电视机
    if (x === 25 && y === 10) return true; // 夹娃娃机
    if (x === 14 && y === 8) return true;  // 爱心长椅
    if (x === 30 && y === 30) return true; // 许愿喷泉
    return false;
}

// 可拾取物品列表
let mapItems = [
    { id: 'coin_1', type: 'coin', name: '硬币', emoji: '🪙', gridX: 12, gridY: 12, color: '#f1c40f' },
    { id: 'coin_2', type: 'coin', name: '硬币', emoji: '🪙', gridX: 25, gridY: 12, color: '#f1c40f' },
    { id: 'coin_3', type: 'coin', name: '硬币', emoji: '🪙', gridX: 32, gridY: 28, color: '#f1c40f' },
    { id: 'fish_1', type: 'fish', name: '小鱼干', emoji: '🐟', gridX: 18, gridY: 14, color: '#3498db' },
];

// 水坑系统
const puddles = [
    { gridX: 11, gridY: 10 },
    { gridX: 14, gridY: 15 },
    { gridX: 22, gridY: 25 }
];

// 动态交互设备状态管理
const worldObjects = {
    tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
    musicBox: { gridX: 12, gridY: 5, isOn: false }, // 挪到12,5防止和长椅重叠
    chair: { gridX: 14, gridY: 8 },
    cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] }
};

// ==========================================
// 4. 精美 DOM 对话框系统 (完美适配你的 CSS)
// ==========================================
function createDialogDOM(title, content) {
    removeDialogDOM(); // 清理老弹窗
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

// 生成飘动的像素气泡 (适配你的 CSS .floating-bubble)
function spawnFloatingBubble(text) {
    const wrapper = document.getElementById('gameContainer');
    const bubble = document.createElement('div');
    bubble.className = 'floating-bubble';
    bubble.innerText = text;
    
    // 基于 Canvas 视口中央偏上生成
    bubble.style.left = `${canvas.offsetLeft + VIEW_WIDTH / 2 - 10}px`;
    bubble.style.top = `${canvas.offsetTop + VIEW_HEIGHT / 2 - 40}px`;
    bubble.style.color = '#764ba2';
    
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1500);
}

// ==========================================
// 5. 交互逻辑与触发事件
// ==========================================
function checkInteractions() {
    let frontX = player.gridX;
    let frontY = player.gridY;
    if (player.direction === 'up') frontY--;
    if (player.direction === 'down') frontY++;
    if (player.direction === 'left') frontX--;
    if (player.direction === 'right') frontX++;

    // 1. 自动售货机互动
    if (frontX === 15 && frontY === 12) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            addItemToInventory('soda', '草莓汽水', '🥤');
            createDialogDOM("自动售货机", "你投入了一枚硬币... 咚咚咚，获得了一瓶【🥤 草莓汽水】！");
        } else {
            createDialogDOM("自动售货机", "售货机闪烁着柔和的霓虹灯，但你身上没有硬币呢。回去翻翻马路吧！");
        }
        return;
    }

    // 2. 夹娃娃机互动
    if (frontX === 25 && frontY === 10) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            createDialogDOM("夹娃娃机", "消耗一枚金币，机械爪晃晃悠悠地降落了......请等待抓取结果。");
            setTimeout(() => {
                if (Math.random() < 0.5) {
                    addItemToInventory('doll', '绝版小熊', '🧸');
                    createDialogDOM("夹娃娃机", "✨ 哇！运气爆棚！你抓到了一只超可爱的【🧸 绝版小熊玩偶】！");
                } else {
                    createDialogDOM("夹娃娃机", "哎呀，爪子在最后关头滑了一下，差一点点就抓到了呜呜~再试一次吧！");
                }
            }, 1000);
        } else {
            createDialogDOM("夹娃娃机", "这台娃娃机里塞满了精致的玩偶，面前按 E 键投掷一枚 [硬币] 就能抓取一次哦。");
        }
        return;
    }

    // 3. 与 NPC 小姐姐聊天
    if (frontX === 8 && frontY === 15) {
        const quotes = [
            "嗨！今天天气真好，很适合在城里悠闲散步呢~ ☀️",
            "你有去试过路那边的自动售货机吗？草莓汽水味道超赞！🥤",
            "街角那只流浪的小猫看起来有点饿了，如果能喂它点小鱼干就好了。🐱",
            "偷偷在这里摸鱼，是只属于我们两个人的秘密哦，绝对不告诉老板！🤫"
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        createDialogDOM("👧 路边的小姐姐", randomQuote);
        return;
    }

    // 4. 音乐八音盒开关
    if (frontX === worldObjects.musicBox.gridX && frontY === worldObjects.musicBox.gridY) {
        worldObjects.musicBox.isOn = !worldObjects.musicBox.isOn;
        createDialogDOM("🎵 音乐八音盒", worldObjects.musicBox.isOn ? "你轻轻打开了八音盒，空气中开始飘荡起温暖的像素音符。" : "你合上了八音盒，周围恢复了平静。");
        return;
    }

    // 5. 街头爱心邮箱 / 许愿喷泉 (合并在30,30区域)
    if ((frontX === 30 && frontY === 30) || (Math.abs(player.gridX - 30) <= 1 && Math.abs(player.gridY - 30) <= 1)) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            const fortunes = [
                "✨ 大吉！今天老板绝对不会转到你身后，安心摸鱼吧！",
                "✨ 中吉！今天适合在工位上偷偷喝一杯双倍糖的冰奶茶！",
                "✨ 小吉！你的工作今天都会极度顺畅，无Bug一身轻！",
                "✨ 惊喜！今天下班的路上，你可能会遇到一只主动蹭你的小动物。🐱"
            ];
            createDialogDOM("⛲ 许愿喷泉运势", fortunes[Math.floor(Math.random() * fortunes.length)]);
            
            // 喷泉溅起绿色/蓝色治愈水花特效
            for(let i=0; i<15; i++) {
                particles.push({
                    x: 30 * TILE_SIZE + 16 + (Math.random()*20-10),
                    y: 30 * TILE_SIZE + 16 + (Math.random()*20-10),
                    vx: Math.random() * 2 - 1,
                    vy: -Math.random() * 2 - 1,
                    color: '#a5d6a7',
                    life: 30 + Math.random()*20
                });
            }
        } else {
            createDialogDOM("⛲ 许愿喷泉与邮箱", "波光粼粼的像素喷泉和红色爱心邮箱。向里面投掷一枚 [硬币] (按E)，可以测一测今天的摸鱼运势并抽取小动物的信件哦。");
        }
        return;
    }

    // 6. 流浪猫投喂
    if (frontX === worldObjects.cat.gridX && frontY === worldObjects.cat.gridY && !worldObjects.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            updateInventoryUI();
            worldObjects.cat.isFollowing = true;
            createDialogDOM("🐱 流浪小猫咪", "咪呜~❤ 小猫高兴地吃下了小鱼干，轻轻蹭了蹭你，决定以后都跟着你走啦！(它现在会黏在你的屁股后面跟随你)");
        } else {
            createDialogDOM("🐱 流浪小猫咪", "喵呜... 瘦弱的流浪猫怯生生地看着你，它好像很饥饿。如果能从马路上捡到 [小鱼干] 喂它就好了。");
        }
        return;
    }
}

// 踩格子触发器（物品自动捡拾、踩水坑粒子）
function checkStepTriggers() {
    // 物品自动拾取
    const itemIdx = mapItems.findIndex(i => i.gridX === player.gridX && i.gridY === player.gridY);
    if (itemIdx !== -1) {
        const item = mapItems[itemIdx];
        addItemToInventory(item.type, item.name, item.emoji);
        mapItems.splice(itemIdx, 1);
        spawnFloatingBubble(`+1 ${item.name}`);
    }

    // 踩水坑粒子动效触发
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

    // 长椅挂机检测
    if (player.gridX === worldObjects.chair.gridX && player.gridY === worldObjects.chair.gridY) {
        player.isSitting = true;
        createDialogDOM("🛋️ 挂机长椅", "你坐在了长椅上。整个人都放松了下来... 头顶开始冒出治愈气泡。(按任意方向键可起立离开)");
    }
}

// 辅助函数：合并添加物品并更新数组
function addItemToInventory(type, name, emoji) {
    const existItem = player.inventory.find(i => i.type === type);
    if (existItem) {
        existItem.count++;
    } else {
        player.inventory.push({ type: type, name: name, emoji: emoji, count: 1 });
    }
    updateInventoryUI();
}

// 更新物品栏 UI 渲染 (完美对接你的 .inventory-slots 和 .inventory-item)
function updateInventoryUI() {
    const slotsContainer = document.getElementById('inventorySlots');
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

    // 计算总收集数呈现给 #stats 容器
    const totalCount = player.inventory.reduce((sum, item) => sum + item.count, 0);
    document.getElementById('stats').innerText = `收集总数: ${totalCount}`;
}

// ==========================================
// 6. 核心帧更新与 Canvas 像素画渲染
// ==========================================
function update() {
    if (isPaused || isBossMode) return;

    // 平滑插值走格子过渡动画
    if (player.isMoving) {
        if (player.pixelX < player.targetPixelX) player.pixelX = Math.min(player.pixelX + player.moveSpeed, player.targetPixelX);
        else if (player.pixelX > player.targetPixelX) player.pixelX = Math.max(player.pixelX - player.moveSpeed, player.targetPixelX);

        if (player.pixelY < player.targetPixelY) player.pixelY = Math.min(player.pixelY + player.moveSpeed, player.targetPixelY);
        else if (player.pixelY > player.targetPixelY) player.pixelY = Math.max(player.pixelY - player.moveSpeed, player.targetPixelY);

        // 到达目标点，解除输入锁定
        if (player.pixelX === player.targetPixelX && player.pixelY === player.targetPixelY) {
            // 猫咪队伍坐标压栈更新
            if (worldObjects.cat.isFollowing) {
                worldObjects.cat.history.push({ x: player.gridX, y: player.gridY });
                if (worldObjects.cat.history.length > 1) {
                    const trail = worldObjects.cat.history.shift();
                    worldObjects.cat.gridX = trail.x;
                    worldObjects.cat.gridY = trail.y;
                }
            }
            player.isMoving = false;
            checkStepTriggers();
        }
    }

    // 电视机雷达感应距离计算
    const distToTV = Math.sqrt(Math.pow(player.gridX - worldObjects.tv.gridX, 2) + Math.pow(player.gridY - worldObjects.tv.gridY, 2));
    worldObjects.tv.isOn = distToTV <= 2.5;
    if (worldObjects.tv.isOn) worldObjects.tv.animFrame++;

    // 八音盒粒子发射器
    if (worldObjects.musicBox.isOn && Math.random() < 0.08) {
        particles.push({
            x: worldObjects.musicBox.gridX * TILE_SIZE + 16,
            y: worldObjects.musicBox.gridY * TILE_SIZE,
            vx: Math.random() * 1 - 0.5,
            vy: -Math.random() * 1 - 0.5,
            color: `hsl(${Math.random() * 360}, 80%, 70%)`,
            life: 40,
            isNote: true
        });
    }

    // 长椅挂机随机冒爱心/睡眠标志
    if (player.isSitting) {
        player.sitTimer++;
        if (player.sitTimer % 90 === 0) {
            const symbols = ['❤️', '💤', '🎵', '☁️'];
            spawnFloatingBubble(symbols[Math.floor(Math.random() * symbols.length)]);
        }
    }

    // 粒子寿命衰减
    particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(idx, 1);
    });
}

function draw() {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 摄像机镜头裁剪裁剪计算
    let camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    let camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;

    camX = Math.max(0, Math.min(camX, MAP_GRID * TILE_SIZE - VIEW_WIDTH));
    camY = Math.max(0, Math.min(camY, MAP_GRID * TILE_SIZE - VIEW_HEIGHT));

    const startX = Math.floor(camX / TILE_SIZE);
    const endX = Math.min(startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1, MAP_GRID);
    const startY = Math.floor(camY / TILE_SIZE);
    const endY = Math.min(startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1, MAP_GRID);

    // 1. 绘制像素背景草地和街道
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            if (gameMap[y][x] === 1) {
                ctx.fillStyle = '#9bbc0f'; // 浅绿复古像素草地
            } else {
                ctx.fillStyle = '#8b956d'; // 像素灰城市主干道
            }
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            ctx.strokeStyle = 'rgba(0,0,0,0.03)';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }

    // 2. 绘制反光水坑
    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd';
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#6a89cc';
        ctx.fillRect(sx + 6, sy + 10, 6, 2);
    });

    // 3. 绘制带有 Emoji 标签的静态互动点建筑
    drawPixelSprite(15, 12, camX, camY, '#e74c3c', '🥤'); // 售货机
    drawPixelSprite(8, 15, camX, camY, '#fd79a8', '👧');  // NPC
    drawPixelSprite(25, 10, camX, camY, '#9b59b6', '🧸'); // 娃娃机
    drawPixelSprite(worldObjects.musicBox.gridX, worldObjects.musicBox.gridY, camX, camY, '#e67e22', '🎵'); // 八音盒
    drawPixelSprite(14, 8, camX, camY, '#d4a574', '🛋️');  // 长椅
    drawPixelSprite(30, 30, camX, camY, '#d63031', '⛲'); // 喷泉/邮箱

    // 绘制自动感应黑白/彩色复古电视机
    const tvX = worldObjects.tv.gridX * TILE_SIZE - camX;
    const tvY = worldObjects.tv.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(tvX, tvY, TILE_SIZE, TILE_SIZE);
    if (worldObjects.tv.isOn) {
        ctx.fillStyle = (Math.floor(worldObjects.tv.animFrame / 15) % 2 === 0) ? '#1abc9c' : '#f1c40f';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#000';
        ctx.font = '10px sans-serif';
        ctx.fillText('🐱', tvX + 11, tvY + 16);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    }

    // 4. 绘制路面掉落物
    mapItems.forEach(item => {
        const ix = item.gridX * TILE_SIZE - camX;
        const iy = item.gridY * TILE_SIZE - camY;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(ix + 16, iy + 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(item.type === 'coin' ? 'C' : 'F', ix + 13, iy + 20);
    });

    // 5. 绘制流浪猫
    const catX = worldObjects.cat.gridX * TILE_SIZE - camX;
    const catY = worldObjects.cat.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(catX + 6, catY + 12, 20, 14);
    ctx.fillStyle = '#d35400';
    ctx.fillRect(catX + 18, catY + 6, 6, 6);

    // 6. 绘制玩家小女孩
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;
    ctx.fillStyle = '#ff7675'; // 裙装
    ctx.fillRect(px + 4, py + 8, 24, 22);
    ctx.fillStyle = '#ffeaa7'; // 皮肤
    ctx.fillRect(px + 8, py + 2, 16, 10);
    ctx.fillStyle = '#2d3436'; // 像素眼睛朝向控制
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 10, py + 5, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 5, 2, 3);
    if (player.direction === 'up') {
        ctx.fillStyle = '#d63031';
        ctx.fillRect(px + 12, py + 1, 8, 2);
    }

    // 7. 渲染粒子碎片组件
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
// 7. 老板键功能与 暂停窗口监听 (完美适配 CSS .active 声明)
// ==========================================
function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    const bossScreen = document.getElementById('bossKeyScreen');
    const pauseDialog = document.getElementById('pauseDialog');

    if (isBossMode) {
        gameContainer.style.display = 'none';
        // 契合你的 CSS：使用 .addClass 或直接添加类名控制激活
        bossScreen.classList.add('active');
        removeDialogDOM(); // 隐匿所有可能暴露的对话窗
        
        const now = new Date();
        document.getElementById('bossKeyTime').innerText = now.toLocaleString();
    } else {
        bossScreen.classList.remove('active');
        gameContainer.style.display = 'flex';
        
        isPaused = true;
        pauseDialog.classList.add('active'); // 完美唤醒你的暂停美化弹窗
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
updateInventoryUI();
loop();

// 首帧载入弹窗提示
setTimeout(() => {
    createDialogDOM("🎮 游戏提示", "欢迎来到像素摸鱼城！用方向键或WASD移动（按一下走一格）。走到特定建筑面前【按 E 键】即可展开神奇的暖心互动哦！");
}, 200);
