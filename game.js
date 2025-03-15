// Game state
let score = 0;
let powerLevel = 0;
let isPoweringUp = false;
let gameStarted = false;
let playerPosition = new THREE.Vector3(0, 0, 3); // Moved player closer
let moveSpeed = 0.1; // Player movement speed
let perfectRelease = 0.5; // Perfect release point
let releaseMargin = 0.1; // Margin of error for perfect release
let moveDirection = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Adjust camera FOV and position for better view
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
document.body.style.width = '100vw';
document.body.style.height = '100vh';
document.getElementById('game-container').style.position = 'fixed';
document.getElementById('game-container').style.top = '0';
document.getElementById('game-container').style.left = '0';
document.getElementById('game-container').style.width = '100vw';
document.getElementById('game-container').style.height = '100vh';
document.getElementById('game-container').appendChild(renderer.domElement);

// Cannon.js physics world setup
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
scene.add(directionalLight);

// Court - adjust size for better proportions
const courtGeometry = new THREE.BoxGeometry(16, 0.1, 12);
const courtMaterial = new THREE.MeshPhongMaterial({ color: 0x4a90e2 });
const court = new THREE.Mesh(courtGeometry, courtMaterial);
court.receiveShadow = true;
scene.add(court);

const courtBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(8, 0.05, 6))
});
world.addBody(courtBody);

// Basketball
const ballRadius = 0.12;
const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b3d });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
ball.castShadow = true;
scene.add(ball);

const ballShape = new CANNON.Sphere(ballRadius);
const ballBody = new CANNON.Body({
    mass: 1,
    shape: ballShape,
    position: new CANNON.Vec3(0, 1.5, 4),
    material: new CANNON.Material({ restitution: 0.8 })
});
world.addBody(ballBody);

// Basketball Hoop
const hoopRadius = 0.2;
const hoopGeometry = new THREE.TorusGeometry(hoopRadius, 0.02, 16, 32);
const hoopMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const hoop = new THREE.Mesh(hoopGeometry, hoopMaterial);
hoop.position.set(0, 2, -3);
hoop.rotation.x = Math.PI / 2;
scene.add(hoop);

// Backboard
const backboardGeometry = new THREE.BoxGeometry(1.2, 0.9, 0.1);
const backboardMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
const backboard = new THREE.Mesh(backboardGeometry, backboardMaterial);
backboard.position.set(0, 2.2, -3.2);
scene.add(backboard);

const backboardBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(0.6, 0.45, 0.05)),
    position: new CANNON.Vec3(0, 2.2, -3.2)
});
world.addBody(backboardBody);

// Player model
const playerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8);
const playerMaterial = new THREE.MeshPhongMaterial({ color: 0x2244ff });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.copy(playerPosition);
player.position.y = 0.9; // Half height of player
scene.add(player);

// Camera setup - adjust these values for better view
camera.position.set(0, 3, 5); // Adjusted height and distance for better centering
camera.lookAt(0, 0.5, 0);

// Power meter elements
const powerMeter = document.getElementById('power-fill');
const scoreDisplay = document.getElementById('score');
const instructions = document.getElementById('instructions');
const perfectReleaseIndicator = document.getElementById('perfect-release');
const releaseZone = document.getElementById('release-zone');

// Game functions
function resetBall() {
    const offset = new THREE.Vector3(0, 1.5, 0.5); // Ball appears in front of player
    ballBody.position.copy(playerPosition.clone().add(offset));
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
}

function updatePerfectReleasePoint() {
    const hoopPosition = new THREE.Vector3(0, 2, -3);
    const distanceToHoop = playerPosition.distanceTo(hoopPosition);
    
    // Make the perfect release zone larger and more centered
    perfectRelease = 0.5; // Always in the middle
    releaseMargin = 0.15; // Very large margin for easier perfect releases
    
    // Update visual indicators for vertical meter
    perfectReleaseIndicator.style.bottom = `${perfectRelease * 100}%`;
    releaseZone.style.bottom = `${(perfectRelease - releaseMargin) * 100}%`;
    releaseZone.style.height = `${releaseMargin * 2 * 100}%`;
}

