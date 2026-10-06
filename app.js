// ===== Configuración =====
const TEX = {
    color:     'texture_pbr_20250901.png',
    normal:    'texture_pbr_20250901_normal.png',
    roughness: 'texture_pbr_20250901_roughness.png'
};
// 'basic'    = sin luces (test: si así se ve con color, la textura está bien)
// 'standard' = con luces, normal y roughness
// 'original' = deja el material que trae el propio FBX
const MATERIAL_MODE = 'basic';
const SPEED = 3.0;
const CHAR_HEIGHT = 1.8;
const CAM_DIST = 3.5;     // distancia detrás del personaje (menos = más cerca)
const CAM_HEIGHT = 1.8;   // altura de la cámara
const CAM_LOOK = 1.0;     // altura del punto al que mira (1.0 = torso)

// Mostrar cualquier error en pantalla
function showError(msg) {
    const el = document.getElementById('loading');
    el.style.display = 'block';
    el.style.maxWidth = '80%';
    el.textContent = msg;
}
window.addEventListener('error', e => showError('Error: ' + e.message));
window.addEventListener('unhandledrejection', e => showError('Error: ' + e.reason));

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
let jumping = false;
let dancing = false;
const actions = {};
const clock = new THREE.Clock();
const loader = new THREE.FBXLoader();

// 4. Cargar personaje
loader.load('personaje.fbx', function (object) {
    document.getElementById('loading').style.display = 'none';
    character = object;

    const box = new THREE.Box3().setFromObject(character);
    character.scale.setScalar(CHAR_HEIGHT / (box.max.y - box.min.y));
    character.position.set(0, 0, 0);
    const box2 = new THREE.Box3().setFromObject(character);
    character.position.y -= box2.min.y;

    const texLoader = new THREE.TextureLoader();
    const load = (url, srgb) => {
        const t = texLoader.load(url, undefined, undefined,
            () => console.warn('No se encontró ' + url));
        if (srgb) t.encoding = THREE.sRGBEncoding;
        return t;
    };
    const colorMap     = load(TEX.color, true);
    const normalMap    = load(TEX.normal, false);
    const roughnessMap = load(TEX.roughness, false);

    character.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        console.log('Mesh:', child.name,
            '| UV:', !!child.geometry.attributes.uv,
            '| normales:', !!child.geometry.attributes.normal,
            '| skinned:', !!child.isSkinnedMesh);

        if (MATERIAL_MODE === 'original') return;

        let mat;
        if (MATERIAL_MODE === 'basic') {
            mat = new THREE.MeshBasicMaterial({
                map: colorMap,
                side: THREE.DoubleSide,
                skinning: !!child.isSkinnedMesh
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                map: colorMap,
                normalMap: normalMap,
                roughnessMap: roughnessMap,
                metalness: 0,
                roughness: 1,
                side: THREE.DoubleSide,
                skinning: !!child.isSkinnedMesh
            });
        }
        child.material = Array.isArray(child.material)
            ? child.material.map(() => mat)
            : mat;
    });

    scene.add(character);
    mixer = new THREE.AnimationMixer(character);
    loadAnim('idle', 'idle.fbx');
    loadAnim('walk', 'walk.fbx');
    loadAnim('jump', 'Jump.fbx');
    loadAnim('dance', 'Dance.fbx');

    // Al terminar el salto, se vuelve a idle/walk
    mixer.addEventListener('finished', e => {
        if (e.action === actions.jump) jumping = false;
    });
}, undefined, function (error) {
    console.error('Error cargando personaje.fbx:', error);
    showError('Error al cargar personaje.fbx (mira la consola)');
});

function loadAnim(name, file) {
    loader.load(file, obj => {
        const clip = obj.animations[0];
        if (!clip) return;

        // Quitar el avance de la cadera (X y Z) para que la animación sea "in place"
        clip.tracks.forEach(track => {
            if (track.name.toLowerCase().endsWith('hips.position')) {
                const v = track.values;
                const x0 = v[0], z0 = v[2];
                for (let i = 0; i < v.length; i += 3) {
                    v[i]     = x0;   // X fija
                    v[i + 2] = z0;   // Z fija
                }
            }
        });

        actions[name] = mixer.clipAction(clip);
        if (name === 'jump') {
            actions[name].setLoop(THREE.LoopOnce, 1);   // se reproduce una sola vez
            actions[name].clampWhenFinished = true;
        }
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

function startJump() {
    const a = actions.jump;
    if (!a || jumping) return;
    jumping = true;
    dancing = false;
    a.reset().fadeIn(0.1).play();
    if (current) current.fadeOut(0.1);
    current = a;
}

function toggleDance() {
    if (!actions.dance || jumping) return;
    dancing = !dancing;
    playAction(dancing ? 'dance' : 'idle');
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

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); startJump(); }
    if (e.code === 'KeyB') toggleDance();
});
window.addEventListener('keyup', e => keys[e.code] = false);

const jumpBtn = document.getElementById('jump-btn');
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); startJump(); });
document.getElementById('dance-btn').addEventListener('pointerdown', e => { e.preventDefault(); toggleDance(); });

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
            const dx = -ix, dz = iy;
            const target = Math.atan2(dx, dz);
            let diff = target - character.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            character.rotation.y += diff * Math.min(1, 10 * delta);

            const len = Math.hypot(dx, dz);
            character.position.x += (dx / len) * mag * SPEED * delta;
            character.position.z += (dz / len) * mag * SPEED * delta;
            dancing = false;   // moverse corta el baile
            if (!jumping) playAction('walk');
        } else {
            if (!jumping && !dancing) playAction('idle');
        }

        camera.position.set(character.position.x, character.position.y + CAM_HEIGHT, character.position.z - CAM_DIST);
        camera.lookAt(character.position.x, character.position.y + CAM_LOOK, character.position.z);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
