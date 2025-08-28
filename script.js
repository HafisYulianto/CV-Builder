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
  certificates: [], languages: [], references: [],
  theme: 'blue', template: 'classic', showQR: false,
  qrCustom: ''
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  bindCoreEvents();
  bootstrapFromStorageOrURL();
  enableDragDrop();
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
  els.photoFile = document.getElementById('photoFile');
  els.photoPreview = document.getElementById('photoPreview');
  els.qrCustom = document.getElementById('qrCustom');
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
    if (action === 'add-certificate') addCertificate();
    if (action === 'add-language') addLanguage();
    if (action === 'add-reference') addReference();
    if (action === 'remove-item') removeItem(btn.dataset.section, +btn.dataset.index);
  });

  // Show QR toggle
  els.showQR.addEventListener('change', () => { state.showQR = els.showQR.checked; render(); persist(); });

  // Tombol bahasa
  document.getElementById('langId').addEventListener('click', () => setLang('id'));
  document.getElementById('langEn').addEventListener('click', () => setLang('en'));

  $('#previewDesktop').addEventListener('click', () => {
    els.preview.classList.remove('preview-mobile','preview-a4');
  });
  $('#previewMobile').addEventListener('click', () => {
    els.preview.classList.add('preview-mobile');
    els.preview.classList.remove('preview-a4');
  });
  $('#previewA4').addEventListener('click', () => {
    els.preview.classList.add('preview-a4');
    els.preview.classList.remove('preview-mobile');
  });

  ['name','email','website','linkedin','github','phone'].forEach(id => {
    els[id].addEventListener('blur', () => validateField(id));
  });

  if (els.photoFile) {
    els.photoFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar!');
        return;
      }
      const reader = new FileReader();
      reader.onload = function(ev) {
        state.photo = ev.target.result;
        renderPhotoPreview();
        render();
        persist();
      };
      reader.readAsDataURL(file);
    });
  }
};

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
  els.qrCustom.value = state.qrCustom || '';

  // Rebuild dynamic sections
  els.educationList.innerHTML = '';
  state.education.forEach((it, idx) => addEducation(it, idx));
  els.experienceList.innerHTML = '';
  state.experience.forEach((it, idx) => addExperience(it, idx));
  els.projectList.innerHTML = '';
  state.projects.forEach((it, idx) => addProject(it, idx));

  // Skills chips
  renderSkillChips();
  renderPhotoPreview();
}

function persist() { localStorage.setItem('cv.data', JSON.stringify(state)); }

/* ---------- Dynamic Sections ---------- */
function sectionItemTemplate(section, idx, values = {}) {
  const dragIcon = `<span class="cv-drag cursor-move select-none mr-2" title="Geser untuk urut">☰</span>`;
  const common = 'grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800';
  if (section === 'education') {
    return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800">
      <div class="sm:col-span-2 flex items-center mb-2">${dragIcon}<span class="text-xs text-gray-500">Item #${idx+1}</span></div>
      <label>Institusi<input data-bind="institution" class="input" value="${esc(values.institution)}" placeholder="Universitas / Sekolah"/></label>
      <label>Jurusan<input data-bind="major" class="input" value="${esc(values.major)}" placeholder="Informatika"/></label>
      <label>Tahun Mulai<input data-bind="start" class="input" value="${esc(values.start)}" placeholder="2019"/></label>
      <label>Tahun Selesai<input data-bind="end" class="input" value="${esc(values.end)}" placeholder="2023"/></label>
      <label class="sm:col-span-2">Deskripsi<textarea data-bind="desc" class="input h-20" placeholder="Prestasi, fokus studi">${esc(values.desc)}</textarea></label>
      <div class="sm:col-span-2 flex justify-end">
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
  if (section === 'certificates') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Nama Sertifikat<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Nama Sertifikat"/></label>
      <label>Penerbit<input data-bind="issuer" class="input" value="${esc(values.issuer)}" placeholder="Penerbit"/></label>
      <label>Tahun<input data-bind="year" class="input" value="${esc(values.year)}" placeholder="2024"/></label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="certificates" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'languages') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Bahasa<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Bahasa"/></label>
      <label>Tingkat
        <select data-bind="level" class="input">
          <option value="Dasar"${values.level==='Dasar'?' selected':''}>Dasar</option>
          <option value="Menengah"${values.level==='Menengah'?' selected':''}>Menengah</option>
          <option value="Lancar"${values.level==='Lancar'?' selected':''}>Lancar</option>
        </select>
      </label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="languages" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'references') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Nama<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Nama"/></label>
      <label>Kontak<input data-bind="contact" class="input" value="${esc(values.contact)}" placeholder="Email/HP"/></label>
      <label>Perusahaan<input data-bind="company" class="input" value="${esc(values.company)}" placeholder="Perusahaan"/></label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="references" data-index="${idx}">Hapus</button>
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
function addCertificate(values = {}, idx = state.certificates.length) {
  state.certificates.splice(idx, 0, {
    name: values.name || '',
    issuer: values.issuer || '',
    year: values.year || ''
  });
  paintSection('certificates');
}
function addLanguage(values = {}, idx = state.languages.length) {
  state.languages.splice(idx, 0, {
    name: values.name || '',
    level: values.level || 'Dasar'
  });
  paintSection('languages');
}
function addReference(values = {}, idx = state.references.length) {
  state.references.splice(idx, 0, {
    name: values.name || '',
    contact: values.contact || '',
    company: values.company || ''
  });
  paintSection('references');
}