function shootBall() {
    const hoopPosition = new THREE.Vector3(0, 2, -3);
    const distanceToHoop = playerPosition.distanceTo(hoopPosition);
    
    // Calculate release quality (0 to 1, where 1 is perfect)
    const releaseQuality = 1 - Math.min(1, Math.abs(powerLevel - perfectRelease) / releaseMargin);
    
    // Calculate shot chance based on release quality
    let makeChance;
    if (releaseQuality > 0.7) {
        // Green zone - 100% chance
        makeChance = 1;
    } else if (releaseQuality > 0.5) {
        // Close to green - 75% chance
        makeChance = 0.75;
    } else if (releaseQuality > 0.3) {
        // Decent timing - 50% chance
        makeChance = 0.5;
    } else {
        // Poor timing - 25% chance
        makeChance = 0.25;
    }
    
    // Roll for shot success
    const isSuccessful = Math.random() < makeChance;
    
    if (isSuccessful) {
        // Teleport ball through perfect arc to hoop
        const arcPoints = 50; // Number of points in the arc
        let arcIndex = 0;
        
        // Clear any existing interval
        if (window.shotInterval) clearInterval(window.shotInterval);
        
        // Create smooth arc animation
        window.shotInterval = setInterval(() => {
            arcIndex++;
            
            if (arcIndex >= arcPoints) {
                clearInterval(window.shotInterval);
                // Increment score at the end of animation
                score++;
                scoreDisplay.textContent = score;
                return;
            }
            
            const progress = arcIndex / arcPoints;
            const height = Math.sin(progress * Math.PI) * 2; // Arc height
            
            // Calculate position along arc
            ballBody.position.x = playerPosition.x + (hoopPosition.x - playerPosition.x) * progress;
            ballBody.position.y = playerPosition.y + 1.5 + height;
            ballBody.position.z = playerPosition.z + (hoopPosition.z - playerPosition.z) * progress;
            
            // Stop all motion
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
        }, 20); // Update every 20ms for smooth animation
        
    } else {
        // Miss animation - make it clearly miss
        const missOffset = (Math.random() - 0.5) * 2; // Random direction for miss
        const missHeight = 2 + Math.random() * 2; // Random height
        
        // Clear any existing interval
        if (window.shotInterval) clearInterval(window.shotInterval);
        
        // Create miss animation
        const arcPoints = 30;
        let arcIndex = 0;
        
        window.shotInterval = setInterval(() => {
            arcIndex++;
            
            if (arcIndex >= arcPoints) {
                clearInterval(window.shotInterval);
                return;
            }
            
            const progress = arcIndex / arcPoints;
            const height = Math.sin(progress * Math.PI) * missHeight;
            
            // Calculate position along miss arc
            ballBody.position.x = playerPosition.x + (hoopPosition.x - playerPosition.x + missOffset) * progress;
            ballBody.position.y = playerPosition.y + 1.5 + height;
            ballBody.position.z = playerPosition.z + (hoopPosition.z - playerPosition.z + missOffset) * progress;
            
            // Stop all motion
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
        }, 20);
    }
    
    powerLevel = 0;
    powerMeter.style.height = '0%';
}

function updatePowerMeter() {
    if (isPoweringUp) {
        // Slower power increase for better control
        powerLevel = Math.min(powerLevel + 0.006, 1); // Even slower meter
        powerMeter.style.height = `${powerLevel * 100}%`;
    }
}

function checkScore() {
    // Scoring is now handled in the shoot function
}

function updatePlayerPosition() {
    const movement = new THREE.Vector3(0, 0, 0);
    
    if (moveDirection.forward) movement.z -= moveSpeed;
    if (moveDirection.backward) movement.z += moveSpeed;
    if (moveDirection.left) movement.x -= moveSpeed;
    if (moveDirection.right) movement.x += moveSpeed;
    
    // Adjust court boundaries
    const newPosition = playerPosition.clone().add(movement);
    if (Math.abs(newPosition.x) < 7 && Math.abs(newPosition.z) < 5) {
        playerPosition.add(movement);
        player.position.copy(playerPosition);
        player.position.y = 0.9;
        
        // Smoother camera following with adjusted height and distance
        camera.position.x = playerPosition.x;
        camera.position.z = playerPosition.z + 5;
        camera.position.y = 3;
        camera.lookAt(playerPosition.x, 0.5, playerPosition.z - 2);
    }
    
    updatePerfectReleasePoint();
}

// Event listeners
window.addEventListener('mousedown', () => {
    if (!gameStarted) {
        gameStarted = true;
        instructions.style.display = 'none';
        return;
    }
    isPoweringUp = true;
});

window.addEventListener('mouseup', () => {
    if (isPoweringUp) {
        isPoweringUp = false;
        shootBall();
    }
});

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        resetBall();
    }
    switch(event.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveDirection.forward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveDirection.backward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveDirection.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveDirection.right = true;
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch(event.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveDirection.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveDirection.backward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveDirection.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveDirection.right = false;
            break;
    }
});

window.addEventListener('resize', () => {
    // Update camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Update renderer with pixel ratio
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, true);
});

// Animation loop
const timeStep = 1 / 60;
function animate() {
    requestAnimationFrame(animate);
    
    world.step(timeStep);
    
    updatePlayerPosition();
    
    // Update ball position
    ball.position.copy(ballBody.position);
    ball.quaternion.copy(ballBody.quaternion);
    
    updatePowerMeter();
    checkScore();
    
    renderer.render(scene, camera);
}

animate();

// Initialize perfect release indicator
updatePerfectReleasePoint();

// Update instructions
instructions.innerHTML = `
    <h2>How to Play</h2>
    <p>Use WASD or Arrow Keys to move</p>
    <p>Click and hold to power up your shot</p>
    <p>Release when the meter hits the green zone</p>
    <p>Press SPACE to reset the ball</p>
    <p>Click anywhere to start</p>
`; 