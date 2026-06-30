import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use(express.static("public"));

const openaiApiKey = process.env.OPENAI_API_KEY;
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function requireOpenAIKey(req, res, next) {
  if (!openai) {
    return res.status(500).json({
      error:
        "Missing OPENAI_API_KEY. Copy .env.example to .env, add your key, then restart the server."
    });
  }

  next();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(openai),
    imageModel
  });
});

app.post("/api/generate-image", requireOpenAIKey, async (req, res) => {
  try {
    const {
      prompt,
      size = "1536x1024",
      quality = "medium",
      output_format = "png"
    } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      size,
      quality,
      output_format
    });

    const b64 = response?.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(502).json({
        error: "The image model did not return base64 image data."
      });
    }

    res.json({
      image: `data:image/${output_format};base64,${b64}`,
      usage: response.usage || null
    });
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({
      error: error?.message || "Image generation failed"
    });
  }
});

app.listen(port, () => {
  console.log(`Storyboard AI Generator running at http://localhost:${port}`);
  console.log(`Image model: ${imageModel}`);
});
