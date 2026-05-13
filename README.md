# North Dallas Alphas — Website Rebuild

**Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc.**  
Rebuilt static website based on northdallasalphas.org, with improved design, layout, and photo-driven "What We Stand For" section.

---

## Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `index.html` | Hero, photo pillar cards (Scholarship/Service/Brotherhood), events, president's message, news preview, membership CTA |
| About | `about.html` | Chapter history, 22 charter members, milestone timeline |
| Events | `events.html` | Scholarship Gala feature + all upcoming Ice Cold events |
| Membership | `membership.html` | Values, requirements, 4-step process, reactivation |
| News | `news.html` | Chapter news, MISD impact timeline |
| Contact | `contact.html` | Contact form, team contacts, quick-contact cards |

---

## Key Feature: What We Stand For — Photo Pillar Cards

The homepage "What We Stand For" section uses real photos for each of the three pillars:

| Pillar | Image | Description |
|--------|-------|-------------|
| Scholarship | `images/scholarship.jpg` | Alpha Phi Alpha scholarship ceremony |
| Service | `images/service.jpg` | Community service event |
| Brotherhood | `images/brotherhood.jpg` | Brothers together |

Cards feature hover reveal effects — description text and link appear on hover/focus.

---

## Images Used

| File | Source |
|------|--------|
| `images/xtl-logo.png` | northdallasalphas.org/resources/Pictures/xtl%20logo.png |
| `images/chapter-event.jpg` | northdallasalphas.org/resources/Pictures/WBP_8935.jpg |
| `images/event-photo.jpg` | northdallasalphas.org/resources/Pictures/IMG_3830.jpeg |
| `images/slideshow1.jpg` | northdallasalphas.org/resources/Slideshow/0f13e060... |
| `images/scholarship.jpg` | Alpha Phi Alpha scholarship ceremony (Alpha Phi Alpha chapter) |
| `images/service.jpg` | Alpha Phi Alpha community service event |
| `images/brotherhood.jpg` | Brotherhood/group photo (50 Years of Brotherhood, Duke) |

---

## Design

- **Colors**: Black (`#0a0a0a`) and Gold (`#C9A84C`)
- **Typography**: Playfair Display (headings) + Inter (body)
- **Layout**: Fully responsive — mobile, tablet, desktop
- **Animations**: Scroll-triggered fade-up/fade-in via IntersectionObserver
- **Features**: Sticky nav with scroll effect, mobile hamburger menu, animated hero, marquee strip, pillar card hover reveals

---

## Files

```
index.html
about.html
events.html
membership.html
news.html
contact.html
css/style.css
js/main.js
images/
  xtl-logo.png
  chapter-event.jpg
  event-photo.jpg
  slideshow1.jpg
  scholarship.jpg
  service.jpg
  brotherhood.jpg
```

---

## To Deploy

Go to the **Publish tab** to make this website live.

---

## Supabase CLI: `login` not working (Windows)

The **Grant admin access** button needs the Edge Function `grant-chapter-admin` deployed. That uses the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

### Install the CLI (pick one)

- **Scoop** (recommended on Windows): [Scoop](https://scoop.sh/) then  
  `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git`  
  `scoop install supabase`
- **No global install:** use **Node.js 20+** and run commands with  
  `npx supabase@latest ...`  
  (Older Node will fail.)

Do **not** use `npm install -g supabase` — it is not supported.

### If `supabase login` (browser) fails

Use a **personal access token** instead (no browser callback):

1. Open [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
2. **Generate new token**, copy it (starts with `sbp_`).
3. In PowerShell, from your project folder:

   ```powershell
   supabase login --token YOUR_SBP_TOKEN_HERE
   ```

   Or with `npx`:

   ```powershell
   npx supabase@latest login --token YOUR_SBP_TOKEN_HERE
   ```

4. Link and deploy:

   ```powershell
   supabase link --project-ref fbjervpgxnbyntylabfr
   supabase functions deploy grant-chapter-admin
   ```

**CI / headless:** you can skip `login` and set the env var `SUPABASE_ACCESS_TOKEN` to the same token when running deploy commands.

### After deploy

In the Supabase Dashboard go to **Edge Functions** and confirm **grant-chapter-admin** is listed. Then try **Grant admin access** on the admin dashboard again.
