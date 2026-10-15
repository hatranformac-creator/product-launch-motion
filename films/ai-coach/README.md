# AI Coach — 60-second launch film

A motion-design film for the **ANI Vietnam Talent Innovator** project *"How might we deploy Agentic AI
through RAG for training & capability upskilling?"* (sponsor: Ha Tran). It is built with the
`product-launch-motion` skill. One shape morphs through every scene with no cuts. Text swaps with a blur, and
everything moves on springs. A cursor drives every change, and the music and sound are locked to the beat.

- **Output:** `deliver/ai-coach-launch.mp4`, 1920×1080, 60 fps, H.264 + AAC, 60 s
- **Storyboard:** `deliver/storyboard.png` (one frame per second)

## Concept

Using AI is not the same as being capable with AI. The film starts with how common AI use is. It then
shows the gap between appearing capable and being capable. It ends on the product, a place to practise
before it counts.

## Scenes (120 BPM; one beat = 0.5 s)

| Time | Scene | What the shape becomes |
|---|---|---|
| 0–4 s | **81%** of Vietnamese AI users use AI every day | dot → mint ring, odometer counts up |
| 4–10 s | **48%** exaggerated AI use / **45%** felt pressure without confidence | ring turns red, then white; digits roll |
| 10–14 s | *Adoption is outrunning capability.* | ring collapses into the "Capability" bar; "Adoption" races ahead |
| 14–18 s | Train · **Practise** · Upskill | bar → liquid tab indicator (edges stretch); "You" cursor clicks each |
| 18–22 s | **AI Coach**: *A place to practise before it counts.* | indicator blooms into the product card |
| 22–30 s | Built on trusted knowledge | card → RAG node; 8 knowledge sources fly in one by one |
| 30–34 s | Retrieve · Ground · Cite (build) | node pulses faster, camera pushes in |
| **34 s DROP** | AI Coach Orchestrator and its 5 agents | node → hub; Assess, Coach, Simulate, Evaluate, Next action pop in, one per beat |
| 40–51 s | Role-play: a new Sales KAM negotiates with a retail-chain buyer (AI persona) | AI Coach cursor clicks Simulate; hub → chat window; reply typed, coached, scored, next practice set |
| 51–55.5 s | Use cases 01 / 02 / 03, one slam per beat | window → tile that is re-sized and re-coloured on each hit |
| 56–60 s | Lockup: **AI Coach** — Trusted knowledge. Guided practice. Evidence of growth. | tile → dot beside the wordmark |

## Real vs invented

**Real (taken from the project deck, with the deck's sources shown on screen):**
- 81% of Vietnamese AI users interact with AI every day (consumer survey cited in the deck)
- 48% exaggerated AI use or expertise; 45% felt pressure to use AI without confidence (Visier, 1,000 US
  full-time employees, 2026). The film says these are US figures.
- The 8 knowledge sources, the 5 agents and their roles, the three use cases, and the tagline lines
  ("A place to practise before it counts", "Trusted knowledge. Guided practice. Evidence of growth.")

**Invented, for illustration only:**
- The role-play dialogue, the coaching line, the citation labels, the rubric scores (4/5, 3/5, 2/5)
  and "Concession trading · 10 min tomorrow"
- "Adoption" vs "Capability" bar lengths. These are a visual metaphor, not data.

## Director's decisions (each can be overturned in one line)

1. **Palette:** the deck's own system: black, mint `#2EE6A6`, white, red for risk, cyan for one use case.
   I used no glows, although the deck's diagrams have them, because the skill bans glows.
2. **Font:** Inter / Inter Display.
3. **Music:** an original score composed in code (`audio.py`), so there is no licensing risk. A minor (tension)
   resolves to C major on the lockup. The drop lands at 34 s on the orchestrator reveal.
4. **Demo use case:** New Sales KAM (use case 2). A negotiation is the easiest coaching moment to read in 10 seconds.
5. I left out the deck's people photos and the third-party mascots (OpenAI Dots / Meta Muse), for likeness and
   brand-permission reasons.
6. I left out the 39% vs 16% "Frontier Professionals" stat to keep one takeaway per scene. It could replace 81%.

## Caveats

- **Audio was measured, not heard.** Tempo measures 120.0 BPM, onsets land on the beat grid, and the cue
  median offset is 0 ms. Loudness is −13.9 LUFS integrated with −0.3 dBFS peak. Please listen once
  before showing it.
- Survey figures should be checked against the original reports before external use.

## Rebuild

```bash
ln -sfn "$(npm root -g)" node_modules          # playwright
CUES=cues.json node snap.mjs snapshots/x 0.12  # exports cues from the film
python3 -I audio.py cues.json                  # song.wav, sfx.wav, mix.wav
node render.mjs renders/ai-coach-launch.mp4 60 4 1 3
```
