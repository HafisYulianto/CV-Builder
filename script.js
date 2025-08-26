/*
 * Resume/CV Builder Online — Vanilla JS
 * - Live preview with two templates
 * - Three themes via CSS variables
 * - LocalStorage persistence
 * - PDF export (html2pdf.js)
 * - Optional Share (URL encoded JSON)
 * - Optional QR code in footer
 */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const state = {
  name: '', headline: '', email: '', phone: '', address: '', summary: '',
  website: '', linkedin: '', github: '', photo: '',
  education: [], experience: [], projects: [], skills: [],
  theme: 'blue', template: 'classic', showQR: false
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  bindCoreEvents();
  bootstrapFromStorageOrURL();
});

function cacheEls() {
  // form basics
  ['name','headline','email','phone','address','summary','website','linkedin','github','photo']
    .forEach(id => els[id] = document.getElementById(id));

  els.educationList = $('#educationList');
  els.experienceList = $('#experienceList');
  els.projectList = $('#projectList');
  els.skillInput = $('#skillInput');
  els.skillsChips = $('#skillsChips');

  els.templateSelect = $('#templateSelect');
  els.preview = $('#cvPreview');
  els.previewWrap = $('#previewWrap');

  els.darkToggle = $('#darkToggle');
  els.resetBtn = $('#resetBtn');
  els.downloadBtn = $('#downloadBtn');
  els.shareBtn = $('#shareBtn');
  els.exportBtn = $('#exportBtn');
  els.importFile = $('#importFile');
  els.addSkillBtn = $('#addSkillBtn');
  els.showQR = $('#showQR');
}

