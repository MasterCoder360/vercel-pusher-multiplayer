// YOUR KEYS - LIVE!
const PUSHER_KEY = '6291de89719e0ba9f19b';
const PUSHER_CLUSTER = 'us2';

const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  forceTLS: true
});
const channel = pusher.subscribe('world-channel');
const myPlayerId = 'player-' + Date.now();

// THREE.JS - FIXED VERSION
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// LIGHTING
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// GROUND
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// PLAYERS
const players = {};
const playerMeshes = {};

// PLAYER
const myPlayer = { x: 0, y: 2, z: 0, rotY: 0, velocityY: 0, onGround: true };

// INPUT
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);
document.addEventListener('click', () => document.body.requestPointerLock());

let mouseX = 0, mouseY = 0;
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === document.body) {
    mouseX -= e.movementX * 0.002;
    mouseY -= e.movementY * 0.002;
    mouseY = Math.max(-Math.PI/2, Math.min(Math.PI/2, mouseY));
  }
});

// CHAT - FIXED
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

// PUSHER EVENTS
channel.bind('pusher:subscription_succeeded', () => {
  console.log('✅ PUSHER CONNECTED!');
  addChatMessage('Connected to 3D World!');
});

channel.bind('client-playerMove', data => {
  players[data.id] = data;
});

channel.bind('client-chat', data => {
  addChatMessage(`${data.id.slice(0,6)}: ${data.message}`);
});

// CREATE PLAYER MESH
function createPlayerMesh(id) {
  const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
  const material = new THREE.MeshLambertMaterial({ 
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6) 
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);
  playerMeshes[id] = mesh;
}

// CHAT UI
function addChatMessage(msg) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  document.getElementById('players').textContent = `Players: ${Object.keys(players).length + 1}`;
}

// GAME LOOP
let lastUpdate = 0;
function animate(time) {
  requestAnimationFrame(animate);
  
  const speed = 0.12;
  let moved = false;
  
  if (keys['KeyW']) { myPlayer.z -= speed; moved = true; }
  if (keys['KeyS']) { myPlayer.z += speed; moved = true; }
  if (keys['KeyA']) { myPlayer.x -= speed; moved = true; }
  if (keys['KeyD']) { myPlayer.x += speed; moved = true; }
  if (keys['Space'] && myPlayer.onGround) {
    myPlayer.velocityY = 0.2;
    myPlayer.onGround = false;
  }
  
  myPlayer.velocityY -= 0.01;
  myPlayer.y += myPlayer.velocityY;
  if (myPlayer.y <= 2) {
    myPlayer.y = 2;
    myPlayer.velocityY = 0;
    myPlayer.onGround = true;
  }
  
  myPlayer.rotY = mouseX;
  
  if (moved && time - lastUpdate > 50) {
    channel.trigger('client-playerMove', {
      id: myPlayerId,
      x: myPlayer.x, y: myPlayer.y, z: myPlayer.z, rotY: myPlayer.rotY
    });
    lastUpdate = time;
  }
  
  camera.position.set(myPlayer.x, myPlayer.y + 1.6, myPlayer.z);
  camera.rotation.set(mouseY, myPlayer.rotY, 0);
  
  Object.keys(players).forEach(id => {
    if (!playerMeshes[id]) createPlayerMesh(id);
    const mesh = playerMeshes[id];
    const player = players[id];
    if (player) {
      mesh.position.set(player.x, player.y, player.z);
      mesh.rotation.y = player.rotY;
    }
  });
  
  renderer.render(scene, camera);
}

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate(0);
