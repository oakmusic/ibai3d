// ===== Configuración =====
const ASSET_VERSION = '1.0.10';
const TEX = {
    color:     'texture_pbr_20250901.webp?v=' + ASSET_VERSION,
    normal:    'texture_pbr_20250901_normal.webp?v=' + ASSET_VERSION,
    roughness: 'texture_pbr_20250901_roughness.webp?v=' + ASSET_VERSION,
    metallic:  'texture_pbr_20250901_metallic.webp?v=' + ASSET_VERSION
};
// 'basic'    = sin luces (test: si así se ve con color, la textura está bien)
// 'standard' = con luces, normal y roughness
// 'original' = deja el material que trae el propio FBX
const MATERIAL_MODE = 'standard';
const SPEED = 4.0;
const CHAR_HEIGHT = 1.8;
const GRAVITY = 18;          // fuerza de gravedad
const JUMP_SPEED = 6;        // impulso del salto (altura aprox. = 6²/(2·18) = 1 unidad)
const JUMP_ANIM_SPEED = 1.5; // velocidad de la animación de salto
const CAM_DIST = 3.5;     // distancia detrás del personaje (menos = más cerca)
const CAM_HEIGHT = 1.8;   // altura de la cámara
const CAM_LOOK = 1.0;     // altura del punto al que mira (1.0 = torso)

// Precargar texturas inmediatamente en paralelo con la descarga del modelo
const texLoader = new THREE.TextureLoader();
const diffuseTex = texLoader.load(TEX.color);
diffuseTex.encoding = THREE.sRGBEncoding;
const normalTex = texLoader.load(TEX.normal);
const roughnessTex = texLoader.load(TEX.roughness);
const metallicTex = texLoader.load(TEX.metallic);

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
// (sin niebla: tiñe de azul y no combina con la foto de fondo)

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
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -25;
dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25;
dirLight.shadow.camera.bottom = -25;
dirLight.shadow.camera.far = 80;
scene.add(dirLight);
scene.add(dirLight.target);

const grid = new THREE.GridHelper(200, 100, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// ===== Escenario y obstáculos =====
const WORLD_LIMIT = 40;        // el mapa va de -40 a +40
const PLAYER_RADIUS = 0.4;     // "grosor" del personaje para chocar
const colliders = [];

// Suelo
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: 0x8aa57a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
grid.position.y = 0.01;   // evita parpadeo con el suelo

// Fondo panorámico 360° optimizado en WebP
let sky = null;
texLoader.load('fondo1.webp?v=' + ASSET_VERSION, tex => {
    tex.encoding = THREE.sRGBEncoding;
    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1, 1, 1);   // se mira desde dentro, sin imagen en espejo
    sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    scene.add(sky);
}, undefined, () => console.warn('No se encontró fondo1.webp'));

function addBox(x, z, w, d, h, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 }));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ type: 'box', x: x, z: z, hw: w / 2, hd: d / 2, top: h });
}

function addCylinder(x, z, r, h, color) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 }));
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push({ type: 'cyl', x: x, z: z, r: r, top: h });
}

// Muros del borde del mapa
const L = WORLD_LIMIT;
addBox(0,  L + 0.5, 2 * L + 2, 1, 3, 0x888888);
addBox(0, -L - 0.5, 2 * L + 2, 1, 3, 0x888888);
addBox( L + 0.5, 0, 1, 2 * L + 2, 3, 0x888888);
addBox(-L - 0.5, 0, 1, 2 * L + 2, 3, 0x888888);

// Obstáculos (lejos del punto de salida 0,0)
addBox(5, 6, 2, 2, 0.7, 0xb5651d);      // cubo bajo
addBox(-6, 8, 3, 1.5, 0.6, 0xb5651d);   // cubo largo bajo
addBox(8, -4, 1.5, 1.5, 0.5, 0xc98a4b); // cubo pequeño bajo
addBox(10, 10, 2, 2, 0.5, 0xc98a4b);    // escalón 1
addBox(12, 10, 2, 2, 1.0, 0xb5651d);    // escalón 2 (salta desde el 1)
addCylinder(-5, -6, 0.8, 3, 0x777788);  // columna
addCylinder(3, -9, 0.8, 3, 0x777788);   // columna
addCylinder(-10, 2, 1.2, 4, 0x2e7d32);  // "árbol"
addBox(0, 14, 10, 0.6, 2.5, 0x6a7fa0);  // pared larga
addBox(14, 4, 0.6, 8, 2.5, 0x6a7fa0);   // pared lateral

// Altura del suelo bajo un punto (0 o la parte de arriba de un cubo)
function groundHeight(x, z) {
    let h = 0;
    for (const c of colliders) {
        if (c.type !== 'box') continue;
        if (Math.abs(x - c.x) <= c.hw + 0.2 && Math.abs(z - c.z) <= c.hd + 0.2) h = Math.max(h, c.top);
    }
    return h;
}

