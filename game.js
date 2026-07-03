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
    isMoving: false,       // 关键：锁定单次网格移动的标志位
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
// 记录当前按下的键，但在 keydown 时我们只触发一次准确的坐标加减
const keysPressed = {};

window.addEventListener('keydown', (e) => {
    if (isBossMode) return;
    
    // 老板键检测
    if (e.key === 'Escape') {
        e.preventDefault();
        toggleBossMode();
        return;
    }

    if (isPaused || player.isSitting || activeDialog) {
        // 如果正在对话，按 E 或者方向键退出对话
        if (activeDialog && (e.key === 'e' || e.key === 'E' || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key.toLowerCase()))) {
            activeDialog = null;
        }
        // 如果在长椅挂机，按任意方向键站起来
        if (player.isSitting && ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(e.key.toLowerCase())) {
            player.isSitting = false;
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
        // 触发互动键
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
// 3. 地图、建筑与生态元素初始化
// ==========================================
// 生成 100*100 的二维数组地图
const gameMap = [];
for (let y = 0; y < MAP_GRID; y++) {
    gameMap[y] = [];
    for (let x = 0; x < MAP_GRID; x++) {
        // 默认全铺成道路或草地
        gameMap[y][x] = (Math.random() < 0.15) ? 1 : 0; // 1: 草地, 0: 道路
    }
}

// 设定静态阻挡建筑
function isSolid(x, y) {
    // 固定的建筑物格子
    if (x === 15 && y === 12) return true; // 自动售货机
    if (x === 8 && y === 15) return true;  // NPC小姐姐固定桩
    if (x === 20 && y === 20) return true; // 复古电视机
    if (x === 25 && y === 10) return true; // 夹娃娃机
    if (x === 12 && y === 8) return true;  // 音乐八音盒
    if (x === 30 && y === 30) return true; // 许愿喷泉
    return false;
}

// ==========================================
// 4. 有爱互动点与物品数据配置
// ==========================================

// 可拾取物品列表
let mapItems = [
    { id: 'coin_1', type: 'coin', name: '🪙 硬币', gridX: 12, gridY: 12, color: '#f1c40f' },
    { id: 'coin_2', type: 'coin', name: '🪙 硬币', gridX: 25, gridY: 12, color: '#f1c40f' },
    { id: 'fish_1', type: 'fish', name: '🐟 小鱼干', gridX: 18, gridY: 14, color: '#3498db' },
];

// 水坑系统
const puddles = [
    { gridX: 11, gridY: 10 },
    { gridX: 14, gridY: 15 },
    { gridX: 22, gridY: 25 }
];

// 电视机、八音盒等设备的运行状态
const worldObjects = {
    tv: { gridX: 20, gridY: 20, isOn: false, animFrame: 0 },
    musicBox: { gridX: 12, gridY: 8, isOn: false },
    chair: { gridX: 14, gridY: 8 },
    cat: { gridX: 17, gridY: 14, isFollowing: false, history: [] }
};

// ==========================================
// 5. 交互逻辑与触发事件
// ==========================================
function checkInteractions() {
    // 获取玩家面对的前方格子坐标
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
            player.inventory.push({ type: 'soda', name: '🥤 草莓汽水' });
            updateInventoryUI();
            activeDialog = "你投入了一枚硬币... 咚咚咚，获得了一瓶【🥤 草莓汽水】！";
        } else {
            activeDialog = "售货机闪烁着柔和的霓虹灯，但你身上没有硬币呢。";
        }
        return;
    }

    // 2. 夹娃娃机互动
    if (frontX === 25 && frontY === 10) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            activeDialog = "消耗一枚金币，机械爪晃晃悠悠地降落了......";
            setTimeout(() => {
                if (Math.random() < 0.5) {
                    player.inventory.push({ type: 'doll', name: '🧸 绝版小熊玩偶' });
                    updateInventoryUI();
                    activeDialog = "✨ 哇！运气爆棚！你抓到了一只超可爱的【🧸 绝版小熊玩偶】！";
                } else {
                    activeDialog = "哎呀，钩子在最后关头滑了一下，差一点点就抓到了呜呜~";
                }
            }, 1000);
        } else {
            activeDialog = "这台娃娃机里塞满了精致的玩偶，投掷一枚 [硬币] 就能抓取一次哦。";
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
        activeDialog = "👧 小姐姐: \"" + quotes[Math.floor(Math.random() * quotes.length)] + "\"";
        return;
    }

    // 4. 音乐八音盒开关
    if (frontX === worldObjects.musicBox.gridX && frontY === worldObjects.musicBox.gridY) {
        worldObjects.musicBox.isOn = !worldObjects.musicBox.isOn;
        activeDialog = worldObjects.musicBox.isOn ? "🎵 你轻轻打开了八音盒，空气中开始飘荡起温暖的像素音符。" : "🎵 你合上了八音盒，周围恢复了平静。";
        return;
    }

    // 5. 街头爱心邮箱
    if (frontX === 30 && frontY === 30) { // 巧妙安排在喷泉旁
        const letters = [
            "✉️ 来自小熊的信：今天也要记得好好吃饭，千万不要累着自己哦！🐾",
            "✉️ 来自小兔的信：新开的那家娃娃机概率超良心，快带上硬币去试试吧！🐇",
            "✉️ 来自小猫的信：喵呜... 谢谢你把这个世界建造得这么温柔~ 🐾",
            "✉️ 来自开发者的备忘：感谢你来到这个像素小世界，愿你的每一天都充满阳光！✨"
        ];
        activeDialog = letters[Math.floor(Math.random() * letters.length)];
        return;
    }

    // 6. 许愿喷泉投币
    if (frontX === 30 && frontY === 30 || (Math.abs(player.gridX-30)<=1 && Math.abs(player.gridY-30)<=1)) {
        const coinIdx = player.inventory.findIndex(i => i.type === 'coin');
        if (coinIdx !== -1) {
            player.inventory.splice(coinIdx, 1);
            updateInventoryUI();
            const fortunes = [
                "✨ 大吉！今天老板绝对不会转到你身后，安心摸鱼吧！",
                "✨ 中吉！今天适合在工位上偷偷喝一杯双倍糖的冰奶茶！",
                "✨ 小吉！你的代码和工作今天都会极度顺畅，一次就过！",
                "✨ 暖心！今天下班的路上，你可能会遇到一只主动蹭你的小猫。🐱"
            ];
            activeDialog = fortunes[Math.floor(Math.random() * fortunes.length)];
            // 喷泉溅水花特效
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
            activeDialog = "波光粼粼的像素许愿喷泉。向里面投掷一枚 [硬币] 可以测一测今天的摸鱼运势哦。";
        }
        return;
    }

    // 7. 流浪猫投喂
    if (frontX === worldObjects.cat.gridX && frontY === worldObjects.cat.gridY && !worldObjects.cat.isFollowing) {
        const fishIdx = player.inventory.findIndex(i => i.type === 'fish');
        if (fishIdx !== -1) {
            player.inventory.splice(fishIdx, 1);
            updateInventoryUI();
            worldObjects.cat.isFollowing = true;
            activeDialog = "🐱 咪呜~❤ 小猫高兴地吃下了小鱼干，轻轻蹭了蹭你，决定以后都跟着你走啦！";
        } else {
            activeDialog = "喵呜... 瘦弱的流浪猫怯生生地看着你，它好像很想吃美味的 [小鱼干] 。";
        }
        return;
    }
}

