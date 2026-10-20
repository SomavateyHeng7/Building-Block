# 12. Notifications — `src/lib/toast.ts` and `src/components/ToastViewport.tsx`

## API

```ts
import { toast } from "@/lib/toast";

toast.success("Downloaded plan.png");
toast.info("Title", { description: "One sentence." });
toast.warning(`Opened "Plan" with repairs`, { description: "Save to keep the repaired version.", details: fixes });
toast.error("Couldn't save the file", {
  description: "It may be read-only or have moved. Use File → Save as to choose another location.",
  action: { label: "Save as…", onClick: () => void saveDiagramToFile({ saveAs: true }) },
});
```

Options: `description`, `details` (a list), `action` (one button), `duration` (ms; `0` = until dismissed).

It works from anywhere, including plain functions outside React (`file.ts` raises toasts), because the store is a
module-level list with listeners, read by the viewport through `useSyncExternalStore`.

## Writing rules

Every toast follows the same pattern so they read as one voice. These rules are also in the doc comment at the top
of `toast.ts`.

| Part | Rule | Examples |
| --- | --- | --- |
| **Title** | What happened, in a few words, sentence case, no full stop. Success names the result; failure starts with "Couldn't". | "Downloaded plan.zip" · "Couldn't save the file" · `Opened "Plan" with repairs` |
| **Description** | Optional. One sentence: what to do next, or why. | "Use File → Save as to choose another location." |
| **Details** | Optional list (e.g. repairs). After two items the rest fold under "Show N more". | |
| **Action** | Optional, one button, for the obvious next step. | "Save as…" |

| Kind | Use when | Duration | Screen readers |
| --- | --- | --- | --- |
| `success` | It worked | 5 s | Polite (`role="status"`) |
| `info` | Worth knowing; nothing went wrong | 6 s | Polite |
| `warning` | It worked, but check something | 10 s | Polite |
| `error` | It didn't work | **Until dismissed** | Immediate (`role="alert"`) |

## Behaviour

- **Repeats replace, not stack:** a toast with the same kind and title as one on screen replaces it (with a fresh
  timer). Repeated autosave failures don't pile up.
- **At most three** on screen; the oldest goes when another arrives.
- **Timers pause** while the toast is hovered or anything in it has focus, and resume when the pointer or focus
  leaves (WCAG 2.2.1, timing adjustable). The timer lives in each `ToastCard` (`useRef` for remaining time).
- **Errors never time out:** an error the user didn't see is worse than one they have to dismiss.
- **Position:** bottom-right on wide screens (384 px wide), full width at the bottom on phones, above the
  safe-area inset. Newest at the bottom. `z-index` 300 keeps toasts above dialogs.
- **Design:** a white card with a 4 px coloured accent on the left, an icon in a tinted circle (✓ success, i info,
  ! warning, × error), the title in semibold, a muted description, and a 32 px dismiss button
  (`aria-label="Dismiss notification"`).
- **Motion:** slides up 8 px over 180 ms, only when the user hasn't asked for reduced motion.
- **No nested live regions:** each toast is its own `status`/`alert`; the container isn't a live region (that
  would announce toasts twice).

## Messages in the app

| Where | Kind | Title |
| --- | --- | --- |
| Save failed (`file.ts`) | error | Couldn't save the file (+ Save as… button) |
| Open failed | error | Couldn't open the file / Couldn't open "x.json" (with the reason) |
| File needed repairs | warning | Opened "Name" with repairs (+ list of repairs) |
| Export (one file) | success | Downloaded plan.png / Downloaded plan.zip |
| Export (several files) | success | Downloaded 4 files (+ names, + hint about allowing several downloads) |
| Export failed | error | Couldn't export |
| Old copies removed (start page) | success | Removed the old copies |

Tests: `tests/lib/toast.test.ts` (durations, replacing repeats, the three-toast limit, empty details).
