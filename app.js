// 1. Configuración de Escena, Cámara y Renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Cielo azul
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(0, 3, 10); // Altura 3, Distancia 10

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 2. Luces y Suelo (Cuadrícula)
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(0, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);

// 3. Variables para el movimiento y animación
let mixer, character;
const clock = new THREE.Clock();
let moveData = { forward: 0, turn: 0 };

// 4. Cargar el FBX de Mixamo
const loader = new THREE.FBXLoader();

loader.load('personaje.fbx', function (object) {
    document.getElementById('loading').style.display = 'none';
    character = object;

    // Escala automática: dejamos el personaje con ~1.8 unidades de alto
    const box = new THREE.Box3().setFromObject(character);
    const height = box.max.y - box.min.y;
    const s = 1.8 / height;
    character.scale.setScalar(s);

    // Apoyar los pies en el suelo (y = 0)
    character.position.set(0, 0, 0);
    const box2 = new THREE.Box3().setFromObject(character);
    character.position.y -= box2.min.y;

    character.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false; // evita que desaparezca por bounding box mal calculada

            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                mat.transparent = false;
                mat.opacity = 1;      // arregla el bug de opacidad 0 de Mixamo
                mat.alphaTest = 0;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
            });
        }
    });

    scene.add(character);

    if (character.animations.length > 0) {
        mixer = new THREE.AnimationMixer(character);
        mixer.clipAction(character.animations[0]).play();
    }
}, undefined, function (error) {
    console.error("Error cargando personaje.fbx:", error);
    document.getElementById('loading').textContent = 'Error al cargar personaje.fbx (mira la consola)';
});

// 5. Joystick Virtual
const joystick = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '100px', bottom: '100px' },
    color: 'white'
});

joystick.on('move', function (evt, data) {
    const angle = data.angle.radian;
    const force = data.force;
    moveData.forward = Math.sin(angle) * (force * 0.05); // Adelante/atrás
    moveData.turn = -Math.cos(angle) * (force * 0.05);   // Giro
});

joystick.on('end', function () {
    moveData.forward = 0;
    moveData.turn = 0;
});

// 6. Bucle del Juego (60 FPS)
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Actualizar animación
    if (mixer) mixer.update(delta);

    // Actualizar movimiento si el modelo ya se cargó
    if (character) {
    const speed = 4.0;
    const turnSpeed = 0.05;

    character.rotation.y += moveData.turn * turnSpeed;

    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
    character.position.add(direction.multiplyScalar(moveData.forward * speed * delta));

    const camDist = 5;
    camera.position.x = character.position.x - Math.sin(character.rotation.y) * camDist;
    camera.position.z = character.position.z - Math.cos(character.rotation.y) * camDist;
    camera.position.y = character.position.y + 3;
    camera.lookAt(character.position.x, character.position.y + 1, character.position.z);
}

    renderer.render(scene, camera);
}

animate();

// Ajustar si se rota la pantalla
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});