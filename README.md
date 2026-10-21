# Embodiment and LLM Agents: Evidence Database

An interactive table of primary studies that compare embodied and non-embodied LLM agents on how people perceive them, plus the motivation research behind a future-self app.

It is a companion to the [3D/XR Embodied Agent Review Database](https://danhuazhang.github.io/3d-xr-embodied-agent-review/), which collects the review-level literature. This site holds the individual studies.

## What is in it

- **Primary studies** — grouped as direct comparisons (an embodied vs a non-embodied agent), mechanism studies (variations within embodied agents), a robot strand kept for future work, and candidates still to screen.
- **Motivation and future self** — regulatory focus, fear appeals, approach and avoidance goals, possible selves, and future-self app trials.

Each record lists the contrast tested, what else changed between conditions, sample and design, the model used, and the main finding.

## Viewing it

Open `index.html` in a browser, or enable GitHub Pages for this repository (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).

Citation counts come from [OpenAlex](https://openalex.org) when you press **Refresh citations**, and are cached in your browser.

## Editing the data

All records live in `data/records.js`. To add one, copy an existing entry in the right list, give it the next `id`, and fill in the fields. Leave a field as an empty string if it is not known yet.

## Status

The search so far is targeted, not a full database run. Records marked **To screen** have not been read, and records marked **Verify** or **Summary only** still need checking against their full texts.
