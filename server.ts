import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy Route for Login
  app.get("/api/login", async (req, res) => {
    const { name, password } = req.query;

    if (!name || !password) {
      return res.status(400).send("Missing name or password parameter");
    }

    const API_URL = 'https://hdrlite.com/records/get.php';
    const remoteUrl = `${API_URL}?name=${encodeURIComponent(name as string)}&password=${encodeURIComponent(password as string)}`;

    try {
      const response = await fetch(remoteUrl);
      const text = await response.text();
      
      // Pass the raw text back to the frontend for handling
      res.send(text);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to connect to the authentication server");
    }
  });

  app.get("/api/update-tokens", async (req, res) => {
    const { name, tokens } = req.query;

    if (!name || tokens === undefined) {
      return res.status(400).send("Missing name or tokens parameter");
    }

    const UPDATE_URL = 'https://hdrlite.com/records/update_tokens.php';
    const remoteUrl = `${UPDATE_URL}?name=${encodeURIComponent(name as string)}&tokens=${encodeURIComponent(tokens as string)}`;

    try {
      const response = await fetch(remoteUrl);
      const text = await response.text();
      res.send(text);
    } catch (error) {
      console.error("Update tokens proxy error:", error);
      res.status(500).send("Failed to connect to the update server");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
