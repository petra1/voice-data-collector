# Voice Data Collector (Petra)

Simple local web app to record voice samples and save `.wav` files into a local
`wav/` project folder for later Whisper fine-tuning.

## Features

- Accessible, keyboard-friendly form and controls
- Metadata fields (`speaker`, `session`, `prompt`) included in filename
- Records microphone audio and encodes it to real WAV (PCM 16-bit, mono)
- Saves files locally to `wav/` through a local Node server
- `wav` audio files are ignored by git

## Requirements

If Node.js is not installed yet, install the current LTS version from
[nodejs.org](https://nodejs.org/). After installation, verify it works with:

```bash
node -v
```

For Windows 11, download the **Windows Installer (.msi)** from
[nodejs.org](https://nodejs.org/), run the installer with default options, then
open **PowerShell** and check:

```bash
node -v
npm -v
```

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

## Troubleshooting

- **`Cannot connect to localhost:8080`**: ensure `node server.js` is running in this
  project directory.
- **Microphone does not start**: allow microphone access in your browser and retry.
- **Save fails**: verify the `wav/` folder exists and that the Node process has write
  permission in the project.
