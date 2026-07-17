# Voice Data Collector (Petra)

Simple local web app to record voice samples and save `.wav` files into a local
`wav/` project folder for later Whisper fine-tuning.

## Features

- Accessible, keyboard-friendly form and controls
- Upload a `.txt` file and step through sentences in a read-only **Sentence** field (one line per utterance)
- WAV filenames combine **Speaker ID**, **Session ID**, and a short slug from the current sentence plus a timestamp
- Records microphone audio and encodes real WAV (PCM 16-bit, mono)
- Preview, save, or discard each recording before moving to the next sentence
- On every **Save Wav**, the app updates `wav/content.txt` (UTF-8) with the matching `wav filename -> sentence` pair
- If `wav/content.txt` does not exist yet, it is created automatically with a short header comment explaining its purpose
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

## Upload a session to the dataset

New recordings become training data via a pull request on the
[HF dataset](https://huggingface.co/datasets/impaired-speech-asr/recordings):
nothing you upload can break anything — a teammate reviews and merges it first.

1. Install [uv](https://docs.astral.sh/uv/).
2. Get a Hugging Face account and membership in the
   [`impaired-speech-asr` org](https://huggingface.co/impaired-speech-asr)
3. Create an access token: on huggingface.co go to **Settings → Access
   Tokens → Create new token**, pick **Fine-grained**, and under
   **Repositories permissions** select the repo
   `impaired-speech-asr/recordings` and check at least these two:
   - **"Write access to contents/settings of selected repos"**
   - **"Interact with discussions / Open pull requests on selected repos"**

   Copy the token (starts with `hf_...`) — it is only shown once.
4. Make the token available in your terminal:

   ```bash
   export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx   # macOS/Linux
   ```

   The variable lasts for that terminal window.
5. Run the upload from this project directory:

   ```bash
   uv run append_session.py
   ```

   The script checks everything first (every file has a transcript in
   `wav/content.txt`, no duplicates, no sentence collides with the frozen
   validation/test splits), skips anything already uploaded, and prints the
   pull request URL when done.
6. Post the PR link in the team chat. Whoever reviews listens to the new
   clips (training repo's explore notebook, `revision="refs/pr/<N>"`) and
   merges in the dataset's **Community** tab — only then does the data land
   in `main` and become training data.

## Troubleshooting

- **`Cannot connect to localhost:8080`**: ensure `node server.js` is running in this
  project directory.
- **Microphone does not start**: allow microphone access in your browser and retry.
- **Save fails**: verify the `wav/` folder exists and that the Node process has write
  permission in the project.
