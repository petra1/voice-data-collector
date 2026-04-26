# Voice Data Collector (Petra)

Simple browser-based web app to record voice samples and export them as `.wav`
files for later Whisper fine-tuning.

## Features

- Accessible, keyboard-friendly form and controls
- Metadata fields (`speaker`, `session`, `prompt`) included in filename
- Records microphone audio and encodes it to real WAV (PCM 16-bit, mono)
- Local download only (no cloud upload)

## Run locally

Because browsers restrict microphone access on `file://`, run a local server:

```bash
python3 -m http.server 8080
```

Then open:

<http://localhost:8080>

## Suggested data collection workflow

1. Fill `Speaker ID` with `petra`.
2. Set a session id such as `2026-04-26-morning`.
3. Paste one sentence in `Prompt / Sentence`.
4. Record, stop, listen, then save.
5. Repeat with many short utterances.

This creates files like:

`petra__2026-04-26-morning__ich-bin-bereit__2026-04-26T13-20-00-000Z.wav`
