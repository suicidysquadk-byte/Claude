import sherpa_onnx, soundfile as sf, numpy as np, json, sys
S=sys.argv[1]; M=S+"/models/sherpa-onnx-whisper-small/"
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=M+"small-encoder.onnx", decoder=M+"small-decoder.onnx", tokens=M+"small-tokens.txt",
    language="pt", task="transcribe", num_threads=8, tail_paddings=2000)
audio, sr = sf.read(S+"/voice16k.wav", dtype="float32")
cfg = sherpa_onnx.VadModelConfig()
cfg.silero_vad.model = S+"/models/silero_vad.onnx"
cfg.silero_vad.min_silence_duration = float(sys.argv[2]) if len(sys.argv)>2 else 0.25
cfg.silero_vad.min_speech_duration = 0.2
cfg.silero_vad.threshold = 0.45
cfg.silero_vad.max_speech_duration = 20
cfg.sample_rate = sr
vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=60)
ws = cfg.silero_vad.window_size
segs=[]
for i in range(0, len(audio), ws):
    vad.accept_waveform(audio[i:i+ws])
    while not vad.empty():
        segs.append((vad.front.start/sr, vad.front.samples)); vad.pop()
vad.flush()
while not vad.empty():
    segs.append((vad.front.start/sr, vad.front.samples)); vad.pop()
out=[]
for st, samples in segs:
    s = rec.create_stream(); s.accept_waveform(sr, np.array(samples, dtype=np.float32)); rec.decode_stream(s)
    en = st + len(samples)/sr
    out.append({"start":round(st,2),"end":round(en,2),"text":s.result.text.strip()})
    print(f"{st:6.2f} - {en:6.2f}  {s.result.text.strip()}")
json.dump(out, open(S+"/transcript.json","w"), ensure_ascii=False, indent=1)
