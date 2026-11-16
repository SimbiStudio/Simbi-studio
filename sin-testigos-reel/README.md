# Sin testigos: reel (post 8, mié 25/11 12:00)

Edición local con ffmpeg (vidIQ solo se usó para el análisis).

## Cómo se arma
```
python3 make_overlays.py <fonts> <overlays>          # textos PNG 1080x1920
./build_reel.sh SinTestigos.mp4 <avatar.mp4|-> <overlays> <out>
```
Fuentes: Instrument Sans y Archivo (variables, Google Fonts). Con `-` como avatar se renderizan placeholders.

## Escenas verificadas a ojo (16/11)
| # | Escena | Fuente | Plano completo | Tipo |
|---|---|---|---|---|
| gancho | informe en llamas | 12:45.01, 2,97 s ralentizado a 3,65 s | 12:45.01 a 12:47.98 | IA |
| 1 | auto, interior | 9:31.00 | 9:30.40 a 9:39.16 | IA |
| 2 | amuleto | 3:53.00 | 3:52.69 a 4:04.66 | filmada |
| 3 | pared | 7:38.00 | | filmada |
| 4 | control policial | 10:29.00 | 10:27.54 a 10:34.18 | IA |
| 5 | servilleta | 5:50.60 | termina 5:53.23 | filmada |
| 6 | auto que se va | 12:57.00 | 12:55.86 a 13:00.07 | IA |

Correcciones al handoff: en 9:27 todavía es el bar; el auto arranca en 9:30.40. El auto que se va termina en 13:00.07 (después ya son los dos hombres en el camino). El amuleto se toma desde 3:53 porque en 3:55 la mano lo tapa.

## Avatar
`avatar-shot-20261116-e82a6d46.mp4` (Drive, 1080x1920, 30 fps, 16,3 s). Los subtítulos del cierre cambian en las pausas de la voz: 23,62 s y 25,91 s del reel. En las partes del avatar los subtítulos van a la altura del pecho (62 %) para no taparle la cara.

## Pendiente
- Permiso del equipo del corto y de los actores.
