// ========================================
// 像素摸鱼小游戏 - 完整版本（修复移动逻辑）
// 包含：流浪猫、长椅、喷泉、老板键、粒子特效、NPC聊天
// ========================================

// 游戏配置
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    TILE_SIZE: 32,
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    COLORS: {
        GRASS: '#9bbc0f',
        ROAD: '#8b956d',
        BUILDING: '#4a3728',
        WATER: '#4f90d3',
        PUDDLE: '#2d5a8c'
    }
};

// ========================================
// 游戏状态管理
// ========================================
const gameState = {
    playerX: 10,
    playerY: 10,
    isMoving: false,  // ✅ 新增：控制移动的标志位
    lastMoveTime: 0,  // ✅ 新增：记录上一次移动的时间
    inventory: {
        coin: 0,
        driedFish: 0
    },
    isSitting: false,
    isChattingWithNPC: false,
    isPaused: false,
    isBossKeyActive: false,
    cat: {
        x: 20,
        y: 20,
        following: false,
        lastPlayerX: 10,
        lastPlayerY: 10
    },
    items: [],
    particles: [],
    puddles: [],
    npc: null
};

// ========================================
// 特殊地点定义
// ========================================
const specialLocations = {
    cat: { x: 20, y: 20, type: 'cat' },
    bench: { x: 30, y: 15, type: 'bench' },
    fountain: { x: 50, y: 50, type: 'fountain' }
};

// ========================================
// NPC 对话库
// ========================================
const NPCDialogues = [
    "嗨！今天的天气真的很适合在城市里散步呢。",
    "你要去售货机那里看看吗？我听说那里有新的草莓汽水哦。",
    "这只小猫咪一直在附近转悠，它是不是肚子饿了呀？",
    "工作真的好累呢...还好有这么一个可以放松的地方。",
    "你看天空中的云，是不是像棉花糖啊？",
    "最近发现了一家很不错的奶茶店，下次一起去试试吧！",
    "听说这个公园的晚上夜景超级漂亮呢。",
    "有没有推荐什么有趣的游戏呀？我最近有点无聊。",
    "我的小猫今天在家睡了一整天，太懒了。😸",
    "对了，这附近有一家很便宜的便利店，什么都有呢。"
];

// ========================================
// Canvas 初始化
// ========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;

// ========================================
// 输入管理（修复版）
// ========================================
const keys = {};
let pendingMove = null; // ✅ 记录待处理的移动方向

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // ✅ 方向键移动处理（只在 keydown 时触发一次）
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && !e.repeat && !gameState.isMoving) {
        pendingMove = { dx: 0, dy: -1 };
    }
    if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && !e.repeat && !gameState.isMoving) {
        pendingMove = { dx: 0, dy: 1 };
    }
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && !e.repeat && !gameState.isMoving) {
        pendingMove = { dx: -1, dy: 0 };
    }
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && !e.repeat && !gameState.isMoving) {
        pendingMove = { dx: 1, dy: 0 };
    }
    
    // E 键交互
    if ((e.key === 'e' || e.key === 'E') && !gameState.isBossKeyActive) {
        handleInteraction();
    }
    
    // Esc 老板键
    if (e.key === 'Escape') {
        toggleBossKey();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    // ✅ 重置移动状态当键释放时
    gameState.isMoving = false;
});

// ========================================
// 老板键系统
// ========================================
function toggleBossKey() {
    const bossKeyScreen = document.getElementById('bossKeyScreen');
    const pauseDialog = document.getElementById('pauseDialog');
    
    if (!gameState.isBossKeyActive) {
        // 进入老板键
        gameState.isBossKeyActive = true;
        gameState.isPaused = true;
        bossKeyScreen.classList.add('active');
        updateBossKeyTime();
    } else {
        // 退出老板键
        gameState.isBossKeyActive = false;
        bossKeyScreen.classList.remove('active');
        pauseDialog.classList.add('active');
    }
}

function updateBossKeyTime() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('bossKeyTime').textContent = timeStr;
}

// 暂停对话框事件
document.getElementById('resumeBtn')?.addEventListener('click', () => {
    gameState.isPaused = false;
    document.getElementById('pauseDialog').classList.remove('active');
});

document.getElementById('hideBtn')?.addEventListener('click', () => {
    const bossKeyScreen = document.getElementById('bossKeyScreen');
    const pauseDialog = document.getElementById('pauseDialog');
    gameState.isBossKeyActive = true;
    pauseDialog.classList.remove('active');
    bossKeyScreen.classList.add('active');
    updateBossKeyTime();
});

