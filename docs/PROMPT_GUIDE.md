# Prompt Guide

The app builds two kinds of prompts.

## Full page prompt

Use this when you want one image like a complete storyboard sheet.

Good for:
- Director presentation
- Fast visual reference
- Pitch deck
- Scene explanation

## Panel prompt

Use this when you want editable panels in HTML.

Good for:
- Replacing one bad panel
- Exporting panel images separately
- Building a bigger storyboard sequence

## Style lock

The app keeps this style fixed:

```txt
Clean professional black-and-white pencil-and-ink film storyboard.
Realistic cinematic sketching, not stick figures, not childish cartoon.
Detailed faces, consistent character design, natural acting.
Director storyboard packet look.
```

Change this inside `public/app.js` in `makeStyleBible()`.
