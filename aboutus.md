# About Section Specification — North Dallas Alphas (Xi Tau Lambda Chapter)

## 1. Overview

This document defines the navigation structure, page content requirements, UI/UX standards, and admin dashboard capabilities for the About section of the North Dallas Alphas website. It is intended as a developer-ready specification for implementation.

---

## 2. Navigation Structure

The primary navigation bar must include an **About** menu item with a dropdown containing the following items:

- History
- National Programs *(with flyout submenu)*
  - A Voteless People Is a Hopeless People
  - Go-to-High School, Go-to-College
  - Project Alpha
  - Brother's Keeper
- Alpha Legacy Group

### Dropdown Behavior

- Desktop: Dropdown appears on hover with a 150ms delay to prevent accidental activation; closes on mouse-leave with 200ms delay.
- Mobile: Dropdown expands on tap; a chevron icon indicates expand/collapse state.
- National Programs item displays a right-arrow indicator on desktop to signal the flyout submenu.
- Flyout submenu opens to the right on desktop; stacks vertically below the parent item on mobile.
- Active page is highlighted in old gold (`#C9A84C`) within the dropdown.
- Keyboard navigation: Arrow keys traverse items; Enter activates; Escape closes.

---

## 3. History Page

### Route
`/history.html` or `/about/history`

### Purpose
Communicate the founding, heritage, and ongoing legacy of Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc.

### Required Content Sections

#### 3.1 Chapter Founding
- Year and location of charter
- Founding circumstances and community context
- Relationship to the national organization at time of founding

#### 3.2 Charter Members
- Names and brief profiles of charter members
- Photo gallery (archival imagery where available)
- Roles held at founding

#### 3.3 Mission & Vision
- Chapter mission statement
- Chapter vision statement
- Alignment with Alpha Phi Alpha Fraternity, Inc. national mission

#### 3.4 Milestones
- Timeline component displaying key chapter milestones by decade
- Events: scholarship launches, community programs, milestone anniversaries, awards received
- Each milestone entry: year, title, brief description, optional image

#### 3.5 Leadership Legacy
- List of past Chapter Presidents with years served
- Notable contributions of each administration
- Optional: photo for each president

#### 3.6 Connection to Alpha Phi Alpha Fraternity, Inc.
- Brief history of Alpha Phi Alpha Fraternity, Inc. (founding 1906, Cornell University)
- Xi Tau Lambda's place within the General Organization
- Links to national organization resources

### Page Layout
- Full-width hero banner with chapter crest and founding year
- Alternating text/image content blocks for milestones
- Horizontal scrollable or vertical stacked timeline component
- Footer CTA: "Join Our Legacy" linking to membership page

---

## 4. National Programs

### Route
`/programs.html` or `/about/programs` (landing page listing all four programs)

Each program links to its own dedicated sub-page.

### Landing Page Layout
- Section header: "Our National Programs"
- Four program cards in a 2×2 grid (desktop) / single column (mobile)
- Each card: program name, one-sentence description, "Learn More" link

---

### 4.1 A Voteless People Is a Hopeless People

**Route:** `/programs/voteless-people.html`

#### Program Overview
Specification for a voter education, registration, and civic engagement initiative targeting underserved communities in the North Dallas area.

#### Historical Context Section
- Program origins within Alpha Phi Alpha Fraternity, Inc.
- National scope and impact data
- Connection to the Civil Rights legacy of the fraternity

#### Chapter-Specific Implementation Section
- Annual voter registration drives: dates, locations, partner organizations
- Civic education workshops: topics covered, target audience
- Get-out-the-vote activities during election cycles
- Partnerships with local municipalities, schools, and faith communities

#### Expected Content Sections
- Hero banner with program name and tagline
- Program overview paragraph (editable via admin)
- Impact statistics: voters registered, workshops held, precincts covered
- Upcoming events related to this program (pulled from Events module)
- Photo gallery of past initiatives
- CTA: "Get Involved" linking to contact or volunteer form

---

### 4.2 Go-to-High School, Go-to-College

**Route:** `/programs/go-to-high-school.html`

#### Program Overview
Specification for an academic encouragement and college readiness initiative targeting middle and high school students.

#### Historical Context Section
- Founding intent within Alpha Phi Alpha Fraternity, Inc.
- National reach and documented outcomes
- Alignment with the fraternity's commitment to education

#### Chapter-Specific Implementation Section
- School partnerships in North Dallas ISD and surrounding districts
- Mentorship pairings between chapter brothers and students
- College application and financial aid workshops
- Campus visit programs and scholarship information sessions

#### Expected Content Sections
- Hero banner with program name and tagline
- Program overview paragraph (editable via admin)
- Partner school logos and names
- Testimonials from student participants
- Upcoming workshops and events (pulled from Events module)
- Photo gallery
- CTA: "Partner With Us" for school administrators or community leaders