// ========================================
// 地图生成
// ========================================
function generateMap() {
    const map = [];
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            let tile = 'grass';
            
            // 道路
            if ((x === 25 && y >= 10 && y <= 40) || (y === 25 && x >= 10 && x <= 60)) {
                tile = 'road';
            }
            
            // 建筑
            if ((x >= 40 && x <= 45 && y >= 30 && y <= 35) ||
                (x >= 10 && x <= 15 && y >= 40 && y <= 45)) {
                tile = 'building';
            }
            
            // 水体
            if ((x >= 60 && x <= 65 && y >= 50 && y <= 55)) {
                tile = 'water';
            }
            
            row.push(tile);
        }
        map.push(row);
    }
    return map;
}

const gameMap = generateMap();

// 生成水坑
function generatePuddles() {
    const puddles = [];
    for (let i = 0; i < 6; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
            y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        } while (gameMap[y][x] !== 'road' || 
                 (x === 25 && y === 25) ||
                 puddles.some(p => Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3));
        
        puddles.push({ x, y });
    }
    return puddles;
}

gameState.puddles = generatePuddles();

// 生成 NPC
function generateNPC() {
    return {
        x: 35,
        y: 20,
        name: '小姐姐',
        currentDialogue: '',
        isActive: false
    };
}

gameState.npc = generateNPC();

// ========================================
// 地图绘制
// ========================================
function drawMap(offsetX, offsetY) {
    const startX = Math.floor(offsetX / CONFIG.TILE_SIZE);
    const startY = Math.floor(offsetY / CONFIG.TILE_SIZE);
    const endX = startX + Math.ceil(CONFIG.CANVAS_WIDTH / CONFIG.TILE_SIZE) + 1;
    const endY = startY + Math.ceil(CONFIG.CANVAS_HEIGHT / CONFIG.TILE_SIZE) + 1;
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) continue;
            
            const tile = gameMap[y][x];
            const screenX = x * CONFIG.TILE_SIZE - offsetX;
            const screenY = y * CONFIG.TILE_SIZE - offsetY;
            
            switch(tile) {
                case 'grass':
                    ctx.fillStyle = CONFIG.COLORS.GRASS;
                    ctx.fillRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.strokeRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    break;
                case 'road':
                    ctx.fillStyle = CONFIG.COLORS.ROAD;
                    ctx.fillRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.strokeRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    break;
                case 'building':
                    ctx.fillStyle = CONFIG.COLORS.BUILDING;
                    ctx.fillRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(screenX + 4, screenY + 4, 8, 8);
                    break;
                case 'water':
                    ctx.fillStyle = CONFIG.COLORS.WATER;
                    ctx.fillRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.strokeRect(screenX, screenY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    break;
            }
        }
    }
}

// ========================================
// 水坑绘制
// ========================================
function drawPuddles(offsetX, offsetY) {
    gameState.puddles.forEach(puddle => {
        const screenX = puddle.x * CONFIG.TILE_SIZE - offsetX;
        const screenY = puddle.y * CONFIG.TILE_SIZE - offsetY;
        const size = CONFIG.TILE_SIZE;
        
        // 水坑底色
        ctx.fillStyle = CONFIG.COLORS.PUDDLE;
        ctx.fillRect(screenX + 4, screenY + 8, size - 8, 16);
        
        // 水坑反光
        ctx.fillStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.fillRect(screenX + 6, screenY + 10, 8, 4);
        
        // 水坑边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX + 4, screenY + 8, size - 8, 16);
    });
}

// ========================================
// 粒子系统
// ========================================
class Particle {
    constructor(x, y, vx, vy, color, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // 重力
        this.lifetime--;
    }
    
    draw(ctx) {
        const alpha = this.lifetime / this.maxLifetime;
        ctx.fillStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.fillRect(this.x, this.y, 4, 4);
    }
}

function createWaterSplash(x, y, offsetX, offsetY) {
    const screenX = x * CONFIG.TILE_SIZE - offsetX + CONFIG.TILE_SIZE / 2;
    const screenY = y * CONFIG.TILE_SIZE - offsetY + CONFIG.TILE_SIZE / 2;
    
    // 生成8个水花粒子
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const speed = 2 + Math.random() * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 1;
        
        const particle = new Particle(
            screenX,
            screenY,
            vx,
            vy,
            'rgb(100, 150, 255)',
            30
        );
        gameState.particles.push(particle);
    }
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        gameState.particles[i].update();
        if (gameState.particles[i].lifetime <= 0) {
            gameState.particles.splice(i, 1);
        }
    }
}

