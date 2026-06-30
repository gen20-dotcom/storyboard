# Storyboard AI Generator

Paste a screenplay scene, select the scene, and generate a cinematic black-and-white storyboard page.

This version is GitHub-ready.

## Features

- Scene heading detection:
  - `EXT. AIRPORT - DAY`
  - `INT. HOUSE - DAY`
  - `SCENE 2A INT. HOUSE - DAY`
- Scene selector dropdown
- Full-page storyboard generation like a director storyboard sheet
- Panel-by-panel mode
- Prompt preview and copy button
- Print / Save as PDF button
- API key stays on the Node backend

## Folder structure

```txt
storyboard-ai-generator/
  public/
    index.html
    styles.css
    app.js
  server.js
  package.json
  .env.example
  .gitignore
  README.md
  LICENSE
```

## Local setup

```bash
npm install
cp .env.example .env
```

Open `.env` and add your key:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_IMAGE_MODEL=gpt-image-2
PORT=3000
```

Run:

```bash
npm start
```

Open:

```bash
http://localhost:3000
```

## GitHub upload commands

Create a new empty repo on GitHub, then run:

```bash
git init
git add .
git commit -m "Initial storyboard generator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/storyboard-ai-generator.git
git push -u origin main
```

## Usage

1. Paste your screenplay scene.
2. Click `Detect scenes`.
3. Select the scene from the dropdown.
4. Choose `Full page like reference`.
5. Click `Generate storyboard`.

For your reference-style output, use:

```txt
Mode: Full page like reference
Panels: 9
Size: Landscape
Quality: Medium or High
```

## Security

Never commit `.env`.

Your OpenAI API key should stay only in `.env`. The browser calls your Node backend, and the backend calls the image API.

## Notes

- Full-page mode uses one image generation request.
- Panel-by-panel mode uses one request per panel.
- High quality can cost more and take longer.
