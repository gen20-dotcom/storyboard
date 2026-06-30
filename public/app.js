const sampleScene = `EXT. AIRPORT – DAY
A plane taxies on the runway.

INT. AIRPLANE – DAY
An AIR HOSTESS closes the overhead bins. FARHAN (30s), a passenger, is reading a book when his phone rings. He scrambles for it, embarrassed he hadn’t turned it off. Other passengers look at him disapprovingly. He sheepishly takes the call.

FARHAN
Hello... Yes?

A beat.

FARHAN
(incredulous)
What?

AIR HOSTESS
Sir, kindly switch off your mobile phone.

FARHAN
Just one sec, please, one sec, please.

The airplane revs its engines. Farhan hangs up, looking disturbed. He tries to catch the attention of the Air Hostess.

FARHAN
Excuse me.

The plane races down the runway. Farhan appears to be in acute physical discomfort as the plane takes off.

FARHAN
Hello... Yes?

FARHAN
What?

FARHAN
(to the Air Hostess)
Excuse me.

He unbuckles his seat belt and stands up. The Air Hostess is alarmed.

AIR HOSTESS
Sir, please sit down.

Farhan tries to steady himself but keels over and falls in the aisle, unconscious.

AIR HOSTESS
(into the phone)
Captain, there’s a medical emergency. A passenger has just fallen down in the aisle.`;

const els = {
  script: document.getElementById("script"),
  project: document.getElementById("project"),
  panelCount: document.getElementById("panelCount"),
  mode: document.getElementById("mode"),
  quality: document.getElementById("quality"),
  size: document.getElementById("size"),
  picker: document.getElementById("scenePicker"),
  output: document.getElementById("output"),
  prompts: document.getElementById("prompts"),
  status: document.getElementById("status"),
  sceneChip: document.getElementById("sceneChip"),
  beatChip: document.getElementById("beatChip"),
  panelChip: document.getElementById("panelChip")
};

let detectedScenes = [];

els.script.value = sampleScene;

document.getElementById("detectBtn").addEventListener("click", detectScenes);
document.getElementById("generateBtn").addEventListener("click", () => build(getActiveText()));
document.getElementById("selectedBtn").addEventListener("click", generateSelectedText);
document.getElementById("copyBtn").addEventListener("click", copyPrompts);
els.picker.addEventListener("change", () => build(getActiveText(), true));

detectScenes();
build(getActiveText(), true);

function setStatus(message) {
  els.status.textContent = message;
}

function isSceneHeading(line) {
  return /^(?:SCENE\s+[A-Z0-9]+[\s:-]*)?(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.)/i.test(line.trim());
}

