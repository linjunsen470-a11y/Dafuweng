#!/usr/bin/env python3
"""Original score: Saltwind Promenade. Deterministic, entirely procedural synthesis.
Run: python scripts/audio/compose.py [--keep-wav]. Requires NumPy + ffmpeg.
No recorded samples, downloaded audio, or third-party musical composition.
"""
import json, math, subprocess, sys, wave
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'public/shanhai/audio'; OUT.mkdir(parents=True, exist_ok=True)
SR=32000; BPM=88; BEAT=60/BPM; BARS=16; LENGTH=64*BEAT
N=round(LENGTH*SR); rng=np.random.default_rng(71321)
bus=np.zeros((N,2),dtype=np.float64)

def freq(note): return 440*2**((note-69)/12)
def env(t, attack, decay): return np.minimum(t/attack,1)*np.exp(-t/decay)
def tone(note, duration, kind='marimba'):
    t=np.arange(round(duration*SR))/SR; f=freq(note)
    if kind=='marimba':
        a=(np.sin(2*np.pi*f*t)*np.exp(-t/0.38)+0.27*np.sin(2*np.pi*f*3.99*t)*np.exp(-t/.065)+.10*np.sin(2*np.pi*f*9.98*t)*np.exp(-t/.025))*np.minimum(t/.004,1)
    elif kind=='flute':
        phase=2*np.pi*f*t+.014*f*np.sin(2*np.pi*4.9*t)*np.minimum(t/.3,1)/4.9
        a=(np.sin(phase)+.13*np.sin(2*phase)+.035*np.sin(3*phase))*np.minimum(t/.06,1)*np.minimum((duration-t)/.16,1)
        a*=.8+.2*np.sin(np.pi*t/duration)
    elif kind=='bass':
        a=(np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*2*f*t))*env(t,.012,.38)*np.minimum((duration-t)/.04,1)
    else:
        a=(np.sin(2*np.pi*f*t)+.12*np.sin(2*np.pi*2*f*t)+.06*np.sin(2*np.pi*3*f*t))*env(t,.025,1.0)*np.minimum((duration-t)/.10,1)
    return a

def add(a, second, gain=1, pan=0, room=False):
    idx=(np.arange(len(a))+round(second*SR))%N
    stereo=np.column_stack((a*np.sqrt((1-pan)/2), a*np.sqrt((1+pan)/2)))*gain
    np.add.at(bus,idx,stereo)
    if room:
        for delay,level in [(.113,.14),(.227,.09),(.359,.055)]:
            np.add.at(bus,(idx+round(delay*SR))%N,stereo[:,::-1]*level)

# D major, two eight-bar phrases: Imaj9 / vi7 / IVmaj9 / Vadd9, with a
# contrasting bridge (iii7, vi7, ii7, V) and a gentle dominant turnaround.
chords=[(38,[62,66,69,73]),(35,[62,66,69,71]),(31,[59,62,66,69]),(33,[61,64,69,71]),
        (38,[62,66,69,73]),(35,[59,62,66,69]),(31,[59,62,66,69]),(33,[61,64,67,71]),
        (30,[57,61,64,69]),(35,[59,62,66,69]),(28,[55,59,62,66]),(33,[57,61,64,71]),
        (31,[59,62,66,69]),(33,[57,61,64,71]),(38,[57,62,66,69]),(33,[57,61,64,71])]
# Authored melody, with rests, syncopation, question/answer and variation.
melody=[[(0,78,.75),(1,76,.5),(1.75,74,1),(3,69,.5)],
[(.5,71,.75),(1.5,74,.5),(2.5,78,1)],
[(0,78,.5),(.75,81,.75),(2,78,.5),(3,76,.75)],
[(0,76,1),(1.5,73,.5),(2.5,71,.5),(3.25,69,.5)],
[(0,74,.5),(.75,76,.5),(1.5,78,1),(3,81,.5)],
[(.25,83,.75),(1.5,81,.5),(2.25,78,.75),(3.25,74,.5)],
[(0,76,.5),(.75,78,.75),(2,74,1.25)],
[(.5,73,.5),(1.5,71,.5),(2.5,69,1)],
[(0,73,.75),(1,76,.5),(2,78,.5),(3,76,.75)],
[(.5,74,.5),(1.25,78,.75),(2.5,83,1)],
[(0,81,.75),(1,78,.5),(2,76,.75),(3,74,.5)],
[(.25,73,.75),(1.5,76,.5),(2.5,81,.75)],
[(0,83,.5),(.75,81,.75),(2,78,.5),(3,76,.5)],
[(0,76,.75),(1,73,.5),(2,71,.5),(3,69,.75)],
[(0,74,1.5),(2,78,.5),(3,76,.5)],
[(0,73,.75),(1.25,71,.5),(2.25,69,.75),(3.25,73,.5)]]
for bar,(bass,notes) in enumerate(chords):
    start=bar*4*BEAT
    for j,note in enumerate(notes): add(tone(note,2.7,'keys'),start+j*.018,.065,(-.5+j/3),True)
    # Broken chord plucks alternate voicings, rather than a static four-tone loop.
    for i,k in enumerate([0,2,1,3,2,1]):
        at=[.0,.75,1.5,2.0,2.75,3.5][i]
        add(tone(notes[(k+bar%2)%4]+12,.7),start+at*BEAT,.075,-.43 if i%2==0 else .43,True)
    for at,note,gain in [(0,bass,.23),(1.5,bass+12,.12),(2.5,bass+7,.16),(3.5,bass+12,.10)]:
        add(tone(note,.6,'bass'),start+at*BEAT,gain,0)
    for at,note,dur in melody[bar]:
        add(tone(note,dur*BEAT+.12,'flute'),start+at*BEAT,.10,.12,True)
        if bar in [4,6,12,14]: add(tone(note-12,.7),start+at*BEAT,.065,-.2,True)
    for beat in range(8):
        t=np.arange(int(.075*SR))/SR; noise=rng.normal(0,1,len(t)); noise=np.r_[0,np.diff(noise)]
        shake=noise*np.exp(-t/.017)*np.minimum(t/.002,1)
        add(shake,start+(beat*.5+.025*(beat%2))*BEAT,.012 if beat%2 else .018,-.65 if beat%2 else .65)
    for beat in [1,3]:
        t=np.arange(int(.10*SR))/SR
        wood=(np.sin(2*np.pi*780*t)+.4*np.sin(2*np.pi*1260*t))*np.exp(-t/.018)*np.minimum(t/.001,1)
        add(wood,start+beat*BEAT,.048,-.22,True)
    for beat in [0,2]:
        t=np.arange(int(.22*SR))/SR; kick=np.sin(2*np.pi*(62*t+1.3*(1-np.exp(-t/.025))))*np.exp(-t/.075)*np.minimum(t/.005,1)
        add(kick,start+beat*BEAT,.12)
