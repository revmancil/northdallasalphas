/* Shared news article defaults + rendering for index.html and news.html */
const NEWS_ARTICLES_CONTENT_KEY = 'news_articles';

const DEFAULT_NEWS_ARTICLES = [
  {
    title: 'Xi Tau Lambda Prepares to Celebrate 40 Years of Service',
    tag: 'Milestone',
    date: 'December 2023',
    image: 'images/chapter-event.jpg',
    excerpt: 'From pioneering the Sankofa Project to the Alpha Legacy Scholarship Gala, Xi Tau Lambda continues to shape North Dallas through leadership and service.',
    body: 'We have provided scholarships to young men entering college as well as resources for responsible choices through Project Alpha. In our community, we have brought valuable partnerships to our city through our commitment to arts education for youth, civic participation, and mentoring of young men who are seeking guidance and direction.\n\nFrom the Sankofa Project to the Alpha Legacy Scholarship Gala, four decades of Xi Tau Lambda represent a legacy of purpose-driven leadership that continues to shape North Dallas County.',
    placement: 'main',
    featured: true,
    published: true
  },
  {
    title: 'North Dallas Alphas Recognized in Frisco City Council',
    tag: 'Recognition',
    date: '2023',
    image: 'images/service.jpg?v=2',
    excerpt: 'The Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc. was formally recognized by the Frisco City Council for their outstanding contributions to the Frisco community.',
    body: 'The Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc. was formally recognized by the Frisco City Council for their outstanding contributions to the Frisco community through service, mentoring, and scholarship.',
    placement: 'main',
    featured: true,
    published: true
  },
  {
    title: 'MISD Impact Statement',
    tag: 'Community',
    date: 'December 2023',
    image: '',
    excerpt: 'Since 2019, the Xi Tau Lambda Chapter has been an avid supporter of MISD schools, students, and families.',
    body: 'Since 2019, the Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc. has been an avid supporter of MISD schools, students, and families. Their commitment to the district began on the campus of Scott Johnson Middle School (SJMS) and has since then grown in complexity and size.',
    placement: 'main',
    featured: true,
    published: true
  },
  {
    title: 'Alpha Legacy Scholarship Gala Funds Next Generation',
    tag: 'Scholarship',
    date: '2023',
    image: 'images/scholarship.jpg?v=2',
    excerpt: 'Proceeds from the annual gala support scholarships and mentoring across North Dallas County.',
    body: 'Proceeds from the annual Alpha Legacy Scholarship Gala support scholarships and mentoring programs that open doors for the next generation of scholars and leaders across North Dallas County.',
    placement: 'sidebar',
    featured: false,
    published: true
  },
  {
    title: '50 Years of Brotherhood Celebrated Nationwide',
    tag: 'Brotherhood',
    date: '2023',
    image: 'images/brotherhood.jpg?v=2',
    excerpt: 'Brothers across the nation marked a milestone of fellowship and service.',
    body: 'Brothers across the nation marked a milestone of fellowship and service, reflecting the enduring bonds of Alpha Phi Alpha.',
    placement: 'sidebar',
    featured: false,
    published: true
  },
  {
    title: 'Mentoring Program Expanded to Collin County Detention Center',
    tag: 'Service',
    date: '2023',
    image: 'images/service.jpg?v=2',
    excerpt: 'Xi Tau Lambda extended its Alpha Legacy mentoring program to reach young men at the John R. Roach Detention Center.',
    body: 'McKinney ISD invited the Xi Tau Lambda Chapter to deepen its commitment by extending its mentoring program to the young men of Collin County\'s John R. Roach Detention Center.',
    placement: 'sidebar',
    featured: false,
    published: true
  }
];

function newsEsc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeNewsArticle(article) {
  if (!article || typeof article !== 'object') return null;
  const placement = article.placement === 'sidebar' ? 'sidebar' : 'main';
  return {
    title: String(article.title || '').trim(),
    tag: String(article.tag || '').trim(),
    date: String(article.date || '').trim(),
    image: String(article.image || '').trim(),
    excerpt: String(article.excerpt || '').trim(),
    body: String(article.body || '').trim(),
    placement: placement,
    featured: !!article.featured,
    published: article.published !== false
  };
}

function normalizeNewsArticles(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw.map(normalizeNewsArticle).filter(Boolean);
}

async function fetchNewsArticles() {
  const url = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') +
    '/rest/v1/site_content?content_key=eq.' + encodeURIComponent(NEWS_ARTICLES_CONTENT_KEY) + '&select=content_json&limit=1';
  const key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key
      }
    });
    if (!res.ok) return DEFAULT_NEWS_ARTICLES.map(function(a) { return Object.assign({}, a); });
    const rows = await res.json();
    const normalized = rows && rows.length ? normalizeNewsArticles(rows[0].content_json) : null;
    if (!normalized || !normalized.length) {
      return DEFAULT_NEWS_ARTICLES.map(function(a) { return Object.assign({}, a); });
    }
    return normalized;
  } catch (err) {
    return DEFAULT_NEWS_ARTICLES.map(function(a) { return Object.assign({}, a); });
  }
}

