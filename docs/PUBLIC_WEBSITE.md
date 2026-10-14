# Premium public website

## Delivered routes

| Route | Content |
| --- | --- |
| `/` | Exact requested headline, consultation CTAs, truck concept image, four service cards, configurable equipment and four onboarding steps |
| `/services` | Editable proposed service descriptions and linked service-detail anchors |
| `/how-it-works` | Onboarding process and preparation checklist |
| `/about` | Proposed working approach and principles without invented company history or claims |
| `/contact` | Working consultation form, preparation notes and conditional verified email/telephone links |
| `/login` | Invitation-only sign-in entry, reached through discreet Team Login links; requires configured auth runtime |

The shared header has an active-page indicator and a keyboard-accessible mobile disclosure menu. Escape closes the menu and returns focus to the toggle. The footer links to every relevant public page and team access. Decorative icons use local inline SVG rather than font-dependent arrow characters. Reduced-motion preferences disable transitions and smooth scrolling. No animation library, external font, stock CDN or decorative background effect is required.

## Editing content

`src/config/company.ts` remains the single source of company facts. Its `publicContent` section holds proposed service copy, equipment descriptions, onboarding steps, hero text and image information. An equipment item's `enabled` flag controls whether it is included in the offered-equipment section on Home and Services. Dry Van, Reefer and Flatbed are currently visible as proposed equipment scope; availability is explicitly subject to consultation.

Confirm service scope and equipment availability before launch. Populate contact details, pricing and business claims only after approval. No testimonials, fleet ownership, customer counts, certifications, experience figures or guaranteed earnings are asserted. Public rendering needs no database or identity-provider credentials.

## Contact behavior

Every consultation CTA links to the real Contact page. Its working form validates and saves inquiries in PostgreSQL before showing success. Recoverable failures keep entered values, and optional staff email alerts report their own outcome independently. Configuring an approved company email or phone enables the corresponding `mailto:` or `tel:` link; unknown contacts remain unset. See `LEADS.md` for credentials, abuse limits, privacy and routing.

## Image

The truck asset is a visibly captioned, generated local concept placeholder. It is not represented as company equipment or verified stock photography. See `public/images/README.md` for provenance and replacement instructions. Next.js optimizes the local PNG and selects responsive image sizes. A checked 1080-pixel WebP response was HTTP 200 and 56,540 bytes; actual delivered size varies with viewport and format.

## Original public-stage verification

- ESLint, TypeScript and optimized production build: passed.
- Existing authorization suite: 5 tests passed.
- Production/database smoke: passed, including anonymous dashboard rejection, Admin/Manager/Dispatcher scope and expired/inactive/revoked sessions. Temporary fixtures were removed.
- Chromium checks: all five public pages returned HTTP 200 at widths 1440, 1024, 768, 390 and 320 (25 page/viewport checks). No horizontal overflow or browser runtime errors detected.
- axe-core WCAG 2 A/AA and WCAG 2.1 AA checks: no detected violations on those 25 page/viewport checks. Automated checks do not replace a full accessibility audit.
- Mobile menu: open/close, Escape focus return, navigation and active-page state checked at 768, 390 and 320 pixels.
- Internal links: 10 distinct route/anchor destinations verified. Both Home consultation CTAs target Contact; the Contact page has no unconnected form or fake success.
- Keyboard skip link and reduced-motion behavior: checked.
- Desktop and mobile screenshots: captured for every public page and visually reviewed for the home layout and Contact mobile layout. This cloud machine retains them in `/workspace/scratch/northlane-public`; they are review artifacts outside the checkout.

Private authentication and basic daily submissions were delivered in the following stage; see `AUTHENTICATION.md`. Expanded manual workflow, Excel import and production deployment remain later work. The foundation's documented development-tool audit findings are unchanged by this public-site stage.

## Connected consultations

The later lead stage replaces the original availability placeholder with a validated PostgreSQL-backed consultation form. Only a completed save produces success. Recoverable errors keep entries, equipment follows company configuration, and optional notification results are reported separately. See [Leads](LEADS.md). Earlier public-stage results below describe the site before this connection; current journey/layout checks are in `VERIFICATION.md`.
