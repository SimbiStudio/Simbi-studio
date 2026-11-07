# Locky — "El choque" · Prompt de animación (v2.2)

> Para usar junto con el modelo `input/LockyBase2026_rigfix.glb` (o `LockyBase2026.glb`).

## Versión en español

**Formato:** video 16:9, 1920×1080, 8,3 segundos, 60 fps (o 30 fps). Sin texto, sin logo, sin otros personajes.

**Estilo:** animación 3D de personaje estilo Illumination / Minions: muy fluida, cómica, con mucho squash & stretch, timing ágil, poses claras y anticipación/rebote en cada acción. Material de juguete de plástico brillante con barniz suave.

**Personaje (Locky, mascota candado de loomlock):** el modelo adjunto. Cuerpo de candado: un bloque cuadrado redondeado azul intenso, con el arco (shackle) celeste arriba. Brazos finos blancos con manos redondas blancas. Piernas cortas color lila azulado con piecitos redondeados. Cara con ojos y boca tipo calcomanía que cambian por expresiones (blend shapes). Mide ~1,33 m (el cuerpo va de 0,29 a 1,02 m y el arco llega a 1,33 m). Mira hacia la cámara.

**Escenario:** fondo liso azul violeta `#4E58DA` (un poco más claro que el azul de marca `#4B55D6`). Degradé vertical, más claro arriba, y una viñeta suave tipo spot centrada un poco por encima del medio del cuadro. No se ve piso, solo una sombra de contacto suave bajo el personaje mientras camina. Entre el personaje y la cámara hay un **vidrio invisible**, como si la pantalla fuera una ventana.

**Cámara:** fija y frontal, a la altura del pecho, lente ~32° vertical, apuntando al centro del personaje. Hace un acercamiento muy lento (~12 cm) durante la caminata, un sacudón fuerte y un mini zoom-in en el golpe, y se aleja apenas en el final.

**Luz:** key cálida desde arriba-izquierda-frente, fill fría desde la derecha y rim azulado desde atrás que recorta la silueta. Sombras suaves, look limpio y luminoso.

**Acción, segundo a segundo:**

1. **0,0–3,2 s · Caminata distraída.** Locky entra desde el fondo (empieza ~3,5 m detrás del vidrio) caminando **de frente a cámara** (nunca de espaldas, sin girar). Va inclinado hacia atrás, mirando al cielo, con los ojos cerrados de felicidad (^^) y **silbando**:
   - La boca es un "o" pequeño y fruncido que late con cada nota: se cierra más en las notas fuertes y agudas, se abre un poquito al atacar cada nota y se corre hacia un costado en las frases largas. Entre frase y frase se relaja en una sonrisa.
   - La cabeza sube en las notas fuertes y se inclina siguiendo la melodía, y mira suavemente a los lados.
   - Pasos cortos, ágiles y alegres (~6 pasos por segundo). Cada pie se apoya plano en el piso sin patinar y despega rodando sobre la punta.
   - El cuerpo rebota con cada paso, carga el peso hacia el pie de apoyo y balancea los brazos en oposición a las piernas, doblando el codo hacia adelante. Se desplaza levemente de la izquierda hacia el centro.
   - No ve el vidrio.
2. **3,2 s · ¡El choque!** Se estampa de cara contra el vidrio:
   - La cara y el frente del cuerpo se aplastan planos contra el vidrio y el cuerpo se ensancha.
   - A las ~0,1 s **rebota** unos 4 cm hacia atrás y a las ~0,26 s queda **chupado de nuevo** contra el vidrio, con un temblor gelatinoso.
   - Brazos y piernas salen disparados hacia adelante en **estrella de mar** y las manos quedan aplastadas contra el vidrio.
   - Expresión: ojos "> <" apretados con rubor rosa y la boca en "O" aplastada.
   - Cámara: sacudón fuerte que decae rápido y mini zoom-in.
   - Efectos sobre el vidrio: ondas circulares blancas desde la cara, un destello diagonal que cruza la pantalla, una marca empañada con la forma de la cara y estrellitas amarillas de mareo que giran sobre el arco.
3. **3,2–3,88 s · Pegado.** Queda pegado al vidrio con temblor gelatinoso, mareado, con las estrellitas girando.
4. **3,88–4,78 s · Se resbala.** Baja deslizándose por el vidrio a tirones (6 tirones de "pega-suelta"), con los brazos arrastrados hacia arriba. Ojos llorosos "T T" y boca triste. Deja rastros empañados en el vidrio y sale por abajo del cuadro.
5. **4,78–5,13 s · Pantalla vacía.** Solo queda la marca empañada de la cara, desvaneciéndose.
6. **5,13 s · Se asoma.** Vuelve a aparecer desde el borde inferior (ahora un poco detrás del vidrio), con la cabeza inclinada, los ojos redondos abiertos y una boquita pequeña. Parpadea dos veces (5,26 s y 5,54 s).
7. **5,73 s · Avergonzado.** Se encoge, sube los hombros y junta las manos cerca del cuerpo. Ojos "> <" con rubor, sonrisa torcida hacia un costado y un temblorcito tímido.
8. **6,23 s · Saluda.** Sube un poco y saluda con la mano derecha, contento: ojos ^^ y sonrisa abierta.
9. **6,8 s · Baja el brazo.**
10. **7,25–8,3 s · Cierre.** Un saltito, inclina la cabeza, **guiña el ojo derecho** con sonrisa abierta y vuelve a saludar hasta el final. Termina sosteniendo la pose.

