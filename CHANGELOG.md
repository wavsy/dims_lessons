# Changelog

Every change to the studio is written down here: what changed, why, and what to check.
The newest entry is at the top. Dates are in YYYY-MM-DD.

## 2026-10-28 · Faster pages

### Why
On the live site every signed-in page waited about 0.6–1 s.
- The server code ran in Washington (`iad1`, the Vercel default) while the database is in the EU. Each query crossed the Atlantic, and a page made about six of them one after another.
- There was no loading state, so a tap on the menu looked frozen until the server finished.

### What changed
- **`vercel.json`: functions run in Frankfurt (`fra1`)**, next to the EU database. If the Supabase project is in Ireland, use `dub1` instead.
- **One auth check per request.** `getSession` and the user lookup are wrapped in React `cache()` (`src/lib/auth.ts`). The layout and the page used to ask Supabase twice each, and the parent layout three times.
- **Teacher layout:** the three badge counts load in parallel instead of one after another.
- **Today and Money:** the clients load in parallel with the translations, and the extra teacher lookup is gone (`session.user_id` is the teacher's id). Money looks up parents only for the people it actually shows.
- **Loading states:** `loading.tsx` for the teacher, parent and student rooms, with a soft skeleton (`page-skeleton.tsx`). The menu stays in place and the content area shows placeholders straight away.

### What to check
- After the deploy, the `x-vercel-id` response header should contain `::fra1::` (or `::dub1::`).
- Signed in as the teacher: Today, Money, Signups. Each tap shows the skeleton at once and the data soon after.

## 2026-10-28 · Landing page, film, README, security update

### Security
- **Next.js 16.4.0 → 16.4.3** (`eslint-config-next` too). Version 16.4.0 has a critical advisory, including remote code execution in the image optimizer and in `use cache`. `npm audit` now reports 0 vulnerabilities.

### Landing page: “the notebook comes alive”
- **Real 3D notebook in the hero (WebGL).** The book is rendered with Three.js via React Three Fiber and drei, in `book-3d.tsx`.
  - It has leather with a clear coat, a gold-foil title, a page block, a ribbon, soft studio light (Lightformers, no external HDR file), contact shadows and floating dust.
  - The cover opens on load, a page turns every seven seconds, and the book tilts towards the pointer.
  - The cover title and the handwritten first page are drawn in the browser with the site fonts, so they follow the language: “Dimi's Lessons” or “Уроците на Дими”.
  - The book loads lazily (`next/dynamic`, no SSR) and stops rendering when it is off screen.
  - Without WebGL, or with “Reduce motion” on, the CSS book below is shown instead.
  - **Stars.** Ninety four-point stars drawn in a custom shader, each with a core, rays and a soft halo.
    - They twinkle at their own pace, and a few larger stars flash now and then.
    - When the cover opens they burst out of the pages, then settle into a slow orbit around the book.
    - They drift against the pointer for depth.
    - In the dark theme they switch to additive glow, like a night sky.
  - Five taps on the book still start the broom game.
  - New dependencies: `three` 0.186, `@react-three/fiber` 9.8, `@react-three/drei` 10.7 and `@types/three`. `npm audit` still reports 0 vulnerabilities.
- **Opening cover (CSS fallback).** The CSS notebook now opens with a leather cover and a gold-foil title, and the rest of the book fades in behind it. Paper catches a soft sheen that follows the pointer. Changed in `book-mark.tsx` with the new `intro` and `coverTitle` props. Other uses of `BookMark` are unchanged.
- **Scroll story.** A new section, “How it works”, has four chapters: Today, Money, Family, Student. On desktop the notebook stays in view and turns a page for each chapter. On phones each chapter shows its own notebook card. New files: `notebook-story.tsx` and `notebook-page.tsx`.
- **Film.** A new section, “See it in 40 seconds”. A taped photo plays the film silently while it is on screen, and a click opens it full size in a dialog. New file: `studio-film.tsx`, with media in `public/video/` (MP4 4 MB plus a poster). The opening 11 seconds were rendered in Blender: a stack of leather notebooks, then the top one slides forward and opens on today's page.
- **Closing call to action.** Sign in, Register a student, I'm a student.
- **Handwriting font.** Caveat, with Latin and Cyrillic, set up in `app/[locale]/layout.tsx` as `--font-caveat`.
- **Notebook pages.** Rows stay on one line and sit on the ruled lines. On the Money page the pack label moved to its own line, so it no longer runs off the page.
- **Copy.** All new text is in English and Bulgarian, under `landing` in `messages/*.json`.
- **Accessibility.** Reduced motion turns off the animations and the page turns. Decorative pieces are `aria-hidden`, and the film is a real `<button>` with a `<dialog>`.

### Docs
- README rewritten: badges, a tech stack table, an architecture sketch, a database table, environment variables, the security model and the project layout.
- README: a new “The landing page” section with four screenshots, all in `docs/images/landing-*.jpg`:
  - the 3D book in the light theme and in the dark theme;
  - the scroll story;
  - the film section.
- README: the film section now has a scene-by-scene table showing which part was made in Blender and which in Remotion.
- This changelog.

### What to check
- `npm run dev`, then open `/en` and `/bg`. Scroll slowly through the story, play the film, and switch to the dark theme.
- Turn on “Reduce motion” in the system settings. The page should be calm and still readable.