function bindCoreEvents() {
  // Text inputs update state
  ['name','headline','email','phone','address','summary','website','linkedin','github','photo']
    .forEach(id => {
      els[id].addEventListener('input', () => {
        state[id] = els[id].value.trim();
        render();
        persist();
      });
    });

  // Theme radios
  $$('input[name="theme"]').forEach(r => {
    r.addEventListener('change', () => {
      state.theme = r.value; applyTheme(); persist();
    });
  });

  // Template select
  els.templateSelect.addEventListener('change', () => {
    state.template = els.templateSelect.value; applyTemplate(); render(); persist();
  });

  // Dark mode toggle
  els.darkToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('cv.dark', document.documentElement.classList.contains('dark') ? '1' : '0');
  });

  // Reset
  els.resetBtn.addEventListener('click', () => {
    if (!confirm('Hapus semua data dan riwayat?')) return;
    localStorage.removeItem('cv.data');
    localStorage.removeItem('cv.dark');
    location.href = location.pathname; // hard reset
  });

  // PDF
  els.downloadBtn.addEventListener('click', downloadPDF);

  // Share (encode to URL)
  els.shareBtn.addEventListener('click', () => {
    const data = JSON.stringify(state);
    const base64 = btoa(unescape(encodeURIComponent(data)));
    const url = `${location.origin}${location.pathname}?data=${base64}`;
    navigator.clipboard.writeText(url).then(() => alert('Link disalin ke clipboard!')).catch(()=>{});
  });

  // Export JSON
  els.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cv-data-${(state.name||'user').toLowerCase().replace(/\s+/g,'-')}.json`;
    a.click();
  });

  // Import JSON
  els.importFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try { Object.assign(state, JSON.parse(text)); } catch(e){ alert('File tidak valid'); return; }
    hydrateFormFromState();
    applyTheme(); applyTemplate(); render(); persist();
  });

  // Skills input (Enter or button)
  els.skillInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSkillsFromInput(); }
  });
  els.addSkillBtn.addEventListener('click', addSkillsFromInput);

  // Dynamic lists buttons
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'add-education') addEducation();
    if (action === 'add-experience') addExperience();
    if (action === 'add-project') addProject();
    if (action === 'remove-item') removeItem(btn.dataset.section, +btn.dataset.index);
  });

  // Show QR toggle
  els.showQR.addEventListener('change', () => { state.showQR = els.showQR.checked; render(); persist(); });
}

function bootstrapFromStorageOrURL() {
  // Dark
  if (localStorage.getItem('cv.dark') === '1') document.documentElement.classList.add('dark');

  // URL data?
  const params = new URLSearchParams(location.search);
  const encoded = params.get('data');
  if (encoded) {
    try { Object.assign(state, JSON.parse(decodeURIComponent(escape(atob(encoded))))); }
    catch { /* ignore */ }
  } else {
    // Local storage
    const saved = localStorage.getItem('cv.data');
    if (saved) { try { Object.assign(state, JSON.parse(saved)); } catch{} }
  }

  hydrateFormFromState();
  applyTheme();
  applyTemplate();
  render();
}

function hydrateFormFromState() {
  ['name','headline','email','phone','address','summary','website','linkedin','github','photo']
    .forEach(id => els[id].value = state[id] || '');

  els.templateSelect.value = state.template || 'classic';
  $$('input[name="theme"]').forEach(r => r.checked = r.value === state.theme);

  els.showQR.checked = !!state.showQR;

  // Rebuild dynamic sections
  els.educationList.innerHTML = '';
  state.education.forEach((it, idx) => addEducation(it, idx));
  els.experienceList.innerHTML = '';
  state.experience.forEach((it, idx) => addExperience(it, idx));
  els.projectList.innerHTML = '';
  state.projects.forEach((it, idx) => addProject(it, idx));

  // Skills chips
  renderSkillChips();
}

function persist() { localStorage.setItem('cv.data', JSON.stringify(state)); }

/* ---------- Dynamic Sections ---------- */
function sectionItemTemplate(section, idx, values = {}) {
  const common = 'grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800';
  if (section === 'education') {
    return `<div class="${common}">
      <label>Institusi<input data-bind="institution" class="input" value="${esc(values.institution)}" placeholder="Universitas / Sekolah"/></label>
      <label>Jurusan<input data-bind="major" class="input" value="${esc(values.major)}" placeholder="Informatika"/></label>
      <label>Tahun Mulai<input data-bind="start" class="input" value="${esc(values.start)}" placeholder="2019"/></label>
      <label>Tahun Selesai<input data-bind="end" class="input" value="${esc(values.end)}" placeholder="2023"/></label>
      <label class="sm:col-span-2">Deskripsi<textarea data-bind="desc" class="input h-20" placeholder="Prestasi, fokus studi">${esc(values.desc)}</textarea></label>
      <div class="sm:col-span-2 flex justify-between">
        <span class="text-xs text-gray-500">Item #${idx+1}</span>
        <button class="btn-secondary" data-action="remove-item" data-section="education" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'experience') {
    return `<div class="${common}">
      <label>Posisi<input data-bind="role" class="input" value="${esc(values.role)}" placeholder="Frontend Developer"/></label>
      <label>Perusahaan/Organisasi<input data-bind="company" class="input" value="${esc(values.company)}" placeholder="Nama perusahaan"/></label>
      <label>Tahun Mulai<input data-bind="start" class="input" value="${esc(values.start)}" placeholder="2022"/></label>
      <label>Tahun Selesai<input data-bind="end" class="input" value="${esc(values.end)}" placeholder="2024 / Sekarang"/></label>
      <label class="sm:col-span-2">Deskripsi<textarea data-bind="desc" class="input h-20" placeholder="Tanggung jawab & pencapaian">${esc(values.desc)}</textarea></label>
      <div class="sm:col-span-2 flex justify-between">
        <span class="text-xs text-gray-500">Item #${idx+1}</span>
        <button class="btn-secondary" data-action="remove-item" data-section="experience" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'projects') {
    return `<div class="${common}">
      <label>Judul Project<input data-bind="title" class="input" value="${esc(values.title)}" placeholder="CV Builder"/></label>
      <label>Link (GitHub/Website)<input data-bind="link" class="input" value="${esc(values.link)}" placeholder="https://…"/></label>
      <label class="sm:col-span-2">Deskripsi<textarea data-bind="desc" class="input h-20" placeholder="Ringkasan singkat">${esc(values.desc)}</textarea></label>
      <div class="sm:col-span-2 flex justify-between">
        <span class="text-xs text-gray-500">Item #${idx+1}</span>
        <button class="btn-secondary" data-action="remove-item" data-section="projects" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
}

