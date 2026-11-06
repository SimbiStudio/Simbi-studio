# Locky — Entrada "El choque" · Handoff para Claude Code

## 0. Estado v2 (los 4 cambios pendientes están hechos)

| # | Cambio | Dónde |
|---|--------|-------|
| 1 | Camina **de frente** toda la entrada (sin caminar de espaldas, sin anticipación ni giro); mira al cielo, ojos `Eyes_Joy`, silbando. Whoosh eliminado. | `build/anim.js`, `build/timeline.js`, `build/sfx.py` |
| 2 | **ElevenLabs** (`eleven_text_to_sound_v2`): plonk, pasos, silbido, chirrido en el vidrio, golpe sordo, boop, risita, destello del saludo, "ting" del guiño. 2 tomas por sonido; prompts e ids en `audio/elevenlabs/manifest.json`. `audio/mix_elevenlabs.py` las corta y las coloca según `timeline.js`. Voz de Locky: pendiente (no había guion de voz). | `audio/` |
| 3 | **Blender 4.5 LTS + Cycles**. `blender/export_anim.js` evalúa `anim.js` cuadro a cuadro (matrices de skinning, shape keys, raíz, squash, contacto con el vidrio, cámara) y `blender/build_scene.py` arma la escena desde el GLB con esos keyframes, así WebGL y Blender comparten **una sola** coreografía. El aplastamiento contra el vidrio es un modificador Geometry Nodes (`GlassPress`) con la misma fórmula del vertex shader. El relleno de `Mouth_O` ahora se ve rosa (el problema lila era del shading WebGL). | `blender/` |
| 4 | **Sin logo**: fuera la caída/rebote, el sobresalto/mirar arriba y los boings/destellos. Final nuevo: saluda → baja el brazo → saltito + inclinación de cabeza + guiño y saludo final. | `build/anim.js`, `build/timeline.js` |

Además: la pausa con pantalla vacía bajó de 0,55 s a 0,35 s y la pieza dura **8,5 s** (antes 9,8 s).

### Tiempos v2 (`build/timeline.js`, segundos)

| Tiempo | Evento | Audio (ElevenLabs) |
|--------|--------|--------------------|
| 0.0–3.4 | Camina de frente desde z=−3, mirando al cielo, silbando (4,6 pasos/s) | pasos (uno por paso) + silbido hasta 3.0 |
| 3.40 | Impacto contra el vidrio | plonk |
| 4.08–4.98 | Resbala a tirones y sale de cuadro | chirrido; golpe sordo en 5.0 |
| 5.33 | Se asoma | boop |
| 5.93 | Avergonzado | risita |
| 6.43 | Saluda | destello |
| 7.00 | Baja el brazo | — |
| 7.45–8.5 | Saltito + guiño + saludo final | ting |

### Cómo reproducir la v2

```bash
cd locky/build
python3 make_glb_js.py
node capture.js ../frames_webgl range 0 8.5 60             # preview WebGL (Chromium de Playwright)
node capture.js ../frames_overlay range 0 8.5 60 --overlay  # solo FX 2D del vidrio, PNG con alfa
python3 ../audio/mix_elevenlabs.py                          # ../output/locky_sfx_v2_elevenlabs.wav
python3 sfx.py                                              # alternativa sintetizada: ../output/locky_sfx_v2.wav

cd ../blender
node export_anim.js                                         # anim.js -> anim_frames.json
blender -b --python build_scene.py                          # -> locky_v2.blend
./render_all.sh /ruta/a/blender                             # Cycles -> out/f_0000.png… (reanudable)
python3 composite.py                                        # fondo + Blender + FX + audio -> ../output/locky_entrada_choque_v2.mp4
```

Render: Cycles CPU, 24 spp adaptativo + OIDN, motion blur 0,5, película transparente con shadow catcher
que acompaña a Locky (solo mientras camina). El fondo es una placa con la misma fórmula del shader v1
y las FX 2D (ondas, brillo, marca empañada, estrellitas) salen del pase `--overlay`.