function resolveCollisions(pos, feetY) {
    for (const c of colliders) {
        if (feetY >= c.top - 0.05) continue;   // si los pies están por encima, no choca (se sube encima)
        if (c.type === 'box') {
            // punto de la caja más cercano al personaje
            const nx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
            const nz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
            const dx = pos.x - nx, dz = pos.z - nz;
            const dist = Math.hypot(dx, dz);
            if (dist < PLAYER_RADIUS) {
                if (dist > 0.0001) {
                    pos.x = nx + (dx / dist) * PLAYER_RADIUS;
                    pos.z = nz + (dz / dist) * PLAYER_RADIUS;
                } else {
                    // el centro quedó dentro de la caja: sacarlo por el lado más cercano
                    const px = c.hw - Math.abs(pos.x - c.x);
                    const pz = c.hd - Math.abs(pos.z - c.z);
                    if (px < pz) pos.x = c.x + (pos.x >= c.x ? 1 : -1) * (c.hw + PLAYER_RADIUS);
                    else         pos.z = c.z + (pos.z >= c.z ? 1 : -1) * (c.hd + PLAYER_RADIUS);
                }
            }
        } else {
            const dx = pos.x - c.x, dz = pos.z - c.z;
            const dist = Math.hypot(dx, dz);
            const min = c.r + PLAYER_RADIUS;
            if (dist < min) {
                const k = dist > 0.0001 ? min / dist : 0;
                pos.x = dist > 0.0001 ? c.x + dx * k : c.x + min;
                pos.z = dist > 0.0001 ? c.z + dz * k : c.z;
            }
        }
    }
}


// 3. Variables
let mixer, character, current;
let jumping = false;
let baseY = 0;      // offset inicial para que los pies queden a Y=0
let feetY = 0;      // altura actual de los pies sobre el suelo (física)
let velY = 0;       // velocidad vertical
let onGround = true;
let dancing = false;
const actions = {};
const clock = new THREE.Clock();

const loader = new THREE.FBXLoader();

const MODEL_PATHS = {
    character: 'resources/Idle.fbx',
    idle:      'resources/Idle.fbx',
    walk:      'resources/Running.fbx',
    jump:      'resources/Jumping.fbx',
    dance:     'resources/Dance.fbx'
};

// 4. Cargar personaje
loader.load(MODEL_PATHS.character, function (object) {
    document.getElementById('loading').style.display = 'none';
    character = object;

    const box = new THREE.Box3().setFromObject(character);
    character.scale.setScalar(CHAR_HEIGHT / (box.max.y - box.min.y));
    character.position.set(0, 0, 0);
    const box2 = new THREE.Box3().setFromObject(character);
    character.position.y -= box2.min.y;
    baseY = character.position.y;

    // Eliminar luces o cámaras incrustadas en el FBX exportado
    const strayObjects = [];
    character.traverse(child => {
        if (child.isLight || child.isCamera) {
            strayObjects.push(child);
        }
    });
    strayObjects.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
    });

    character.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        // Calcular normales si el FBX no las traía de serie
        if (child.geometry && !child.geometry.attributes.normal) {
            child.geometry.computeVertexNormals();
        }

        // Crear material PBR con las texturas correctas de Ibai (precargadas en WebP)
        let mat;
        if (MATERIAL_MODE === 'basic') {
            mat = new THREE.MeshBasicMaterial({
                map: diffuseTex,
                side: THREE.DoubleSide,
                skinning: !!child.isSkinnedMesh
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                map:          diffuseTex,
                normalMap:    normalTex,
                roughnessMap: roughnessTex,
                metalnessMap: metallicTex,
                roughness:    1.0,
                metalness:    1.0,
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

    // Cargar o procesar animaciones
    if (object.animations && object.animations.length > 0) {
        processAndAddAnim('idle', object.animations[0]);
    } else {
        loadAnim('idle', MODEL_PATHS.idle);
    }

    loadAnim('walk', MODEL_PATHS.walk);
    loadAnim('jump', MODEL_PATHS.jump);
    loadAnim('dance', MODEL_PATHS.dance);
}, function (xhr) {
    if (xhr.lengthComputable && xhr.total > 0) {
        const percent = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
        const el = document.getElementById('loading');
        if (el) el.textContent = 'Cargando personaje 3D... ' + percent + '%';
    }
}, function (error) {
    console.error('Error cargando personaje 3D:', error);
    showError('Error al cargar el personaje 3D (mira la consola)');
});

function processAndAddAnim(name, clip) {
    if (!clip) return;

    clip.tracks.forEach(track => {
        const tname = track.name.toLowerCase();
        if (!tname.endsWith('hips.position')) return;

        const v = track.values;
        if (v.length === 0) return;

        // Normalizar clips exportados en centímetros (Hips Y > 5.0) al estándar en metros (~0.55m)
        if (Math.abs(v[1]) > 5.0) {
            for (let i = 0; i < v.length; i++) {
                v[i] *= 0.01;
            }
        }

        if (name === 'jump') {
            // En el salto la física del motor controla la trayectoria vertical/horizontal.
            // Fijamos la posición inicial de la cadera para que no se desplace fuera del personaje.
            const x0 = v[0], y0 = v[1], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) {
                v[i]     = x0;
                v[i + 1] = y0;
                v[i + 2] = z0;
            }
        } else if (name === 'walk') {
            // En correr centramos X y Z para que sea in-place y no se desvíe lateralmente,
            // conservando el rebote natural en Y del ciclo de carrera.
            const x0 = v[0], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) {
                v[i]     = x0;
                v[i + 2] = z0;
            }
        }
        // En 'idle' y 'dance': NO alteramos las coordenadas de Hips.position.
        // La animación natural de Mixamo compensa las rotaciones de las piernas,
        // manteniendo los pies anclados al suelo (< 3 mm) y eliminando el patinaje y bamboleo.
    });

    actions[name] = mixer.clipAction(clip);
    if (name === 'jump') {
        actions[name].setLoop(THREE.LoopOnce, 1);
        actions[name].clampWhenFinished = true;
        actions[name].timeScale = JUMP_ANIM_SPEED;
    }
    if (name === 'idle') playAction('idle');
}

