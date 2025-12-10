
// Ultimate Jumping Game - all upgrades
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const assets = {
  bg1: 'assets/bg_layer1.png',
  bg2: 'assets/bg_layer2.png',
  bg3: 'assets/bg_layer3.png',
  player: 'assets/player_sheet.png',
  obs1: 'assets/obs1.png',
  obs2: 'assets/obs2.png',
  obs3: 'assets/obs3.png',
  power_inv: 'assets/power_inv.png',
  power_mul: 'assets/power_mul.png'
};

let images = {};
let loaded = 0, totalImages = Object.keys(assets).length;

// load images
for(const k in assets){
  const img = new Image();
  img.src = assets[k];
  img.onload = ()=>{ images[k]=img; loaded++; };
  img.onerror = ()=>{ console.warn('failed load',assets[k]); loaded++; images[k]=null; };
}

// UI elements
const startBtn = document.getElementById('startBtn');
const menu = document.getElementById('menu');
const gameArea = document.getElementById('gameArea');
const gameOver = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const highscoreEl = document.getElementById('highscore');
const besttimeEl = document.getElementById('besttime');
const finalScore = document.getElementById('finalScore');
const finalTime = document.getElementById('finalTime');
const jumpBtn = document.getElementById('jumpBtn');
const difficultySel = document.getElementById('difficulty');
const themeSel = document.getElementById('theme');
const powerWrap = document.getElementById('powerWrap');

let keys = {};
let lastTime = 0;
let running = false;
let score = 0;
let startTime = 0;
let elapsed = 0;
let highscore = parseInt(localStorage.getItem('jg_highscore')||'0');
let besttime = parseFloat(localStorage.getItem('jg_besttime')||'0');

highscoreEl.textContent = highscore;
besttimeEl.textContent = besttime;

let player = {
  x:80, y:0, w:48, h:48, vy:0, gravity:1400, jumpPower:480, onGround:false,
  frame:0, frameTimer:0
};

let groundY = H - 48;
let obstacles = [];
let powers = [];
let spawnTimer = 0, spawnInterval = 1400;
let difficulty = 'normal';
let theme = 'school';
let bgOffset = [0,0,0];

// difficulty settings
const DIFF = {
  easy:{speedFactor:0.8, spawn:1600},
  normal:{speedFactor:1, spawn:1400},
  hard:{speedFactor:1.35, spawn:1100},
  hod:{speedFactor:1.8, spawn:800}
};

// game state flags
let invincible = false;
let invTimer = 0;
let scoreMultiplier = 1;
let mulTimer = 0;

// audio using WebAudio simple tones
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = AudioCtx ? new AudioCtx() : null;
function beep(freq, time=0.06, vol=0.2){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type='sine'; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + time);
}

// helpers
function rand(a,b){ return Math.random()*(b-a)+a; }

// collision with padding
function rectsOverlap(a,b){
  const p = 6;
  return (a.x+p < b.x+b.w-p && a.x+a.w-p > b.x+p && a.y+p < b.y+b.h-p && a.y+a.h-p > b.y+p);
}

// spawn obstacle
function spawnObstacle(){
  const type = Math.floor(Math.random()*3) + 1;
  const w = 40 + Math.random()*30;
  const h = 40;
  const y = groundY - h;
  const speed = 220 * DIFF[difficulty].speedFactor * (1 + Math.random()*0.2);
  const img = (type===1?images.obs1:(type===2?images.obs2:images.obs3));
  obstacles.push({x: W + 60, y, w, h, speed, type, img});
}

// spawn power-ups
function spawnPower(){
  const kind = Math.random()<0.6 ? 'inv' : 'mul';
  const img = kind==='inv' ? images.power_inv : images.power_mul;
  powers.push({x:W+60, y: groundY - 130, w:40, h:40, kind, img, speed:160});
}

// update game
function update(dt){
  // background offsets parallax
  bgOffset[0] = (bgOffset[0] + 20*dt) % images.bg1.width;
  bgOffset[1] = (bgOffset[1] + 40*dt) % images.bg2.width;
  bgOffset[2] = (bgOffset[2] + 80*dt) % images.bg3.width;

  // player physics
  player.vy += player.gravity * dt;
  player.y += player.vy * dt;
  if(player.y + player.h >= groundY){
    player.y = groundY - player.h;
    player.vy = 0;
    player.onGround = true;
  } else player.onGround = false;

  // animation frames
  player.frameTimer += dt;
  if(player.onGround){
    if(player.frameTimer > 0.12){ player.frame = (player.frame+1) % 2; player.frameTimer = 0; }
  } else {
    player.frame = player.vy < 0 ? 2 : 3;
  }

  // jump input
  if((keys[' ']||keys['Space']||keys['ArrowUp']) && player.onGround){ player.vy = -player.jumpPower; beep(520,0.05,0.08); }

  // spawn logic based on difficulty
  spawnTimer += dt*1000;
  const intervalBase = DIFF[difficulty].spawn;
  if(spawnTimer > intervalBase){
    spawnTimer = 0;
    // spawn obstacle
    if(Math.random() < 0.85) spawnObstacle(); else spawnPower();
    // gradually shorten spawn
    // no-op: DIFF controls baseline
  }

  // move obstacles
  for(let i=obstacles.length-1;i>=0;i--){
    const ob = obstacles[i];
    ob.x -= ob.speed * dt;
    if(ob.x + ob.w < -50) obstacles.splice(i,1);
    else if(!invincible && rectsOverlap(player, ob)){
      // hit
      gameOverSequence();
    } else if(invincible && rectsOverlap(player, ob)){
      // destroy obstacle
      obstacles.splice(i,1);
      score += 20 * scoreMultiplier;
      beep(880,0.06,0.06);
    }
  }

  // move powers
  for(let i=powers.length-1;i>=0;i--){
    const p = powers[i];
    p.x -= p.speed * dt;
    if(p.x + p.w < -50) powers.splice(i,1);
    else if(rectsOverlap(player, p)){
      // collect
      if(p.kind==='inv'){ invincible = true; invTimer = 5; }
      else { scoreMultiplier = 2; mulTimer = 8; }
      powers.splice(i,1);
      beep(720,0.08,0.09);
    }
  }

  // timers
  if(invincible){ invTimer -= dt; if(invTimer <= 0){ invincible=false; } }
  if(scoreMultiplier>1){ mulTimer -= dt; if(mulTimer <= 0){ scoreMultiplier=1; } }

  // scoring & time
  if(running){ score += dt * 12 * scoreMultiplier; }
  elapsed = (performance.now() - startTime)/1000;
  scoreEl.textContent = Math.floor(score);
  timeEl.textContent = elapsed.toFixed(1);

  // update power UI
  powerWrap.innerHTML = invincible ? 'Shield' : (scoreMultiplier>1 ? 'x2' : '');
}

