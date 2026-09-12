# Finalist video checklist

Target **2:45**. Required by the supplied brief: **2:00–4:00**, **at least 720p**, and **clear human speech, not music**. The [demo script](demo-script.md) is ready to rehearse; a real recording and human narration are still required.

## Before the take

- [ ] Open [the deployed app](https://closeout-ashen.vercel.app) in a clean browser window. If recording a local build instead, identify it as local.
- [ ] Use a landscape 1920×1080 canvas when practical, with 1280×720 as the minimum export target. Set browser zoom so the fee and remaining-share rows are readable at normal playback size.
- [ ] Confirm live reads load, the example Atlas market is available, and the Privy chooser opens and dismisses on this origin. Do not connect a wallet or sign for this demonstration.
- [ ] Hide notifications, unrelated tabs, bookmarks, personal account details and secret-bearing windows. Show only the app and the actions in the script.
- [ ] Record a short microphone test and listen back. Use a quiet space; keep the meter out of the clipping/red range. Choose your microphone rather than an unintended system or silent input.
- [ ] Rehearse the 250-share / 0.60-floor flow. Say clearly when you enter Example mode and when the result is simulated.

## Record

- [ ] Speak the narration yourself. Use clear speech throughout; omit background music. Do not substitute a synthetic voice, subtitles alone or a music track for narration.
- [ ] Capture the actual product at normal speed. Keep the cursor deliberate, pause on the numbers, and leave the Live/Example and Simulated labels visible.
- [ ] Show the actual source state. If live reads fail, use the script’s explicit fallback line before choosing Example mode.
- [ ] Demonstrate partial fill → all-or-nothing block → partial review → simulated Activity. A wallet chooser can be shown and dismissed without selecting a wallet or authorizing a transaction.
- [ ] Trim dead time without concealing errors, changing the order of results or making a synthetic result appear live. Keep the final cut within 2–4 minutes rather than relying on the script’s estimated duration.

## Export and inspect the actual file

- [ ] Export a local MP4 with H.264 video and an AAC audio track for broad playback compatibility. Keep at least 1280×720 landscape (1920×1080 preferred); preserve a normal frame rate such as 30 fps.
- [ ] Use a clear filename, for example `closeout-demo-final.mp4`. Confirm the export completed and opens in a separate player.
- [ ] Run the local metadata check:

  ```sh
  node scripts/check-demo.mjs "/absolute/path/to/closeout-demo-final.mp4"
  ```

  Optional machine-readable output:

  ```sh
  node scripts/check-demo.mjs --json "/absolute/path/to/closeout-demo-final.mp4"
  ```

  The checker uses installed `ffprobe` on a regular local file. It checks reported duration inclusively from 120 to 240 seconds, the default/first non-cover video stream at a minimum 1280×720 envelope (720-pixel short edge and 1280-pixel long edge, either orientation), and the presence of an audio stream. Landscape is recommended for this app; the checker does not impose a separate aspect-ratio rule. It does not upload anything or change the recording.

- [ ] If the checker reports a failure or cannot inspect the file, resolve it and rerun on the new export. A script self-test is not a check of your recording.

## Mandatory manual review

- [ ] Watch the **entire exported file**, not just the editor timeline. Confirm the opening, middle and ending are present, with no frozen or blank sections or cut-off speech.
- [ ] Listen at ordinary volume through headphones and, if possible, a second device. Every explanation should be intelligible without straining; check for clipping, echo, missing audio, long silence and distracting noise.
- [ ] Verify the voice is your actual human narration and the track contains speech rather than only music. **An audio stream can be silent, unintelligible or music: ffprobe cannot establish this.**
- [ ] Confirm screen text remains readable at normal playback size. Pixel dimensions alone do not prove visual quality, useful framing or legibility.
- [ ] Confirm mode switches, fictional balances/fills, excluded costs and the absence of a real-trade claim are clear. Do not label the simulated net amount as a real receipt or saved fees.
- [ ] Compare the final file with the current submission requirements and verify the real upload/link separately when you choose to submit. This preparation does not upload, publish or submit the video.

`node scripts/check-demo.mjs --self-test` checks the validator against in-memory metadata cases only. It creates no video or voice and does not verify a demo recording. A metadata pass still requires all manual checks above.
