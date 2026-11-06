#!/usr/bin/env python3
"""Three original synthesized action cues; no external samples or network access."""
from pathlib import Path
import hashlib,json,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/shanhai/audio';SR=32000
rng=np.random.default_rng(60611)
def tone(hz,duration,decay=.24):
 t=np.arange(round(duration*SR))/SR
 env=np.minimum(t/.008,1)*np.exp(-t/decay)*np.minimum((duration-t)/.055,1)
 return (np.sin(2*np.pi*hz*t)+.12*np.sin(2*np.pi*hz*2*t))*env

def mix(bus,sound,start,gain=1):
 at=round(start*SR);n=min(len(sound),len(bus)-at);bus[at:at+n]+=sound[:n]*gain

def write(name,bus,description):
 bus[:160]*=np.linspace(0,1,160);bus[-320:]*=np.linspace(1,0,320)
 peak=np.max(np.abs(bus));bus*=.42/max(peak,.42)
 pcm=(bus*32767).astype('<i2');path=OUT/f'{name}.wav'
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
 x=pcm.astype(float)/32768
 return {'file':path.name,'description':description,'seconds':len(x)/SR,'peak':float(np.max(np.abs(x))),'rms':float(np.sqrt(np.mean(x*x))),'clippedSamples':int(np.sum(np.abs(x)>=1)),'endpointSamples':[int(pcm[0]),int(pcm[-1])],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

ability=np.zeros(round(.64*SR));t=np.arange(round(.29*SR))/SR
# Rising integrated-frequency whistle, then a quiet two-note answer.
rise=np.sin(2*np.pi*(330*t+420*t*t))*np.sin(np.pi*t/.29)**2
mix(ability,rise,0,.32);mix(ability,tone(784,.32),.26,.23);mix(ability,tone(1174.66,.28),.34,.12)
sold=np.zeros(round(.62*SR));t=np.arange(round(.085*SR))/SR
wood=(np.sin(2*np.pi*310*t)+.3*np.sin(2*np.pi*930*t)+rng.normal(0,.18,len(t)))*np.exp(-t/.014)*np.minimum(t/.002,1)
mix(sold,wood,0,.38);mix(sold,wood,.17,.3);mix(sold,tone(659.25,.26),.29,.23);mix(sold,tone(987.77,.23),.33,.12)
bankruptcy=np.zeros(round(.82*SR));mix(bankruptcy,tone(220,.46,.2),0,.31);mix(bankruptcy,tone(146.83,.49,.28),.28,.33)
checks=[write('ability',ability,'Rising whistle and soft high answer: role ability completed.'),write('auction-sold',sold,'Two dry wooden strikes and short confirmation: lot sold.'),write('bankruptcy',bankruptcy,'Two low descending tones with a soft release: player exits the season.')]
assert all(0<c['rms']<.25 and c['peak']<=.43 and c['clippedSamples']==0 and c['endpointSamples']==[0,0] for c in checks)
(OUT/'feedback-validation.json').write_text(json.dumps({'method':'Decoded PCM signal checks only; subjective listening not completed','source':'scripts/audio/compose-feedback.py','sampleRate':SR,'files':checks},indent=2)+'\n')
manifest=json.loads((OUT/'manifest.json').read_text());manifest['sfx']=list(dict.fromkeys(manifest['sfx']+[c['file'] for c in checks]));manifest['sources']=list(dict.fromkeys(manifest['sources']+['scripts/audio/compose-feedback.py']));manifest['revision']='action-feedback-2026-11-06';manifest['actionCues']={c['file']:c['description'] for c in checks};(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(checks,indent=2))
