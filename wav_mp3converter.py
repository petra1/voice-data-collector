# Source - https://stackoverflow.com/a/12391576
# Posted by Jiaaro
# Retrieved 2026-05-01, License - CC BY-SA 3.0

from pydub import AudioSegment
import os

# Convert all wav files in the "wav" folder to mp3 and save them in the "mp3" folder
# Only mp3 files are accepted by Whisper
for name in os.listdir("wav"):
    if name.endswith(".wav"):  # prevent to convert non-wav files eg. .gitignore
        # Check that mp3 file doesn't already exist to prevent unnecessary conversion
        if not os.path.exists("mp3/" + name.replace(".wav", ".mp3")):
            AudioSegment.from_wav("wav/" + name).export(
                "mp3/" + name.replace(".wav", ".mp3"),
                format="mp3",
            )