function drawParticles(ctx) {
    gameState.particles.forEach(particle => {
        particle.draw(ctx);
    });
}

// ========================================
// 角色绘制
// ========================================
function drawPlayer(screenX, screenY) {
    const size = CONFIG.TILE_SIZE;
    
    if (gameState.isSitting) {
        // 坐下状态
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(screenX + 4, screenY + 16, size - 8, 12);
        
        ctx.fillStyle = '#ffc0cb';
        ctx.fillRect(screenX + 6, screenY + 2, size - 12, size - 14);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + 10, screenY + 6, 3, 3);
        ctx.fillRect(screenX + 19, screenY + 6, 3, 3);
        
        ctx.fillRect(screenX + 13, screenY + 12, 6, 2);
    } else {
        // 站立状态
        ctx.fillStyle = '#ffc0cb';
        ctx.fillRect(screenX + 6, screenY, size - 12, size - 8);
        
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(screenX + 8, screenY + 12, size - 16, size - 18);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + 10, screenY + 4, 3, 4);
        ctx.fillRect(screenX + 19, screenY + 4, 3, 4);
        
        ctx.fillRect(screenX + 13, screenY + 10, 6, 2);
    }
}

// ========================================
// 流浪猫绘制
// ========================================
function drawCat(x, y, offsetX, offsetY) {
    const screenX = x * CONFIG.TILE_SIZE - offsetX;
    const screenY = y * CONFIG.TILE_SIZE - offsetY;
    const size = CONFIG.TILE_SIZE;
    
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(screenX + 4, screenY + 10, size - 8, 12);
    
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(screenX + 8, screenY + 2, 16, 12);
    
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(screenX + 10, screenY, 4, 4);
    ctx.fillRect(screenX + 18, screenY, 4, 4);
    
    ctx.fillStyle = '#ff6347';
    ctx.fillRect(screenX + 11, screenY + 1, 2, 2);
    ctx.fillRect(screenX + 19, screenY + 1, 2, 2);
    
    ctx.fillStyle = '#000';
    ctx.fillRect(screenX + 12, screenY + 4, 3, 3);
    ctx.fillRect(screenX + 17, screenY + 4, 3, 3);
    
    ctx.fillStyle = '#fff';
    ctx.fillRect(screenX + 13, screenY + 5, 1, 1);
    ctx.fillRect(screenX + 18, screenY + 5, 1, 1);
    
    ctx.fillStyle = '#ff6347';
    ctx.fillRect(screenX + 15, screenY + 8, 2, 2);
}

// ========================================
// 长椅绘制
// ========================================
function drawBench(x, y, offsetX, offsetY) {
    const screenX = x * CONFIG.TILE_SIZE - offsetX;
    const screenY = y * CONFIG.TILE_SIZE - offsetY;
    const size = CONFIG.TILE_SIZE;
    
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(screenX + 2, screenY + 14, size - 4, 8);
    
    ctx.fillStyle = '#654321';
    ctx.fillRect(screenX + 4, screenY + 22, 4, 8);
    ctx.fillRect(screenX + size - 8, screenY + 22, 4, 8);
    
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(screenX + 3, screenY + 8, size - 6, 6);
    
    drawHeart(screenX + 12, screenY + 4, '#ff1493');
}

function drawHeart(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, 3);
    ctx.fillRect(x + 5, y, 3, 3);
    ctx.fillRect(x + 1, y + 3, 6, 2);
    ctx.fillRect(x + 2, y + 5, 4, 1);
}

// ========================================
// 喷泉绘制
// ========================================
function drawFountain(x, y, offsetX, offsetY) {
    const screenX = x * CONFIG.TILE_SIZE - offsetX;
    const screenY = y * CONFIG.TILE_SIZE - offsetY;
    const size = CONFIG.TILE_SIZE;
    
    ctx.fillStyle = '#808080';
    ctx.fillRect(screenX + 2, screenY + 10, size - 4, size - 12);
    
    ctx.fillStyle = '#4f90d3';
    ctx.fillRect(screenX + 6, screenY + 14, size - 12, size - 18);
    
    ctx.fillStyle = '#696969';
    ctx.fillRect(screenX + 12, screenY + 12, 8, 8);
    
    ctx.fillStyle = '#87ceeb';
    ctx.beginPath();
    ctx.arc(screenX + 16, screenY + 10, 3, 0, Math.PI * 2);
    ctx.fill();
}