// 检查可拾取物品与踩水坑
function checkStepTriggers() {
    // 物品自动拾取
    const itemIdx = mapItems.findIndex(i => i.gridX === player.gridX && i.gridY === player.gridY);
    if (itemIdx !== -1) {
        const item = mapItems[itemIdx];
        player.inventory.push({ type: item.type, name: item.name });
        mapItems.splice(itemIdx, 1);
        updateInventoryUI();
    }

    // 踩水坑粒子动效触发
    const inPuddle = puddles.some(p => p.gridX === player.gridX && p.gridY === player.gridY);
    if (inPuddle) {
        for (let i = 0; i < 6; i++) {
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
    }
}

// 更新物品栏 UI 渲染
function updateInventoryUI() {
    const slots = document.getElementById('inventorySlots');
    slots.innerHTML = '';
    // 固定的 6 个展示格子格子
    for (let i = 0; i < 6; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'inventory-slot';
        slotEl.style.width = '50px';
        slotEl.style.height = '50px';
        slotEl.style.border = '2px solid #2c2c2c';
        slotEl.style.backgroundColor = '#f5f6fa';
        slotEl.style.display = 'flex';
        slotEl.style.justifyContent = 'center';
        slotEl.style.alignItems = 'center';
        slotEl.style.fontSize = '20px';
        slotEl.style.borderRadius = '4px';

        if (player.inventory[i]) {
            // 解析前置 Emoji 用于显示
            slotEl.innerText = player.inventory[i].name.split(' ')[0];
            slotEl.title = player.inventory[i].name;
        }
        slots.appendChild(slotEl);
    }
    document.getElementById('stats').innerText = `收集物品: ${player.inventory.length}`;
}

// ==========================================
// 6. 核心渲染与状态更新循环 (Game Loop)
// ==========================================
function update() {
    if (isPaused || isBossMode) return;

    // 平滑插值计算玩家角色的移动（平滑走格子过渡动画）
    if (player.isMoving) {
        if (player.pixelX < player.targetPixelX) player.pixelX = Math.min(player.pixelX + player.moveSpeed, player.targetPixelX);
        else if (player.pixelX > player.targetPixelX) player.pixelX = Math.max(player.pixelX - player.moveSpeed, player.targetPixelX);

        if (player.pixelY < player.targetPixelY) player.pixelY = Math.min(player.pixelY + player.moveSpeed, player.targetPixelY);
        else if (player.pixelY > player.targetPixelY) player.pixelY = Math.max(player.pixelY - player.moveSpeed, player.targetPixelY);

        // 到达网格目标点，释放锁状态
        if (player.pixelX === player.targetPixelX && player.pixelY === player.targetPixelY) {
            // 猫咪队列历史记录更新
            if (worldObjects.cat.isFollowing) {
                worldObjects.cat.history.push({ x: player.gridX, y: player.gridY });
                if (worldObjects.cat.history.length > 1) {
                    const trail = worldObjects.cat.history.shift();
                    worldObjects.cat.gridX = trail.x;
                    worldObjects.cat.gridY = trail.y;
                }
            }

            player.isMoving = false;
            checkStepTriggers(); // 触发踩格子事件
        }
    }

    // 电视机自动化邻近距离开关检测逻辑
    const distToTV = Math.sqrt(Math.pow(player.gridX - worldObjects.tv.gridX, 2) + Math.pow(player.gridY - worldObjects.tv.gridY, 2));
    worldObjects.tv.isOn = distToTV <= 2.5;
    if (worldObjects.tv.isOn) worldObjects.tv.animFrame++;

    // 八音盒音符粒子发射器
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

    // 长椅挂机治愈气泡定时器循环
    if (player.isSitting) {
        player.sitTimer++;
        if (player.sitTimer % 120 === 0 && Math.random() < 0.6) {
            const bubbles = ['❤️', '💤', '🎵', '☁️'];
            activeDialog = "💤 挂机治愈中... 头顶冒出气泡 " + bubbles[Math.floor(Math.random() * bubbles.length)] + " (按任意方向键起身)";
        }
    }

    // 更新粒子状态寿命
    particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(idx, 1);
    });
}

