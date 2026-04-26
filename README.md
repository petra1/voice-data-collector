# Voice Data Collector (Petra)

Simple local web app to record voice samples and save `.wav` files into a local
`wav/` project folder for later Whisper fine-tuning.

## Features

- Accessible, keyboard-friendly form and controls
- Metadata fields (`speaker`, `session`, `prompt`) included in filename
- Records microphone audio and encodes it to real WAV (PCM 16-bit, mono)
- Saves files locally to `wav/` through a local Node server
- `wav` audio files are ignored by git

## Run locally

Run the local server:

```bash
node server.js
```

Then open:

<http://localhost:8080>

## Suggested data collection workflow

1. Fill `Speaker ID` with `petra`.
2. Set a session id such as `2026-04-26-morning`.
3. Paste one sentence in `Prompt / Sentence`.
4. Record, stop, listen, then save.
5. Repeat with many short utterances.

This creates files in `wav/`, for example:

`wav/petra__2026-04-26-morning__ich-bin-bereit__2026-04-26T13-20-00-000Z.wav`