---

### 4.3 Project Alpha

**Route:** `/programs/project-alpha.html`

#### Program Overview
Specification for a male youth development program focused on responsible decision-making, health awareness, and personal development.

#### Historical Context Section
- National launch and founding rationale within Alpha Phi Alpha Fraternity, Inc.
- Public health and social context driving the program's creation
- Evolution of program focus over decades

#### Chapter-Specific Implementation Section
- Target age group (middle and high school males)
- Topics addressed: health literacy, sexual responsibility, substance avoidance, leadership
- Workshop formats: school presentations, community sessions, one-day summits
- Collaborating organizations: health departments, school counselors, faith communities

#### Expected Content Sections
- Hero banner with program name and tagline
- Program overview paragraph (editable via admin)
- Session topics listed with brief descriptions
- Scheduling and participation information
- Photo gallery of past sessions
- CTA: "Request a Program" for schools or organizations to invite participation

---

### 4.4 Brother's Keeper

**Route:** `/programs/brothers-keeper.html`

#### Program Overview
Specification for a mentorship and reentry support initiative focused on formerly incarcerated individuals and at-risk men.

#### Historical Context Section
- Origin within Alpha Phi Alpha Fraternity, Inc. national programs
- Social justice context and fraternity's commitment to criminal justice reform
- Alignment with national advocacy positions

#### Chapter-Specific Implementation Section
- Partnerships with reentry organizations, workforce development programs, and correctional facilities
- Mentorship structure: one-on-one pairings, group sessions
- Skill-building workshops: resume writing, financial literacy, job placement assistance
- Wraparound support: housing referrals, legal aid connections

#### Expected Content Sections
- Hero banner with program name and tagline
- Program overview paragraph (editable via admin)
- How it works: step-by-step participant journey
- Partner organization logos and links
- Volunteer opportunities for chapter brothers
- Upcoming program dates (pulled from Events module)
- CTA: "Get Support" and "Volunteer"

---

## 5. Alpha Legacy Group

### Route
`/alpha-legacy-group.html` or `/about/alpha-legacy-group`

### Purpose
Present the Alpha Legacy Group as a structured youth development initiative affiliated with Xi Tau Lambda Chapter, building a pipeline of college-ready young men committed to scholarship, service, and leadership.

### Overview Section
- Definition of the Alpha Legacy Group in the context of Xi Tau Lambda
- Target demographic: young men in middle school through high school
- Affiliation with the chapter and guidance from active brothers

### Mission Section
- Mission statement for the Alpha Legacy Group
- Core values: scholarship, service, brotherhood, leadership
- Relationship to Alpha Phi Alpha Fraternity, Inc. values

### Program Pillars Section
Each pillar presented as a card or icon block:

- **Scholarship** — Academic excellence, tutoring support, study skills, GPA benchmarks
- **Leadership** — Public speaking, civic engagement, youth governance, personal accountability
- **Service** — Community service hours, volunteer projects, chapter-led service days
- **Brotherhood** — Mentorship from chapter brothers, cohort bonding activities, character development
- **Health & Wellness** — Physical fitness, mental health awareness, healthy lifestyle education

### Scholarship Pipeline Section
- Description of how Alpha Legacy Group prepares members for scholarship eligibility
- Available scholarships through Xi Tau Lambda Chapter and Alpha Phi Alpha Fraternity, Inc.
- GPA and service-hour requirements for scholarship consideration
- Application timeline and process overview

### Community Engagement Section
- Chapter-hosted events involving Alpha Legacy Group members
- Joint service projects with the chapter
- Public-facing appearances and presentations at community events
- Partnerships with schools, faith organizations, and community nonprofits

### Integration with Xi Tau Lambda Section
- How chapter brothers serve as mentors and advisors
- Chapter oversight structure for the program
- Alumni involvement and success stories
- Pathway from Alpha Legacy Group to college and eventual fraternity consideration

### Expected Content Sections
- Full-width hero banner: program name, tagline, and representative imagery
- Mission statement block (editable via admin)
- Program pillars: icon grid with heading and description per pillar (editable via admin)
- Scholarship pipeline: formatted callout section with requirements and deadlines
- Photo gallery: events, service days, cohort activities
- Meet the Mentors: grid of participating chapter brothers (name, photo, brief bio)
- Upcoming events (pulled from Events module, filtered by Alpha Legacy Group tag)
- Enrollment CTA: "Apply Now" or "Learn More" with contact form or email link

---

## 6. UI/UX Requirements

### Dropdown Navigation

