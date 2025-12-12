// 反应测试游戏主逻辑
class ReactionGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.gameState = 'start'; // start, playing, paused, gameover
        this.difficulty = 'easy';
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalBlocks = 0;
        this.gameTime = 60; // 60秒游戏时间
        this.timeLeft = this.gameTime;
        this.gameTimer = null;
        
        // 游戏参数（根据难度调整）
        this.difficultySettings = {
            easy: { 
                speed: 2, 
                spawnRate: 1.5, 
                perfectWindow: 150, 
                color: '#00ff88'
            },
            medium: { 
                speed: 3, // 中等 = 简单 × 1.5
                spawnRate: 1.8, 
                perfectWindow: 120, 
                color: '#ffcc00'
            },
            hard: { 
                speed: 4, // 困难 = 简单 × 2
                spawnRate: 2.2, 
                perfectWindow: 100, 
                color: '#ff416c'
            }
        };
        
        // 轨道配置
        this.tracks = [
            { x: 0, width: this.canvas.width / 4, color: '#ff416c', key: 'q' },
            { x: this.canvas.width / 4, width: this.canvas.width / 4, color: '#ffcc00', key: 'w' },
            { x: this.canvas.width / 2, width: this.canvas.width / 4, color: '#00ff88', key: 'e' },
            { x: this.canvas.width * 3 / 4, width: this.canvas.width / 4, color: '#4169e1', key: 'r' }
        ];
        
        // 下落块数组
        this.blocks = [];
        this.spawnTimer = 0;
        
        // 命中区域
        this.hitZone = {
            y: this.canvas.height - 40,
            height: 30
        };
        
        // 反应时间记录
        this.reactionTimes = [];
        
        // 按键状态
        this.keys = {};
        
        // 游戏记录
        this.gameRecords = JSON.parse(localStorage.getItem('reactionGameRecords') || '[]');
        
        // 音效
        this.audioContext = null;
        this.sounds = {};
        
        // 初始化
        this.init();
        this.setupEventListeners();
        this.setupAudio();
        this.displayRecords();
    }
    
    init() {
        // 设置画布大小
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        
        // 更新命中区域
        this.hitZone.y = this.canvas.height - 40;
        
        // 重置游戏数据
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.totalHits = 0;
        this.totalBlocks = 0;
        this.timeLeft = this.gameTime;
        this.blocks = [];
        this.reactionTimes = [];
        
        // 更新UI
        this.updateUI();
        this.updateButtons();
    }
    
    setupEventListeners() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            
            // 高亮显示按下的键
            const keyElements = {
                'q': document.getElementById('keyQ'),
                'w': document.getElementById('keyW'),
                'e': document.getElementById('keyE'),
                'r': document.getElementById('keyR')
            };
            
            if (keyElements[key]) {
                keyElements[key].classList.add('active');
            }
            
            // 检查是否命中块
            if (this.gameState === 'playing') {
                this.checkHit(key);
            }
        });
        
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
            
            // 移除高亮
            const keyElements = {
                'q': document.getElementById('keyQ'),
                'w': document.getElementById('keyW'),
                'e': document.getElementById('keyE'),
                'r': document.getElementById('keyR')
            };
            
            if (keyElements[key]) {
                keyElements[key].classList.remove('active');
            }
        });
        
        // 触摸控制（移动端）
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            // 检查点击位置对应的轨道
            const trackIndex = Math.floor(x / (this.canvas.width / 4));
            if (trackIndex >= 0 && trackIndex < 4) {
                const key = ['q', 'w', 'e', 'r'][trackIndex];
                this.keys[key] = true;
                
                // 高亮显示
                const keyId = 'key' + key.toUpperCase();
                document.getElementById(keyId).classList.add('active');
                
                // 检查命中
                if (this.gameState === 'playing') {
                    this.checkHit(key);
                }
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            ['q', 'w', 'e', 'r'].forEach(key => {
                this.keys[key] = false;
                const keyId = 'key' + key.toUpperCase();
                document.getElementById(keyId).classList.remove('active');
            });
        });
    }
    
    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 创建音调函数
            this.createTone = (frequency, duration = 0.1) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + duration);
            };
            
            // 定义不同命中评级的音调
            this.sounds = {
                perfect: () => this.createTone(800, 0.2),
                good: () => this.createTone(600, 0.15),
                miss: () => this.createTone(300, 0.3)
            };
            
        } catch (e) {
            console.log('音频不支持或已禁用');
            // 提供备用方案
            this.sounds = {
                perfect: () => {},
                good: () => {},
                miss: () => {}
            };
        }
    }
    
    startGame() {
        this.init();
        this.gameState = 'playing';
        
        // 隐藏开始屏幕
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        // 更新按钮状态
        this.updateButtons();
        
        // 开始游戏计时器
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            document.getElementById('time').textContent = this.timeLeft + 's';
            
            if (this.timeLeft <= 0) {
                this.gameOver(true); // 正常结束
            }
        }, 1000);
        
        // 开始游戏循环
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            clearInterval(this.gameTimer);
            this.updateButtons();
        }
    }
    
    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.gameTimer = setInterval(() => {
                this.timeLeft--;
                document.getElementById('time').textContent = this.timeLeft + 's';
                
                if (this.timeLeft <= 0) {
                    this.gameOver(true); // 正常结束
                }
            }, 1000);
            this.updateButtons();
            this.lastTime = performance.now();
            this.gameLoop();
        }
    }
    
    endGame() {
        if (this.gameState === 'playing' || this.gameState === 'paused') {
            this.gameState = 'gameover';
            clearInterval(this.gameTimer);
            
            // 终止游戏，不显示成绩
            document.getElementById('startScreen').classList.remove('hidden');
            document.getElementById('gameOverScreen').classList.add('hidden');
            this.updateButtons();
        }
    }
    
    gameOver(isNormalEnd = false) {
        this.gameState = 'gameover';
        clearInterval(this.gameTimer);
        
        // 计算准确率
        const accuracy = this.totalBlocks > 0 ? (this.totalHits / this.totalBlocks) * 100 : 100;
        this.accuracy = accuracy;
        
        // 只有正常结束时才记录成绩
        if (isNormalEnd) {
            this.saveRecord();
            this.displayRecords();
            
            // 显示游戏结束屏幕
            document.getElementById('gameOverScreen').classList.remove('hidden');
            document.getElementById('finalScore').textContent = this.score;
            document.getElementById('finalCombo').textContent = this.maxCombo;
            document.getElementById('finalAccuracy').textContent = this.accuracy.toFixed(1) + '%';
            
            // 设置难度显示
            const difficultyText = this.difficulty === 'easy' ? '简单模式' : 
                                 this.difficulty === 'medium' ? '中等模式' : '困难模式';
            document.getElementById('finalDifficulty').textContent = difficultyText;
        } else {
            // 返回开始菜单
            document.getElementById('startScreen').classList.remove('hidden');
        }
        
        this.updateButtons();
    }
    
    saveRecord() {
        const record = {
            id: Date.now(), // 使用时间戳作为唯一ID
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            score: this.score,
            maxCombo: this.maxCombo,
            accuracy: this.accuracy,
            difficulty: this.difficulty
        };
        
        this.gameRecords.unshift(record); // 添加到开头
        
        // 只保留最近20条记录
        if (this.gameRecords.length > 20) {
            this.gameRecords = this.gameRecords.slice(0, 20);
        }
        
        // 保存到本地存储
        localStorage.setItem('reactionGameRecords', JSON.stringify(this.gameRecords));
    }
    
    deleteRecord(recordId) {
        // 从数组中删除指定记录
        this.gameRecords = this.gameRecords.filter(record => record.id !== recordId);
        
        // 保存到本地存储
        localStorage.setItem('reactionGameRecords', JSON.stringify(this.gameRecords));
        
        // 重新显示记录
        this.displayRecords();
    }
    
    clearAllRecords() {
        if (confirm('确定要清空所有游戏记录吗？此操作不可撤销！')) {
            this.gameRecords = [];
            localStorage.removeItem('reactionGameRecords');
            this.displayRecords();
        }
    }
    
    displayRecords() {
        const recordsList = document.getElementById('recordsList');
        
        if (this.gameRecords.length === 0) {
            recordsList.innerHTML = '<div class="no-records">暂无游戏记录<br>开始游戏来创建记录吧！</div>';
            return;
        }
        
        let recordsHTML = '';
        
        this.gameRecords.forEach((record, index) => {
            const difficultyText = record.difficulty === 'easy' ? '简单' : 
                                 record.difficulty === 'medium' ? '中等' : '困难';
            
            recordsHTML += `
                <div class="record-item" data-id="${record.id}">
                    <div class="record-info">
                        <div class="record-stat">
                            <div class="record-stat-value">${record.score}</div>
                            <div class="record-stat-label">得分</div>
                        </div>
                        <div class="record-stat">
                            <div class="record-stat-value">${record.maxCombo}</div>
                            <div class="record-stat-label">最高连击</div>
                        </div>
                        <div class="record-stat">
                            <div class="record-stat-value">${record.accuracy.toFixed(1)}%</div>
                            <div class="record-stat-label">准确率</div>
                        </div>
                        <div class="record-stat">
                            <div class="record-stat-value">${difficultyText}</div>
                            <div class="record-stat-label">难度</div>
                        </div>
                    </div>
                    <div style="width: 100%; text-align: center; color: #666; font-size: 0.8em; margin-top: 5px;">
                        ${record.date} ${record.time}
                    </div>
                    <button class="delete-btn" onclick="deleteRecord(${record.id})">删除</button>
                </div>
            `;
        });
        
        recordsList.innerHTML = recordsHTML;
    }
    
    updateButtons() {
        const startBtn = document.getElementById('startBtn');
        const modeBtn = document.getElementById('modeBtn');
        
        switch (this.gameState) {
            case 'start':
                startBtn.textContent = '开始游戏';
                startBtn.disabled = false;
                modeBtn.textContent = '难度选择';
                modeBtn.classList.remove('end-btn');
                break;
                
            case 'playing':
                startBtn.textContent = '暂停游戏';
                startBtn.disabled = false;
                modeBtn.textContent = '终止游戏';
                modeBtn.classList.add('end-btn');
                break;
                
            case 'paused':
                startBtn.textContent = '继续游戏';
                startBtn.disabled = false;
                modeBtn.textContent = '终止游戏';
                modeBtn.classList.add('end-btn');
                break;
                
            case 'gameover':
                startBtn.textContent = '开始游戏';
                startBtn.disabled = false;
                modeBtn.textContent = '难度选择';
                modeBtn.classList.remove('end-btn');
                break;
        }
    }
    
    handleModeButton() {
        if (this.gameState === 'start' || this.gameState === 'gameover') {
            // 在开始界面或游戏结束界面，点击难度选择按钮返回开始界面
            document.getElementById('gameOverScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
            this.gameState = 'start';
            this.updateButtons();
            this.showDifficultySelector();
        } else if (this.gameState === 'playing' || this.gameState === 'paused') {
            // 游戏中或暂停时，点击终止游戏
            this.endGame();
        }
    }
    
    showDifficultySelector() {
        // 切换难度选择器的显示状态
        const diffButtons = document.querySelectorAll('.diff-btn');
        diffButtons.forEach(btn => {
            btn.style.animation = 'none';
            setTimeout(() => {
                btn.style.animation = 'pulse 0.5s';
            }, 10);
        });
    }
    
    setDifficulty(diff) {
        this.difficulty = diff;
        
        // 更新按钮状态
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 找到对应难度的按钮并激活
        const targetBtn = document.querySelector(`.diff-btn[data-difficulty="${diff}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }
    
    spawnBlock() {
        const settings = this.difficultySettings[this.difficulty];
        const track = Math.floor(Math.random() * 4);
        
        this.blocks.push({
            x: this.tracks[track].x,
            y: -50,
            width: this.tracks[track].width,
            height: 40,
            color: this.tracks[track].color,
            track: track,
            key: this.tracks[track].key,
            speed: settings.speed,
            spawnTime: Date.now(),
            hit: false,
            missed: false
        });
        
        this.totalBlocks++;
    }
    
    updateBlocks(deltaTime) {
        const settings = this.difficultySettings[this.difficulty];
        
        // 更新块位置
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            
            // 更新位置
            block.y += block.speed * (deltaTime / 16);
            
            // 检查是否超出屏幕（未命中）
            if (block.y > this.canvas.height + 50 && !block.hit && !block.missed) {
                block.missed = true;
                this.combo = 0;
                this.showComboText('Miss!', 'miss');
                this.sounds.miss();
                this.updateUI();
            }
            
            // 移除超出屏幕的块
            if (block.y > this.canvas.height + 100) {
                this.blocks.splice(i, 1);
            }
        }
        
        // 生成新块（无限生成）
        this.spawnTimer += deltaTime;
        const spawnInterval = 1000 / settings.spawnRate;
        
        if (this.spawnTimer > spawnInterval) {
            this.spawnBlock();
            this.spawnTimer = 0;
        }
    }
    
    checkHit(key) {
        const settings = this.difficultySettings[this.difficulty];
        const currentTime = Date.now();
        
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            
            if (block.key === key && !block.hit && !block.missed) {
                // 检查块是否在命中区域内
                const blockBottom = block.y + block.height;
                const hitZoneTop = this.hitZone.y;
                const hitZoneBottom = this.hitZone.y + this.hitZone.height;
                
                if (blockBottom >= hitZoneTop && block.y <= hitZoneBottom) {
                    // 计算反应时间
                    const reactionTime = currentTime - block.spawnTime;
                    this.reactionTimes.push(reactionTime);
                    
                    // 计算命中精度
                    const distanceFromCenter = Math.abs(blockBottom - (hitZoneTop + this.hitZone.height / 2));
                    
                    // 判断命中评级
                    let rating;
                    let points;
                    
                    if (distanceFromCenter < settings.perfectWindow / 2) {
                        rating = 'perfect';
                        points = 100;
                        this.sounds.perfect();
                        this.showComboText('Perfect!', 'perfect');
                    } else if (distanceFromCenter < settings.perfectWindow) {
                        rating = 'good';
                        points = 50;
                        this.sounds.good();
                        this.showComboText('Good!', 'perfect');
                    } else {
                        rating = 'late';
                        points = 20;
                        this.sounds.good();
                    }
                    
                    // 更新分数和连击
                    this.combo++;
                    this.maxCombo = Math.max(this.maxCombo, this.combo);
                    
                    // 连击加成
                    const comboMultiplier = Math.min(2.0, 1.0 + (this.combo - 1) * 0.1);
                    const finalPoints = Math.floor(points * comboMultiplier);
                    
                    this.score += finalPoints;
                    this.totalHits++;
                    block.hit = true;
                    
                    // 更新UI
                    this.updateUI();
                    
                    // 播放命中效果
                    this.playHitEffect(block);
                    
                    return;
                }
            }
        }
        
        // 如果按了键但没有命中任何块，中断连击
        if (['q', 'w', 'e', 'r'].includes(key)) {
            this.combo = 0;
            this.showComboText('Miss!', 'miss');
            this.sounds.miss();
            this.updateUI();
        }
    }
    
    playHitEffect(block) {
        // 创建命中粒子效果
        const particles = [];
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: block.x + block.width / 2,
                y: block.y + block.height / 2,
                size: Math.random() * 5 + 2,
                speedX: (Math.random() - 0.5) * 10,
                speedY: (Math.random() - 0.5) * 10,
                color: block.color,
                life: 1.0
            });
        }
        
        // 绘制粒子效果
        const animateParticles = () => {
            this.ctx.save();
            
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                
                p.x += p.speedX;
                p.y += p.speedY;
                p.life -= 0.02;
                
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                
                if (p.life <= 0) {
                    particles.splice(i, 1);
                }
            }
            
            this.ctx.restore();
            
            if (particles.length > 0) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        animateParticles();
    }
    
    showComboText(text, type) {
        const comboDisplay = document.getElementById('comboDisplay');
        comboDisplay.textContent = text;
        comboDisplay.className = `combo ${type}`;
        comboDisplay.style.opacity = '1';
        
        // 动画效果
        comboDisplay.style.transform = 'translate(-50%, -50%) scale(1.2)';
        
        setTimeout(() => {
            comboDisplay.style.opacity = '0';
            comboDisplay.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 500);
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = this.combo + 'x';
        
        // 计算准确率
        const accuracy = this.totalBlocks > 0 ? (this.totalHits / this.totalBlocks) * 100 : 100;
        document.getElementById('accuracy').textContent = accuracy.toFixed(1) + '%';
    }
    
    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制渐变背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, 'rgba(15, 12, 41, 1)');
        gradient.addColorStop(1, 'rgba(36, 36, 62, 1)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格背景
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let i = 1; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width * i / 4, 0);
            this.ctx.lineTo(this.canvas.width * i / 4, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let i = 1; i < 10; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.canvas.height * i / 10);
            this.ctx.lineTo(this.canvas.width, this.canvas.height * i / 10);
            this.ctx.stroke();
        }
        
        // 绘制轨道
        this.tracks.forEach((track, index) => {
            // 轨道背景
            this.ctx.fillStyle = `rgba(${this.hexToRgb(track.color)}, 0.1)`;
            this.ctx.fillRect(track.x, 0, track.width, this.canvas.height);
            
            // 轨道发光效果
            const trackGradient = this.ctx.createLinearGradient(track.x, 0, track.x + track.width, 0);
            trackGradient.addColorStop(0, `rgba(${this.hexToRgb(track.color)}, 0)`);
            trackGradient.addColorStop(0.5, `rgba(${this.hexToRgb(track.color)}, 0.05)`);
            trackGradient.addColorStop(1, `rgba(${this.hexToRgb(track.color)}, 0)`);
            this.ctx.fillStyle = trackGradient;
            this.ctx.fillRect(track.x, 0, track.width, this.canvas.height);
            
            // 轨道底部按键提示
            this.ctx.fillStyle = track.color;
            this.ctx.font = 'bold 28px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = track.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillText(
                track.key.toUpperCase(),
                track.x + track.width / 2,
                this.canvas.height - 20
            );
            this.ctx.shadowBlur = 0;
        });
        
        // 绘制命中区域
        const hitGradient = this.ctx.createLinearGradient(0, this.hitZone.y, 0, this.hitZone.y + this.hitZone.height);
        hitGradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
        hitGradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.5)');
        hitGradient.addColorStop(1, 'rgba(0, 255, 136, 0.3)');
        this.ctx.fillStyle = hitGradient;
        this.ctx.fillRect(0, this.hitZone.y, this.canvas.width, this.hitZone.height);
        
        // 命中区域发光边框
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#00ff88';
        this.ctx.shadowBlur = 15;
        this.ctx.strokeRect(0, this.hitZone.y, this.canvas.width, this.hitZone.height);
        this.ctx.shadowBlur = 0;
        
        // 绘制块
        this.blocks.forEach(block => {
            // 块主体
            this.ctx.fillStyle = block.color;
            this.ctx.shadowColor = block.color;
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.roundRect(block.x + 2, block.y, block.width - 4, block.height, 5);
            this.ctx.fill();
            
            // 如果被命中，添加发光效果
            if (block.hit) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.beginPath();
                this.ctx.roundRect(block.x + 2, block.y, block.width - 4, block.height, 5);
                this.ctx.fill();
            }
            
            // 如果错过，变暗
            if (block.missed) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                this.ctx.beginPath();
                this.ctx.roundRect(block.x + 2, block.y, block.width - 4, block.height, 5);
                this.ctx.fill();
            }
            
            this.ctx.shadowBlur = 0;
            
            // 块上的按键提示
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            this.ctx.shadowBlur = 2;
            this.ctx.fillText(
                block.key.toUpperCase(),
                block.x + block.width / 2,
                block.y + block.height / 2
            );
            this.ctx.shadowBlur = 0;
        });
        
        // 绘制连击提示
        if (this.combo >= 5) {
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.font = 'bold 50px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = '#ffcc00';
            this.ctx.shadowBlur = 20;
            this.ctx.fillText(
                this.combo + ' COMBO!',
                this.canvas.width / 2,
                this.canvas.height / 2 - 50
            );
            this.ctx.shadowBlur = 0;
        }
        
        // 绘制暂停状态
        if (this.gameState === 'paused') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = '#00ff88';
            this.ctx.shadowBlur = 15;
            this.ctx.fillText('游戏暂停', this.canvas.width / 2, this.canvas.height / 2 - 30);
            this.ctx.shadowBlur = 0;
            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = '#ccc';
            this.ctx.fillText('点击"继续游戏"按钮继续', this.canvas.width / 2, this.canvas.height / 2 + 30);
        }
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '0, 0, 0';
    }
    
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 更新游戏状态
        this.updateBlocks(deltaTime);
        
        // 绘制游戏
        this.draw();
        
        // 继续游戏循环
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// 游戏初始化
let game;

window.onload = function() {
    game = new ReactionGame();
    
    // 全局函数供按钮调用
    window.toggleGame = () => {
        if (game.gameState === 'start' || game.gameState === 'gameover') {
            game.startGame();
        } else if (game.gameState === 'playing') {
            game.pauseGame();
        } else if (game.gameState === 'paused') {
            game.resumeGame();
        }
    };
    
    window.handleModeButton = () => game.handleModeButton();
    window.setDifficulty = (diff) => game.setDifficulty(diff);
    window.deleteRecord = (recordId) => game.deleteRecord(recordId);
    window.clearAllRecords = () => game.clearAllRecords();
};