---

## 1. Pedido original

Animación de entrada de Locky (mascota candado de loomlock), estilo Minions / Illumination, muy fluida.
Fondo azul violeta de loomlock un poco más claro, cerca de `#4B55D6`.

Idea 1 "El choque": Locky entra desde el fondo distraído mirando el cielo, se acerca, se da de cara
contra la pantalla como si fuera un vidrio (se aplasta, suena "plonk"), se resbala hasta abajo,
vuelve a asomarse avergonzado y saluda. (Originalmente arriba caía el logo de loomlock y rebotaba:
**ya no va**, ver pendientes.)

## 2. Cambios pedidos tras la v1 (✅ resueltos en v2, ver sección 0)

1. **Caminar de frente, no de espaldas.** En la v1 Locky entra caminando hacia atrás (de espaldas a cámara)
   y gira justo antes del choque. Tiene que caminar **de frente** hacia cámara (distraído, mirando el cielo,
   ojos cerrados/felices, silbando) y chocar sin giro.
   - En `anim.js`: en el bloque `if (walking)`, poner `rotY = 0 + lookAround*0.5` (en vez de `PI + lookAround`),
     usar el patrón de piernas/brazos "forward" (el que hoy está dentro de `if (t > T.turnEnd)`) para toda la caminata,
     y eliminar la anticipación + giro (`turnStart`/`turnEnd`). Mirar al cielo = `hipsX` negativo (ya está: -0.30).
   - El sonido del "whoosh" del giro (`sfx.py`) se elimina.
2. **Conectar ElevenLabs** para los sonidos (plonk, pasos, silbido, chirrido en el vidrio, "boop" al asomarse,
   risita avergonzada, etc.) y eventualmente voz de Locky. Hoy están sintetizados con numpy (`sfx.py`) como placeholder.
   Los tiempos de cada evento salen de `timeline.js` (ver sección 6).
3. **Descargar e instalar Blender** y hacer el render final allí (Cycles/EEVEE) para calidad de producción.
   En la v1 no se pudo (sin red para instalar), por eso se hizo un renderizador WebGL propio.
4. **Sacar el logo.** Quitar la caída/rebote del logo "loomlock" y todo lo asociado:
   la reacción de Locky al aterrizaje (sobresalto + mirar arriba), los boings y destellos del logo en el audio.
   Reajustar el final (saludo + guiño) para que cierre sin el logo.

## 3. Archivos del paquete

```
handoff/
├── HANDOFF.md                     ← este documento
├── input/
│   ├── LockyBase2026.glb          ← modelo usado (rig + blend shapes + texturas embebidas)
│   ├── BaseLocky2026.fbx          ← mismo personaje en FBX (no se usó; útil para Blender)
│   └── textures/                  ← texturas extraídas del GLB (Eyes, Expressions, Mouth)
├── build/                         ← renderizador + animación v1 (todo el código)
│   ├── render.html                ← página que compone WebGL (3D) + canvas 2D (FX/logo)
│   ├── engine.js                  ← loader glTF, skinning GPU, morphs CPU, shading, sombra, "vidrio"
│   ├── anim.js                    ← TODA la animación (poses, expresiones, cámara, FX, logo)
│   ├── timeline.js                ← tiempos clave compartidos por animación y audio
│   ├── capture.py                 ← render cuadro a cuadro con Playwright + Chrome headless
│   ├── sfx.py                     ← síntesis de sonido (numpy) → WAV
│   └── make_glb_js.py             ← genera build/glb.js (el GLB en base64) — correr antes de renderizar
└── output/
    ├── locky_entrada_choque_v1.mp4 ← v1 entregada (1920×1080, 60 fps, 9,8 s, con audio)
    └── locky_sfx_v1.wav            ← audio v1 por separado
```

## 4. Cómo reproducir la v1

