#!/usr/bin/env python3
"""Original Maple Tea Waltz and revised cues. Run after compose.py; no external samples."""
from pathlib import Path
import json, subprocess, wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/shanhai/audio';SR=32000
rng=np.random.default_rng(82641);BPM=76;BEAT=60/BPM;N=round(48*BEAT*SR);bus=np.zeros((N,2))
def note(midi,length,kind='pluck'):
 t=np.arange(round(length*SR))/SR;f=440*2**((midi-69)/12)
 if kind=='reed':
  phase=2*np.pi*f*t+.09*np.sin(2*np.pi*4.2*t);a=(np.sin(phase)+.09*np.sin(phase*2))*np.minimum(t/.09,1)*np.minimum((length-t)/.18,1)
 elif kind=='pad':a=(np.sin(2*np.pi*f*t)+.12*np.sin(2*np.pi*f*2*t))*np.minimum(t/.2,1)*np.minimum((length-t)/.5,1)*.6
 else:a=(np.sin(2*np.pi*f*t)+.24*np.sin(2*np.pi*f*2*t)*np.exp(-t/.12)+.07*np.sin(2*np.pi*f*4*t))*np.exp(-t/.45)*np.minimum(t/.005,1)*np.minimum((length-t)/.04,1)
 return a

def add(a,second,gain,pan=0):
 idx=(np.arange(len(a))+round(second*SR))%N;stereo=np.column_stack([a*np.sqrt((1-pan)/2),a*np.sqrt((1+pan)/2)])*gain
 np.add.at(bus,idx,stereo)
 for delay,level in [(.19,.11),(.38,.055)]:np.add.at(bus,(idx+round(delay*SR))%N,stereo[:,::-1]*level)
# G-centered pentatonic melody, two distinct phrases and a soft D turnaround.
chords=[[55,59,62],[52,55,59],[48,52,55],[50,57,62],[55,59,62],[52,55,59],[48,55,60],[50,57,62],
 [59,62,66],[52,55,59],[48,52,55],[50,57,62],[48,55,60],[50,57,62],[55,59,62],[50,57,62]]
melody=[[(0,74,1), (1.5,71,.5),(2.2,69,.5)],[(.5,67,.8),(1.7,69,1)],[(0,71,1.2),(1.6,74,.8)],[(.4,69,1.5)],
 [(0,74,.6),(.8,79,.8),(2,76,.7)],[(.3,74,.8),(1.5,71,1)],[(0,69,.8),(1,67,1.4)],[(.5,69,1.8)],
 [(0,78,1),(1.5,76,.7)],[(.4,74,1),(1.8,71,.8)],[(0,72,.8),(1,74,.8),(2,71,.7)],[(.5,69,1.6)],
 [(0,67,1),(1.4,71,1)],[(0,69,.6),(.9,74,1.2)],[(0,71,1),(1.5,67,1)],[(.5,69,1.7)]]
for bar,chord in enumerate(chords):
 start=bar*3*BEAT
 for n in chord:add(note(n,3*BEAT+.4,'pad'),start,.045)
 for beat,k in [(0,0),(1,1),(2,2)]:add(note(chord[k]+12,.9),start+beat*BEAT,.13,(-.4 if beat==1 else .4))
 add(note(chord[0]-12,1.1),start,.16)
 for at,n,d in melody[bar]:add(note(n,d*BEAT+.15,'reed'),start+at*BEAT,.085,-.13)
 if bar%2==0:add(note(chord[2]+24,.6),start+2.5*BEAT,.035,.6)
# Periodic, band-limited wind bed: all frequencies are whole cycles of the loop.
t=np.arange(N)/N
for k in range(90,170):
 phase=rng.uniform(0,2*np.pi);wind=np.sin(2*np.pi*k*t+phase)*.00028*(1+.4*np.sin(2*np.pi*t*3))
 bus[:,0]+=wind;bus[:,1]+=np.roll(wind,320)
bus-=bus.mean(axis=0);bus*=.66/np.max(np.abs(bus))
# Ten-ms endpoint smoothing, without silence or a repeated fade-out.
w=np.linspace(0,1,320)[:,None];mid=(bus[0]+bus[-1])/2;bus[:320]=mid*(1-w)+bus[:320]*w;bus[-320:]=bus[-320:]*(1-w)+mid*w

def wav(path,a):
 a=np.asarray(a);a=a[:,None] if a.ndim==1 else a
 with wave.open(str(path),'wb') as f:f.setnchannels(a.shape[1]);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
raw=OUT/'maple-tea-waltz.wav';wav(raw,bus)
for ext,args in [('ogg',['-c:a','libvorbis','-q:a','3']),('mp3',['-c:a','libmp3lame','-b:a','96k'])]:subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(raw),*args,str(OUT/f'maple-tea-waltz.{ext}')],check=True)
raw.unlink()
def cue(name,notes,duration,spacing,gain):
 a=np.zeros(round(duration*SR))
 for i,n in enumerate(notes):
  sound=note(n,.35)*gain;at=round(i*spacing*SR);take=min(len(sound),len(a)-at);a[at:at+take]+=sound[:take]
 a[-160:]*=np.linspace(1,0,160);wav(OUT/f'{name}.wav',a)
cue('purchase',[74,81,86],.48,.085,.34)
cue('event',[72,79],.48,.16,.27)
cue('event-success',[74,78,81],.55,.12,.34)
cue('event-fail',[69,64],.55,.17,.28)
a=np.zeros(round(.62*SR))
for i,at in enumerate([0,.05,.11,.19,.29,.42,.55]):
 t=np.arange(round(.065*SR))/SR;click=(.32*rng.normal(0,1,len(t))+.6*np.sin(2*np.pi*(420+i*55)*t))*np.exp(-t/.009)*np.minimum(t/.0015,1)
 pos=round(at*SR);a[pos:pos+len(t)]+=click*(.33 if i<6 else .42)
wav(OUT/'dice.wav',a)
manifest=json.loads((OUT/'manifest.json').read_text());manifest['tracks']=[{'id':'saltwind-promenade','title':'盐风漫步','map':'shanhai-coast','meter':'4/4','bpm':88,'source':'scripts/audio/compose.py'}, {'id':'maple-tea-waltz','title':'枫谷茶时','map':'shanhai-highland','meter':'3/4','bpm':BPM,'durationSeconds':N/SR,'source':'scripts/audio/compose-chapters.py'}];manifest['sfx']=list(dict.fromkeys(manifest['sfx']+['event-success.wav','event-fail.wav']));manifest['revision']='chapter-sound-2026-11-05';manifest['sources']=['scripts/audio/compose.py','scripts/audio/compose-chapters.py'];(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
checks={}
for path in sorted(OUT.iterdir()):
 if path.suffix not in ['.ogg','.mp3','.wav']:continue
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(SR),'-ac','2','-']);x=np.frombuffer(data,dtype='<f4').reshape(-1,2);peak=float(np.max(np.abs(x)))
 assert 0<peak<1,path
 checks[path.name]={'seconds':len(x)/SR,'peak':peak,'rms':float(np.sqrt(np.mean(x*x))),'clippedSamples':int(np.sum(np.abs(x)>=1)),'endpointDelta':float(np.max(np.abs(x[0]-x[-1])))}
(OUT/'validation.json').write_text(json.dumps({'method':'FFmpeg decoded signal checks; not subjective listening','files':checks},indent=2)+'\n');print(json.dumps(checks,indent=2))
