# TraceForge — Demo Video Script

**Target length:** 3–5 minutes
**Tone:** Confident, fast-paced, product-demo style — no slow intros
**Setup before recording:** Have all tabs pre-opened and the app running

---

## Pre-Recording Checklist

- [ ] Cloud Run deployment is live and healthy (`/health` returns 200)
- [ ] Arize Phoenix portal is open at your project's trace view
- [ ] Firestore console open to `agent_strategy` collection (shows v58+)
- [ ] Browser: Chrome, full screen, zoom at 90–100%, no bookmarks bar
- [ ] Resolution: 1920×1080 or Retina (export at 1080p minimum)
- [ ] Microphone tested — no background noise
- [ ] Close all notifications (macOS: Do Not Disturb on)
- [ ] Prepare the demo component below in a text file ready to paste

**Demo component to use (copy this exactly):**
```tsx
import React, { useState } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

export function ProductCard({ product, onAddToCart }: { product: Product; onAddToCart: (id: number) => void }) {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
    onAddToCart(product.id);
  };

  return (
    <div className="card" onClick={handleClick} style={{ cursor: 'pointer', padding: '16px', margin: '8px' }}>
      <h2>{product.name}</h2>
      <p dangerouslySetInnerHTML={{ __html: product.description }} />
      <span>${product.price}</span>
      <button>Add to Cart ({count})</button>
    </div>
  );
}
```

---

## Script

---

### [0:00–0:20] HOOK — Start with the problem

> *Start recording immediately — no countdown.*

**Show:** Blank screen or your terminal, then immediately cut to the app.

**Say:**
> "Every code review tool I've used gives you the same feedback forever. They never learn. TraceForge is different — it's a code review agent that gets better with every single review it runs, using its own execution traces as training signal. Let me show you."

*[Navigate to the app — /review page]*

---

### [0:20–0:50] DEMO — Run a live review

**Show:** The /review page. Paste the ProductCard component.

**Say:**
> "I'll paste a React component — it has real issues, but they're subtle. Performance problems, a security vulnerability, and an accessibility gap. Let's see what the agent catches."

*[Click "Review" button. The SSE stream starts — tool calls appear one by one.]*

**Say (while stream runs):**
> "Watch the tool calls on the left. First it parses the component structure, then it reviews each dimension — performance, accessibility, best practices, security — and searches the web for WCAG guidelines. It's not just running a linter. It's reasoning."

*[Wait for the review panel to appear with findings.]*

**Point to a specific finding:**
> "Here — it caught the `dangerouslySetInnerHTML` with unescaped product description. That's an XSS risk. And here it flagged the missing `aria-label` on the div acting as a button. These are real, actionable findings."

---

### [0:50–1:20] SELF-EVALUATION — Show the LLM-as-Judge step

*[The stream continues — run_evaluation fires.]*

**Say:**
> "Now it evaluates its own output. This is LLM-as-Judge — Gemini scores the review it just produced across four dimensions: completeness, accuracy, actionability, and calibration."

*[Point to the eval scores appearing.]*

> "0.91 completeness. 0.87 calibration. These scores aren't just for show — they drive the next step."

---

### [1:20–2:00] SELF-IMPROVEMENT — The strategy update

*[The stream shows phoenix_query_traces and update_strategy firing.]*

**Say:**
> "This is where TraceForge is unique. The agent now queries its own past execution traces from Arize Phoenix — it's reading its own history to find blind spots."

*[The stream finishes. Navigate to /strategy.]*

> "Every time the agent reflects, it writes strategy adjustments to Firestore. Look at this — we're on version 58. These aren't rules I wrote. Every single adjustment here was discovered by the agent analyzing its own performance."

*[Scroll through the strategy timeline — show v1 and then v58+]*

> "Version 1: just a default checklist. Version 58 — the agent added checks for icon-only buttons missing aria-label, useCallback in memoized components, inline objects breaking referential equality. These came from real reviews where the agent scored low and asked itself why."

---

### [2:00–2:30] OBSERVABILITY — Arize Phoenix

*[Switch to the Traces tab (/traces) in TraceForge, or open Arize Phoenix portal.]*

