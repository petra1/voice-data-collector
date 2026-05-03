const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8080);
const rootDir = __dirname;
const wavDir = path.join(rootDir, "wav");
const textDir = path.join(rootDir, "text");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

if (!fs.existsSync(wavDir)) {
  fs.mkdirSync(wavDir, { recursive: true });
}
if (!fs.existsSync(textDir)) {
  fs.mkdirSync(textDir, { recursive: true });
}

function safeName(rawName, fallback, ext) {
  const base = String(rawName || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base.endsWith(ext)) {
    return `${base || fallback}${ext}`;
  }

  return base || `${fallback}${ext}`;
}

const CONTENT_TXT_COMMENT =
  `# This file pairs each recorded WAV filename with the sentence shown in the app when\n` +
  `# "Save Wav" ran. Encoding: UTF-8. Imported sentence lists do not erase this log.\n` +
  `# Columns: WAV filename TAB utterance text (single line).\n#\n`;

function sentencePlainFromB64(headers) {
  const raw = headers["x-sentence-b64"];
  if (!raw || typeof raw !== "string") {
    return "";
  }

  try {
    return Buffer.from(raw.trim(), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function oneLineSentence(text) {
  return String(text || "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\t/g, " ")
    .trimEnd();
}

/**
 * Writes UTF-8 wav/content.txt: header only on create; append one line per save.
 */
function appendWavContentLog(wavFileName, sentencePlain, callback) {
  const contentPath = path.join(wavDir, "content.txt");
  const utteranceLine = `${wavFileName}\t${oneLineSentence(sentencePlain)}\n`;

  fs.access(contentPath, fs.constants.F_OK, (missingErr) => {
    if (missingErr) {
      fs.writeFile(contentPath, CONTENT_TXT_COMMENT + utteranceLine, "utf8", callback);
      return;
    }

    fs.appendFile(contentPath, utteranceLine, "utf8", callback);
  });
}

function serveStatic(req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url;
  const cleanPath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, cleanPath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });
    res.end(data);
  });
}

function handleSaveWav(req, res) {
  const filename = safeName(req.headers["x-filename"], "recording", ".wav");
  const outputPath = path.join(wavDir, filename);
  const sentencePlain = sentencePlainFromB64(req.headers);
  const chunks = [];
  let size = 0;

  req.on("data", (chunk) => {
    chunks.push(chunk);
    size += chunk.length;
    if (size > 25 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", () => {
    const data = Buffer.concat(chunks);

    fs.writeFile(outputPath, data, (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Could not save WAV file");
        return;
      }

      appendWavContentLog(filename, sentencePlain, (logErr) => {
        if (logErr) {
          fs.unlink(outputPath, () => {});
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Could not update wav/content.txt");
          return;
        }

        res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, path: `wav/${filename}` }));
      });
    });
  });

  req.on("error", () => {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Invalid upload");
  });
}

function handleSaveText(req, res) {
  const filename = safeName(req.headers["x-filename"], "sentences", ".txt");
  const outputPath = path.join(textDir, filename);
  const chunks = [];
  let size = 0;

  req.on("data", (chunk) => {
    chunks.push(chunk);
    size += chunk.length;
    if (size > 5 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", () => {
    const data = Buffer.concat(chunks);
    fs.writeFile(outputPath, data, (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Could not save text file");
        return;
      }

      res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, path: `text/${filename}` }));
    });
  });

  req.on("error", () => {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Invalid upload");
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save-wav") {
    handleSaveWav(req, res);
    return;
  }
  if (req.method === "POST" && req.url === "/api/save-text") {
    handleSaveText(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, host, () => {
  console.log(`Voice collector running on http://${host}:${port}`);
  console.log(`Local WAV storage: ${wavDir} (+log: wav/content.txt)`);
  console.log(`Local text storage: ${textDir}`);
});
