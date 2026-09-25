import numpy as np, soundfile as sf, subprocess, os
S=os.path.dirname(os.path.abspath(__file__)); SR=48000; DUR=43.30
v,sr=sf.read(f"{S}/audio/voice_clean.wav",dtype="float32"); assert sr==SR
N=int(DUR*SR); voice=np.zeros(N,np.float32)
# (orig_in, orig_out, offset)  -> timeline = orig + offset
BLOCKS=[(1.75,7.46,-1.75),(7.46,13.80,-1.45),(13.80,18.18,-1.45),(18.18,27.48,-0.25),(27.48,33.80,0.15),(33.80,40.42,0.65)]
fade=int(0.025*SR)
for a,b,off in BLOCKS:
    seg=v[int(a*SR):int(b*SR)].copy()
    seg[:fade]*=np.linspace(0,1,fade); seg[-fade:]*=np.linspace(1,0,fade)
    st=int((a+off)*SR); voice[st:st+len(seg)]+=seg[:max(0,min(len(seg),N-st))]
sf.write(f"{S}/audio/voice_timeline.wav",voice,SR)
# ---------------- SFX synthesis
rng=np.random.default_rng(3)
def bp_sweep(x,f0,f1,q=1.2):
    y=np.zeros_like(x); n=len(x); z1=z2=0.0
    fs=np.geomspace(f0,f1,n)
    out=np.empty(n,np.float32)
    # time-varying biquad bandpass (RBJ), coefficients updated every 32 samples
    for i0 in range(0,n,32):
        f=fs[i0]; w=2*np.pi*f/SR; al=np.sin(w)/(2*q); c=np.cos(w)
        b0,b1,b2=al,0,-al; a0,a1,a2=1+al,-2*c,1-al
        b0/=a0;b1/=a0;b2/=a0;a1/=a0;a2/=a0
        for i in range(i0,min(n,i0+32)):
            xi=x[i]; yi=b0*xi+z1; z1=b1*xi-a1*yi+z2; z2=b2*xi-a2*yi; out[i]=yi
    return out
def whoosh(dur=0.8,peak=0.55,f0=350,f1=2600,gain=0.10,rev=False):
    n=int(dur*SR); t=np.arange(n)/SR
    x=rng.normal(0,1,n).astype(np.float32)
    y=bp_sweep(x,f0,f1) if not rev else bp_sweep(x,f1,f0)
    tp=peak*dur
    env=np.where(t<tp,(t/tp)**2.2,np.exp(-(t-tp)/(0.16*dur)))
    y=y*env; y=y/np.max(np.abs(y))*gain
    pan=np.linspace(-0.6,0.6,n)
    L=y*np.sqrt((1-pan)/2); R=y*np.sqrt((1+pan)/2)
    return np.stack([L,R],1), tp
def tick(gain=0.05,f=2100):
    n=int(0.09*SR); t=np.arange(n)/SR
    y=(np.sin(2*np.pi*f*t)*0.7+np.sin(2*np.pi*f*1.5*t)*0.3)*np.exp(-t/0.014)
    y+=rng.normal(0,1,n)*np.exp(-t/0.002)*0.15
    y=y/np.max(np.abs(y))*gain
    return np.stack([y,y],1), 0.0
def hit(gain=0.16):
    n=int(1.4*SR); t=np.arange(n)/SR
    fr=48+30*np.exp(-t/0.08); ph=2*np.pi*np.cumsum(fr)/SR
    y=np.sin(ph)*np.exp(-t/0.45)
    nz=bp_sweep(rng.normal(0,1,n).astype(np.float32),1800,500)*np.exp(-t/0.25)*0.25
    y=y+nz/np.max(np.abs(nz))*0.2
    att=int(0.004*SR); y[:att]*=np.linspace(0,1,att)
    y=y/np.max(np.abs(y))*gain
    return np.stack([y,y],1), 0.0
sfx=np.zeros((N,2),np.float32)
def place(clip,t):
    c,off=clip; st=int((t-off)*SR); en=min(N,st+len(c))
    if st<0: c=c[-st:]; st=0
    sfx[st:en]+=c[:en-st]
place(whoosh(0.75,0.6,300,2400,0.085),3.32)
place(whoosh(0.9,0.6,260,2000,0.090),16.86)
place(whoosh(0.7,0.55,2200,500,0.060,rev=False),26.18)
place(whoosh(1.0,0.65,220,1800,0.085),38.72)
for i in range(4): place(tick(0.030,2400),5.05+i*0.08)
for i in range(4): place(tick(0.050,2000),23.62+i*0.18)
for i in range(3): place(tick(0.040,2200),26.30+i*0.14)
place(hit(0.15),39.00)
sf.write(f"{S}/audio/sfx.wav",sfx,SR)
print("voice peak",np.max(np.abs(voice)),"sfx peak",np.max(np.abs(sfx)))