function addEducation(values = {}, idx = state.education.length) {
  state.education.splice(idx, 0, {
    institution: values.institution || '',
    major: values.major || '',
    start: values.start || '',
    end: values.end || '',
    desc: values.desc || ''
  });
  paintSection('education');
}
function addExperience(values = {}, idx = state.experience.length) {
  state.experience.splice(idx, 0, {
    role: values.role || '',
    company: values.company || '',
    start: values.start || '',
    end: values.end || '',
    desc: values.desc || ''
  });
  paintSection('experience');
}
function addProject(values = {}, idx = state.projects.length) {
  state.projects.splice(idx, 0, {
    title: values.title || '',
    link: values.link || '',
    desc: values.desc || ''
  });
  paintSection('projects');
}

function removeItem(section, idx) {
  if (section === 'education') state.education.splice(idx, 1);
  if (section === 'experience') state.experience.splice(idx, 1);
  if (section === 'projects') state.projects.splice(idx, 1);
  paintSection(section);
  render();
  persist();
}

function paintSection(section) {
  if (section === 'education') {
    els.educationList.innerHTML = state.education.map((it, i) => sectionItemTemplate('education', i, it)).join('');
    bindSectionInputs('education', els.educationList, state.education);
  }
  if (section === 'experience') {
    els.experienceList.innerHTML = state.experience.map((it, i) => sectionItemTemplate('experience', i, it)).join('');
    bindSectionInputs('experience', els.experienceList, state.experience);
  }
  if (section === 'projects') {
    els.projectList.innerHTML = state.projects.map((it, i) => sectionItemTemplate('projects', i, it)).join('');
    bindSectionInputs('projects', els.projectList, state.projects);
  }
  render();
  persist();
}

function bindSectionInputs(section, container, arrRef) {
  container.querySelectorAll('[data-bind]').forEach(input => {
    input.addEventListener('input', () => {
      const idx = Array.from(container.children).indexOf(input.closest('div'));
      const key = input.dataset.bind;
      arrRef[idx][key] = input.value;
      render();
      persist();
    });
  });
}

/* ---------- Skills ---------- */
function addSkillsFromInput() {
  const raw = els.skillInput.value.trim();
  if (!raw) return;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  state.skills.push(...parts);
  els.skillInput.value = '';
  renderSkillChips();
  render();
  persist();
}

