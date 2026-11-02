/**
 * page-editor.js — Inline WYSIWYG page editor for North Dallas Alphas
 * When an admin is logged in, injects a floating "Edit Page" button on public pages.
 * Blocks can be edited in place, reordered by drag-and-drop, and new blocks added between existing ones.
 */
(function() {
  'use strict';

  var SUPABASE_URL = 'https://fbjervpgxnbyntylabfr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiamVydnBneG5ieW50eWxhYmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NzU1ODksImV4cCI6MjA5MjA1MTU4OX0.cMGLe14EDNivZHREWvmE7QMHjb4V_STx0Mfbx7AT4dg';

  var PAGE_KEY_MAP = {
    'index.html':      'page_blocks_home',
    '':                'page_blocks_home',
    '/':               'page_blocks_home',
    'events.html':     'page_blocks_events',
    'gallery.html':    'page_blocks_gallery',
    'leadership.html': 'page_blocks_leadership'
  };

  var _pePageKey = null;
  var _peBlocks = [];
  var _peEditMode = false;
  var _peDragIdx = null;
  var _peInsertIdx = null; // index to insert new block at
  var _pePopoverBlockId = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getAdminToken() {
    try {
      var s = localStorage.getItem('adminSession');
      if (!s) return null;
      var parsed = JSON.parse(s);
      return parsed && parsed.access_token ? parsed.access_token : null;
    } catch(e) { return null; }
  }

  function peEsc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function genId() {
    return 'b' + Date.now() + Math.random().toString(36).slice(2, 6);
  }

  function showToast(msg, type) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:' +
      (type === 'error' ? '#c0392b' : '#1a1a1a') +
      ';color:#fff;padding:10px 22px;border-radius:8px;font-size:0.88rem;font-weight:600;z-index:99999;border:1px solid ' +
      (type === 'error' ? '#e74c3c' : '#C9A84C') + ';box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  // ── CSS injection ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('pe-styles')) return;
    var s = document.createElement('style');
    s.id = 'pe-styles';
    s.textContent = [
      '.pe-block-wrap{position:relative;transition:outline 0.15s;}',
      '.pe-edit-active .pe-block-wrap:hover{outline:2px dashed #C9A84C;outline-offset:3px;}',
      '.pe-block-toolbar{position:absolute;top:8px;right:8px;display:none;gap:4px;z-index:100;background:rgba(0,0,0,0.6);border-radius:6px;padding:3px;}',
      '.pe-edit-active .pe-block-wrap:hover .pe-block-toolbar{display:flex;}',
      '.pe-tb-btn{background:rgba(0,0,0,0.8);color:#fff;border:none;border-radius:4px;padding:5px 9px;cursor:pointer;font-size:0.78rem;line-height:1;}',
      '.pe-tb-btn:hover{background:#C9A84C;color:#000;}',
      '.pe-add-zone{height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s;position:relative;}',
      '.pe-edit-active .pe-add-zone:hover{opacity:1;}',
      '.pe-add-zone::before,.pe-add-zone::after{content:"";flex:1;height:2px;background:#C9A84C;border-radius:1px;}',
      '.pe-add-zone-btn{background:#C9A84C;color:#000;border:none;border-radius:4px;padding:2px 12px;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap;margin:0 8px;}',
      '.pe-popover{position:fixed;background:#1a1a1a;border:1.5px solid #C9A84C;border-radius:10px;padding:20px;width:360px;max-width:92vw;z-index:10001;box-shadow:0 8px 40px rgba(0,0,0,0.7);max-height:80vh;overflow-y:auto;}',
      '.pe-popover label{display:block;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.45);margin-bottom:4px;margin-top:12px;}',
      '.pe-popover label:first-child{margin-top:0;}',
      '.pe-popover input,.pe-popover textarea,.pe-popover select{width:100%;padding:7px 10px;background:#2a2a2a;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:0.85rem;box-sizing:border-box;font-family:inherit;}',
      '.pe-popover textarea{resize:vertical;min-height:80px;}',
      '.pe-popover input:focus,.pe-popover textarea:focus,.pe-popover select:focus{outline:none;border-color:#C9A84C;}',
      '.pe-popover-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.1);}',
      '.pe-popover-title{font-size:0.82rem;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:0.07em;}',
      '.pe-popover-close{background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:1.2rem;cursor:pointer;padding:0;line-height:1;}',
      '.pe-popover-close:hover{color:#fff;}',
      '.pe-popover-actions{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);}',
      '.pe-btn-done{background:#C9A84C;color:#000;border:none;border-radius:6px;padding:8px 20px;font-size:0.85rem;font-weight:700;cursor:pointer;flex:1;}',
      '.pe-btn-done:hover{background:#d4b05a;}',
      '.pe-picker-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10002;display:flex;align-items:center;justify-content:center;}',
      '.pe-picker-box{background:#1a1a1a;border:1.5px solid #C9A84C;border-radius:12px;padding:28px;max-width:480px;width:92vw;}',
      '.pe-picker-title{font-size:1rem;font-weight:800;color:#fff;margin-bottom:6px;}',
      '.pe-picker-sub{font-size:0.8rem;color:rgba(255,255,255,0.4);margin-bottom:20px;}',
      '.pe-picker-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}',
      '.pe-picker-card{background:#2a2a2a;border:1.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px 12px;cursor:pointer;text-align:center;transition:border-color 0.15s,background 0.15s;}',
      '.pe-picker-card:hover{border-color:#C9A84C;background:rgba(201,168,76,0.08);}',
      '.pe-picker-card i{font-size:1.4rem;color:#C9A84C;display:block;margin-bottom:8px;}',
      '.pe-picker-card span{font-size:0.82rem;font-weight:700;color:#fff;}',
      '.pe-picker-cancel{background:transparent;border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.5);border-radius:6px;padding:8px 20px;cursor:pointer;font-size:0.82rem;width:100%;}',
      '.pe-drag-over-top{border-top:3px solid #C9A84C!important;}',
      '#pe-toolbar{padding-bottom:env(safe-area-inset-bottom,0);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Block rendering (mirrors public page logic) ────────────────────────────

  function peRenderBlockHtml(b) {
    if (!b || !b.type) return '';
    if (b.type === 'hero') {
      var bg = b.imageUrl
        ? 'background:linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url(' + peEsc(b.imageUrl) + ') center/cover no-repeat;'
        : 'background:#111;';
      return '<section style="' + bg + 'padding:80px 20px;text-align:center;color:#fff;">' +
        (b.heading ? '<h2 style="font-size:2.2rem;font-weight:800;margin:0 0 12px;color:#fff;">' + peEsc(b.heading) + '</h2>' : '') +
        (b.subtext ? '<p style="font-size:1.05rem;margin:0 0 24px;color:rgba(255,255,255,0.85);max-width:640px;margin-left:auto;margin-right:auto;">' + peEsc(b.subtext) + '</p>' : '') +
        (b.buttonText ? '<a href="' + peEsc(b.buttonUrl||'#') + '" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 28px;border-radius:6px;font-weight:700;text-decoration:none;">' + peEsc(b.buttonText) + '</a>' : '') +
        '</section>';
    }
    if (b.type === 'text') {
      return '<section style="padding:60px 20px;max-width:800px;margin:0 auto;">' +
        (b.heading ? '<h2 style="font-size:1.8rem;font-weight:800;color:#111;margin-bottom:16px;">' + peEsc(b.heading) + '</h2>' : '') +
        (b.body ? '<p style="font-size:1rem;color:#444;line-height:1.75;white-space:pre-wrap;">' + peEsc(b.body) + '</p>' : '') +
        '</section>';
    }
    if (b.type === 'image_text') {
      var dir = b.imagePosition === 'right' ? 'row-reverse' : 'row';
      return '<section style="padding:60px 20px;">' +
        '<div style="max-width:1000px;margin:0 auto;display:flex;flex-direction:' + dir + ';gap:40px;align-items:center;flex-wrap:wrap;">' +
        (b.imageUrl ? '<img src="' + peEsc(b.imageUrl) + '" style="width:100%;max-width:420px;border-radius:10px;object-fit:cover;flex-shrink:0;" />' : '<div style="width:420px;height:240px;background:#eee;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.85rem;">No image</div>') +
        '<div style="flex:1;min-width:260px;">' +
          (b.heading ? '<h2 style="font-size:1.8rem;font-weight:800;color:#111;margin-bottom:14px;">' + peEsc(b.heading) + '</h2>' : '') +
          (b.body ? '<p style="font-size:1rem;color:#444;line-height:1.75;white-space:pre-wrap;">' + peEsc(b.body) + '</p>' : '') +
        '</div></div></section>';
    }
    if (b.type === 'cta') {
      var ctaBg = b.bgColor || '#C9A84C';
      var ctaFg = (ctaBg.toLowerCase() === '#c9a84c' || ctaBg === '#C9A84C') ? '#000' : '#fff';
      return '<section style="background:' + peEsc(ctaBg) + ';padding:64px 20px;text-align:center;">' +
        (b.heading ? '<h2 style="font-size:2rem;font-weight:800;color:' + ctaFg + ';margin:0 0 10px;">' + peEsc(b.heading) + '</h2>' : '') +
        (b.subtext ? '<p style="font-size:1rem;color:' + ctaFg + ';opacity:0.85;max-width:600px;margin:0 auto 24px;">' + peEsc(b.subtext) + '</p>' : '') +
        (b.buttonText ? '<a href="' + peEsc(b.buttonUrl||'#') + '" style="display:inline-block;background:#000;color:#C9A84C;padding:12px 28px;border-radius:6px;font-weight:700;text-decoration:none;">' + peEsc(b.buttonText) + '</a>' : '') +
        '</section>';
    }
    return '';
  }

  // ── Render edit-mode blocks ────────────────────────────────────────────────

  function peRenderEditMode() {
    var container = document.getElementById('page-builder-blocks');
    if (!container) return;
    container.classList.add('pe-edit-active');

    var html = '';
    // Add-zone at the very top
    html += '<div class="pe-add-zone" data-insert="0"><button class="pe-add-zone-btn" onclick="peShowPicker(0)">+ Add Block</button></div>';

    _peBlocks.forEach(function(block, idx) {
      html += '<div class="pe-block-wrap" id="pe-wrap-' + peEsc(block.id) + '" draggable="true" ' +
        'ondragstart="peDragStart(event,' + idx + ')" ' +
        'ondragover="peDragOver(event,' + idx + ')" ' +
        'ondrop="peDrop(event,' + idx + ')" ' +
        'ondragleave="peDragLeave(event,' + idx + ')">' +
        // Block visual
        peRenderBlockHtml(block) +
        // Hover toolbar
        '<div class="pe-block-toolbar">' +
          '<span style="background:rgba(0,0,0,0.8);color:rgba(255,255,255,0.5);border-radius:4px;padding:5px 8px;cursor:grab;font-size:0.85rem;" title="Drag to reorder">⠿</span>' +
          '<button class="pe-tb-btn" onclick="peOpenPopover(\'' + peEsc(block.id) + '\')" title="Edit block"><i class="fas fa-pencil-alt"></i></button>' +
          '<button class="pe-tb-btn" onclick="peDeleteBlock(\'' + peEsc(block.id) + '\')" title="Delete block" style="color:#ff9090;"><i class="fas fa-times"></i></button>' +
        '</div>' +
      '</div>';
      // Add-zone after each block
      html += '<div class="pe-add-zone" data-insert="' + (idx + 1) + '"><button class="pe-add-zone-btn" onclick="peShowPicker(' + (idx + 1) + ')">+ Add Block</button></div>';
    });

    if (!_peBlocks.length) {
      html += '<div style="text-align:center;padding:60px 20px;">' +
        '<div style="font-size:2.5rem;color:rgba(201,168,76,0.3);margin-bottom:12px;"><i class="fas fa-cubes"></i></div>' +
        '<div style="font-size:0.9rem;color:#aaa;margin-bottom:16px;">No blocks on this page yet.</div>' +
        '<button onclick="peShowPicker(0)" style="background:#C9A84C;color:#000;border:none;border-radius:8px;padding:10px 22px;font-size:0.88rem;font-weight:700;cursor:pointer;"><i class="fas fa-plus"></i> Add First Block</button>' +
        '</div>';
    }

    container.innerHTML = html;
  }

  function peExitEditRender() {
    var container = document.getElementById('page-builder-blocks');
    if (!container) return;
    container.classList.remove('pe-edit-active');
    container.innerHTML = _peBlocks.map(peRenderBlockHtml).join('');
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  window.peDragStart = function(e, idx) {
    _peDragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  window.peDragOver = function(e, idx) {
    e.preventDefault();
    document.querySelectorAll('.pe-block-wrap').forEach(function(el) { el.classList.remove('pe-drag-over-top'); });
    var wrap = document.getElementById('pe-wrap-' + _peBlocks[idx].id);
    if (wrap) wrap.classList.add('pe-drag-over-top');
  };
  window.peDragLeave = function(e, idx) {
    var wrap = document.getElementById('pe-wrap-' + _peBlocks[idx].id);
    if (wrap) wrap.classList.remove('pe-drag-over-top');
  };
  window.peDrop = function(e, toIdx) {
    e.preventDefault();
    document.querySelectorAll('.pe-block-wrap').forEach(function(el) { el.classList.remove('pe-drag-over-top'); });
    if (_peDragIdx === null || _peDragIdx === toIdx) { _peDragIdx = null; return; }
    var moved = _peBlocks.splice(_peDragIdx, 1)[0];
    _peBlocks.splice(toIdx, 0, moved);
    _peDragIdx = null;
    peRenderEditMode();
  };

  // ── Block CRUD ─────────────────────────────────────────────────────────────

  window.peDeleteBlock = function(id) {
    peClosePopover();
    _peBlocks = _peBlocks.filter(function(b) { return b.id !== id; });
    peRenderEditMode();
  };

  var PB_DEFAULTS = {
    hero:       function(id) { return { id:id, type:'hero',       heading:'New Banner',   subtext:'',  buttonText:'', buttonUrl:'', imageUrl:'' }; },
    text:       function(id) { return { id:id, type:'text',       heading:'New Section',  body:'' }; },
    image_text: function(id) { return { id:id, type:'image_text', heading:'New Section',  body:'', imageUrl:'', imagePosition:'left' }; },
    cta:        function(id) { return { id:id, type:'cta',        heading:'Join Us',      subtext:'', buttonText:'Learn More', buttonUrl:'#', bgColor:'#C9A84C' }; }
  };

  window.peAddBlock = function(type, insertAt) {
    var id = genId();
    var block = PB_DEFAULTS[type] ? PB_DEFAULTS[type](id) : { id:id, type:type };
    if (insertAt === undefined || insertAt === null) insertAt = _peBlocks.length;
    _peBlocks.splice(insertAt, 0, block);
    peHidePicker();
    peRenderEditMode();
    peOpenPopover(id);
  };

  // ── Block picker modal ─────────────────────────────────────────────────────

  var _pePickerInsertAt = null;

  window.peShowPicker = function(insertAt) {
    _pePickerInsertAt = (insertAt !== undefined) ? insertAt : _peBlocks.length;
    peClosePopover();
    var existing = document.getElementById('pe-picker-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = 'pe-picker-overlay';
    overlay.className = 'pe-picker-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) peHidePicker(); };
    overlay.innerHTML = '<div class="pe-picker-box">' +
      '<div class="pe-picker-title">Add a Block</div>' +
      '<div class="pe-picker-sub">Choose the type of content to add</div>' +
      '<div class="pe-picker-grid">' +
        '<div class="pe-picker-card" onclick="peAddBlock(\'hero\',' + _pePickerInsertAt + ')"><i class="fas fa-image"></i><span>Hero / Banner</span></div>' +
        '<div class="pe-picker-card" onclick="peAddBlock(\'text\',' + _pePickerInsertAt + ')"><i class="fas fa-align-left"></i><span>Text Section</span></div>' +
        '<div class="pe-picker-card" onclick="peAddBlock(\'image_text\',' + _pePickerInsertAt + ')"><i class="fas fa-columns"></i><span>Image + Text</span></div>' +
        '<div class="pe-picker-card" onclick="peAddBlock(\'cta\',' + _pePickerInsertAt + ')"><i class="fas fa-bullhorn"></i><span>Call to Action</span></div>' +
      '</div>' +
      '<button class="pe-picker-cancel" onclick="peHidePicker()">Cancel</button>' +
    '</div>';
    document.body.appendChild(overlay);
  };

  window.peHidePicker = function() {
    var overlay = document.getElementById('pe-picker-overlay');
    if (overlay) overlay.parentNode.removeChild(overlay);
  };

  // ── Edit popover ───────────────────────────────────────────────────────────

  function pePopoverFields(block) {
    var html = '';
    function field(label, key, type, extra) {
      extra = extra || '';
      var val = peEsc(String(block[key] || ''));
      if (type === 'textarea') {
        return '<label>' + label + '</label><textarea data-field="' + key + '" ' + extra + '>' + val + '</textarea>';
      }
      if (type === 'select') {
        return '<label>' + label + '</label>' + extra;
      }
      return '<label>' + label + '</label><input type="' + type + '" data-field="' + key + '" value="' + val + '" ' + extra + ' />';
    }

    if (block.type === 'hero') {
      html += field('Heading', 'heading', 'text', 'placeholder="Main headline"');
      html += field('Subtext', 'subtext', 'textarea', 'rows="2" placeholder="Supporting text"');
      html += field('Button Text', 'buttonText', 'text', 'placeholder="e.g. Learn More"');
      html += field('Button URL', 'buttonUrl', 'text', 'placeholder="https://..."');
      html += field('Background Image URL', 'imageUrl', 'text', 'placeholder="https://..."');
    } else if (block.type === 'text') {
      html += field('Heading', 'heading', 'text', 'placeholder="Section heading"');
      html += field('Body Text', 'body', 'textarea', 'rows="5" placeholder="Your content here..."');
    } else if (block.type === 'image_text') {
      html += field('Heading', 'heading', 'text', 'placeholder="Section heading"');
      html += field('Body Text', 'body', 'textarea', 'rows="4" placeholder="Your content here..."');
      html += field('Image URL', 'imageUrl', 'text', 'placeholder="https://..."');
      var selVal = block.imagePosition === 'right' ? 'right' : 'left';
      html += '<label>Image Position</label><select data-field="imagePosition"><option value="left"' + (selVal==='left'?' selected':'') + '>Left</option><option value="right"' + (selVal==='right'?' selected':'') + '>Right</option></select>';
    } else if (block.type === 'cta') {
      html += field('Heading', 'heading', 'text', 'placeholder="Call to action heading"');
      html += field('Subtext', 'subtext', 'textarea', 'rows="2" placeholder="Supporting text"');
      html += field('Button Text', 'buttonText', 'text', 'placeholder="e.g. Sign Up"');
      html += field('Button URL', 'buttonUrl', 'text', 'placeholder="https://..."');
      html += field('Background Color', 'bgColor', 'text', 'placeholder="#C9A84C"');
    }
    return html;
  }

  var TYPE_LABELS = { hero:'Hero / Banner', text:'Text Section', image_text:'Image + Text', cta:'Call to Action' };

  window.peOpenPopover = function(blockId) {
    peClosePopover();
    var block = _peBlocks.find(function(b) { return b.id === blockId; });
    if (!block) return;
    _pePopoverBlockId = blockId;

    var pop = document.createElement('div');
    pop.className = 'pe-popover';
    pop.id = 'pe-popover';
    pop.innerHTML = '<div class="pe-popover-header">' +
      '<span class="pe-popover-title">' + (TYPE_LABELS[block.type] || block.type) + '</span>' +
      '<button class="pe-popover-close" onclick="peClosePopover()" title="Close">&times;</button>' +
    '</div>' +
    '<div id="pe-popover-fields">' + pePopoverFields(block) + '</div>' +
    '<div class="pe-popover-actions">' +
      '<button class="pe-btn-done" onclick="peClosePopover()"><i class="fas fa-check"></i> Done</button>' +
    '</div>';

    document.body.appendChild(pop);

    // Position near center-right, avoid toolbar
    pop.style.top = '60px';
    pop.style.right = '24px';

    // Wire up live-update on all fields
    pop.querySelectorAll('[data-field]').forEach(function(el) {
      el.addEventListener('input', function() {
        block[el.dataset.field] = el.value;
        // Re-render just this block's visual
        var wrap = document.getElementById('pe-wrap-' + blockId);
        if (wrap) {
          var toolbar = wrap.querySelector('.pe-block-toolbar');
          var toolbarHtml = toolbar ? toolbar.outerHTML : '';
          wrap.innerHTML = peRenderBlockHtml(block) + toolbarHtml;
        }
      });
    });
  };

  window.peClosePopover = function() {
    var pop = document.getElementById('pe-popover');
    if (pop) pop.parentNode.removeChild(pop);
    _pePopoverBlockId = null;
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  window.peSave = async function() {
    var token = getAdminToken();
    if (!token) { showToast('Admin session expired — please sign in again.', 'error'); return; }
    var btn = document.getElementById('pe-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/site_content?on_conflict=content_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + token,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ content_key: _pePageKey, content_json: _peBlocks, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('Page saved!');
    } catch(e) {
      showToast('Save failed: ' + (e.message || 'unknown error'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
    }
  };

  // ── Edit mode enter/exit ───────────────────────────────────────────────────

  function peEnterEditMode() {
    _peEditMode = true;

    // Remove launcher
    var launcher = document.getElementById('pe-launcher');
    if (launcher) launcher.style.display = 'none';

    // Inject toolbar
    var existing = document.getElementById('pe-toolbar');
    if (existing) existing.parentNode.removeChild(existing);
    var toolbar = document.createElement('div');
    toolbar.id = 'pe-toolbar';
    toolbar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a1a;border-top:2px solid #C9A84C;padding:12px 24px;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 20px rgba(0,0,0,0.5);';
    toolbar.innerHTML = '<span style="color:#C9A84C;font-weight:700;font-size:0.88rem;white-space:nowrap;"><i class="fas fa-edit"></i> Editing Page</span>' +
      '<button id="pe-add-top-btn" onclick="peShowPicker(' + _peBlocks.length + ')" style="background:rgba(201,168,76,0.15);border:1px dashed #C9A84C;color:#C9A84C;border-radius:6px;padding:7px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;"><i class="fas fa-plus"></i> Add Block</button>' +
      '<div style="margin-left:auto;display:flex;gap:8px;">' +
        '<button id="pe-save-btn" onclick="peSave()" style="background:#C9A84C;color:#000;border:none;border-radius:6px;padding:8px 20px;font-size:0.85rem;font-weight:700;cursor:pointer;"><i class="fas fa-save"></i> Save Changes</button>' +
        '<button id="pe-exit-btn" onclick="peExitEditMode()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.7);border-radius:6px;padding:8px 16px;font-size:0.85rem;cursor:pointer;">Exit Editing</button>' +
      '</div>';
    document.body.appendChild(toolbar);
    document.body.style.paddingBottom = '64px';

    peRenderEditMode();
  }

  window.peExitEditMode = function() {
    _peEditMode = false;
    peClosePopover();
    peHidePicker();

    var toolbar = document.getElementById('pe-toolbar');
    if (toolbar) toolbar.parentNode.removeChild(toolbar);
    document.body.style.paddingBottom = '';

    var launcher = document.getElementById('pe-launcher');
    if (launcher) launcher.style.display = '';

    peExitEditRender();
  };

  // ── Load blocks from Supabase ──────────────────────────────────────────────

  async function peLoadBlocks(pageKey) {
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/site_content?content_key=eq.' + encodeURIComponent(pageKey) + '&select=content_json&limit=1', {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
      });
      if (res.ok) {
        var rows = await res.json();
        if (rows && rows[0] && Array.isArray(rows[0].content_json)) {
          _peBlocks = rows[0].content_json;
        }
      }
    } catch(e) {}
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function peDetectPageKey() {
    var path = window.location.pathname;
    var file = path.split('/').pop() || '';
    if (!file || file === '/') file = 'index.html';
    return PAGE_KEY_MAP[file] || null;
  }

  function peInjectLauncher() {
    if (document.getElementById('pe-launcher')) return;
    var launcher = document.createElement('div');
    launcher.id = 'pe-launcher';
    launcher.style.cssText = 'position:fixed;bottom:80px;right:24px;z-index:9999;';
    launcher.innerHTML = '<button id="pe-edit-btn" onclick="peEnterEditMode()" style="background:#C9A84C;color:#000;border:none;border-radius:8px;padding:10px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.35);display:flex;align-items:center;gap:8px;"><i class="fas fa-edit"></i> Edit Page</button>';
    document.body.appendChild(launcher);
  }

  window.peEnterEditMode = async function() {
    // Reload blocks fresh from DB before entering edit mode
    if (_pePageKey) await peLoadBlocks(_pePageKey);
    peEnterEditMode();
  };

  function peInit() {
    var token = getAdminToken();
    if (!token) return; // Not an admin — no editor

    var pageKey = peDetectPageKey();
    if (!pageKey) return; // Unknown page

    _pePageKey = pageKey;

    injectStyles();
    peInjectLauncher();
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', peInit);
  } else {
    peInit();
  }

})();
