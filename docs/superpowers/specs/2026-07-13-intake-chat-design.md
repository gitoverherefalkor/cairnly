# Intake Chat — Landing Page Conversational Funnel (Design)

**Date:** 2026-07-13 · **Status:** approved by Sjoerd in session

## Problem

The landing page CTA sends logged-out visitors straight to `/payment` (`useGetStarted.ts`).
Drop-off is steep at that jump: the visitor has invested nothing of themselves before being
asked for money. Cairnly's strength — the agent and the quality of its questions — is
invisible until after purchase.

## Solution

An agent-led intake chat overlay on the landing page (Jack & Jill / Apt-style "talk first"):

1. **Triggers:** clicking a "what brings you here?" intent pill opens the chat seeded with
   that intent; Get Started (logged out) opens it too. Logged-in users still go to
   `/dashboard`. No auto-open on scroll.
2. **Conversation:** the agent asks ~5 questions one at a time (current role, how they got
   there, what's nagging, what they'd want instead, timeline). Phase control is
   **server-side**: the edge function counts answers and decides when Q&A ends — the model
   is never trusted to self-report the phase.
3. **Pitch:** after the Q&A beats, one personalized "here's what Cairnly would dig into for
   you" message built from their actual words, followed by email capture ("save this +
   your progress") and a CTA to `/payment`.
4. **The out:** overlay is dismissible at any time, collapsing to a floating
   "continue our chat" pill. A visible "skip to checkout" link inside. A dismissal is
   respected: subsequent pill clicks don't re-open it (Get Started always does).
5. **Data travels:** a final extraction call produces mapper-compatible fields
   (`name`, `goals`, `years_experience`, `study_subject`). Stored in localStorage
   `intake_prefill_data` and merged by the survey pre-fill hook after purchase — same rails
   as the resume upload. Checkout form pre-fills name/email from the chat.
6. **Recovery:** after email capture, a Resend magic-link email
   (`/?intake=<resume_token>`) restores the conversation and pre-fill data. Doubles as
   abandoned-funnel recovery.

## Architecture

- **Edge function `intake-chat`** (new, `verify_jwt = false`): actions `start`, `message`,
  `email`, `resume`. Calls Anthropic directly (`claude-sonnet-5`, **no temperature param**),
  Resend for the email. Guardrails: per-IP rate limit (15/min), 14 user-turn hard cap,
  600-char message cap, server-side phase machine, scope-locked system prompt (agent asks,
  user answers), language lock (EN/NL from site language), house style rules (no em-dashes,
  no "it's not X, it's Y").
- **Table `intake_sessions`** (new): transcript, intent, status funnel
  (`active → pitched → email_captured`), extraction, email, `resume_token`. RLS enabled with
  no policies — service-role only. Links to purchases by email match; **no changes to
  `create-checkout` / `payment-success`** (money path untouched).
- **Frontend:** `IntakeChatProvider` + portal overlay under `src/components/landing/intake/`,
  mounted in `Index.tsx` inside `IntentProvider`. `useGetStarted` and `IntentChips` consume
  the provider optionally (fallback = current `/payment` navigation, so other pages using
  `LandingNav` are unaffected). Styling follows `landing.css` tokens (navy `#122E3B`,
  cream `#FBF6E8`, gold `#D4A024`, teal `#2ABFBF`). i18n via `landing` namespace, EN + NL.
- **Model choice:** Sonnet 5 throughout (the chat is the product demo). Volumes low; caps
  bound worst-case spend.

## Non-goals (v1)

- No streaming (typing indicator instead, matching WF5 chat UX).
- No DB-side pre-fill fallback for cross-device magic-link opens (fast-follow).
- No A/B test harness — full cutover with skip link; funnel measured via
  `intake_sessions.status` transitions joined to `purchases` by email.
- No n8n changes anywhere.
