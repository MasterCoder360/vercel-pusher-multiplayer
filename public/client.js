// === YOUR PUSHER KEYS HERE ===
const PUSHER_KEY = '6291de89719e0ba9f19b';
const PUSHER_CLUSTER = 'us2'; // us2, eu, etc.

// === PUSHER SETUP ===
const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  forceTLS: true,
  authEndpoint: '/api/auth'
});

const channel = pusher.subscribe('world-channel');
let myPlayerId = 'player-' + Math.random().toString(36).substr(2, 9);

// === THREE.JS SETUP ===
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// === LIGHTING ===
const ambient = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

// === WORLD ===
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add some scenery
for (let i = 0; i < 20; i++) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 3, 8),
    new THREE.MeshLambertMaterial({ color: 0x228B22 })
  );
  tree.position.set(
    (Math.random() - 0.5) * 100,
    1.5,
    (Math.random() - 0.5) * 100
  );
  tree.castShadow = true;
  scene.add(tree);
}

// === GAME STATE ===
const myPlayer = { x: 0, y: 1, z: 0, rotY: 0, velocityY: 0, onGround: true };
const players = {};
const playerMeshes = {};

// === INPUT ===
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

let mouseX = 0, mouseY = 0;
document.addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === document.body) {
    mouseX -= e.movementX * 0.002;
    mouseY -= e.movementY * 0.002;
    mouseY = Math.max(-Math.PI/2, Math.min(Math.PI/2, mouseY));
  }
});

// === CHAT ===
const chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keypress', e => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    channel.trigger('client-chat', {
      id: myPlayerId,
      message: chatInput.value.trim()
    });
    chatInput.value = '';
  }
});

// === PUSHER EVENTS ===
channel.bind('pusher:subscription_succeeded', () => {
  addChatMessage('Connected to multiplayer world!');
});

channel.bind('client-playerMove', data => {
  if (!players[data.id]) {
    players[data.id] = data;
    createPlayerMesh(data.id, data);
    addChatMessage(`${data.id.slice(0,6)} joined`);
  } else {
    players[data.id] = data;
  }
});

channel.bind('client-chat', data => {
  addChatMessage(`${data.id.slice(0,6)}: ${data.message}`);
});

// === PLAYER MESH ===
function createPlayerMesh(id, data) {
  const group = new THREE.Group();
  
  // Body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 1.2, 4, 8),
    new THREE.MeshLambertMaterial({ 
      color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.5, 0.7, 0.6) 
    })
  );
  body.castShadow = true;
  group.add(body);
  
  // Nametag
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(id.slice(0,6), 64, 22);
  
  const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 1.3;
  sprite.scale.set(1.2, 0.3, 1);
  group.add(sprite);
  
  scene.add(group);
  playerMeshes[id] = group;
}

// === CHAT UI ===
function addChatMessage(msg) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  updatePlayerCount();
}

function updatePlayerCount() {
  document.getElementById('players').textContent = 
    `Players: ${Object.keys(players).length}`;
}

// === GAME LOOP ===
let lastMoveTime = 0;
function animate(time) {
  requestAnimationFrame(animate);
  
  // Movement
  const speed = 0.12;
  let moved = false;
  
  if (keys['KeyW']) { myPlayer.z -= speed; moved = true; }
  if (keys['KeyS']) { myPlayer.z += speed; moved = true; }
  if (keys['KeyA']) { myPlayer.x -= speed; moved = true; }
  if (keys['KeyD']) { myPlayer.x += speed; moved = true; }
  if (keys['Space'] && myPlayer.onGround) {
    myPlayer.velocityY = 0.25;
    myPlayer.onGround = false;
  }
  
  // Physics
  myPlayer.velocityY -= 0.015;
  myPlayer.y += myPlayer.velocityY;
  if (myPlayer.y <= 1) {
    myPlayer.y = 1;
    myPlayer.velocityY = 0;
    myPlayer.onGround = true;
  }
  
  myPlayer.rotY = mouseX;
  
  // Send updates (throttle to 50ms)
  if (moved && time - lastMoveTime > 50) {
    channel.trigger('client-playerMove', {
      id: myPlayerId,
      x: myPlayer.x, y: myPlayer.y, z: myPlayer.z, rotY: myPlayer.rotY,
      username: myPlayerId.slice(7)
    });
    lastMoveTime = time;
  }
  
  // Camera
  camera.position.set(myPlayer.x, myPlayer.y + 1.6, myPlayer.z);
  camera.rotation.set(mouseY, myPlayer.rotY, 0);
  
  // Update players
  Object.values(playerMeshes).forEach(mesh => {
    const id = Object.keys(playerMeshes).find(key => playerMeshes[key] === mesh);
    if (players[id]) {
      mesh.position.set(players[id].x, players[id].y, players[id].z);
      mesh.rotation.y = players[id].rotY;
    }
  });
  
  renderer.render(scene, camera);
}

// === RESIZE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updatePlayerCount();
animate(0);
