"""Reproducible Deadwood audio production. Python/numpy + ffmpeg; no runtime DSP synthesis.
Kenney CC0 source packs in research/audio/{impact,scifi,ui}/Audio (see CREDITS).
Original score: 32 bars, 88 BPM, D minor, two synchronized stems.
"""
from pathlib import Path
import numpy as np, subprocess, json, wave
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/audio'; OUT.mkdir(exist_ok=True)
SR=22050; rng=np.random.default_rng(4207); TAU=2*np.pi

def time(d): return np.arange(round(d*SR))/SR
def filt(y, lo=0, hi=10000):
 f=np.fft.rfftfreq(len(y),1/SR); w=1/(1+(f/max(hi,1))**6)
 if lo: w*=1-1/(1+(f/lo)**6)
 return np.fft.irfft(np.fft.rfft(y)*w,n=len(y))
def noise(d,lo=100,hi=8000): return filt(rng.normal(0,1,len(time(d))),lo,hi)
def fade(y,attack=.003,release=.02):
 y=y.copy();a=min(len(y),round(attack*SR));r=min(len(y),round(release*SR))
 if a:y[:a]*=np.linspace(0,1,a)
 if r:y[-r:]*=np.linspace(1,0,r)
 return y

def source(pack,name,rate=1):
 p=ROOT/'research/audio'/pack/'Audio'/(name+'.ogg')
 b=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ar',str(SR),'-ac','1','-'])
 y=np.frombuffer(b,np.float32)
 return np.interp(np.arange(0,len(y),rate),np.arange(len(y)),y)
def combine(d,parts):
 y=np.zeros(len(time(d)))
 for at,s,g in parts:
  i=round(at*SR);n=min(len(s),len(y)-i)
  if n>0:y[i:i+n]+=s[:n]*g
 return y

