// 1. Configuración básica de Three.js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 20, 100);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(0, 200, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Luces y suelo
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);

// 2. Variables del personaje y movimiento
let mixer, character;
const clock = new THREE.Clock();
let moveData = { forward: 0, turn: 0 };

// 3. Cargar el personaje FBX
const loader = new THREE.FBXLoader();
loader.load('personaje.fbx', function (object) {
    character = object;
    character.scale.set(0.1, 0.1, 0.1); // Ajusta la escala si tu modelo es muy grande
    scene.add(character);

    // Iniciar la animación que viene en el FBX
    if (character.animations.length > 0) {
        mixer = new THREE.AnimationMixer(character);
        const action = mixer.clipAction(character.animations[0]);
        action.play();
    }
});

// 4. Configurar el Joystick táctil (Nipple.js)
const joystick = nipplejs.create({
    zone: document.getElementById('joystick-zone'),
    mode: 'static',
    position: { left: '100px', bottom: '100px' },
    color: 'white'
});

joystick.on('move', function (evt, data) {
    const angle = data.angle.radian; // Ángulo en radianes
    const force = data.force;        // Fuerza aplicada al pulgar
    
    // Traducir ángulo a dirección (adelante/atrás y giros)
    moveData.forward = Math.sin(angle) * force;
    moveData.turn = -Math.cos(angle) * force;
});

joystick.on('end', function () {
    moveData.forward = 0;
    moveData.turn = 0;
});

// 5. Bucle de actualización (Update Loop)
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Actualizar animación del FBX
    if (mixer) mixer.update(delta);

    // Mover el personaje según el joystick
    if (character) {
        const speed = 2.0;
        const turnSpeed = 0.05;

        // Rotar el personaje
        character.rotation.y += moveData.turn * turnSpeed;

        // Calcular el movimiento hacia adelante/atrás respecto a la rotación del personaje
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
        character.position.add(direction.multiplyScalar(moveData.forward * speed));

        // Hacer que la cámara siga al personaje
        camera.position.x = character.position.x;
        camera.position.z = character.position.z + 300;
        camera.lookAt(character.position);
    }

    renderer.render(scene, camera);
}

animate();

// Ajustar canvas si se gira el móvil
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});