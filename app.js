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
    document.getElementById('loading').style.display = 'none';
    
    character = object;
    
    // SOLUCIÓN 1: La Escala. 
    // A veces FBXLoader auto-escala el modelo. Si le ponemos 0.01 lo hacemos microscópico.
    // Cambiémoslo a 1 (Si al recargar se ve un zapato gigante, cámbialo a 0.1 o 0.01).
    character.scale.set(1, 1, 1); 
    
    // Forzamos a que nazca en el centro exacto
    character.position.set(0, 0, 0);

    character.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // SOLUCIÓN 2: El "Bug de Cristal" de Mixamo.
            // Los FBX de Mixamo suelen exportar materiales "transparentes" por error, 
            // haciéndolos invisibles en Three.js. Esto fuerza a que sean sólidos.
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.transparent = false;
                        mat.alphaTest = 0.5;
                    });
                } else {
                    child.material.transparent = false;
                    child.material.alphaTest = 0.5;
                }
            }
        }
    });

    scene.add(character);

    if (character.animations.length > 0) {
        mixer = new THREE.AnimationMixer(character);
        const action = mixer.clipAction(character.animations[0]);
        action.play();
    }
}, undefined, function (error) {
    console.error("Error:", error);
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