- Dropdown menus must use CSS transitions (opacity + translateY) with 200ms ease.
- No layout shift on dropdown open; menus must overlay content, not push it.
- Focus trap within open dropdown when navigated by keyboard.
- Close dropdown on outside click or Escape key.

### Mobile Responsiveness

- Breakpoints: 1024px (tablet), 768px (large mobile), 480px (small mobile).
- Navigation collapses to hamburger menu at 1024px and below.
- All dropdown and flyout menus convert to accordion-style expand/collapse on mobile.
- Touch targets minimum 44×44px per WCAG 2.1 AA.
- No horizontal scrolling at any breakpoint.

### Page Layout Expectations

- Max content width: 1200px, centered with 24px horizontal padding on mobile.
- Hero banners: full viewport width, minimum 400px height on desktop, 280px on mobile.
- Section padding: 90px top/bottom on desktop, 60px on tablet, 40px on mobile.
- Typography scale consistent with site globals: Playfair Display for headings, sans-serif body.
- Images: responsive, `max-width: 100%`, lazy-loaded, with meaningful `alt` text.

### Accessibility (WCAG 2.1 AA)

- All interactive elements reachable and operable via keyboard.
- Color contrast ratio minimum 4.5:1 for body text, 3:1 for large text and UI components.
- ARIA roles and labels on navigation: `role="navigation"`, `aria-label="About"`, `aria-expanded` on dropdowns.
- Skip-to-content link visible on keyboard focus at top of page.
- Images require descriptive `alt` attributes; decorative images use `alt=""`.
- Form inputs (enrollment, contact) must have associated `<label>` elements.
- No content conveyed by color alone.

### Branding

- Primary palette: Black (`#000000`) and Old Gold (`#C9A84C`).
- Accent: White (`#FFFFFF`) for text on dark backgrounds.
- Hover and active states use gold underline or gold border-left accent.
- Section backgrounds alternate between white and light gray (`#F5F5F5`) to create visual rhythm.
- Chapter crest and Alpha Phi Alpha Fraternity, Inc. marks used per brand guidelines; no distortion or recoloring.

---

## 7. Admin Dashboard Requirements

Each About sub-page must be fully editable via the admin dashboard without requiring a code deployment.

### Editable Pages
- History
- A Voteless People Is a Hopeless People
- Go-to-High School, Go-to-College
- Project Alpha
- Brother's Keeper
- Alpha Legacy Group

### Rich Text Editor
- WYSIWYG editor supporting: headings (H2–H4), bold, italic, unordered and ordered lists, hyperlinks, block quotes.
- Output stored as sanitized HTML in the `site_content` table keyed by page slug and section identifier.
- Preview mode: admin can preview changes before publishing.
- Publish / Save Draft controls on each section.

### Image Upload
- Per-section image upload with drag-and-drop support.
- Accepted formats: JPG, PNG, WebP. Maximum file size: 5MB.
- Images stored in Supabase Storage bucket; URL written to corresponding `site_content` row.
- Alt text field required before image can be saved.
- Gallery sections support multi-image upload and reordering via drag-and-drop.

### Version History
- Each content save creates a versioned record in a `content_versions` table storing: section key, content HTML, admin user ID, timestamp.
- Admin can view a list of prior versions for any section.
- Admin can restore any prior version with a single action (requires confirmation prompt).
- Minimum retention: 20 versions per section.

### Access Control
- Only users present in the `chapter_admins` table may access the content editor.
- Full admins (`is_full_admin = true`) may edit all sections.
- Section-scoped admins may only edit sections listed in their `sections` column.

---

## 8. Data & Integration Requirements

- All editable page content retrieved from Supabase `site_content` table using the `key` column as the section identifier.
- Events displayed on program sub-pages pulled from the `events` table, filtered by a `program_tag` or `category` column matching the program slug.
- Alpha Legacy Group enrollment and contact forms submit to a dedicated Supabase table (`legacy_group_inquiries`) and trigger a confirmation email via the `send-rsvp-confirmation` edge function.
- All pages must degrade gracefully if Supabase fetch fails: display last-known static fallback content rather than a blank section.

---

## 9. File & Route Map

| Page | File | Route |
|---|---|---|
| About Landing (optional) | `about.html` | `/about.html` |
| History | `history.html` | `/history.html` |
| National Programs Landing | `programs.html` | `/programs.html` |
| A Voteless People | `programs/voteless-people.html` | `/programs/voteless-people.html` |
| Go-to-High School | `programs/go-to-high-school.html` | `/programs/go-to-high-school.html` |
| Project Alpha | `programs/project-alpha.html` | `/programs/project-alpha.html` |
| Brother's Keeper | `programs/brothers-keeper.html` | `/programs/brothers-keeper.html` |
| Alpha Legacy Group | `alpha-legacy-group.html` | `/alpha-legacy-group.html` |