function removeItem(section, idx) {
  if (section === 'education') state.education.splice(idx, 1);
  if (section === 'experience') state.experience.splice(idx, 1);
  if (section === 'projects') state.projects.splice(idx, 1);
  if (section === 'certificates') state.certificates.splice(idx, 1);
  if (section === 'languages') state.languages.splice(idx, 1);
  if (section === 'references') state.references.splice(idx, 1);
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
  if (section === 'certificates') {
    els.certificateList.innerHTML = state.certificates.map((it, i) => sectionItemTemplate('certificates', i, it)).join('');
    bindSectionInputs('certificates', els.certificateList, state.certificates);
  }
  if (section === 'languages') {
    els.languageList.innerHTML = state.languages.map((it, i) => sectionItemTemplate('languages', i, it)).join('');
    bindSectionInputs('languages', els.languageList, state.languages);
  }
  if (section === 'references') {
    els.referenceList.innerHTML = state.references.map((it, i) => sectionItemTemplate('references', i, it)).join('');
    bindSectionInputs('references', els.referenceList, state.references);
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
    chip.innerHTML = `<span class="cv-drag cursor-move select-none mr-1" title="Geser untuk urut">☰</span>${esc(s)} <button title="Hapus" class="ml-1">✕</button>`;
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
  els.preview.classList.remove('template-classic','template-modern','template-elegant','template-minimalist');
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

  // Certificates
  if (state.certificates.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Sertifikat</div>');
    state.certificates.forEach(it => {
      if (!(it.name || it.issuer)) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.name||'')}</div>`);
      h.push(`<div class="item-sub">${esc(it.issuer||'')}${it.year? ' – '+esc(it.year):''}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }
  // Languages
  if (state.languages.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Bahasa</div>');
    state.languages.forEach(it => {
      if (!it.name) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.name||'')}</div>`);
      h.push(`<div class="item-sub">${esc(it.level||'')}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }
  // References
  if (state.references.length) {
    h.push('<section class="cv-section">');
    h.push('<div class="cv-sec-title">Referensi</div>');
    state.references.forEach(it => {
      if (!it.name) return;
      h.push('<div class="bubble mb-2">');
      h.push(`<div class="item-title">${esc(it.name||'')}</div>`);
      h.push(`<div class="item-sub">${esc(it.company||'')} ${esc(it.contact||'')}</div>`);
      h.push('</div>');
    });
    h.push('</section>');
  }
  // QR Footer
  if (state.showQR && (state.qrCustom || state.linkedin || state.github)) {
    h.push('<div class="qr-wrap">');
    h.push('<div id="qrBox"></div>');
    h.push('</div>');
  }

  h.push('</div>');
  els.preview.innerHTML = h.join('');

  // Render QR if enabled
  if (state.showQR && (state.qrCustom || state.linkedin || state.github)) {
    const target = state.qrCustom || state.linkedin || state.github;
    const box = $('#qrBox', els.preview);
    if (box) {
      box.innerHTML = '';
      new QRCode(box, { text: target, width: 72, height: 72 });
    }
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

const LANG = {
  id: {
    name: "Nama wajib diisi",
    email: "Format email tidak valid",
    phone: "Nomor HP tidak valid",
    website: "URL tidak valid",
    linkedin: "URL LinkedIn tidak valid",
    github: "URL GitHub tidak valid",
    required: "Wajib diisi",
    // Label
    label_name: "Nama",
    label_headline: "Jabatan / Headline",
    label_email: "Email",
    label_phone: "No. HP",
    label_address: "Alamat",
    label_summary: "Ringkasan Profil",
    label_website: "Website/Portofolio",
    label_linkedin: "LinkedIn",
    label_github: "GitHub",
    label_photo: "Foto (URL opsional)",
    // ...tambahkan label lain sesuai kebutuhan
  },
  en: {
    name: "Name is required",
    email: "Invalid email format",
    phone: "Invalid phone number",
    website: "Invalid URL",
    linkedin: "Invalid LinkedIn URL",
    github: "Invalid GitHub URL",
    required: "Required",
    // Label
    label_name: "Name",
    label_headline: "Headline / Position",
    label_email: "Email",
    label_phone: "Phone",
    label_address: "Address",
    label_summary: "Profile Summary",
    label_website: "Website/Portfolio",
    label_linkedin: "LinkedIn",
    label_github: "GitHub",
    label_photo: "Photo (optional URL)",
    // ...add more as needed
  }
};

let currentLang = 'id';

function setLang(lang) {
  currentLang = lang;
  // Ganti label form
  document.querySelector('label[for="name"]')?.childNodes[0] && (document.querySelector('label[for="name"]').childNodes[0].textContent = LANG[lang].label_name);
  // Lakukan hal yang sama untuk label lain, atau gunakan pendekatan querySelectorAll dan mapping
  // Atau, untuk lebih baik, gunakan data-label="name" pada label dan lakukan loop
  document.querySelectorAll('[data-label]').forEach(el => {
    const key = el.getAttribute('data-label');
    el.childNodes[0].textContent = LANG[lang][`label_${key}`];
  });
  // Ganti placeholder jika perlu
  // ...
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  // ...existing code...
  // Tombol bahasa
  document.getElementById('langId').addEventListener('click', () => setLang('id'));
  document.getElementById('langEn').addEventListener('click', () => setLang('en'));
  // ...existing code...
});

// Validasi dengan feedback error
function validateField(id) {
  const el = els[id];
  let valid = true;
  let msg = '';
  if (id === 'name' && !el.value.trim()) {
    valid = false; msg = LANG[currentLang].name;
  }
  if (id === 'email' && el.value && !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(el.value)) {
    valid = false; msg = LANG[currentLang].email;
  }
  if (['website','linkedin','github'].includes(id) && el.value && !/^https?:\/\/.+\..+/.test(el.value)) {
    valid = false; msg = LANG[currentLang][id];
  }
  if (id === 'phone' && el.value && !/^[0-9+\s()-]{8,}$/.test(el.value)) {
    valid = false; msg = LANG[currentLang].phone;
  }
  el.classList.toggle('border-red-500', !valid);
  el.classList.toggle('border-primary', valid);
  const errorDiv = document.getElementById('error-' + id);
  if (errorDiv) errorDiv.textContent = !valid ? msg : '';
  return valid;
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
    if (action === 'add-certificate') addCertificate();
    if (action === 'add-language') addLanguage();
    if (action === 'add-reference') addReference();
    if (action === 'remove-item') removeItem(btn.dataset.section, +btn.dataset.index);
  });

  // Show QR toggle
  els.showQR.addEventListener('change', () => { state.showQR = els.showQR.checked; render(); persist(); });

  // Tombol bahasa
  document.getElementById('langId').addEventListener('click', () => setLang('id'));
  document.getElementById('langEn').addEventListener('click', () => setLang('en'));

  $('#previewDesktop').addEventListener('click', () => {
    els.preview.classList.remove('preview-mobile','preview-a4');
  });
  $('#previewMobile').addEventListener('click', () => {
    els.preview.classList.add('preview-mobile');
    els.preview.classList.remove('preview-a4');
  });
  $('#previewA4').addEventListener('click', () => {
    els.preview.classList.add('preview-a4');
    els.preview.classList.remove('preview-mobile');
  });

  ['name','email','website','linkedin','github','phone'].forEach(id => {
    els[id].addEventListener('blur', () => validateField(id));
  });

  if (els.photoFile) {
    els.photoFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar!');
        return;
      }
      const reader = new FileReader();
      reader.onload = function(ev) {
        state.photo = ev.target.result;
        renderPhotoPreview();
        render();
        persist();
      };
      reader.readAsDataURL(file);
    });
  }
}

