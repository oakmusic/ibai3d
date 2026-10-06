// ===== Configuración =====
const TEX = {
    color:     'texture_pbr_20250901.png',
    normal:    'texture_pbr_20250901_normal.png',
    metallic:  'texture_pbr_20250901_metallic.png',
    roughness: 'texture_pbr_20250901_roughness.png'
};
const SPEED = 3.0;         // unidades por segundo
const CHAR_HEIGHT = 1.8;   // altura del personaje en el juego

// 1. Escena, cámara y renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 3, -6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Luces y suelo
scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const grid = new THREE.GridHelper(200, 100, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// 3. Variables
let mixer, character, current;
const actions = {};
const clock = new THREE.Clock();
const loader = new THREE.FBXLoader();

// 4. Cargar personaje
loader.load('personaje.fbx', function (object) {
    document.getElementById('loading').style.display = 'none';
    character = object;

    // Escala automática y pies en el suelo
    const box = new THREE.Box3().setFromObject(character);
    character.scale.setScalar(CHAR_HEIGHT / (box.max.y - box.min.y));
    character.position.set(0, 0, 0);
    const box2 = new THREE.Box3().setFromObject(character);
    character.position.y -= box2.min.y;

    // Texturas PBR
    const texLoader = new THREE.TextureLoader();
    const load = (url, srgb) => {
        const t = texLoader.load(url, undefined, undefined,
            () => console.warn('No se encontró ' + url));
        if (srgb) t.encoding = THREE.sRGBEncoding;
        return t;
    };
    const colorMap     = load(TEX.color, true);
    const normalMap    = load(TEX.normal, false);
    const metallicMap  = load(TEX.metallic, false);
    const roughnessMap = load(TEX.roughness, false);

    character.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        const mat = new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    metalness: 0,      // sin metal: así se ve el color de la textura
    roughness: 1,
    side: THREE.DoubleSide,
    skinning: !!child.isSkinnedMesh
});
        child.material = Array.isArray(child.material)
            ? child.material.map(() => mat)
            : mat;
    });

    scene.add(character);
    mixer = new THREE.AnimationMixer(character);
    loadAnim('idle', 'idle.fbx');
    loadAnim('walk', 'walk.fbx');
}, undefined, function (error) {
    console.error('Error cargando personaje.fbx:', error);
    document.getElementById('loading').textContent = 'Error al cargar personaje.fbx';
});

// Animaciones separadas (Idle / Walking de Mixamo)
function loadAnim(name, file) {
    loader.load(file, obj => {
        const clip = obj.animations[0];
        if (!clip) return;
        actions[name] = mixer.clipAction(clip);
        if (name === 'idle') playAction('idle');
    }, undefined, () => console.warn('No se pudo cargar ' + file));
}

function playAction(name) {
    const next = actions[name];
    if (!next || next === current) return;
    next.reset().fadeIn(0.25).play();
    if (current) current.fadeOut(0.25);
    current = next;
}

// 5. Entrada: joystick + teclado
const input = { x: 0, y: 0 };
const keys = {};

const joystick = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '75px', bottom: '75px' },
    color: 'white'
});
joystick.on('move', (evt, data) => {
    const mag = Math.min(data.force, 1);
    input.x = data.vector.x * mag;
    input.y = data.vector.y * mag;
});
joystick.on('end', () => { input.x = 0; input.y = 0; });

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// 6. Bucle del juego
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    if (character) {
        let ix = input.x + ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
        let iy = input.y + ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
        const mag = Math.min(Math.hypot(ix, iy), 1);

        if (mag > 0.1) {
            // La cámara mira hacia +Z: arriba = +Z, derecha en pantalla = -X
            const dx = -ix, dz = iy;
            const target = Math.atan2(dx, dz);
            let diff = target - character.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            character.rotation.y += diff * Math.min(1, 10 * delta);

            const len = Math.hypot(dx, dz);
            character.position.x += (dx / len) * mag * SPEED * delta;
            character.position.z += (dz / len) * mag * SPEED * delta;
            playAction('walk');
        } else {
            playAction('idle');
        }

        camera.position.set(character.position.x, character.position.y + 3, character.position.z - 6);
        camera.lookAt(character.position.x, character.position.y + 1, character.position.z);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
