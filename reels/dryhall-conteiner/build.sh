#!/usr/bin/env bash
# Recria o Reels "Móvel planejado começa antes da obra" a partir dos arquivos brutos.
# Uso: coloque os arquivos em src/ (veja LEIA-ME.md) e rode ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts stills audio out

# 1. Fontes da marca (OFL)
[ -f fonts/Marcellus-Regular.ttf ] || curl -sSL -o fonts/Marcellus-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/marcellus/Marcellus-Regular.ttf
for w in Light Regular Medium SemiBold Bold LightItalic; do
  [ -f fonts/Montserrat-$w.ttf ] || curl -sSL -o fonts/Montserrat-$w.ttf https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-$w.ttf
done

# 2. Quadros congelados usados no desenho do projeto, no fundo do diagrama e no encerramento
ffmpeg -v error -y -ss 2.4 -i src/D.mp4 -frames:v 1 -vf scale=1080:1920 stills/D_2.4.png
ffmpeg -v error -y -ss 3.3 -i src/D.mp4 -frames:v 1 -vf scale=1080:1920 stills/D_3.3.png

# 3. Rastreamento das cantoneiras (marcadores dourados)
python3 track.py

# 4. Áudio: limpeza da narração, remontagem no tempo do vídeo, efeitos sutis e mixagem
ffmpeg -v error -y -i src/voice.m4a -ac 1 -ar 48000 -af "highpass=f=75,lowpass=f=15000,afftdn=nr=8:nf=-48:tn=1,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=2,deesser=i=0.35,acompressor=threshold=-22dB:ratio=2.8:attack=6:release=90:makeup=2" audio/voice_clean.wav
python3 audio.py
ffmpeg -v error -y -i audio/voice_timeline.wav -i audio/sfx.wav -filter_complex "[0:a]pan=stereo|c0=c0|c1=c0[v];[v][1:a]amix=inputs=2:normalize=0:duration=first[m]" -map "[m]" -ar 48000 audio/mix_raw.wav
ffmpeg -v error -y -i audio/mix_raw.wav -af "volume=2.24dB,alimiter=limit=0.89:attack=3:release=60:level=disabled" -ar 48000 audio/mix_final.wav
ffmpeg -v error -y -i audio/sfx.wav -af "volume=2.24dB,alimiter=limit=0.84" -ar 48000 audio/sfx_only.wav

# 5. Vídeo em 4 partes paralelas
python3 render.py render 0 11 out/part0.mp4 & python3 render.py render 11 22 out/part1.mp4 &
python3 render.py render 22 33 out/part2.mp4 & python3 render.py render 33 43.3 out/part3.mp4 &
wait
printf "file 'part0.mp4'\nfile 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > out/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/list.txt -c copy out/video_master.mp4

# 6. Arquivos finais para o Instagram
ENC="-c:v libx264 -preset slow -crf 19 -maxrate 9M -bufsize 18M -profile:v high -level 4.1 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -r 30 -g 60 -movflags +faststart"
ffmpeg -v error -y -i out/video_master.mp4 -i audio/mix_final.wav -map 0:v -map 1:a $ENC -c:a aac -b:a 256k -ar 48000 -shortest out/reels_dryhall_final.mp4
ffmpeg -v error -y -i out/reels_dryhall_final.mp4 -i audio/sfx_only.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/reels_dryhall_sem_narracao.mp4
echo "Pronto: out/reels_dryhall_final.mp4"
