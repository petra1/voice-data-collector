const speakerIdInput = document.getElementById("speakerId");
const sessionIdInput = document.getElementById("sessionId");
const promptTextInput = document.getElementById("promptText");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const saveBtn = document.getElementById("saveBtn");
const discardBtn = document.getElementById("discardBtn");
const uploadBtn = document.getElementById("uploadBtn");
const textFileInput = document.getElementById("textFileInput");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const savedListEl = document.getElementById("savedList");

let audioContext;
let mediaStream;
let sourceNode;
let processorNode;
let recordedChunks = [];
let recordingSampleRate = 44100;
let currentWavBlob = null;
let savedCounter = 0;
let uploadedSentences = [];
let currentSentenceIndex = -1;

function setStatus(message) {
  statusEl.textContent = message;
}

function hasActiveSentence() {
  return (
    currentSentenceIndex >= 0 &&
    currentSentenceIndex < uploadedSentences.length &&
    uploadedSentences.length > 0
  );
}

function setButtons({ isRecording, hasRecording }) {
  startBtn.disabled = isRecording || !hasActiveSentence();
  stopBtn.disabled = !isRecording;
  saveBtn.disabled = !hasRecording;
  discardBtn.disabled = !hasRecording;
}

function sanitize(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFileName() {
  const speaker = sanitize(speakerIdInput.value || "speaker");
  const session = sanitize(sessionIdInput.value || "session");
  const prompt = sanitize(promptTextInput.value || "utterance");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${speaker}__${session}__${prompt}__${stamp}.wav`;
}

function setCurrentSentence() {
  if (hasActiveSentence()) {
    promptTextInput.value = uploadedSentences[currentSentenceIndex];
    return;
  }

  if (uploadedSentences.length > 0 && currentSentenceIndex >= uploadedSentences.length) {
    promptTextInput.value = "All sentences have been recorded.";
    setStatus("All sentences have been recorded.");
    return;
  }

  promptTextInput.value = "";
}

function splitSentences(rawText) {
  return rawText
    .split(/\r\n|\n|\r/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function decodeUploadedText(arrayBuffer) {
  const decoders = [
    { encoding: "utf-8", fatal: true },
    { encoding: "utf-16le", fatal: true },
    { encoding: "utf-16be", fatal: true },
    { encoding: "windows-1252", fatal: false },
    { encoding: "iso-8859-1", fatal: false },
    { encoding: "macintosh", fatal: false },
  ];

  for (const decoderOptions of decoders) {
    try {
      const decoder = new TextDecoder(decoderOptions.encoding, {
        fatal: decoderOptions.fatal,
      });
      const text = decoder.decode(arrayBuffer);
      if (text && text.replace(/\uFFFD/g, "").trim().length > 0) {
        return text;
      }
    } catch (error) {
      // Try the next decoder.
    }
  }

  return new TextDecoder("utf-8").decode(arrayBuffer);
}

async function saveTextFileLocally(file) {
  const bytes = await file.arrayBuffer();
  const response = await fetch("/api/save-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Filename": file.name || "sentences.txt",
    },
    body: bytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to save text file on local server.");
  }
}

async function handleFileSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    await saveTextFileLocally(file);
    const rawBytes = await file.arrayBuffer();
    const decodedText = decodeUploadedText(rawBytes);
    const sentences = splitSentences(decodedText);

    if (sentences.length === 0) {
      setStatus("No valid sentences found in uploaded file.");
      uploadedSentences = [];
      currentSentenceIndex = -1;
      setCurrentSentence();
      setButtons({ isRecording: false, hasRecording: false });
      return;
    }

    uploadedSentences = sentences;
    currentSentenceIndex = 0;
    currentWavBlob = null;
    recordedChunks = [];
    previewEl.removeAttribute("src");
    previewEl.load();
    setCurrentSentence();
    setStatus(`Loaded ${sentences.length} sentence(s).`);
    setButtons({ isRecording: false, hasRecording: false });
  } catch (error) {
    setStatus(`Text file upload failed: ${error.message}`);
  } finally {
    textFileInput.value = "";
  }
}

function mergeFloat32(chunks) {
  const length = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: "audio/wav" });
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    recordingSampleRate = audioContext.sampleRate;

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    recordedChunks = [];
    currentWavBlob = null;
    previewEl.removeAttribute("src");
    previewEl.load();

    processorNode.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      recordedChunks.push(new Float32Array(channelData));
    };

    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    setButtons({ isRecording: true, hasRecording: false });
    setStatus("Recording... speak now.");
  } catch (error) {
    setStatus(`Microphone access failed: ${error.message}`);
  }
}

async function stopRecording() {
  if (!audioContext) {
    return;
  }

  processorNode.disconnect();
  sourceNode.disconnect();
  mediaStream.getTracks().forEach((track) => track.stop());
  await audioContext.close();

  const merged = mergeFloat32(recordedChunks);
  currentWavBlob = encodeWav(merged, recordingSampleRate);
  previewEl.src = URL.createObjectURL(currentWavBlob);
  previewEl.load();

  setButtons({ isRecording: false, hasRecording: true });
  setStatus("Recording stopped. Preview and save as WAV.");
}

async function saveRecording() {
  if (!currentWavBlob) {
    return;
  }

  const fileName = buildFileName();
  const bytes = await currentWavBlob.arrayBuffer();

  try {
    const response = await fetch("/api/save-wav", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Filename": fileName,
      },
      body: bytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to save on local server.");
    }
  } catch (error) {
    setStatus(`Save failed: ${error.message}`);
    return;
  }

  savedCounter += 1;
  const li = document.createElement("li");
  li.textContent = `${savedCounter}. wav/${fileName}`;
  savedListEl.appendChild(li);
  setStatus(`Saved locally to wav/${fileName}`);

  currentWavBlob = null;
  recordedChunks = [];
  previewEl.removeAttribute("src");
  previewEl.load();
  currentSentenceIndex += 1;
  setCurrentSentence();
  setButtons({ isRecording: false, hasRecording: false });
}

function discardRecording() {
  currentWavBlob = null;
  recordedChunks = [];
  previewEl.removeAttribute("src");
  previewEl.load();
  setButtons({ isRecording: false, hasRecording: false });
  setStatus("Discarded current recording.");
}

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
saveBtn.addEventListener("click", saveRecording);
discardBtn.addEventListener("click", discardRecording);
uploadBtn.addEventListener("click", () => textFileInput.click());
textFileInput.addEventListener("change", handleFileSelection);

setButtons({ isRecording: false, hasRecording: false });
setCurrentSentence();
