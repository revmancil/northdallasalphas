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
