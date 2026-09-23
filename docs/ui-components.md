# UI component ownership

Cue's React UI lives in named modules. `Editor.tsx` composes the workspace; `editor/useEditorController.ts` owns editing, autosave, recovery, job actions and selection. Feature panels and cards consume the loaded editor context rather than redeclaring controls. Remotion's root, film, scene and media visual each have their own module. The extension imports its route and capture views from standalone DOM component modules.

Use the controls in `apps/editor/components/ui` for buttons, inputs, selects, textareas, tabs, disclosures, notices, dialogs and resizable panels. Buttons default to `type="button"`; forms must opt into `type="submit"`. Textareas grow and shrink with content and available width. Dialogs own focus, Escape, backdrop dismissal and restoration. Do not define React components inside another component or duplicate a control implementation in a feature file.

Both editor sidebars remember their width and collapsed state in this browser. Drag the inside edge to resize, double-click it to restore the default width, or focus it and use arrow keys (Shift for larger steps), Home or End. The preview retains at least 280px on desktop. At 900px and below the workspace stacks and collapse controls remain available; drag resizing is disabled because there is no horizontal space to trade. Opening an editing tool also opens the inspector.

Tests enforce shared primitive ownership and one module-level React component per file, and exercise panel bounds across desktop widths, collapsed combinations and damaged saved preferences.

## Review of this change

- Preserved form submission types during shared-button migration; accidental submits now default off.
- Replaced document-wide dialog lookup with a dialog-owned ref, keyboard focus trap, scroll lock and focus restoration.
- Added keyboard-operable resize separators and editing tabs.
- Corrected asymmetric panel clamping so a panel already at minimum width cannot force the preview outside the viewport.
- Added a synchronous guard to editor actions to prevent rapid clicks queuing duplicate operations before React updates the disabled state.
- Kept database, account ownership, encrypted credentials, API contracts and job execution unchanged. The controller retains revision checks and browser recovery. Compositor extraction preserves rendering calculations.

Validation: `npm run check` passes (73 tests, TypeScript, extension packaging and Next production build). Paid-provider generation and authenticated Chrome capture were not exercised as part of this UI refactor. Browser verification used a temporary local fixture importing the production controls: drag both edges, persist collapse and width on reload, grow/shrink long text, arrow-key resize and tab navigation, dialog Tab/Shift+Tab trapping and Escape focus restoration. Checked 1440px, the 901px desktop boundary (280px preview, no page overflow), and 390px mobile. The fixture was removed after testing. Full signed-in editor replay on localhost still requires its separate login.
