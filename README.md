# Voice Data Collector (Petra)

Simple local web app to record voice samples and save `.wav` files into a local
`wav/` project folder for later Whisper fine-tuning.

## Features

- Accessible, keyboard-friendly form and controls
- Upload a `.txt` file and step through sentences in a read-only **Sentence** field (one line per utterance)
- WAV filenames combine **Speaker ID**, **Session ID**, and a short slug from the current sentence plus a timestamp
- Records microphone audio and encodes real WAV (PCM 16-bit, mono)
- Preview, save, or discard each recording before moving to the next sentence
- **WAV save is minimal on the wire:** the browser sends only the audio bytes and the filename to the local Node server—full sentence text is not sent as metadata and no server-side transcript log is written under `wav/`
- The same server can store a copy of the uploaded sentences file under local `text/`
- `wav/` and `text/` each ship a `.gitignore` so recordings and copied lists stay out of Git by default

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
