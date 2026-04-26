const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8080);
const rootDir = __dirname;
const wavDir = path.join(rootDir, "wav");

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

function safeName(rawName) {
  const name = String(rawName || "recording.wav")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!name.endsWith(".wav")) {
    return `${name || "recording"}.wav`;
  }

  return name || "recording.wav";
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
  const filename = safeName(req.headers["x-filename"]);
  const outputPath = path.join(wavDir, filename);
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

      res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, path: `wav/${filename}` }));
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

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, host, () => {
  console.log(`Voice collector running on http://${host}:${port}`);
  console.log(`Local WAV storage: ${wavDir}`);
});