// ========================================
// NPC 小姐姐绘制
// ========================================
function drawNPC(x, y, offsetX, offsetY) {
    const screenX = x * CONFIG.TILE_SIZE - offsetX;
    const screenY = y * CONFIG.TILE_SIZE - offsetY;
    const size = CONFIG.TILE_SIZE;
    
    // 长发
    ctx.fillStyle = '#333';
    ctx.fillRect(screenX + 4, screenY - 2, size - 8, 8);
    
    // 头部
    ctx.fillStyle = '#fdb4d4';
    ctx.fillRect(screenX + 6, screenY + 4, size - 12, 12);
    
    // 身体
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(screenX + 8, screenY + 14, size - 16, 12);
    
    // 眼睛
    ctx.fillStyle = '#000';
    ctx.fillRect(screenX + 10, screenY + 8, 3, 3);
    ctx.fillRect(screenX + 19, screenY + 8, 3, 3);
    
    // 眼睛高光
    ctx.fillStyle = '#fff';
    ctx.fillRect(screenX + 11, screenY + 9, 1, 1);
    ctx.fillRect(screenX + 20, screenY + 9, 1, 1);
    
    // 嘴巴
    ctx.fillStyle = '#ff6b9d';
    ctx.fillRect(screenX + 13, screenY + 14, 6, 2);
    
    // 腮红
    ctx.fillStyle = 'rgba(255, 105, 180, 0.4)';
    ctx.fillRect(screenX + 8, screenY + 10, 2, 2);
    ctx.fillRect(screenX + 22, screenY + 10, 2, 2);
}

// ========================================
// NPC 聊天提示框
// ========================================
function drawNPCPrompt(offsetX, offsetY) {
    const npc = gameState.npc;
    if (!npc || !canTalkToNPC()) return;
    
    const screenX = npc.x * CONFIG.TILE_SIZE - offsetX;
    const screenY = npc.y * CONFIG.TILE_SIZE - offsetY;
    
    // 提示框背景
    ctx.fillStyle = 'rgba(255, 192, 203, 0.9)';
    ctx.fillRect(screenX + 2, screenY - 20, 28, 16);
    
    // 提示框边框
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX + 2, screenY - 20, 28, 16);
    
    // 文字
    ctx.fillStyle = '#000';
    ctx.font = '10px Courier';
    ctx.fillText('按E', screenX + 8, screenY - 8);
}

// ========================================
// 物品绘制
// ========================================
function drawItems(offsetX, offsetY) {
    gameState.items.forEach(item => {
        const screenX = item.x * CONFIG.TILE_SIZE - offsetX;
        const screenY = item.y * CONFIG.TILE_SIZE - offsetY;
        const size = CONFIG.TILE_SIZE;
        
        if (item.type === 'coin') {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(screenX + 8, screenY + 8, 16, 16);
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX + 8, screenY + 8, 16, 16);
            
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(screenX + 12, screenY + 14, 8, 2);
        } else if (item.type === 'driedFish') {
            ctx.fillStyle = '#d2691e';
            ctx.fillRect(screenX + 6, screenY + 10, 20, 12);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(screenX + 8, screenY + 12, 2, 8);
            ctx.fillRect(screenX + 14, screenY + 12, 2, 8);
            ctx.fillRect(screenX + 20, screenY + 12, 2, 8);
        }
    });
}

// ========================================
// 碰撞检测
// ========================================
function canWalkOn(x, y) {
    if (x < 0 || x >= CONFIG.MAP_WIDTH || y < 0 || y >= CONFIG.MAP_HEIGHT) {
        return false;
    }
    return gameMap[y][x] !== 'building';
}

function getDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function canTalkToNPC() {
    const npc = gameState.npc;
    if (!npc) return false;
    return getDistance(gameState.playerX, gameState.playerY, npc.x, npc.y) <= 1 &&
           !gameState.isChattingWithNPC;
}