**Expresiones del modelo (shape keys):**
- Ojos: `Eyes_Joy` (^^), `Eyes_ .> <.` (apretados con rubor), `Eyes_ T T` (llorando), `Eyes_Wink R`, `Eyes_Close` (parpadeo). Sin morph, los ojos quedan redondos.
- Boca: `Mouth_U` y `Mouth_O` (silbar / "O"), `Mouth_Smirk L` (de costado), `Mouth_Joy` (sonrisa abierta), `Mouth_Sad`, `Mouth_I`.

**Sonido (para sincronizar):**
- 0–3,2 s: pasos de goma suaves (uno por paso, cada vez más fuertes) y silbido alegre hasta 2,85 s.
- 3,2 s: "plonk" hueco de cara contra vidrio con un "ting".
- 3,88–4,78 s: chirrido de goma resbalando en el vidrio.
- 4,8 s: golpe sordo fuera de cuadro.
- 5,25 s: "boop".
- 5,73 s: risita tímida.
- 6,29 s: destello mágico.
- 7,3 s: "ting" del guiño.

**Evitar:** caminar de espaldas o girarse, que aparezca el logo, texto en pantalla, cambiar el color de fondo, pies que patinan o flotan, movimientos rígidos o robóticos.

---

## English version (condensed)

16:9, 1920×1080, 8.3 s, 60 fps. Illumination/Minions-style 3D character animation: very fluid, comedic, strong squash & stretch, snappy timing. Glossy toy-plastic look. No text, no logo.

Character: the attached model "Locky", a padlock mascot: rounded deep-blue square body, light-blue shackle on top, thin white arms with round white hands, short lilac-blue legs, decal eyes/mouth driven by shape keys. ~1.33 m tall, facing camera.

Set: flat violet-blue background #4E58DA, lighter at the top, soft spotlight vignette slightly above center; no visible floor, soft contact shadow only. An invisible glass pane sits between character and camera, as if the screen were a window. Camera: fixed, frontal, chest height, ~32° vertical FOV; slow 12 cm push-in during the walk, hard shake plus a quick punch-in on impact, slight pull-back at the end. Lighting: warm key top-left-front, cool fill right, bluish rim from behind.

Beats:
- **0–3.2 s:** walks toward camera from ~3.5 m behind the glass, always facing camera (never walks backwards, no turn). He leans back, gazes at the sky with happily closed eyes (^^) and whistles: small puckered "o" lips pulsing with each note, shifting to one side on long phrases, relaxing into a smile between phrases; head nods to the tune and glances side to side. Brisk happy steps (~6/s) with feet planted flat (no sliding) and a toe roll, bouncy body, weight shift, arms swinging opposite the legs with bent elbows. Drifts from slightly left to center. He doesn't notice the glass.
- **3.2 s:** smacks face-first into the glass. Face and front flatten on it and the body widens. He bounces back ~4 cm, then gets sucked back on and sticks with a jelly wobble. Arms and legs splay forward like a starfish, hands flattened on the glass. Eyes "> <" with pink blush, squashed "O" mouth. Camera shake and punch-in. White circular ripples, a diagonal glint sweeping the screen, a fogged face print, and yellow dizzy stars circling above the shackle.
- **3.88–4.78 s:** slides down the glass in 6 stick-slip jerks, arms dragged up, crying "T T" eyes, sad mouth, leaving fog streaks, and exits the bottom of frame.
- **4.78–5.13 s:** empty frame with the fading face print.
- **5.13 s:** peeks up from the bottom edge, head tilted, round open eyes, small mouth, blinks twice.
- **5.73 s:** embarrassed: shrinks with shoulders up, "> <" eyes with blush, lopsided smile, shy shiver.
- **6.23 s:** rises a little and waves happily with the right hand (^^ eyes, open smile).
- **6.8 s:** lowers the arm.
- **7.25–8.3 s:** little hop, head tilt, winks the right eye and waves again until the end; holds the pose.

SFX sync: soft rubber footsteps and a cheerful whistle (0–2.85 s), hollow "plonk" with a glass ting (3.2 s), rubber squeak sliding down the glass (3.88–4.78 s), soft thud off-screen (4.8 s), "boop" (5.25 s), shy giggle (5.73 s), sparkle (6.29 s), wink "ting" (7.3 s).