```bash
cd handoff/build
python3 make_glb_js.py                           # crea glb.js desde ../input/LockyBase2026.glb
python3 capture.py ../frames range 0 9.8 60      # 588 PNG, ~0.3 s/cuadro con SwiftShader
python3 sfx.py                                   # escribe ../output/locky_sfx_v1.wav (ajustar ruta)
ffmpeg -framerate 60 -i ../frames/f_%05d.png -i ../output/locky_sfx_v1.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest out.mp4
```
Previews sueltos: `python3 capture.py ../test times '[3.8, 6.5]'`.
`capture.py` usa `/usr/bin/google-chrome` con `--use-angle=swiftshader` y rutas absolutas `/home/claude/build/...`: ajustarlas.

## 5. Datos técnicos del modelo (LockyBase2026.glb)

- Escala: ~1,33 de alto (suelo y=0, cuerpo 0,29–1,02, arco del candado hasta 1,33). El personaje mira a **+Z**.
- 5 mallas / 7 materiales:
  - `LockyBody` (cuerpo, `#` lineal 0.022,0.095,0.546) y `ShackleMinus` (arco, 0.12,0.48,0.94): **rígidos**, pesados a `neutral_bone`.
    En el renderer se los hace seguir a `Hips` (ver `computeJoints`). En Blender: emparentarlos al hueso Hips/Chest.
  - `Eyes` (material BLEND, textura con alfa), `Mouth.001`, parte `Expressions` (rubor/rellenos): skin a `Hips`.
  - `HandsFeet`: manos (blanco 0.8) y piernas (azul claro 0.24,0.27,0.79), skin a brazos/piernas.
- Esqueleto (27 joints): Hips → Spine → Chest → Neck → Head; Chest → Left/Right Shoulder → UpperArm → LowerArm → Hand;
  Hips → UpperLeg → LowerLeg → Ankle → Toes. Pose de reposo: **T-pose** (brazos horizontales).
- **Ejes de rotación verificados** (delta multiplicado sobre la rotación local de reposo):
  - `UpperArm_L/R` eje X: **+ sube**, −1.1 ≈ brazo pegado al cuerpo.
  - `UpperArm` eje Z: L **+ = atrás**, R **+ = adelante** (espejados).
  - `LowerArm` eje X: dobla el codo hacia arriba.
  - `UpperLeg` eje X: **+ = pierna hacia atrás**. `LowerLeg` eje X +: flexión natural de rodilla.
  - `Hips` eje X: **+ = inclina hacia adelante** (− = mirar al cielo). Para mantener piernas verticales: `UpperLeg X -= hipsX`.
- **Blend shapes** (shape keys):
  - Ojos (sin morph = ojos redondos por defecto): `Eyes_` (los oculta), `Eyes_ .> <.` (con rubor), `Eyes_ O O`,
    `Eyes_ T T`, `Eyes_Angry`, `Eyes_Bored`, `Eyes_Close`, `Eyes_Fun`, `Eyes_Joy` (^^), `Eyes_Sad`,
    `Eyes_Wink L`, `Eyes_Wink R`, `Eyes_Close L`, `Eyes_Close R`.
  - Boca: `Mouth_A`, `Mouth_E`, `Mouth_I`, `Mouth_O`, `Mouth_U`, `Mouth_Angry`, `Mouth_Sad`, `Mouth_NoSmirk`,
    `Mouth_Smirk L`, `Mouth_Smirk R`, `Mouth_Joy`, `Mouth_Fun`.
- El GLB no trae animaciones.

## 6. Guion y tiempos de la v1 (`timeline.js`, segundos) — histórico, los de v2 están en la sección 0

