# Manual screen-reader review

The automated suite checks axe violations, field names/descriptions, keyboard focus, native dialogs, and narrow layouts. A human pass with the intended screen reader remains necessary to confirm what is spoken and whether the experience is understandable.

Use NVDA with a desktop browser or VoiceOver with Safari. Demo mode (`VITE_USE_MOCK_API=true npm run dev`) avoids production test accounts. Browser emulation does not replace a physical-device or screen-reader check.

| Flow | Expected experience |
| --- | --- |
| Empty sign-in fields | Email/password errors are associated with inputs; focus reaches the first invalid input. |
| Missing registration names | Names have separate errors; focus reaches first name. Corrected fields permit submission. |
| Show/hide password | Toggle name and pressed state are clear. The password field retains its name/description. |
| Workspace navigation | Skip link reaches main content; active page is identified. Mobile navigation traps focus and returns focus on Escape. |
| Search/filter/paging | Counts and loading changes are announced. Tables are named. Empty/error states offer a next action. |
| Download | Dialog identifies the filename; preparation is announced and cancellable. Save/Open, retry, and expiry are understandable. Escape restores focus. |
| Share | Expiry choices, link creation/copying, failures, and expiry are understandable; closing restores focus. |
| Delete | File and permanence are clear. Controls stay unavailable while deleting; failure preserves the file. |
| Upload | Picker, categories, progress, outcomes, and ready/uploaded/attention summary are labelled. Retry/cancellation work. |
| Responsive/reduced motion | At 320px, 200% zoom, and reduced motion, content and controls stay reachable with visible focus. |

Record date, device/browser, screen reader/version, results, and issues in the private runbook. Leave this item pending until a person completes it.