# Airy, near-inaudible surf: periodic modulation ensures seamless circular bed.
noise=rng.normal(0,1,(N,2)); surf=np.cumsum(noise,axis=0); surf-=np.linspace(0,1,N)[:,None]*surf[-1]
# Use short moving-average noise rather than drifting low-frequency energy.
for side in range(2):
    soft=np.convolve(noise[:,side],np.ones(120)/120,'same')
    bus[:,side]+=soft*(.012+.009*np.sin(2*np.pi*np.arange(N)/N*4))
bus-=np.mean(bus,axis=0); peak=np.max(np.abs(bus)); bus*=.77/peak

def write_wav(path,a):
    a=np.asarray(a); a=a[:,None] if a.ndim==1 else a
    with wave.open(str(path),'wb') as w:
        w.setnchannels(a.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
write_wav(OUT/'saltwind-promenade.wav',bus)
for ext,args in [('ogg',['-c:a','libvorbis','-q:a','3']),('mp3',['-c:a','libmp3lame','-b:a','96k'])]:
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(OUT/'saltwind-promenade.wav'),*args,str(OUT/f'saltwind-promenade.{ext}')],check=True)

def effect(name,notes,spacing=.095,duration=.7,gain=.7):
    a=np.zeros(round(duration*SR))
    for i,note in enumerate(notes):
        sound=tone(note,.32,'marimba'); pos=round(i*spacing*SR); take=min(len(sound),len(a)-pos)
        if take>0:a[pos:pos+take]+=sound[:take]
    a*=gain/max(1,np.max(np.abs(a))); a[-200:]*=np.linspace(1,0,200)
    write_wav(OUT/f'{name}.wav',a)
for args in [('purchase',[74,78,81],.085,.7,.6),('upgrade',[74,78,81,86],.09,.85,.65),('rent',[69,66],.12,.55,.48),('event',[78,74,81,85],.1,.9,.52),('turn',[81,86],.12,.6,.44),('win',[74,78,81,86,81,86,90],.13,1.4,.65)]: effect(*args)
# Dice: tumbling wooden clicks slow toward landing; step: soft sandal-like tap.
for name,duration,hits in [('dice',.64,[0,.055,.12,.20,.30,.43,.56]),('step',.12,[0])]:
    a=np.zeros(round(duration*SR))
    for i,at in enumerate(hits):
        t=np.arange(round(.075*SR))/SR; click=(rng.normal(0,.3,len(t))+np.sin(2*np.pi*(650+i*87)*t)) *np.exp(-t/.012)*np.minimum(t/.001,1)
        pos=round(at*SR); take=min(len(click),len(a)-pos); a[pos:pos+take]+=click[:take]*(.4 if name=='dice' else .2)
    write_wav(OUT/f'{name}.wav',a)
manifest={'title':'Saltwind Promenade / 盐风漫步','authorship':'Original composition and procedural synthesis created for 山海都市岛. No external samples.','tempoBpm':BPM,'meter':'4/4','bars':BARS,'durationSeconds':N/SR,'sampleRate':SR,'music':['saltwind-promenade.ogg','saltwind-promenade.mp3'],'sfx':[f'{x}.wav' for x in ['dice','step','purchase','upgrade','rent','event','turn','win']],'source':'scripts/audio/compose.py','quality':{'peak':float(np.max(np.abs(bus))),'rms':float(np.sqrt(np.mean(bus**2))),'loopEndpointDelta':float(np.max(np.abs(bus[0]-bus[-1]))),'clippedSamples':int(np.sum(np.abs(bus)>=1))}}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
if '--keep-wav' not in sys.argv:(OUT/'saltwind-promenade.wav').unlink()