| Tiempo | Evento | Expresión | Audio v1 |
|---|---|---|---|
| 0.0–3.0 | Camina desde z=−3 (fondo) **de espaldas** hacia cámara, inclinado mirando al cielo, mirando a los lados, 4.6 pasos/s | `Eyes_Joy` + `Mouth_O/U` (silbando) | pasos suaves crecientes + silbido melódico |
| 3.0–3.38 | Anticipación + giro 180° para quedar de frente (**eliminar**) | Joy | whoosh (**eliminar**) |
| 3.38–3.72 | 2 pasos hacia el vidrio | Joy + `Mouth_Joy` | pasos |
| **3.72** | **Impacto** contra el vidrio (z=2.75): se aplasta, manos pegadas, piernas patean, temblor de cámara | `Eyes_ .> <.` + `Mouth_O` | **plonk** (tono hueco con caída de pitch + golpe + "ting" de vidrio) + wobble |
| 3.72–4.4 | Queda pegado con jiggle; estrellitas de mareo | igual | — |
| 4.4–5.3 | Resbala hacia abajo a tirones (stick-slip, 6 tirones), sale de cuadro | `Eyes_ T T` + `Mouth_Sad` (desde 4.55) | chirrido en el vidrio + golpe sordo al final |
| 5.3–5.85 | Pantalla vacía con marca empañada de la cara | — | silencio (el cliente podría querer acortarlo) |
| 5.85 | Se asoma desde abajo, inclinado | ojos redondos, `Mouth_I`, parpadeos 5.98 y 6.26 | "boop" |
| 6.45 | Avergonzado: se encoge, hombros arriba | `Eyes_ .> <.` + `Mouth_Smirk L` | risita (3 notas) |
| 6.95 | Sube un poco y saluda (brazo derecho) | `Eyes_Joy` + `Mouth_Joy` | destellos |
| 7.25–8.1 | ~~Logo cae y rebota (contactos 7.62, 7.93, 8.05, 8.09)~~ **eliminar** | ~~`Eyes_ O O`~~ | ~~slide whistle + boings~~ |
| 7.95 | ~~Mira hacia arriba al logo~~ **eliminar** | | |
| 8.75–9.8 | Guiño + saludo final | `Eyes_Wink R` + `Mouth_Joy` | "ting" |

## 7. Cámara, luces y look (v1)

- Cámara: fov 32°, posición (0, 1.0, ~4.6), mira a (0, 0.72, 0). Se acerca 0.12 durante la caminata y retrocede 0.12 en el final.
  Temblor al impacto: amplitud 0.035, decae con e^(−9t).
- Vidrio: plano z = 2.75. Aplastamiento hecho en el vertex shader: lo que pasa del plano se clava en él y se expande
  en XY desde el centro de contacto (`min(d,0.13)*2.6`), más squash global del cuerpo (z×0.78, x×1.08, y×1.05) con jiggle.
  **En Blender**: shape key de "cara aplastada" + Lattice/SimpleDeform, o un modificador con un plano colisionador.
- Luces: key cálida arriba-izquierda-frente, fill fría a la derecha, rim azulado desde atrás, ambiente hemisférico
  (cielo azul claro / suelo color fondo), AO falso hacia el suelo, sombra de contacto suave (blob), niebla leve por profundidad.
- Fondo: `#4E58DA` (un poco más claro que #4B55D6), degradé vertical + viñeta tipo spot en (0.5, 0.62).
- FX 2D: ondas en el vidrio al impacto, brillo diagonal que cruza la pantalla, marca empañada de la cara + rastros
  del resbalón (se desvanece hacia 7.5 s), estrellitas amarillas de mareo.

## 8. Notas y problemas conocidos

- Mientras está aplastado contra el vidrio, el relleno de `Mouth_O` se ve lila en vez de rosa (shading del renderer WebGL). Revisar en Blender.
- El FBX no se usó; el GLB tiene todo (rig, shape keys y texturas embebidas).
- Para el render en Blender: importar el GLB (File → Import → glTF 2.0), las shape keys y el armature vienen intactos.
  El guion, los tiempos y los valores de pose de `anim.js` se pueden portar a un script `bpy` que ponga keyframes.
