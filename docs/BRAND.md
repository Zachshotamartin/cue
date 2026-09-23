# Cue identity

**Your product. In motion.** Cue is an editorial film tool for people who build products. The visual idea is an opening frame and the short signal that starts an action.

## Mark

A thick open right-angle frame in ink with one short orange timing bar. The lowercase wordmark keeps the tool approachable. Use the shared `cue-logo.svg` for every wordmark. It contains the offset bracket and orange bar with outlined Manrope lettering, so its proportions do not depend on fonts loading. `Logo.tsx` references the wordmark or compact mark from that asset; the capture-extension build copies the same file. The app icon uses the bracket on chalk. Never recreate the logo with CSS or live text. Maintain clear space equal to the thickness of the bracket on every side. Do not add gradients, a play triangle or decorative waveforms.

## Palette

| Role          | Color     |
| ------------- | --------- |
| Chalk         | `#F3F3EE` |
| Ink           | `#181A19` |
| Stone         | `#B9BBB4` |
| Signal orange | `#DF603C` |

Orange marks selected states, motion and emphasis. Use darker burnt orange for small text on chalk. Public pages use chalk with charcoal type and ink buttons. The landing hero, sign-in brand panel, and editing workspace use charcoal with chalk type and orange primary actions. Use neutral surfaces, thin borders, and restrained 4px corners. The film remains the strongest visual object in the editor.

## Typography and voice

Manrope, self-hosted, with compact tracking in large headings. IBM Plex Mono is available for technical metadata; routine UI remains Manrope. Copy is direct: capture, scene, take, direction, export. Do not imply that a deterministic starter cut is AI-generated.

## Generated visual direction

The identity board and material hero were generated with the built-in image-generation tool for this project. The final art direction: a premium Cue identity board with a lowercase wordmark, thick frame bracket and short orange timing bar; precise editorial grids; chalk, charcoal and stone; tactile printed identity applications; minimal typography; intentional negative space. The supporting hero uses smoked-glass frames with one orange edge on a pale studio floor, natural shadows and no product UI.

The board is a concept presentation. The interface shown by the running app is real implementation; sample screenshots in `examples/` were captured from that interface. The hero does not pretend to be generated video or a screenshot of a feature.

## Files

- `apps/editor/public/brand/cue-brand-kit.png`: generated identity board.
- `apps/editor/public/brand/frames.png`: generated material hero.
- `apps/editor/public/brand/cue-icon.svg`: geometric vector implementation of the mark.
- `apps/editor/public/brand/cue-logo.svg`: shared vector wordmark and compact mark.
- `apps/editor/components/Logo.tsx`: the only React logo component.
- `apps/editor/styles/tokens.css`: canonical palette and light/dark semantic roles.
- `apps/editor/styles/base.css`: shared controls, typography and dialogs.
- `apps/editor/styles/pages.css`: public, account and library layouts.
- `apps/editor/styles/editor.css`: editing workspace and responsive panels.
- `apps/editor/app/globals.css`: imports the four style layers in order.
- `/brand`: view/download the board and vector from the running app.
