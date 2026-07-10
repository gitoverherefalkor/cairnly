# Atlas Assessments — Frontend

## What this is
Career guidance platform. Users complete a survey → AI generates personality + career recommendations → users discuss results via chat → feedback incorporated into a final report.

## Developer profile
- Non-technical "vibe coder" — keep explanations simple, not condescending
- For large changes: recap what you understand + outline approach, wait for confirmation, then execute
- For small changes: just do it and push
- Visual confirmation of changes is important

## Tech stack
- React + TypeScript
- Tailwind CSS
- Supabase (auth + database — client via `src/integrations/supabase/`)
- Vite
- n8n webhooks for AI chat (via `src/hooks/useN8nWebhook.ts`)

## Key folders
```
src/
  components/chat/     ← custom AI chat (ChatContainer, ChatInput, ChatMessage, ReportSidebar…)
  components/ui/       ← shadcn/ui primitives, don't modify
  hooks/               ← useN8nWebhook, useChatMessages, etc.
  pages/               ← Chat.tsx, Dashboard.tsx, Assessment.tsx, etc.
  integrations/        ← Supabase client + generated types
```

## Coding standards
- Follow existing patterns in the file you're editing
- TypeScript types required
- Comments only where logic isn't obvious
- Run `npm run build` from the project root to verify before committing

## Git (run from project root, one level up)
- `git add <file>` → `git commit -m "message"` → `git push`
- Descriptive commit messages — not "update" or "fix"

## Communication
- Business casual tone
- Challenge assumptions if something seems off
- Be honest when uncertain