// draw scene
function draw(){
  // clear
  ctx.clearRect(0,0,W,H);

  // draw backgrounds tiled with parallax
  if(images.bg1){
    const i = images.bg1;
    for(let x = -bgOffset[0]; x < W; x += i.width) ctx.drawImage(i, x, 0, i.width, H);
  } else { ctx.fillStyle='#89b4ff'; ctx.fillRect(0,0,W,H); }

  if(images.bg2){
    const i = images.bg2;
    for(let x = -bgOffset[1]; x < W; x += i.width) ctx.drawImage(i, 0, 40, i.width, H-40, x, 20, i.width, H-40);
  }

  if(images.bg3){
    const i = images.bg3;
    for(let x = -bgOffset[2]; x < W; x += i.width) ctx.drawImage(i, 0, 60, i.width, H-60, x, 40, i.width, H-60);
  }

  // ground
  ctx.fillStyle = '#cfe0ff';
  ctx.fillRect(0, groundY, W, H-groundY);

  // obstacles
  obstacles.forEach(o=>{
    if(o.img) ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    else { ctx.fillStyle='#b33'; ctx.fillRect(o.x,o.y,o.w,o.h); }
  });

  // powers
  powers.forEach(p=>{
    if(p.img) ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
    else { ctx.fillStyle='#fb0'; ctx.fillRect(p.x,p.y,p.w,p.h); }
  });

  // player (sprite)
  const ps = images.player;
  if(ps){
    const fw = 64, fh = 64;
    const sx = player.frame * fw;
    ctx.drawImage(ps, sx, 0, fw, fh, player.x, player.y-8, player.w, player.h+8);
  } else {
    ctx.fillStyle='#0a3'; ctx.fillRect(player.x,player.y,player.w,player.h);
  }

  // overlay invincible
  if(invincible){
    ctx.strokeStyle='rgba(255,215,0,0.9)'; ctx.lineWidth=3;
    ctx.strokeRect(player.x-6, player.y-6, player.w+12, player.h+12);
  }
}

// game over
function gameOverSequence(){
  running = false;
  // show game over panel
  finalScore.textContent = 'Score: ' + Math.floor(score);
  finalTime.textContent = 'Time: ' + elapsed.toFixed(1) + 's';
  // save highscore
  if(Math.floor(score) > highscore){
    highscore = Math.floor(score);
    localStorage.setItem('jg_highscore', String(highscore));
    highscoreEl.textContent = highscore;
  }
  if(elapsed > besttime){
    besttime = elapsed;
    localStorage.setItem('jg_besttime', String(besttime));
    besttimeEl.textContent = besttime.toFixed(1);
  }
  gameArea.classList.add('hidden');
  gameOver.classList.remove('hidden');
  beep(160,0.2,0.12);
}

// start game
function startGame(){
  difficulty = document.getElementById('difficulty').value;
  theme = document.getElementById('theme').value;
  // difficulty adjustments
  spawnInterval = DIFF[difficulty].spawn;
  spawnTimer = 0;
  obstacles = []; powers = [];
  invincible=false; invTimer=0; scoreMultiplier=1; mulTimer=0;
  score = 0; startTime = performance.now(); elapsed = 0;
  player.x = 80; player.y = groundY - player.h; player.vy = 0;
  running = true;
  gameOver.classList.add('hidden');
  gameArea.classList.remove('hidden');
  menu.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

// main loop
function loop(ts){
  if(!lastTime) lastTime = ts;
  const dt = Math.min(0.05, (ts - lastTime)/1000);
  lastTime = ts;
  if(running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

// inputs
window.addEventListener('keydown', e=>{
  keys[e.key]=true;
  if(!running && e.key==='Enter') startGame();
});
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

jumpBtn.addEventListener('touchstart', ()=>{ if(player.onGround) player.vy = -player.jumpPower; });
jumpBtn.addEventListener('mousedown', ()=>{ if(player.onGround) player.vy = -player.jumpPower; });

// click handlers
startBtn.addEventListener('click', ()=>{ startGame(); });
restartBtn.addEventListener('click', ()=>{ startGame(); });
menuBtn.addEventListener('click', ()=>{ gameOver.classList.add('hidden'); menu.classList.remove('hidden'); gameArea.classList.add('hidden'); });

// initial placement
player.y = groundY - player.h;

// simple auto-spawn power every 7-12s
setInterval(()=>{ if(running && Math.random()<0.5) spawnPower(); }, 8000);

// preload check finish loader (not shown)
setTimeout(()=>{ /* images likely loaded */ }, 800);

// expose for debugging
window._jg = { startGame, spawnObstacle, spawnPower };