function renderSkillChips() {
  els.skillsChips.innerHTML = '';
  state.skills.forEach((s, i) => {
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs';
    chip.style.borderColor = 'var(--primary)';
    chip.innerHTML = `${esc(s)} <button title="Hapus" class="ml-1">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      state.skills.splice(i,1); renderSkillChips(); render(); persist();
    });
    els.skillsChips.appendChild(chip);
  });
}

/* ---------- Theme & Template ---------- */
function applyTheme() {
  els.preview.classList.remove('theme-blue','theme-green','theme-gray');
  els.preview.classList.add(`theme-${state.theme}`);
}
function applyTemplate() {
  els.preview.classList.remove('template-classic','template-modern');
  els.preview.classList.add(`template-${state.template}`);
}

/* ---------- Render Preview ---------- */
function render() {
  const h = [];
  h.push('<div class="cv-page">');
  // Header
  h.push('<header class="cv-header">');
  h.push('<div>');
  h.push(`<div class="cv-name">${esc(state.name)||'Nama Lengkap'}</div>`);
  h.push(`<div class="cv-headline">${esc(state.headline)||'Jabatan / Headline'}</div>`);
  h.push('<div class="cv-meta">');
  if (state.email) h.push(`<span>✉️ ${esc(state.email)}</span>`);
  if (state.phone) h.push(`<span>📞 ${esc(state.phone)}</span>`);
  if (state.address) h.push(`<span>📍 ${esc(state.address)}</span>`);
  if (state.website) h.push(`<span>🔗 <a href="${esc(state.website)}" target="_blank" rel="noopener">Website</a></span>`);
  if (state.linkedin) h.push(`<span>💼 <a href="${esc(state.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></span>`);
  if (state.github) h.push(`<span>🐙 <a href="${esc(state.github)}" target="_blank" rel="noopener">GitHub</a></span>`);
  h.push('</div>');
  h.push('</div>');
  h.push('<div>');
  if (state.photo) h.push(`<img src="${esc(state.photo)}" alt="Foto" class="w-24 h-24 rounded-2xl object-cover border border-primary"/>`);
  h.push('</div>');
  h.push('</header>');

  // Summary
  if (state.summary) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Ringkasan</div>');
    h.push(`<div class="bubble text-sm leading-relaxed">${nl2br(esc(state.summary))}</div>`);
    h.push('</section>');
  }

  // Experience
  if (state.experience.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Pengalaman</div>');
    state.experience.forEach(it => {
      if (!(it.role || it.company || it.desc)) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.role||'')}${it.company? ' — '+esc(it.company):''}</div>`);
      h.push(`<div class="item-sub">${esc(it.start||'')}${it.end? ' – '+esc(it.end):''}</div>`);
      if (it.desc) h.push(`<div class="text-sm mt-1">${nl2br(esc(it.desc))}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }

  // Education
  if (state.education.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Pendidikan</div>');
    state.education.forEach(it => {
      if (!(it.institution || it.major || it.desc)) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.institution||'')}${it.major? ' — '+esc(it.major):''}</div>`);
      h.push(`<div class="item-sub">${esc(it.start||'')}${it.end? ' – '+esc(it.end):''}</div>`);
      if (it.desc) h.push(`<div class="text-sm mt-1">${nl2br(esc(it.desc))}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }

  // Projects
  if (state.projects.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Project</div>');
    state.projects.forEach(it => {
      if (!(it.title || it.desc)) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.title||'')}${it.link? ` — <a href="${esc(it.link)}" target="_blank" rel="noopener">Link</a>`:''}</div>`);
      if (it.desc) h.push(`<div class="text-sm mt-1">${nl2br(esc(it.desc))}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }

  // Skills
  if (state.skills.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Skill</div>');
    h.push('<div>');
    state.skills.forEach(s => h.push(`<span class="skill-chip" style="border-color: var(--primary); background: rgba(0,0,0,0.02)">${esc(s)}</span>`));
    h.push('</div>');
    h.push('</section>');
  }

  // QR Footer
  if (state.showQR && (state.linkedin || state.github)) {
    h.push('<div class="qr-wrap">');
    h.push('<div id="qrBox"></div>');
    h.push('</div>');
  }

  h.push('</div>');
  els.preview.innerHTML = h.join('');

  // Render QR if enabled
  if (state.showQR && (state.linkedin || state.github)) {
    const target = state.linkedin || state.github;
    const box = $('#qrBox', els.preview);
    if (box) new QRCode(box, { text: target, width: 72, height: 72 });
  }

  // Auto-scroll preview to bottom when content grows
  els.previewWrap.scrollTo({ top: els.previewWrap.scrollHeight, behavior: 'smooth' });
}

/* ---------- PDF ---------- */
async function downloadPDF() {
  const element = els.preview;
  const opt = {
    margin:       [10,10,10,10],
    filename:     `${(state.name||'CV').replace(/\s+/g,'_')}.pdf`,
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  await html2pdf().from(element).set(opt).save();
}

/* ---------- Helpers ---------- */
function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function nl2br(s='') { return s.replace(/\n/g, '<br>'); }