// ========================================
// 玩家移动更新（修复版）
// ========================================
function updatePlayer() {
    if (gameState.isSitting || gameState.isChattingWithNPC || gameState.isPaused) return;
    
    // ✅ 只处理待处理的移动
    if (pendingMove && !gameState.isMoving) {
        const newX = gameState.playerX + pendingMove.dx;
        const newY = gameState.playerY + pendingMove.dy;
        
        if (canWalkOn(newX, newY)) {
            gameState.playerX = newX;
            gameState.playerY = newY;
            gameState.isMoving = true;  // ✅ 标记为正在移动
            
            // 检查长椅
            if (gameState.playerX === specialLocations.bench.x && 
                gameState.playerY === specialLocations.bench.y) {
                gameState.isSitting = true;
                gameState.benchSitTime = Date.now();
                gameState.bubbleTime = Date.now();
            }
            
            // 检查水坑
            checkPuddleCollision();
        }
        
        pendingMove = null;  // ✅ 清除待处理的移动
    }
    
    // 猫咪跟随
    if (gameState.cat.following) {
        updateCatFollowing();
    }
}

// ========================================
// 水坑碰撞检测
// ========================================
function checkPuddleCollision() {
    const puddle = gameState.puddles.find(p => 
        p.x === gameState.playerX && p.y === gameState.playerY
    );
    
    if (puddle && !puddle.splashed) {
        puddle.splashed = true;
        const offsetX = gameState.playerX * CONFIG.TILE_SIZE - CONFIG.CANVAS_WIDTH / 2 + CONFIG.TILE_SIZE / 2;
        const offsetY = gameState.playerY * CONFIG.TILE_SIZE - CONFIG.CANVAS_HEIGHT / 2 + CONFIG.TILE_SIZE / 2;
        createWaterSplash(gameState.playerX, gameState.playerY, offsetX, offsetY);
        
        // 1秒后重置
        setTimeout(() => {
            puddle.splashed = false;
        }, 1000);
    }
}

// ========================================
// 猫咪跟随逻辑
// ========================================
function updateCatFollowing() {
    gameState.cat.x = gameState.cat.lastPlayerX;
    gameState.cat.y = gameState.cat.lastPlayerY;
    gameState.cat.lastPlayerX = gameState.playerX;
    gameState.cat.lastPlayerY = gameState.playerY;
}

// ========================================
// 物品生成
// ========================================
function generateItems() {
    const items = [];
    for (let i = 0; i < 8; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
            y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        } while (!canWalkOn(x, y) || 
                 (x === gameState.playerX && y === gameState.playerY) ||
                 (x >= 40 && x <= 45 && y >= 30 && y <= 35));
        
        items.push({
            x: x,
            y: y,
            type: Math.random() > 0.5 ? 'coin' : 'driedFish'
        });
    }
    return items;
}

gameState.items = generateItems();

// ========================================
// 物品拾取
// ========================================
function checkItemPickup() {
    for (let i = gameState.items.length - 1; i >= 0; i--) {
        const item = gameState.items[i];
        if (item.x === gameState.playerX && item.y === gameState.playerY) {
            if (item.type === 'coin') {
                gameState.inventory.coin++;
                createFloatingBubble(gameState.playerX, gameState.playerY, '🪙');
            } else if (item.type === 'driedFish') {
                gameState.inventory.driedFish++;
                createFloatingBubble(gameState.playerX, gameState.playerY, '🐟');
            }
            gameState.items.splice(i, 1);
            updateInventoryUI();
            break;
        }
    }
}

// ========================================
// 浮动气泡
// ========================================
function createFloatingBubble(x, y, text) {
    const bubble = document.createElement('div');
    bubble.className = 'floating-bubble';
    bubble.textContent = text;
    bubble.style.left = (x * CONFIG.TILE_SIZE + CONFIG.CANVAS_WIDTH / 2 - gameState.playerX * CONFIG.TILE_SIZE) + 'px';
    bubble.style.top = (y * CONFIG.TILE_SIZE + 100 - gameState.playerY * CONFIG.TILE_SIZE) + 'px';
    document.body.appendChild(bubble);
    
    setTimeout(() => bubble.remove(), 1500);
}

// ========================================
// 交互系统
// ========================================

// 流浪猫交互
function interactWithCat() {
    if (getDistance(gameState.playerX, gameState.playerY, 
                    specialLocations.cat.x, specialLocations.cat.y) <= 1) {
        if (gameState.inventory.driedFish > 0) {
            gameState.inventory.driedFish--;
            gameState.cat.following = true;
            gameState.cat.lastPlayerX = gameState.playerX - 1;
            gameState.cat.lastPlayerY = gameState.playerY;
            createFloatingBubble(specialLocations.cat.x, specialLocations.cat.y, '喵~❤');
            updateInventoryUI();
        } else {
            createFloatingBubble(specialLocations.cat.x, specialLocations.cat.y, '喵？');
        }
    }
}