function getPublishedNewsArticles(articles) {
  return (articles || []).filter(function(a) { return a && a.published !== false && a.title; });
}

function renderNewsBodyParagraphs(body, extraStyle) {
  const text = String(body || '').trim();
  if (!text) return '';
  const style = extraStyle ? ' style="' + extraStyle + '"' : '';
  return text.split(/\n\n+/).map(function(paragraph) {
    return '<p' + style + '>' + newsEsc(paragraph).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function renderNewsImageMarkup(image, alt, options) {
  const opts = options || {};
  if (image) {
    return '<img src="' + newsEsc(image) + '" alt="' + newsEsc(alt || '') + '" onerror="this.style.display=\'none\';" />';
  }
  if (opts.logoFallback) {
    return '<div style="background:var(--black);height:280px;display:flex;align-items:center;justify-content:center;">' +
      '<img src="images/xtl-logo.png" alt="Xi Tau Lambda Logo" style="height:140px;width:140px;object-fit:contain;opacity:0.7;" />' +
      '</div>';
  }
  return '';
}

function pickHomeNewsArticles(articles) {
  const published = getPublishedNewsArticles(articles);
  const featured = published.filter(function(a) { return a.featured; });
  const pool = featured.length
    ? featured.concat(published.filter(function(a) { return !a.featured; }))
    : published.slice();
  const picks = [];
  const seen = {};
  pool.forEach(function(article) {
    if (picks.length >= 3) return;
    const key = article.title || '';
    if (seen[key]) return;
    seen[key] = true;
    picks.push(article);
  });
  return picks;
}

function renderHomeNewsGrid(container, articles) {
  if (!container) return;
  const picks = pickHomeNewsArticles(articles);
  container.innerHTML = '';
  picks.forEach(function(article, idx) {
    const card = document.createElement('div');
    card.className = 'news-card fade-up' + (idx === 0 ? ' featured' : '');
    const imageBlock = article.image
      ? '<div class="news-card-img"><img src="' + newsEsc(article.image) + '" alt="' + newsEsc(article.title) + '" /></div>'
      : '<div class="news-card-img" style="background:var(--black);display:flex;align-items:center;justify-content:center;">' +
        '<img src="images/xtl-logo.png" alt="Xi Tau Lambda Chapter Logo" style="height:110px;width:110px;object-fit:contain;opacity:0.8;" />' +
        '</div>';
    card.innerHTML = imageBlock +
      '<div class="news-body">' +
        '<span class="news-tag">' + newsEsc(article.tag || 'News') + '</span>' +
        '<h3>' + newsEsc(article.title) + '</h3>' +
        '<p>' + newsEsc(article.excerpt || article.body) + '</p>' +
        (article.date ? '<span class="news-meta">' + newsEsc(article.date) + '</span>' : '') +
      '</div>';
    container.appendChild(card);
  });
  container.querySelectorAll('.fade-up').forEach(function(el) {
    el.classList.add('visible');
  });
}

function renderNewsPageLists(mainEl, sidebarEl, articles) {
  const published = getPublishedNewsArticles(articles);
  const mainArticles = published.filter(function(a) { return a.placement !== 'sidebar'; });
  const sidebarArticles = published.filter(function(a) { return a.placement === 'sidebar'; });

  if (mainEl) {
    mainEl.innerHTML = '';
    mainArticles.forEach(function(article) {
      const card = document.createElement('div');
      card.className = 'news-featured-card fade-up visible';
      const imageHtml = article.image
        ? '<img src="' + newsEsc(article.image) + '" alt="' + newsEsc(article.title) + '" />'
        : renderNewsImageMarkup('', article.title, { logoFallback: true });
      const bodyHtml = renderNewsBodyParagraphs(article.body || article.excerpt);
      card.innerHTML =
        imageHtml +
        '<div class="body">' +
          '<span class="news-tag">' + newsEsc(article.tag || 'News') + '</span>' +
          '<h2>' + newsEsc(article.title) + '</h2>' +
          bodyHtml +
          (article.date ? '<div style="margin-top:20px;font-size:0.82rem;color:var(--gray-400);">' + newsEsc(article.date) + '</div>' : '') +
        '</div>';
      mainEl.appendChild(card);
    });
  }

  if (sidebarEl) {
    sidebarEl.innerHTML = '';
    sidebarArticles.forEach(function(article) {
      const item = document.createElement('div');
      item.className = 'sidebar-item';
      const thumb = article.image
        ? '<img src="' + newsEsc(article.image) + '" alt="' + newsEsc(article.title) + '" />'
        : '<img src="images/xtl-logo.png" alt="' + newsEsc(article.title) + '" style="object-fit:contain;padding:8px;background:var(--black);" />';
      item.innerHTML = thumb +
        '<div class="info">' +
          '<div class="tag">' + newsEsc(article.tag || 'News') + '</div>' +
          '<h4>' + newsEsc(article.title) + '</h4>' +
        '</div>';
      sidebarEl.appendChild(item);
    });
  }
}