function cleanSceneHeading(line) {
  return line
    .replace(/^SCENE\s+[A-Z0-9]+\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectScenes() {
  const lines = els.script.value.replace(/\r/g, "").split("\n");
  detectedScenes = [];
  let current = null;

  for (const line of lines) {
    if (isSceneHeading(line)) {
      if (current) detectedScenes.push(current);
      current = { heading: cleanSceneHeading(line), body: [line] };
    } else if (current) {
      current.body.push(line);
    }
  }

  if (current) detectedScenes.push(current);

  els.picker.innerHTML = `<option value="all">Whole text</option>`;

  detectedScenes.forEach((scene, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = scene.heading.slice(0, 82);
    els.picker.appendChild(option);
  });

  setStatus(`Detected ${detectedScenes.length} scene heading(s).`);
}

function getActiveText() {
  const value = els.picker.value;

  if (value !== "all" && detectedScenes[Number(value)]) {
    return detectedScenes[Number(value)].body.join("\n").trim();
  }

  return els.script.value.trim();
}

function generateSelectedText() {
  const selected = els.script.value
    .slice(els.script.selectionStart, els.script.selectionEnd)
    .trim();

  if (!selected) {
    setStatus("Select text inside the screenplay box first.");
    return;
  }

  build(selected);
}

async function build(text, previewOnly = false) {
  if (!text) {
    els.output.innerHTML = `<div class="empty">Paste a scene first.</div>`;
    return;
  }

  const parsed = parseScene(text);
  const panels = choosePanels(parsed, Number(els.panelCount.value));
  const project = els.project.value.trim() || "Untitled";
  const pagePrompt = makeFullPagePrompt(project, parsed, panels);
  const panelPrompts = panels.map(panel => makePanelPrompt(project, parsed, panel));

  els.sceneChip.textContent = `Scene: ${parsed.sceneTitle}`;
  els.beatChip.textContent = `Beats: ${parsed.beats.length}`;
  els.panelChip.textContent = `Panels: ${panels.length}`;

  renderPrompts(pagePrompt, panelPrompts);

  if (previewOnly) {
    renderPreviewSheet(project, parsed, panels);
    return;
  }

  if (els.mode.value === "page") {
    await generateFullPage(pagePrompt);
  } else {
    await generatePanelSheet(project, parsed, panels, panelPrompts);
  }
}

function parseScene(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const beats = [];
  const headings = [];
  let pendingSpeaker = "";

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) continue;

    if (isSceneHeading(line)) {
      const heading = cleanSceneHeading(line);
      headings.push(heading);
      beats.push({ type: "heading", speaker: "", text: heading });
      pendingSpeaker = "";
      continue;
    }

    const inlineDialogue = line.match(/^([A-Z][A-Z0-9 .'\-]{1,35})(?:\s*\([^)]*\))?:\s*(.+)$/);

    if (inlineDialogue) {
      beats.push({
        type: "dialogue",
        speaker: inlineDialogue[1].trim(),
        text: inlineDialogue[2].trim()
      });
      pendingSpeaker = "";
      continue;
    }

    const speakerLine = line.match(/^([A-Z][A-Z0-9 .'\-]{1,35})(?:\s*\([^)]*\))?$/);

    if (speakerLine && !line.includes(".") && line.length <= 40) {
      pendingSpeaker = speakerLine[1].trim();
      continue;
    }

    if (pendingSpeaker && !line.startsWith("(")) {
      beats.push({
        type: "dialogue",
        speaker: pendingSpeaker,
        text: line
      });
      pendingSpeaker = "";
      continue;
    }

    splitAction(line).forEach(sentence => {
      beats.push({ type: "action", speaker: "", text: sentence });
    });
  }

  return {
    text,
    headings,
    sceneTitle: sceneNameFromHeading(headings[0] || "Scene"),
    characters: findCharacters(text, beats),
    beats
  };
}

function splitAction(line) {
  const protectedLine = line.replace(/INT\./gi, "INT§").replace(/EXT\./gi, "EXT§");

  return (protectedLine.match(/[^.!?]+[.!?]?/g) || [protectedLine])
    .map(x => x.replace(/INT§/g, "INT.").replace(/EXT§/g, "EXT.").trim())
    .filter(Boolean);
}

function sceneNameFromHeading(heading) {
  return heading
    .replace(/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.)\s*/i, "")
    .replace(/\s*[-–]\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS).*$/i, "")
    .trim() || "Scene";
}

function findCharacters(text, beats) {
  const names = new Set();

  beats.forEach(beat => {
    if (beat.speaker) names.add(beat.speaker);
  });

  const allCaps = text.match(/\b[A-Z][A-Z]{2,}(?:\s+[A-Z][A-Z]{2,})?\b/g) || [];

  allCaps.forEach(name => {
    const cleaned = name.trim();

    if (!["INT", "EXT", "DAY", "NIGHT", "SCENE", "WITH"].includes(cleaned)) {
      names.add(cleaned);
    }
  });

  return [...names].slice(0, 8);
}

function choosePanels(parsed, count) {
  const scored = parsed.beats.map((beat, index) => ({
    ...beat,
    index,
    shot: chooseShot(beat, parsed),
    score: scoreBeat(beat, index, parsed.beats.length)
  }));

  const selected = [];
  const firstHeading = scored.find(beat => beat.type === "heading");

  if (firstHeading) selected.push(firstHeading);

  scored
    .filter(beat => !selected.includes(beat))
    .sort((a, b) => b.score - a.score)
    .slice(0, count - selected.length)
    .forEach(beat => selected.push(beat));

  return selected
    .sort((a, b) => a.index - b.index)
    .slice(0, count)
    .map((panel, index) => ({
      ...panel,
      number: index + 1,
      caption: cleanCaption(panel)
    }));
}

function chooseShot(beat, parsed) {
  const text = `${beat.text} ${beat.speaker} ${parsed.sceneTitle}`.toLowerCase();

  if (beat.type === "heading") {
    if (/airport|runway/.test(text)) return "Wide establishing shot";
    if (/airplane|plane|cabin/.test(text)) return "Interior cabin establishing shot";
    if (/house|home|room/.test(text)) return "Interior establishing shot";
    return "Establishing shot";
  }

  if (/phone|rings|call|scrambles|fumbles/.test(text)) return "Close on character and phone";
  if (/passengers|look|disapproving|reaction/.test(text)) return "Medium reaction shot";
  if (/air hostess|switch off|kindly|one sec/.test(text)) return "Two-shot";
  if (/revs|runway|races|takeoff|takes off|lifts off/.test(text)) return "Dynamic cabin shot";
  if (/discomfort|disturbed|acute|pain|unbuckles/.test(text)) return "Tense medium shot";
  if (/stands|sit down|steady/.test(text)) return "Action shot";
  if (/falls|unconscious|medical emergency|captain|aisle/.test(text)) return "Dramatic final panel";
  if (/camera|canon|picture|photo|click/.test(text)) return "Camera insert / photo moment";
  if (/computer|mouse|screen|keyboard/.test(text)) return "Computer over-the-shoulder shot";
  if (/dad|father|speaks|showing/.test(text)) return "Father-child two-shot";

  if (beat.type === "dialogue") return "Dialogue close-up";

  return "Medium shot";
}

function scoreBeat(beat, index, total) {
  const text = `${beat.text} ${beat.speaker}`.toLowerCase();
  let score = 1;

  if (beat.type === "heading") score += 5;
  if (beat.type === "dialogue") score += 3;

  if (/phone|rings|call|what|incredulous/.test(text)) score += 5;
  if (/air hostess|sir|switch off|sit down/.test(text)) score += 4;
  if (/passengers|disapproving|reaction/.test(text)) score += 4;
  if (/revs|races|takeoff|runway/.test(text)) score += 5;
  if (/discomfort|pain|disturbed|acute/.test(text)) score += 6;
  if (/unbuckles|stands|steady/.test(text)) score += 5;
  if (/falls|unconscious|medical emergency|captain/.test(text)) score += 8;
  if (/camera|canon|picture|click/.test(text)) score += 6;
  if (/computer|mouse|screen|bill gates/.test(text)) score += 5;
  if (/dad|father/.test(text)) score += 4;

  if (index === 0) score += 2;
  if (index === total - 1) score += 2;

  return score;
}

function cleanCaption(panel) {
  const speaker = panel.speaker ? `${panel.speaker}: ` : "";
  return `${speaker}${panel.text}`.replace(/\s+/g, " ").trim().slice(0, 175);
}

function makeStyleBible(parsed) {
  const characters = parsed.characters.length
    ? parsed.characters.join(", ")
    : "main characters from the screenplay";

  return [
    "Clean professional black-and-white pencil-and-ink film storyboard.",
    "Realistic cinematic sketching, not stick figures, not childish cartoon.",
    "Detailed faces, consistent character design, natural acting, expressive body language.",
    "Director storyboard packet look, clean panels, confident linework, light pencil shading.",
    "Use cinematic camera language: foreground, background, perspective, depth, and motion arrows only when useful.",
    `Recurring characters must remain visually consistent across panels: ${characters}.`,
    "Avoid color. Avoid messy text. Avoid unrelated objects."
  ].join(" ");
}

function makeFullPagePrompt(project, parsed, panels) {
  const rows = panels.length <= 6 ? "2 rows" : panels.length <= 9 ? "3 rows" : "4 rows";
  const header = `PROJECT: ${project.toUpperCase()} | SCENE: ${parsed.sceneTitle.toUpperCase()} | PAGE: 1 OF 1`;

  const panelPlan = panels
    .map(panel => `Panel ${panel.number}: ${panel.shot}. ${panel.caption}`)
    .join("\n");

  return `${makeStyleBible(parsed)}

Create ONE complete storyboard sheet image like a professional pre-production storyboard page.

Layout:
- 3 columns grid.
- ${rows}.
- White paper background.
- Black borders around every panel.
- Panel number box on top-left of each panel.
- Short caption under each panel.
- Header at the top: ${header}.

Scene source:
${parsed.text}

Storyboard panel plan:
${panelPlan}

The result should look like a polished storyboard page similar to a film director packet: detailed pencil drawings, cinematic framing, readable action, clear emotional expressions.`;
}

function makePanelPrompt(project, parsed, panel) {
  return `${makeStyleBible(parsed)}

Generate only the artwork inside storyboard Panel ${panel.number}.
Do not add page title. Do not add big captions. Small motion arrows are okay.
Project: ${project}
Scene: ${parsed.sceneTitle}
Shot: ${panel.shot}
Action: ${panel.caption}

Full scene context:
${parsed.text}`;
}

function renderPrompts(pagePrompt, panelPrompts) {
  els.prompts.innerHTML = `
    <div class="prompt" data-prompt="${escapeHtml(pagePrompt)}"><b>Full page prompt</b>\n${escapeHtml(pagePrompt)}</div>
    ${panelPrompts
      .map((prompt, index) => `<div class="prompt" data-prompt="${escapeHtml(prompt)}"><b>Panel ${index + 1}</b>\n${escapeHtml(prompt)}</div>`)
      .join("")}
  `;
}

function renderPreviewSheet(project, parsed, panels) {
  els.output.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <div>Project: <span>${escapeHtml(project)}</span></div>
        <div>Scene: <span>${escapeHtml(parsed.sceneTitle)}</span></div>
        <div>Page: <span>1 of 1</span></div>
      </div>
      <div class="grid">
        ${panels
          .map(panel => `
            <article class="card">
              <div class="frame">
                <div class="num">${panel.number}</div>
                <div class="loading-frame">${escapeHtml(panel.shot)}</div>
              </div>
              <div class="caption">
                <strong>${escapeHtml(panel.shot)}</strong>
                <p>${escapeHtml(panel.caption)}</p>
              </div>
            </article>
          `)
          .join("")}
      </div>
    </div>
  `;
}

async function generateFullPage(prompt) {
  setStatus("Generating full AI storyboard page...");

  els.output.innerHTML = `<div class="empty">Generating full storyboard page...</div>`;

  try {
    const image = await generateImage(prompt, els.size.value, els.quality.value);

    els.output.innerHTML = `
      <div class="ai-page">
        <img src="${image}" alt="Generated storyboard page" />
      </div>
    `;

    setStatus("Done. Full storyboard page generated.");
  } catch (error) {
    els.output.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    setStatus(error.message);
  }
}

async function generatePanelSheet(project, parsed, panels, panelPrompts) {
  setStatus("Generating panel-by-panel sheet...");
  renderPreviewSheet(project, parsed, panels);

  const frames = [...document.querySelectorAll(".frame")];

  for (let index = 0; index < panels.length; index++) {
    setStatus(`Generating panel ${index + 1} of ${panels.length}...`);

    try {
      const image = await generateImage(panelPrompts[index], els.size.value, els.quality.value);

      frames[index].innerHTML = `
        <div class="num">${index + 1}</div>
        <img src="${image}" alt="Panel ${index + 1}" />
      `;
    } catch (error) {
      frames[index].innerHTML = `
        <div class="num">${index + 1}</div>
        <div class="loading-frame">${escapeHtml(error.message)}</div>
      `;
    }
  }

  setStatus("Done. Panel sheet generated.");
}

async function generateImage(prompt, size, quality) {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt,
      size,
      quality,
      output_format: "png"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Image generation failed");
  }

  return data.image;
}

async function copyPrompts() {
  const text = [...document.querySelectorAll("[data-prompt]")]
    .map(el => el.dataset.prompt)
    .join("\n\n---\n\n");

  if (!text.trim()) return;

  await navigator.clipboard.writeText(text);
  setStatus("Prompts copied.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
