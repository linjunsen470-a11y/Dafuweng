# Original chapter soundtracks · 原创章节配乐

An original 16-bar, 4/4, 88 BPM coastal miniature for 山海都市岛 (43.636 seconds).
The score has two authored eight-bar phrases, a contrasting harmonic bridge,
flute-like melody, alternating marimba broken chords, electric-piano-like harmony,
rounded bass, wooden rim percussion, shaker and a subtle surf-noise bed.

All pitches, rhythms, arrangements and synthesis were created for this project.
No downloaded samples, commercial recordings, sample packs or third-party music
are used. Audio assets can be distributed with this project without attribution
or royalty obligations to a sample provider. The executable source of every sound
is `compose.py`, `compose-chapters.py`, or `compose-feedback.py`; random elements use a fixed seed for reproducibility.

## Rebuild

Run `python3 scripts/audio/compose.py` followed by
`python3 scripts/audio/compose-chapters.py`, then
`python3 scripts/audio/compose-feedback.py` from the repository root. The second
script adds the mountain score and overwrites revised dice/purchase/event cues. Requires Python,
NumPy, and FFmpeg with libvorbis/libmp3lame. Add `--keep-wav` to retain the stereo
32 kHz PCM source. The lossless source is otherwise omitted to keep downloads small.
OGG is preferred; MP3 is the browser fallback. SFX use short mono WAVs.
No network or remote service is needed to reproduce the assets.

The renderer places note and room tails circularly into the 16-bar buffer instead
of fading out each repeat. The arrangement intentionally turns around on A before
returning to D. The accompanying manifest records objective signal checks.

## Integration

Import `SliceAudio` (named or default) from `src/shanhai/SliceAudio.js`.
Create with optional `musicVolume`, `sfxVolume`, `musicEnabled`, `sfxEnabled` and
`musicTrack` (`saltwind-promenade` or `maple-tea-waltz`) and `baseUrl`. Construction does not fetch or play audio. Call `unlock()` directly
inside the first pointer/click/key gesture. It is safe to call again after a
browser rejects playback. Music starts only if enabled. Each effects asset loads
once on unlock; early effects are skipped, never queued and played late.

Use `play('dice'|'step'|'purchase'|'upgrade'|'rent'|'event'|'event-success'|'event-fail'|'turn'|'win'|'ability'|'auction-sold'|'bankruptcy')`.
The setters `setMusicEnabled`, `setSfxEnabled`, `setMusicVolume`, `setSfxVolume`
operate independently. Music pauses and current effects stop when the page is hidden; hidden AI effects are skipped. Muting effects stops active voices. The chapter UI persists both volumes and mute flags under the existing audio preference key. `dispose()` stops
playback, aborts outstanding downloads, removes listeners and closes the context.

## Validation

`node scripts/audio/test-audio.mjs` checks gesture gating, effect loads, independent
mute/volume controls, duplicate throttling, page visibility and disposal with
browser API doubles. `public/shanhai/audio/validation.json` records FFmpeg-decoded
signal checks for the chapter scores and earlier effects; `feedback-validation.json`
records PCM checks for the three new action cues. All signals are non-silent and unclipped;
the music has no silent one-second windows. These are objective checks, not a
claim of subjective listening evaluation.

## Maple Tea Waltz · 枫谷茶时 (2026-11-05)

A new original 16-bar, 3/4, 76 BPM mountain miniature (37.895 seconds):
plucked broken chords, warm pads, reed-like melody, sparse bell notes and a
periodic synthesized wind bed. Its two authored phrases and D turnaround lead
back to G. Notes and delay tails wrap around the loop; the outer 10ms is
smoothed to a shared endpoint. No sample recordings or outside compositions.
The coast keeps its earlier score with a slightly clearer soft wave bed.

Dice now has seven short wooden taps; purchase has a brief rising bell figure.
The event notice, success and setback use different original motifs. All are
synthesized here, including the noise sources. Decoded OGG and MP3 peak/RMS
and endpoint measurements are in validation.json. These measurements cannot
prove perceptually seamless playback or replace listening on real speakers.

## Action cues · 关键操作反馈 (2026-11-06)

`compose-feedback.py` generates three short original mono cues at 32 kHz using
only oscillator envelopes and fixed-seed synthesized noise: ability (0.64s,
rising whistle plus high answer), auction-sold (0.62s, two wooden strikes and
confirmation), bankruptcy (0.82s, two descending low tones). No external samples.
The existing event-fail cue signals an unsold auction; an ordinary bid or pass
has no additional sound. Both human and AI settlements use the same mapping.

All three cues are available in the sound settings for manual audition. Volume
zero now stops existing effects, matching the mute switch; raising the slider
does not revive an old tail. Music remains independent. New files are checked in
`public/shanhai/audio/feedback-validation.json`. Real browser output recordings
and checks are documented in `docs/shanhai-action-sound.md`.

Subjective listening remains **not completed**: the current audio input endpoint
explicitly does not support audio input. Neither decoded PCM measurements nor
browser recordings establish listening comfort or physical speaker quality.