// 喷泉交互
function interactWithFountain() {
    if (getDistance(gameState.playerX, gameState.playerY,
                    specialLocations.fountain.x, specialLocations.fountain.y) <= 1) {
        if (gameState.inventory.coin > 0) {
            gameState.inventory.coin--;
            showWishingDialog();
            updateInventoryUI();
        } else {
            showSimpleDialog('喷泉说', '需要一枚金币才能许愿呢~');
        }
    }
}

// NPC 交互
function interactWithNPC() {
    const npc = gameState.npc;
    if (!npc || !canTalkToNPC()) return;
    
    gameState.isChattingWithNPC = true;
    npc.currentDialogue = NPCDialogues[Math.floor(Math.random() * NPCDialogues.length)];
    showNPCDialog(npc);
}

// 统一交互处理
function handleInteraction() {
    if (gameState.dialogActive) return;
    
    interactWithCat();
    interactWithFountain();
    interactWithNPC();
}

// ========================================
// 对话框系统
// ========================================

const wishes = [
    '✨ 运势：大吉！\n今天老板绝对不会转到你身后。',
    '✨ 运势：中吉！\n适合在工位上偷偷喝一杯奶茶。',
    '✨ 运势：小吉！\n你的代码今天编译一次就能过。',
    '✨ 运势：上上签！\n今天不会被追bug..吧？',
    '✨ 运势：吉！\n下午茶时间会特别长。',
    '✨ 运势：平！\n平稳度过一天，不出问题最好。'
];

function showWishingDialog() {
    const randomWish = wishes[Math.floor(Math.random() * wishes.length)];
    const dialog = document.createElement('div');
    dialog.className = 'pixel-dialog';
    
    const title = document.createElement('div');
    title.className = 'pixel-dialog-title';
    title.textContent = '今日摸鱼运势';
    
    const content = document.createElement('div');
    content.className = 'pixel-dialog-content';
    content.textContent = randomWish;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pixel-dialog-close';
    closeBtn.textContent = '知道了';
    closeBtn.onclick = () => {
        dialog.remove();
        gameState.dialogActive = false;
    };
    
    dialog.appendChild(title);
    dialog.appendChild(content);
    dialog.appendChild(closeBtn);
    document.body.appendChild(dialog);
    
    gameState.dialogActive = true;
}

function showNPCDialog(npc) {
    const dialog = document.createElement('div');
    dialog.className = 'pixel-dialog';
    
    const title = document.createElement('div');
    title.className = 'pixel-dialog-title';
    title.textContent = npc.name + '说：';
    
    const content = document.createElement('div');
    content.className = 'pixel-dialog-content';
    content.textContent = npc.currentDialogue;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pixel-dialog-close';
    closeBtn.textContent = '好的呢';
    closeBtn.onclick = () => {
        dialog.remove();
        gameState.isChattingWithNPC = false;
        gameState.dialogActive = false;
    };
    
    dialog.appendChild(title);
    dialog.appendChild(content);
    dialog.appendChild(closeBtn);
    document.body.appendChild(dialog);
    
    gameState.dialogActive = true;
}

function showSimpleDialog(title, content) {
    const dialog = document.createElement('div');
    dialog.className = 'pixel-dialog';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'pixel-dialog-title';
    titleDiv.textContent = title;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'pixel-dialog-content';
    contentDiv.textContent = content;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pixel-dialog-close';
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => {
        dialog.remove();
        gameState.dialogActive = false;
    };
    
    dialog.appendChild(titleDiv);
    dialog.appendChild(contentDiv);
    dialog.appendChild(closeBtn);
    document.body.appendChild(dialog);
    
    gameState.dialogActive = true;
}

// ========================================
// 长椅挂机气泡
// ========================================
const bubbles = ['Zzz...', '❤', '🎵'];

function updateBenchBubbles() {
    if (!gameState.isSitting) return;
    
    const now = Date.now();
    if (now - gameState.bubbleTime > 2000) {
        const bubble = bubbles[Math.floor(Math.random() * bubbles.length)];
        createFloatingBubble(gameState.playerX, gameState.playerY - 1, bubble);
        gameState.bubbleTime = now;
    }
}

