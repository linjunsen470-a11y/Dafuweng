// All voices use the game's two gain buses, including weather ducking and mute.
export function mallet(audio, hz, start, duration, wood = false) {
  const bus = {destination: audio.musicGain, trackMusic:true, attack:.005};
  audio.scheduleTone(hz,start,duration,{...bus,type:wood?'triangle':'sine',volume:.049,release:duration*.7});
  audio.scheduleTone(hz*(wood ? 3 : 4.02),start,.054,{...bus,type:'sine',volume:.013,release:.034});
}

export function playSceneSound(audio, kind) {
  if (audio.muted || !audio.init()) return false;
  const now = audio.ctx.currentTime;
  const note = (hz, at, length, volume, end = hz) => {
    const oscillator = audio.scheduleTone(hz,now+at,length,{type:'sine',volume,release:length*.68});
    oscillator?.frequency.exponentialRampToValueAtTime(end,now+at+length);
  };
  const knock = (at, lowpass) => audio.scheduleNoise(now+at,.065,{volume:.08,highpass:110,lowpass});
  switch (kind) {
    case 'stamp': knock(0,1200); note(215,0,.15,.12,78); break;
    case 'hammer':
      [0,.13,.24].forEach(offset=>knock(offset,1750));
      [880,1109,1319].forEach((hz,i)=>note(hz,.28+i*.04,.16,.045)); break;
    case 'missile': note(340,0,.39,.055,1360); knock(.45,1900); note(180,.45,.22,.13,48); break;
    case 'blast': knock(0,2100); note(180,0,.25,.12,48); break;
    case 'brake': note(860,0,.14,.05,220); note(160,.12,.17,.065,420); break;
    case 'jackpot': [392,494,587,784].forEach((hz,i)=>note(hz,i*.07,.19,.06)); break;
    case 'sigh': note(460,0,.13,.05,365); note(365,.12,.26,.06,196); break;
    case 'stock': [620,780,980].forEach((hz,i)=>note(hz,i*.06,.15,.045)); break;
    default: return false;
  }
  return true;
}
