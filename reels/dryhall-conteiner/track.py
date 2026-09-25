import subprocess, numpy as np, cv2, json
W,H=1080,1920
start, dur = 9.70, 2.1
p = subprocess.Popen(["ffmpeg","-v","error","-ss",str(start),"-i","src/C.mp4","-t",str(dur),"-vf","scale=1080:1920","-f","rawvideo","-pix_fmt","rgb24","-"],stdout=subprocess.PIPE)
frames=[]
while True:
    b=p.stdout.read(W*H*3)
    if len(b)<W*H*3: break
    frames.append(np.frombuffer(b,np.uint8).reshape(H,W,3))
print("frames",len(frames))
# reference frame is at 9.85 -> index round(0.15*30)=4 or 5
ref_i=int(round((9.85-start)*30))
g=[cv2.cvtColor(f,cv2.COLOR_RGB2GRAY) for f in frames]
pts={"b1":(100,693),"b2":(400,673)}
res={k:[None]*len(frames) for k in pts}
R=36; SR=60
for k,(x,y) in pts.items():
    tpl=g[ref_i][y-R:y+R, x-R:x+R]
    cx,cy=x,y
    # forward and backward from ref
    for order in [range(ref_i,len(frames)), range(ref_i,-1,-1)]:
        cx,cy=x,y
        for i in order:
            x0=max(0,cx-R-SR); y0=max(0,cy-R-SR)
            win=g[i][y0:cy+R+SR, x0:cx+R+SR]
            m=cv2.matchTemplate(win,tpl,cv2.TM_CCOEFF_NORMED)
            _,mv,_,ml=cv2.minMaxLoc(m)
            nx=x0+ml[0]+R; ny=y0+ml[1]+R
            res[k][i]=(int(nx),int(ny),round(float(mv),3))
            if mv>0.5: cx,cy=nx,ny
for i in range(len(frames)):
    print(i, round(start+i/30,3), res["b1"][i], res["b2"][i])
json.dump({"start":start,"fps":30,"b1":res["b1"],"b2":res["b2"]},open("track.json","w"))
