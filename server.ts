import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache to prevent spamming Google Scholar
  let scholarCache: { [key: string]: any } = {};
  let lastFetchTime = 0;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/scholar", async (req, res) => {
    const userId = req.query.user as string;
    if (!userId) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    const now = Date.now();
    // Cache for 1 hour
    if (scholarCache[userId] && (now - lastFetchTime < 3600000)) {
        return res.json(scholarCache[userId]);
    }

    try {
      const response = await axios.get(`https://scholar.google.com/citations?user=${userId}&hl=en`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const papers: { title: string, citations: string }[] = [];
      
      $('.gsc_a_tr').each((i, el) => {
        const title = $(el).find('.gsc_a_at').text().trim();
        const citations = $(el).find('.gsc_a_ac').text().trim() || "0";
        papers.push({ title, citations });
      });

      const totalCitations = $('#gsc_rsb_st td.gsc_rsb_std').first().text().trim();

      const result = { papers, totalCitations };
      scholarCache[userId] = result;
      lastFetchTime = now;
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching Google Scholar data:", error);
      res.status(500).json({ error: "Failed to fetch Google Scholar data" });
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
    const distPath = path.join(process.cwd(), 'dist');
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