function loadAnim(name, file) {
    loader.load(file, obj => {
        const clip = obj.animations[0];
        if (!clip) return;
        processAndAddAnim(name, clip);
    }, undefined, () => console.warn('No se pudo cargar ' + file));
}

function playAction(name) {
    const next = actions[name];
    if (!next) return;
    if (current === next && next.isRunning()) return;

    next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (current && current !== next) {
        current.fadeOut(0.2);
    }
    current = next;
}

function startJump() {
    const a = actions.jump;
    if (!a || jumping || !onGround) return;
    jumping = true;
    velY = JUMP_SPEED;
    onGround = false;
    dancing = false;

    // Si había otra animación activa que no sea jump, desvanecerla
    if (current && current !== a) {
        current.fadeOut(0.15);
    }
    // Reiniciar y asegurar peso completo en jump (evita pose en T al saltar consecutivamente)
    a.reset();
    a.setEffectiveTimeScale(JUMP_ANIM_SPEED);
    a.setEffectiveWeight(1);
    a.fadeIn(0.15).play();
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
let jumpPressed = false;

const joystick = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '75px', bottom: '75px' },
    color: '#444444'
});
joystick.on('move', (evt, data) => {
    const mag = Math.min(data.force, 1);
    input.x = data.vector.x * mag;
    input.y = data.vector.y * mag;
});
joystick.on('end', () => { input.x = 0; input.y = 0; });

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        jumpPressed = true;
        startJump();
    }
    if (e.code === 'KeyB') toggleDance();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Space') jumpPressed = false;
});

const jumpBtn = document.getElementById('jump-btn');
jumpBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    jumpPressed = true;
    startJump();
});
jumpBtn.addEventListener('pointerup', e => {
    e.preventDefault();
    jumpPressed = false;
});
jumpBtn.addEventListener('pointercancel', e => {
    e.preventDefault();
    jumpPressed = false;
});
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

        // Física vertical: gravedad, salto y aterrizaje sobre cubos
        velY -= GRAVITY * delta;
        feetY += velY * delta;
        resolveCollisions(character.position, feetY);
        const gh = groundHeight(character.position.x, character.position.z);
        if (feetY <= gh) {
            feetY = gh;
            velY = 0;
            const wasInAir = !onGround;
            onGround = true;

            if (wasInAir) {
                jumping = false;
                // Si el jugador mantiene pulsado el botón/tecla de salto, encadenar el siguiente salto
                if (jumpPressed) {
                    startJump();
                } else if (mag > 0.1) {
                    playAction('walk');
                } else if (!dancing) {
                    playAction('idle');
                }
            }
        } else {
            onGround = false;
        }
        character.position.y = baseY + feetY;

        // La luz (y sus sombras) sigue al personaje
        dirLight.position.set(character.position.x + 5, 20, character.position.z + 10);
        dirLight.target.position.copy(character.position);

        camera.position.set(character.position.x, character.position.y + CAM_HEIGHT, character.position.z - CAM_DIST);
        camera.lookAt(character.position.x, character.position.y + CAM_LOOK, character.position.z);
    }

    if (sky) sky.position.copy(camera.position);   // el horizonte siempre queda lejos

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
