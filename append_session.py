# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "datasets[audio]>=4",
# ]
# ///
"""Upload new recordings to the HF dataset as a pull request.

Reads wav/ (recordings + the content.txt transcript log), validates, appends
the new rows to the train split, and opens a PR on the dataset repo. A
teammate then reviews - listen to the clips in the training repo's explore
notebook via load_dataset(..., revision="refs/pr/<N>") - and merges in the
dataset's Community tab. Only after the merge does the data reach main.

Already-uploaded recordings are skipped automatically, so wav/ can keep
accumulating and this script can be re-run after every session.

Auth: a HF token with write access to the org, via the HF_TOKEN env var or
`hf auth login`.

Usage: uv run append_session.py
"""

import hashlib
import re
import sys
from pathlib import Path

from datasets import Audio, Dataset, concatenate_datasets, load_dataset

REPO_ID = "impaired-speech-asr/recordings"
WAV_DIR = Path(__file__).parent / "wav"


def fail(message: str) -> None:
    sys.exit(f"ERROR: {message}")


def timestamp_from_filename(name: str) -> str:
    """...__2026-05-16t17-40-01-194z.wav -> 2026-05-16T17:40:01.194Z"""
    m = re.search(r"(\d{4}-\d{2}-\d{2})t(\d{2})-(\d{2})-(\d{2})-(\d{3})z", name)
    if not m:
        fail(f"cannot parse timestamp from filename: {name}")
    d, h, mi, s, ms = m.groups()
    return f"{d}T{h}:{mi}:{s}.{ms}Z"


content_file = WAV_DIR / "content.txt"
if not content_file.exists():
    fail(f"{content_file} not found - record something first")

transcripts: dict[str, str] = {}
for line in content_file.read_text(encoding="utf-8").splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    name, _, text = line.partition("\t")
    if name and text.strip():
        transcripts[name] = text.strip()

wavs = {f.name: f for f in WAV_DIR.glob("*.wav")}
untranscribed = sorted(set(wavs) - set(transcripts))
if untranscribed:
    fail(
        f"{len(untranscribed)} recording(s) have no transcript in content.txt "
        f"(first: {untranscribed[0]}) - these are unusable for training"
    )

print("loading current dataset state (cached after the first run)...")
dd = load_dataset(REPO_ID)
already_uploaded = {name for split in dd.values() for name in split["filename"]}
existing_train_sentences = set(dd["train"]["text"])
held_out_sentences = set(dd["validation"]["text"]) | set(dd["test"]["text"])

new_names = sorted(set(wavs) - already_uploaded)
if not new_names:
    sys.exit("Nothing to upload - every recording is already in the dataset.")

# skip byte-identical duplicates (e.g. accidental double-saves); identical
# takes share their name prefix, so sorted order keeps the earliest timestamp
seen_hashes: dict[str, str] = {}
duplicates: list[tuple[str, str]] = []
for name in new_names:
    digest = hashlib.md5(wavs[name].read_bytes()).hexdigest()
    if digest in seen_hashes:
        duplicates.append((name, seen_hashes[digest]))
    else:
        seen_hashes[digest] = name
if duplicates:
    print(f"skipping {len(duplicates)} byte-identical duplicate recording(s):")
    for name, original in duplicates:
        print(f"  {name} (same audio as {original})")
    dropped = {name for name, _ in duplicates}
    new_names = [n for n in new_names if n not in dropped]

leaked = sorted({transcripts[n] for n in new_names} & held_out_sentences)
if leaked:
    fail(
        f"{len(leaked)} sentence(s) already exist in the validation/test splits - "
        f"adding recordings of them to train would corrupt evaluation. "
        f"First: {leaked[0]!r}"
    )

already_in_train = [name for name in new_names if transcripts[name] in existing_train_sentences]
if already_in_train:
    print(f"skipping {len(already_in_train)} recording(s) whose transcript already exists in train:")
    for name in already_in_train:
        print(f"  {name}: {transcripts[name]!r}")
    dropped = set(already_in_train)
    new_names = [n for n in new_names if n not in dropped]
    if not new_names:
        sys.exit("Nothing to upload - every new recording transcript already exists in train.")

rows = [
    {
        "audio": str(wavs[name]),
        "text": transcripts[name],
        "filename": name,
        "recorded_at": timestamp_from_filename(name),
    }
    for name in new_names
]
rows.sort(key=lambda r: r["recorded_at"])
new_rows = Dataset.from_list(rows).cast_column("audio", Audio())

train = concatenate_datasets([dd["train"], new_rows])
print(f"uploading {len(new_rows)} new recording(s) ({len(dd['train'])} -> {len(train)} train rows)...")

info = train.push_to_hub(
    REPO_ID,
    split="train",
    create_pr=True,
    commit_message=f"Add {len(new_rows)} recordings ({rows[0]['recorded_at'][:10]})",
)
print("\nOpened a pull request - review and merge it here:")
print(info.pr_url)
