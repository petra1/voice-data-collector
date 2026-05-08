import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
import json
import pandas as pd
import os

device = "cuda:0" if torch.cuda.is_available() else "cpu"
print(device)
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

model_id = "openai/whisper-large-v3-turbo"

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id, dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
)
model.to(device)

processor = AutoProcessor.from_pretrained(model_id)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    dtype=torch_dtype,
    device=device,
)

# go over all samples in the mp3 folder and transcribe them with Whisper, save the result in a jsonl file with the file name and the transcription
files = os.listdir("mp3")
# Load the jsonl file
df = pd.read_json("transcriptions.jsonl", lines=True)

# Save the result in a jsonl file with the file name and the transcription
# Check that the file_name is not already in the jsonl file to prevent duplicates

for filename in files:
    if filename.endswith(".mp3"):
        sample = os.path.join("mp3/", filename)
        result = pipe(
            sample,
            generate_kwargs={
                "language": "german",
                "task": "transcribe",
            },  # force german and transcribe task
        )
        # Get the keys (columns)
    if "file_name" in df.columns:
        # Check if the file_name is already in the jsonl file
        if sample not in df["file_name"].values:
            entry = {"file_name": sample, "whisper_output": result["text"]}
        else:
            print(f"File {sample} is already in the jsonl file.")
    else:
        entry = {"file_name": sample, "whisper_output": result["text"]}
        with open("transcriptions.jsonl", "a") as f:
            f.write(json.dumps(entry) + "\n")