function draw() {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 摄像机镜头裁剪跟随计算 (Camera Bounds Control)
    let camX = player.pixelX - VIEW_WIDTH / 2 + TILE_SIZE / 2;
    let camY = player.pixelY - VIEW_HEIGHT / 2 + TILE_SIZE / 2;

    // 锁死镜头不穿过 100*100 的总地图边缘
    camX = Math.max(0, Math.min(camX, MAP_GRID * TILE_SIZE - VIEW_WIDTH));
    camY = Math.max(0, Math.min(camY, MAP_GRID * TILE_SIZE - VIEW_HEIGHT));

    // 计算当前可见视口的网格索引区间（极大提升渲染性能）
    const startX = Math.floor(camX / TILE_SIZE);
    const endX = Math.min(startX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1, MAP_GRID);
    const startY = Math.floor(camY / TILE_SIZE);
    const endY = Math.min(startY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1, MAP_GRID);

    // 1. 绘制像素地图格子
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const screenX = x * TILE_SIZE - camX;
            const screenY = y * TILE_SIZE - camY;

            if (gameMap[y][x] === 1) {
                ctx.fillStyle = '#9bbc0f'; // 复古浅绿草地像素
            } else {
                ctx.fillStyle = '#8b956d'; // 像素灰街道道路
            }
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

            // 绘制像素格子的细微网格边界线体现复古游戏质感
            ctx.strokeStyle = 'rgba(0,0,0,0.03)';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }

    // 2. 绘制路面上的水坑
    puddles.forEach(p => {
        const sx = p.gridX * TILE_SIZE - camX;
        const sy = p.gridY * TILE_SIZE - camY;
        ctx.fillStyle = '#4a69bd'; // 具有反光感的蓝色像素水坑
        ctx.fillRect(sx + 4, sy + 8, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#6a89cc'; // 水坑的高亮反光边边
        ctx.fillRect(sx + 6, sy + 10, 6, 2);
    });

    // 3. 绘制静态功能建筑/互动目标点
    // 售货机
    drawPixelSprite(15, 12, camX, camY, '#e74c3c', '🥤');
    // NPC 小姐姐
    drawPixelSprite(8, 15, camX, camY, '#fd79a8', '👧');
    // 夹娃娃机
    drawPixelSprite(25, 10, camX, camY, '#9b59b6', '🧸');
    // 八音盒
    drawPixelSprite(worldObjects.musicBox.gridX, worldObjects.musicBox.gridY, camX, camY, '#e67e22', '🎵');
    // 邮箱
    drawPixelSprite(30, 30, camX, camY, '#d63031', '✉️');

    // 绘制自动感应电视机 (带动态点亮检测渲染)
    const tvX = worldObjects.tv.gridX * TILE_SIZE - camX;
    const tvY = worldObjects.tv.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#2c3e50'; // 电视外壳
    ctx.fillRect(tvX, tvY, TILE_SIZE, TILE_SIZE);
    if (worldObjects.tv.isOn) {
        // 电视点亮时呈现动态闪烁色彩
        ctx.fillStyle = (Math.floor(worldObjects.tv.animFrame / 15) % 2 === 0) ? '#1abc9c' : '#f1c40f';
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
        ctx.fillStyle = '#000';
        ctx.font = '10px sans-serif';
        ctx.fillText('🐱', tvX + 10, tvY + 16);
    } else {
        ctx.fillStyle = '#111'; // 黑屏关机
        ctx.fillRect(tvX + 4, tvY + 4, TILE_SIZE - 8, TILE_SIZE - 12);
    }

    // 4. 绘制地图上掉落的地面物品
    mapItems.forEach(item => {
        const ix = item.gridX * TILE_SIZE - camX;
        const iy = item.gridY * TILE_SIZE - camY;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(ix + 16, iy + 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(item.type === 'coin' ? 'C' : 'F', ix + 12, iy + 20);
    });

    // 5. 绘制流浪小猫咪 (喂食后会像个尾巴一样粘着玩家)
    const catX = worldObjects.cat.gridX * TILE_SIZE - camX;
    const catY = worldObjects.cat.gridY * TILE_SIZE - camY;
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(catX + 6, catY + 10, 20, 16); // 猫身体
    ctx.fillStyle = '#d35400';
    ctx.fillRect(catX + 20, catY + 4, 6, 6);   // 猫头
    if (worldObjects.cat.isFollowing) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = '10px sans-serif';
        ctx.fillText('❤️', catX + 10, catY + 2); // 冒爱心
    }

    // 6. 绘制玩家小女孩主体像素形象
    const px = player.pixelX - camX;
    const py = player.pixelY - camY;
    ctx.fillStyle = '#ff7675'; // 裙子基础色
    ctx.fillRect(px + 4, py + 8, 24, 22);
    ctx.fillStyle = '#ffeaa7'; // 皮肤色面部像素
    ctx.fillRect(px + 8, py + 2, 16, 10);
    // 根据上下左右的朝向绘制眼睛像素点体现生动的朝向细节
    ctx.fillStyle = '#2d3436';
    if (player.direction === 'down' || player.direction === 'left') ctx.fillRect(px + 10, py + 5, 2, 3);
    if (player.direction === 'down' || player.direction === 'right') ctx.fillRect(px + 18, py + 5, 2, 3);
    if (player.direction === 'up') {
        ctx.fillStyle = '#d63031'; // 背面露出可爱的小红发带
        ctx.fillRect(px + 12, py + 1, 8, 2);
    }

    // 7. 渲染飞散的粒子特效组件
    particles.forEach(p => {
        const psx = p.x - camX;
        const psy = p.y - camY;
        ctx.fillStyle = p.color;
        if (p.isNote) {
            ctx.font = '12px sans-serif';
            ctx.fillText('🎵', psx, psy);
        } else {
            ctx.fillRect(psx, psy, 4, 4); // 标准正方形像素碎片颗粒
        }
    });

    // 8. 游戏内的通用全局像素对话文本框UI叠加
    if (activeDialog) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(40, VIEW_HEIGHT - 100, VIEW_WIDTH - 80, 80);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(42, VIEW_HEIGHT - 98, VIEW_WIDTH - 84, 76);

        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText(activeDialog, 60, VIEW_HEIGHT - 55);
    }
}