def save(name,y,peak=.78,music=False):
 y=np.nan_to_num(y);y-=y.mean(axis=0);y=fade(y,.006,.04) if y.ndim==1 else y
 m=np.max(np.abs(y)); y=y*peak/max(m,.001)
 wav=ROOT/'research/audio'/(name+'.wav')
 with wave.open(str(wav),'wb') as w:
  w.setnchannels(1 if y.ndim==1 else 2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((y*32767).astype('<i2').tobytes())
 ext='mp3' if music else 'wav'
 if music:subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','128k',str(OUT/(name+'.mp3'))],check=True)
 else:(OUT/(name+'.wav')).write_bytes(wav.read_bytes())
 return dict(file=name+'.'+ext,seconds=round(len(y)/SR,4),peak=round(float(np.max(abs(y))),4),rms=round(float(np.sqrt(np.mean(y*y))),4))
report=[]
# Rapid cannon: dry crack, short low body, quieter mechanism; three alternate attacks.
for v in range(3):
 t=time(.23); crack=noise(.23,900,6800)*np.exp(-t*42)
 body=np.sin(TAU*(105*t+2*(1-np.exp(-t*35))))*np.exp(-t*25)
 y=combine(.3,[(0,crack,.44),(0,body,.65),(.033,source('impact',f'impactMetal_light_00{v}',1.18),.35)])
 report.append(save('gun'+str(v),filt(y,70,7500),.73))
# Mortar: low tube report + air; blast uses recorded debris with a tuned pressure tail.
t=time(.75); thump=np.sin(TAU*(54*t+.75*(1-np.exp(-t*18))))*np.exp(-t*9)
report.append(save('launch',combine(.75,[(0,thump,.8),(.008,noise(.7,180,1800)*np.exp(-time(.7)*12),.3),(.025,source('impact','impactWood_heavy_001',.85),.6)])))
for v in range(2):
 t=time(1.5); sub=np.sin(TAU*(42*t+2*(1-np.exp(-t*13))))*np.exp(-t*3.9)
 y=combine(1.8,[(0,source('scifi',f'explosionCrunch_00{v}',.82),.8),(0,sub,.7),(.11,noise(1.5,120,1700)*np.exp(-t*3.5),.2)])
 report.append(save('boom'+str(v),filt(y,38,6000),.84))
# Bow mechanism: wooden snap plus pitched string and a short passing bolt.
t=time(.42); string=np.sin(TAU*165*t+2*np.sin(TAU*330*t))*np.exp(-t*16)
report.append(save('ballista',combine(.5,[(0,source('impact','impactPlank_medium_002',1.25),.65),(0,string,.28),(.035,noise(.3,1200,4800)*np.sin(np.pi*time(.3)/.3)**2,.12)]),.68))
# Electric arc: noisy crackle, granular interruptions and resonating copper, not a laser beep.
t=time(.65); gate=(.4+.6*np.sin(TAU*37*t)**6); arc=noise(.65,350,6500)*gate*np.exp(-t*7)
metal=np.sin(TAU*176*t+3*np.sin(TAU*263*t))*np.exp(-t*9)
report.append(save('tesla',arc*.55+metal*.22,.72))
# Discharge attack is immediate (matches impact), with a turbulent electrical collapse/tail.
t=time(2.2); discharge=noise(2.2,60,5000)*np.exp(-t*2.7); bass=np.sin(TAU*(46*t+3*(1-np.exp(-t*7))))*np.exp(-t*3)
report.append(save('overcharge',combine(2.6,[(0,discharge,.55),(0,bass,.55),(.01,source('scifi','explosionCrunch_003',.62),.6),(.1,source('scifi','forceField_001',.8),.18)]),.88))
# UI stays tactile and small. Success is a short tuned glass/chime flourish.
for name,pack,src in [('ui','ui','click_003'),('open','ui','open_001'),('close','ui','close_001'),('focus','ui','tick_002'),('ready','ui','confirmation_002'),('hit','impact','impactWood_heavy_002'),('death','impact','impactSoft_medium_001')]:
 report.append(save(name,filt(source(pack,src),100,7000),.56))
t=time(.9); reward=np.zeros(len(t))
for j,f in enumerate([587.33,880,1174.66]):
 tt=time(.65);s=(np.sin(TAU*f*tt)+.22*np.sin(TAU*f*2.7*tt))*np.exp(-tt*8);at=int(j*.07*SR);n=min(len(s),len(t)-at);reward[at:at+n]+=fade(s[:n])*.32
report.append(save('pack',reward,.56))
# A sparse distant creature call: breath/formants, no individual crowd voice per zombie.
for v in range(2):
 t=time(1.5);f=65+v*12+7*np.sin(t*5);phase=TAU*np.cumsum(f)/SR
 growl=sum(np.sin(phase*k+rng.uniform(-1,1))/(k**1.1) for k in range(1,12))
 env=np.sin(np.pi*t/1.5)**2*(.7+.3*np.sin(t*19)**2)
 report.append(save('horde'+str(v),filt(growl*env+noise(1.5,200,1200)*env*.16,130,1300),.62))
# Musical stems. Seamlessly wrap tails/delays across a 32-bar phrase, avoiding MP3 timing drift
# by setting exact musical loopEnd in the runtime. No persistent oscillator graph.
B=60/88;D=32*4*B;N=round(D*SR);bed=np.zeros((N,2));drums=np.zeros_like(bed)
def add(dst,s,beat,amp=1,pan=0):
 start=round(beat*B*SR);idx=(np.arange(len(s))+start)%N
 dst[idx,0]+=s*amp*np.sqrt((1-pan)/2);dst[idx,1]+=s*amp*np.sqrt((1+pan)/2)
def hz(m):return 440*2**((m-69)/12)
def pad(notes,d):
 t=time(d);y=np.zeros(len(t))
 for m in notes:
  f=hz(m)
  for det in [-.002,0,.0025]:
   y+=(np.sin(TAU*f*(1+det)*t)+.18*np.sin(TAU*f*2*(1+det)*t))/len(notes)/3
 return y*(1-np.exp(-t*1.7))*np.minimum(1,(d-t)/.85)*(.9+.1*np.sin(t*.7))
def pluck(m,d=1.6):
 t=time(d);f=hz(m);env=(1-np.exp(-t*180))*np.exp(-t*3.8)
 return (np.sin(TAU*f*t+1.8*np.sin(TAU*f*2*t)*np.exp(-t*9))+.12*np.sin(TAU*f*3*t))*env
chords=[[50,57,60,64],[46,53,57,60],[53,60,64,67],[48,55,58,62]]
for bar in range(32):
 ch=chords[(bar//2)%4]; section=bar//8
 if bar%2==0:
  s=pad(ch,8*B+1.6);add(bed,s,bar*4,.26,-.18);add(bed,s,bar*4+.045,.19,.25)
 # Warm subdued eighth-note bass, not a lead.
 for beat in [0,1.5,2.5,3.5]:
  t=time(.55);f=hz(ch[0]-12);s=(np.sin(TAU*f*t)+.2*np.sin(TAU*f*2*t))*fade(np.exp(-t*5),.012,.07)
  add(bed,s,bar*4+beat,.21)
 # Evolving pentatonic motif; alternating space and response.
 if section!=2 or bar%2==0:
  pattern=[(0,0),(.75,2),(1.5,1),(2.75,3)] if bar%2==0 else [(1,2),(2.5,1)]
  for beat,k in pattern:
   m=ch[k]+12 if section==3 else ch[k]
   s=pluck(m);add(bed,s,bar*4+beat,.11,(-.25 if k%2 else .25))
   add(bed,s,bar*4+beat+.75,.035,.45);add(bed,s,bar*4+beat+1.5,.018,-.45)
 # restrained war drums with sparse tom fills, no constant high-frequency hats
 for beat in [0,2,3.5] if section!=2 else [0,2.5]:
  t=time(.65);s=np.sin(TAU*(48*t+2*(1-np.exp(-t*20))))*np.exp(-t*8)+noise(.65,400,1700)*np.exp(-t*55)*.13
  add(drums,fade(s),bar*4+beat,.5)
 for beat in [1,3]:
  t=time(.24);s=noise(.24,500,3000)*np.exp(-t*20)
  add(drums,fade(s),bar*4+beat,.19,.15)
 if bar%4==3:
  for j in range(3):
   t=time(.38);s=np.sin(TAU*(95-j*12)*t)*np.exp(-t*13)+noise(.38,350,1100)*np.exp(-t*20)*.14
   add(drums,fade(s),bar*4+3+j*.25,.2,(-.3+j*.3))
# Circular subtle early reflections glue score together; reserve headroom.
for delay,amp in [(int(.23*SR),.14),(int(.41*SR),.09),(int(.67*SR),.05)]:bed+=np.roll(bed[:,::-1],delay,axis=0)*amp
report.append(save('siege-bed',bed,.64,True));report.append(save('siege-drums',drums,.7,True))
# Seamless wind bed, spectral texture rather than looping a short hiss.
D=16;t=time(D);w=noise(D,90,1300);w*=.4+.12*np.sin(TAU*t/D)+.07*np.sin(TAU*3*t/D)
# stitch endpoint using a short equal-power crossfade
n=int(.5*SR);w[:n]=w[:n]*np.linspace(0,1,n)+w[-n:]*np.linspace(1,0,n);w=w[:-n]
report.append(save('wind',w,.35,True))
(OUT/'manifest.json').write_text(json.dumps({'musicLoopSeconds':32*4*B,'assets':report},indent=2)+'\n')
print(json.dumps(report,indent=2))
