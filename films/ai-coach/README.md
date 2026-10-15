# AI Coach — launch film (42 s, 1080p60)

Made with this repo's `product-launch-motion` skill, recreating the structure of the Cheerful
glass film for a new story: the **AI Coach** from the ANI VN Talent Innovator deck (sponsor: Ha Tran).

## Story (one shape, never cut, 120 BPM)

| Time | Scene | Takeaway |
|---|---|---|
| 0–3 s | A mint dot grows into a card: **81%** odometer + 100-dot matrix | AI is already a daily habit in Vietnam |
| 3–6 s | Bars: **Vietnam 39% vs Global 16%** Frontier Professionals, “2.4×” tooltip | Vietnam's professionals are ahead |
| 6–8.5 s | Card turns red: **48%** exaggerated AI skills → **45%** use AI without confidence | The pain point |
| 8.5–10 s | Headline pill | “AI adoption is moving faster than capability.” |
| 10–12 s | Segmented control, liquid indicator: Train → Practice → Upskill | What they need |
| 12–16 s | Indicator grows into the chat input; a new KAM types; snare build | Someone asks for help |
| **16 s drop** | **AI COACH** slams; the 7-step loop lands one per 8th note | Goal → RAG → Plan → Act → Verify → Evaluate → Adapt |
| 20–23 s | RAG: playbooks flow into retrieval, cited answer | Built on trusted knowledge |
| 23–28 s | Use case: New Sales KAM role-plays a chain buyer → rubric + readiness odometer | Practise before it counts |
| 28–31 s | Use case: New employee role-plays their manager → next action | Guided swim |
| 31–34 s | Use case: New medical rep role-plays an HCP → “Verified” | Scientific confidence, approved claims |
| 34–37 s | Pull back: one orchestrator, five specialist roles, guardrails | One coach |
| 37–42 s | The shape becomes the full stop of “AI Coach.” | A place to practise before it counts. |

## Real vs invented

**Real (from the deck, with the source shown on screen):** 81% daily AI interaction (consumer survey of
Vietnamese AI users); 39% vs 16% Frontier Professionals (Microsoft Work Trend Index Vietnam 2026,
2,000 knowledge workers); 48% / 45% (Visier, 1,000 **US** full-time employees, 2026). “2.4×” is 39 ÷ 16.
The 7-step loop, the five agent roles, the guardrails and the three use cases come from the deck.

**Invented for the film (illustrative micro-story):** the chat lines, “Playbook §3.2”, “JBP Scenario 07”,
“shoppers grew 18%”, the rubric scores, “Readiness 41 → 86”, “+45 this week”, and the next actions.

## Decisions (overturn any in one reply)

- DECISION: deck palette (near-black, mint #2EE6A0, red for the pain point) with no glows. The skill bans glows, so the deck's neon was dropped.
- DECISION: Geist as the one UI font (installed from npm, `fonts/`).
- DECISION: no Abbott / Similac / Microsoft / OpenAI / Meta logos, and no photos of people. The ending is the generic “AI Coach.”
- DECISION: an original numpy score (A minor, Am–F–C–G) instead of a stock track, so there are no licence questions. The drop sits on the “AI COACH” reveal.
- DECISION: the KAM use case gets the most screen time (chat + rubric). The other two are short montage beats.
- DECISION: bars in scene 2 are drawn on a 0–45% scale, so the proportions between bars stay true.
- DECISION: the deck's 76% “passion point” stat, the Vietnam #12 ranking and the app-spending numbers were cut to keep one idea per scene.

## Rebuild

```bash
npm i                         # playwright + geist
CUES=1 node snap.mjs snaps/beats beats        # one frame per beat + exports events.json
python3 -I audio.py                           # music.wav, sfx.wav, mix.wav
node render.mjs out/ai-coach-launch-1080p60.mp4 60 4 1 4
```
`index.html` + `film.js` is the film: every style is computed from `t` inside `seek(t)`.