**Say:**
> "Every review is fully traced to Arize Phoenix. I can see every tool call, every LLM invocation, every token. This is the trace for the review we just ran."

*[Click a trace to expand it. Show spans: analyze_code, run_evaluation, phoenix_query_traces, update_strategy.]*

> "The span tree shows exactly what happened, in what order, and how long each step took. And critically — these traces are what the agent reads during reflection. Arize Phoenix isn't just observability here. It's the feedback loop."

---

### [2:30–3:00] BEFORE/AFTER — Show the improvement

*[Navigate to /improvement.]*

**Say:**
> "The improvement dashboard shows eval scores over time. Completeness trending up. Calibration steadily improving. But the best part is the before/after comparison."

*[Select a component from the dropdown — e.g., ProductCard.tsx. Show v1 vs current side by side.]*

> "Same component, same code — reviewed at strategy v1 and strategy v58. Early review: 3 findings. Latest review: 9 findings, more precise severity levels, with specific fix suggestions. The agent learned to catch these. No code changes. No retraining. Just reviews and reflection."

---

### [3:00–3:30] PR REVIEW (optional — include if under 4 min)

*[Navigate to /pr-reviews.]*

**Say:**
> "It also reviews GitHub PRs directly. Paste any public PR URL, and the agent fetches the diff, reviews changed files hunk by hunk, and produces findings aligned to diff positions — ready to post as inline GitHub comments."

*[Paste a PR URL and start the review — show the streaming progress.]*

---

### [3:30–4:00] ARCHITECTURE — One slide or screen share

*[Show a simple diagram or the HACKATHON_SUBMISSION.md architecture section.]*

**Say:**
> "Under the hood: two Cloud Run services — a Python ADK agent backend and a Next.js frontend. Gemini 3 Flash Preview on Vertex AI as the reviewer and evaluator. Firestore for strategy persistence. GitHub Actions for CI/CD. And Arize Phoenix as both the observability layer and the agent's memory."

> "The agent reads Phoenix via the GraphQL API — no Node.js needed on Cloud Run. That was a fun engineering problem to solve."

---

### [4:00–4:15] CLOSE

**Say:**
> "TraceForge is live on Cloud Run right now. The strategy is at version 58 and climbing. Thank you."

*[End recording.]*

---

## Editing Notes

- **Cut dead time** aggressively — if the SSE stream pauses for >2 seconds, cut or speed up 2×
- **Add captions** for the tool call names (analyze_code, run_evaluation, etc.) — some viewers will be muted
- **Music:** light lo-fi under the whole video at -20dB. Fade out at the close.
- **B-roll to add in editing:**
  - Zoom-in on the strategy version number jumping from v1 to v58
  - Screen recording of the Arize Phoenix trace tree (shows span depth)
  - Side-by-side before/after findings count (3 vs 9)
- **Thumbnail:** Split screen — "v1: 3 findings" on left, "v58: 9 findings" on right, big red/green delta

---

## Backup Plan (if live demo breaks)

Pre-record the following clips separately, then edit together:
1. Paste component → review streams → findings appear (60s)
2. /strategy page scrolling through v1 → v58 (30s)
3. /improvement page with trend lines (20s)
4. Arize Phoenix portal showing the trace tree (20s)

Use these clips in the final edit if the live recording has issues.

---

## Common Recording Mistakes to Avoid

- **Don't start with "Hi, my name is..."** — Open with the hook immediately
- **Don't read the findings out loud** — point and say what matters, then move on
- **Don't narrate what you're clicking** — "I'll now click the Review button" → just click it
- **Don't wait for spinners** — cut during loading, cut back when loaded
- **Don't over-explain the architecture** — 20 seconds max, then move on

---

## Submission Checklist

- [ ] Video uploaded to YouTube (unlisted or public)
- [ ] Video link included in hackathon form
- [ ] `HACKATHON_SUBMISSION.md` or equivalent project description included
- [ ] GitHub repo link included (or zip if private)
- [ ] Live demo URL included (Cloud Run URL)
- [ ] Team name + contact email filled in
- [ ] Arize track checkbox selected