// 绘制带有 Emoji 小标签的模块化像素建筑方法
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

// 主时间轮询轴机制驱动
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ==========================================
// 7. 老板键功能与交互面板 UI 操作绑定
// ==========================================
function toggleBossMode() {
    isBossMode = !isBossMode;
    const gameContainer = document.getElementById('gameContainer');
    const bossScreen = document.getElementById('bossKeyScreen');

    if (isBossMode) {
        gameContainer.style.display = 'none';
        bossScreen.style.display = 'block';
        // 动态同步更新隐藏报表上的当前电脑时间
        const now = new Date();
        document.getElementById('bossKeyTime').innerText = now.toLocaleString();
    } else {
        bossScreen.style.display = 'none';
        gameContainer.style.display = 'flex';
        // 弹出安全重回暂停机制
        isPaused = true;
        document.getElementById('pauseDialog').style.display = 'flex';
    }
}

// 绑定 HTML 的暂停窗口按钮事件响应
document.getElementById('resumeBtn').addEventListener('click', () => {
    isPaused = false;
    document.getElementById('pauseDialog').style.display = 'none';
});

document.getElementById('hideBtn').addEventListener('click', () => {
    document.getElementById('pauseDialog').style.display = 'none';
    toggleBossMode();
});

// ==========================================
// 8. 跑起来！游戏开机启动引导
// ==========================================
updateInventoryUI();
// 初始化将部分动态事件提示语写入首帧让玩家一目了然
activeDialog = "欢迎来到像素城市街区！使用 W/A/S/D 移动，遇到建筑前方按 E 键展开有爱交互吧~";
loop();
