# Despliegue y Mantenimiento de ibai3d

Guía operativa para gestionar el servicio web `ibai3d` en el servidor Hetzner, realizar cambios en los modelos y recursos 3D, y sincronizar con GitHub.

---

## 1. Arquitectura y Entorno

- **Directorio del proyecto:** `/var/www/ibai3d`
- **Tecnología:** Servidor web Nginx en contenedor Docker aislado (`nginx:alpine`).
- **Nombre del contenedor:** `ibai3d-web`
- **Puerto local asignado:** `127.0.0.1:5187` (vinculado exclusivamente a loopback local, no expuesto a interfaces públicas).
- **Red Docker:** `ibai3d_default` (red propia e independiente).
- **Modo de montaje:** Los archivos de `/var/www/ibai3d` están montados en modo lectura (`:ro`) dentro del contenedor `/usr/share/nginx/html`.
  > **Ventaja:** Cualquier edición directa en archivos HTML, JS, texturas o modelos FBX se refleja inmediatamente en el navegador sin necesidad de reconstruir imágenes Docker.

---

## 2. Gestión del Servicio Docker

Todos los comandos deben ejecutarse desde `/var/www/ibai3d`:

```bash
cd /var/www/ibai3d
```

### Consultar estado
```bash
docker compose ps
```

### Consultar registros (logs)
```bash
# Ver los últimos logs
docker compose logs

# Seguir los logs en tiempo real
docker compose logs -f
```

### Reiniciar el servicio
```bash
docker compose restart
```

### Detener el servicio
```bash
docker compose down
```

### Iniciar el servicio
```bash
docker compose up -d
```

### Recargar la configuración de Nginx (sin reiniciar el contenedor)
```bash
docker exec ibai3d-web nginx -s reload
```

---

## 3. Acceso Público mediante Cloudflare Tunnel

El servidor utiliza Cloudflare Tunnel gestionado de forma centralizada mediante token (Zero Trust). El túnel existente reenvía peticiones de varios subdominios de `byaritz.com` a puertos locales específicos.

Para habilitar `https://ibai3d.byaritz.com`:

1. Accede al panel de **Cloudflare Zero Trust** (o Cloudflare Dashboard > Networks > Tunnels).
2. Selecciona tu túnel activo y haz clic en **Configure**.
3. En la pestaña **Public Hostnames**, pulsa **Add a public hostname**.
4. Configura:
   - **Subdomain:** `ibai3d`
   - **Domain:** `byaritz.com`
   - **Path:** *(dejar vacío)*
   - **Service Type:** `HTTP`
   - **URL:** `localhost:5187` (o `127.0.0.1:5187`)
5. Haz clic en **Save hostname**.

Cloudflare propagará automáticamente el DNS y la ruta en el daemon local en segundos, sin requerir reinicios en el servidor.

---

## 4. Modificación de Modelos 3D y Recursos

Al estar montado el volumen en vivo en `/usr/share/nginx/html`, puedes modificar los recursos directamente en `/var/www/ibai3d`:

| Recurso | Archivo activo | Notas |
| :--- | :--- | :--- |
| **Modelo 3D del personaje (skin)** | `resources/Idle.fbx` (y symlink `personaje.fbx`) | Modelo en pose idle con malla, esqueleto y skin |
| **Animación Idle** | `resources/Idle.fbx` (y symlink `idle.fbx`) | Clip de animación de espera en reposo |
| **Animación Desplazamiento** | `resources/Running.fbx` (y symlink `walk.fbx`) | Animación de carrera para el joystick/teclas |
| **Animación Salto** | `resources/Jumping.fbx` (y symlink `Jump.fbx`) | Animación de salto sincronizada con física |
| **Animación Baile** | `resources/Dance.fbx` (y symlink `Dance.fbx`) | Animación de baile (botón Bailar o tecla B) |
| **Textura Difusa (Color)** | `texture_pbr_20250901.png` | Mapa de color principal PBR |
| **Textura Normales** | `texture_pbr_20250901_normal.png` | Mapa de relieve/normales |
| **Textura Rugosidad** | `texture_pbr_20250901_roughness.png` | Mapa de rugosidad |
| **Fondo / Escenario** | `fondo1.jpg` | Textura panorámica del cielo/entorno |
| **Lógica del juego** | `app.js` | Configuración Three.js, controls y animación |
| **PWA / Service Worker** | `sw.js` y `manifest.json` | Configuración PWA y caché offline |

> **Nota sobre caché:** Si sustituyes modelos o scripts, asegúrate de refrescar la caché del navegador (Ctrl + F5 o modo incógnito), o incrementa la constante de versión en `sw.js` (`CACHE_NAME`) para forzar la actualización de los clientes PWA.

---

## 5. Control de Versiones con Git

El repositorio local está configurado con:
- **Rama:** `main`
- **Remoto `origin`:** `https://github.com/oakmusic/ibai3d.git`

### Comprobar cambios
```bash
cd /var/www/ibai3d
git status
```

### Crear un commit
```bash
git add .
git commit -m "Descripción de los cambios realizados"
```

### Subir cambios a GitHub (`oakmusic/ibai3d`)
Para autenticarte con GitHub sin introducir credenciales en texto plano:

#### Opción A: Clave SSH (Recomendada)
El servidor dispone de una clave pública Ed25519 en `/root/.ssh/id_ed25519.pub`:
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILTc2BhuqQan9ireHtfD748PztWluXmUP0wqNfaapQPT oakmusic@users.noreply.github.com
```
1. Añade esta clave a tu cuenta de GitHub en **Settings > SSH and GPG keys**.
2. Cambia el remoto a SSH:
   ```bash
   git remote set-url origin git@github.com:oakmusic/ibai3d.git
   ```
3. Realiza el push:
   ```bash
   git push origin main
   ```

#### Opción B: Personal Access Token (HTTPS)
Si mantienes el remoto HTTPS actual, al ejecutar `git push origin main`, introduce tu usuario `oakmusic` y tu GitHub Personal Access Token (PAT) como contraseña cuando lo solicite de forma interactiva.