// Drag and Drop functionality
function enableDragDrop() {
  // Education
  new Sortable(els.educationList, {
    animation: 150,
    handle: '.cv-drag',
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const moved = state.education.splice(evt.oldIndex, 1)[0];
      state.education.splice(evt.newIndex, 0, moved);
      paintSection('education');
      render();
      persist();
    }
  });
  // Experience
  new Sortable(els.experienceList, {
    animation: 150,
    handle: '.cv-drag',
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const moved = state.experience.splice(evt.oldIndex, 1)[0];
      state.experience.splice(evt.newIndex, 0, moved);
      paintSection('experience');
      render();
      persist();
    }
  });
  // Skills (chips)
  new Sortable(els.skillsChips, {
    animation: 150,
    onEnd: function (evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const moved = state.skills.splice(evt.oldIndex, 1)[0];
      state.skills.splice(evt.newIndex, 0, moved);
      renderSkillChips();
      render();
      persist();
    }
  });
}

// Tambahkan ikon drag di template section
function sectionItemTemplate(section, idx, values = {}) {
  const dragIcon = `<span class="cv-drag cursor-move select-none mr-2" title="Geser untuk urut">☰</span>`;
  const common = 'grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800';
  if (section === 'education') {
    return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800">
      <div class="sm:col-span-2 flex items-center mb-2">${dragIcon}<span class="text-xs text-gray-500">Item #${idx+1}</span></div>
      <label>Institusi<input data-bind="institution" class="input" value="${esc(values.institution)}" placeholder="Universitas / Sekolah"/></label>
      <label>Jurusan<input data-bind="major" class="input" value="${esc(values.major)}" placeholder="Informatika"/></label>
      <label>Tahun Mulai<input data-bind="start" class="input" value="${esc(values.start)}" placeholder="2019"/></label>
      <label>Tahun Selesai<input data-bind="end" class="input" value="${esc(values.end)}" placeholder="2023"/></label>
      <label class="sm:col-span-2">Deskripsi<textarea data-bind="desc" class="input h-20" placeholder="Prestasi, fokus studi">${esc(values.desc)}</textarea></label>
      <div class="sm:col-span-2 flex justify-end">
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
  if (section === 'certificates') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Nama Sertifikat<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Nama Sertifikat"/></label>
      <label>Penerbit<input data-bind="issuer" class="input" value="${esc(values.issuer)}" placeholder="Penerbit"/></label>
      <label>Tahun<input data-bind="year" class="input" value="${esc(values.year)}" placeholder="2024"/></label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="certificates" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'languages') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Bahasa<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Bahasa"/></label>
      <label>Tingkat
        <select data-bind="level" class="input">
          <option value="Dasar"${values.level==='Dasar'?' selected':''}>Dasar</option>
          <option value="Menengah"${values.level==='Menengah'?' selected':''}>Menengah</option>
          <option value="Lancar"${values.level==='Lancar'?' selected':''}>Lancar</option>
        </select>
      </label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="languages" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
  if (section === 'references') {
    return `<div class="bubble flex flex-col gap-2">
      <label>Nama<input data-bind="name" class="input" value="${esc(values.name)}" placeholder="Nama"/></label>
      <label>Kontak<input data-bind="contact" class="input" value="${esc(values.contact)}" placeholder="Email/HP"/></label>
      <label>Perusahaan<input data-bind="company" class="input" value="${esc(values.company)}" placeholder="Perusahaan"/></label>
      <div class="flex justify-end">
        <button class="btn-secondary" data-action="remove-item" data-section="references" data-index="${idx}">Hapus</button>
      </div>
    </div>`;
  }
}
