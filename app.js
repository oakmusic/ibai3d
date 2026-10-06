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

// 4. Cargar el archivo FBX de Mixamo
const loader = new THREE.FBXLoader();

loader.load('Jump.fbx', function (object) {
    // Si carga bien, quitamos el cartel de "Cargando"
    document.getElementById('loading').style.display = 'none';
    
    character = object;
    // IMPORTANTE: Reducimos la escala porque los FBX suelen ser inmensos
    character.scale.set(0.01, 0.01, 0.01); 

    character.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(character);

    // Iniciar la animación
    if (character.animations.length > 0) {
        mixer = new THREE.AnimationMixer(character);
        const action = mixer.clipAction(character.animations[0]);
        action.play();
    }
}, undefined, function (error) {
    console.error("Error cargando el modelo:", error);
    document.getElementById('loading').innerText = "Error: ¿Está el archivo Jump.fbx en la carpeta?";
    document.getElementById('loading').style.color = "red";
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

        // Rotación
        character.rotation.y += moveData.turn * turnSpeed;

        // Desplazamiento
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(character.quaternion);
        character.position.add(direction.multiplyScalar(moveData.forward * speed * delta));

        // Cámara en tercera persona (persigue la espalda)
        //camera.position.x = character.position.x - Math.sin(character.rotation.y) * 5;
       // camera.position.z = character.position.z - Math.cos(character.rotation.y) * 5;
       // camera.position.y = character.position.y + 3; // Altura de la cámara
       // camera.lookAt(character.position.x, character.position.y + 1, character.position.z);
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