// 站起来（修复版）
window.addEventListener('keydown', (e) => {
    if (gameState.isSitting && 
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
         e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
         e.key === 'w' || e.key === 'W' || 
         e.key === 'a' || e.key === 'A' || 
         e.key === 's' || e.key === 'S' || 
         e.key === 'd' || e.key === 'D')) {
        gameState.isSitting = false;
        gameState.isMoving = false;  // ✅ 重置移动状态
    }
    
    // 关闭 NPC 对话
    if (gameState.isChattingWithNPC && 
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
         e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
         e.key === 'e' || e.key === 'E')) {
        gameState.isChattingWithNPC = false;
        gameState.dialogActive = false;
        gameState.isMoving = false;  // ✅ 重置移动状态
    }
});

// ========================================
// UI 更新
// ========================================
function updateInventoryUI() {
    const inventorySlots = document.getElementById('inventorySlots');
    inventorySlots.innerHTML = '';
    
    if (gameState.inventory.coin > 0) {
        const coinItem = document.createElement('div');
        coinItem.className = 'inventory-item';
        coinItem.innerHTML = `
            <span class="inventory-item-emoji">🪙</span>
            <span>金币</span>
            <span class="inventory-item-count">${gameState.inventory.coin}</span>
        `;
        inventorySlots.appendChild(coinItem);
    }
    
    if (gameState.inventory.driedFish > 0) {
        const fishItem = document.createElement('div');
        fishItem.className = 'inventory-item';
        fishItem.innerHTML = `
            <span class="inventory-item-emoji">🐟</span>
            <span>小鱼干</span>
            <span class="inventory-item-count">${gameState.inventory.driedFish}</span>
        `;
        inventorySlots.appendChild(fishItem);
    }
    
    if (gameState.inventory.coin === 0 && gameState.inventory.driedFish === 0) {
        inventorySlots.innerHTML = '<div style="color: #999; font-size: 11px; padding: 8px; text-align: center;">物品栏为空</div>';
    }
    
    const total = gameState.inventory.coin + gameState.inventory.driedFish;
    document.getElementById('stats').textContent = `收集物品: ${total}`;
}

// ========================================
// 主游戏循环
// ========================================
function gameLoop() {
    if (gameState.isBossKeyActive) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const offsetX = gameState.playerX * CONFIG.TILE_SIZE - CONFIG.CANVAS_WIDTH / 2 + CONFIG.TILE_SIZE / 2;
    const offsetY = gameState.playerY * CONFIG.TILE_SIZE - CONFIG.CANVAS_HEIGHT / 2 + CONFIG.TILE_SIZE / 2;
    
    // 清空画布
    ctx.fillStyle = '#e0f4f7';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    
    // 绘制地图
    drawMap(offsetX, offsetY);
    
    // 绘制水坑
    drawPuddles(offsetX, offsetY);
    
    // 绘制特殊地点
    drawBench(specialLocations.bench.x, specialLocations.bench.y, offsetX, offsetY);
    drawFountain(specialLocations.fountain.x, specialLocations.fountain.y, offsetX, offsetY);
    
    // 绘制 NPC
    drawNPC(gameState.npc.x, gameState.npc.y, offsetX, offsetY);
    drawNPCPrompt(offsetX, offsetY);
    
    // 绘制猫咪
    drawCat(specialLocations.cat.x, specialLocations.cat.y, offsetX, offsetY);
    if (gameState.cat.following) {
        drawCat(gameState.cat.x, gameState.cat.y, offsetX, offsetY);
    }
    
    // 绘制物品
    drawItems(offsetX, offsetY);
    
    // 绘制玩家
    const playerScreenX = CONFIG.CANVAS_WIDTH / 2 - CONFIG.TILE_SIZE / 2;
    const playerScreenY = CONFIG.CANVAS_HEIGHT / 2 - CONFIG.TILE_SIZE / 2;
    drawPlayer(playerScreenX, playerScreenY);
    
    // 绘制粒子
    drawParticles(ctx);
    
    // 更新游戏逻辑
    if (!gameState.isPaused) {
        updatePlayer();
        checkItemPickup();
        updateBenchBubbles();
        updateParticles();
    }
    
    requestAnimationFrame(gameLoop);
}

// 初始化 UI
updateInventoryUI();

// 启动游戏循环
gameLoop();
