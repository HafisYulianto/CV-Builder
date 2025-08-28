/*
 * Resume/CV Builder Online — FINAL
 * - Tema ditempel ke <html> + preview
 * - Ringkasan justify (pakai paragraf)
 * - Defensive binding, drag&drop, foto dikompres, persist throttled
 * - html2pdf & qrcode lazy-load
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

/* ---------- Cache elements ---------- */
function cacheEls() {
  ['name','headline','email','phone','address','summary','website','linkedin','github']
    .forEach(id => els[id] = document.getElementById(id));

  els.educationList = $('#educationList');
  els.experienceList = $('#experienceList');
  els.projectList    = $('#projectList');
  els.skillInput     = $('#skillInput');
  els.skillsChips    = $('#skillsChips');

  els.templateSelect = $('#templateSelect');
  els.preview        = $('#cvPreview');
  els.previewWrap    = $('#previewWrap');

  els.darkToggle   = $('#darkToggle');
  els.resetBtn     = $('#resetBtn');
  els.downloadBtn  = $('#downloadBtn');
  els.shareBtn     = $('#shareBtn');
  els.exportBtn    = $('#exportBtn');
  els.importFile   = $('#importFile');
  els.addSkillBtn  = $('#addSkillBtn');
  els.showQR       = $('#showQR');
  els.photoFile    = $('#photoFile');
  els.photoPreview = $('#photoPreview');
  els.qrCustom     = $('#qrCustom');

  els.certificateList = $('#certificateList');
  els.languageList    = $('#languageList');
  els.referenceList   = $('#referenceList');

  els.previewDesktop = $('#previewDesktop');
  els.previewMobile  = $('#previewMobile');
  els.previewA4      = $('#previewA4');
}

/* ---------- Events ---------- */
function bindCoreEvents() {
  // Form inputs → state
  ['name','headline','email','phone','address','summary','website','linkedin','github']
    .forEach(id => {
      const el = els[id];
      if (!el) return;
      el.addEventListener('input', () => {
        state[id] = el.value.trim();
        render(); persist();
      });
    });

  // Theme radios
  $$('input[name="theme"]').forEach(r => {
    r.addEventListener('change', () => {
      state.theme = r.value; applyTheme(); persist();
    });
  });

  // Template select
  if (els.templateSelect) {
    els.templateSelect.addEventListener('change', () => {
      state.template = els.templateSelect.value; applyTemplate(); render(); persist();
    });
  }

  // Dark mode
  if (els.darkToggle) {
    els.darkToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('cv.dark', document.documentElement.classList.contains('dark') ? '1' : '0');
    });
  }

  // Reset
  if (els.resetBtn) {
    els.resetBtn.addEventListener('click', () => {
      if (!confirm('Hapus semua data dan riwayat?')) return;
      localStorage.removeItem('cv.data');
      localStorage.removeItem('cv.dark');
      location.href = location.pathname;
    });
  }

  // PDF
  if (els.downloadBtn) els.downloadBtn.addEventListener('click', downloadPDF);

  // Share link
  if (els.shareBtn) {
    els.shareBtn.addEventListener('click', () => {
      const data = JSON.stringify(state);
      const base64 = btoa(unescape(encodeURIComponent(data)));
      const url = `${location.origin}${location.pathname}?data=${base64}`;
      navigator.clipboard.writeText(url).then(() => alert('Link disalin ke clipboard!')).catch(()=>{});
    });
  }

  // Export JSON
  if (els.exportBtn) {
    els.exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cv-data-${(state.name||'user').toLowerCase().replace(/\s+/g,'-')}.json`;
      a.click();
    });
  }

  // Import JSON
  if (els.importFile) {
    els.importFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try { Object.assign(state, JSON.parse(text)); }
      catch { alert('File tidak valid'); return; }
      hydrateFormFromState();
      applyTheme(); applyTemplate(); render(); persist();
      e.target.value = '';
    });
  }

  // Skills
  if (els.skillInput) {
    els.skillInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSkillsFromInput(); }
    });
  }
  if (els.addSkillBtn) els.addSkillBtn.addEventListener('click', addSkillsFromInput);

  // Delegasi tombol dinamis
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'add-education')  addEducation();
    if (action === 'add-experience') addExperience();
    if (action === 'add-project')    addProject();
    if (action === 'add-certificate')addCertificate();
    if (action === 'add-language')   addLanguage();
    if (action === 'add-reference')  addReference();
    if (action === 'remove-item')    removeItem(btn.dataset.section, +btn.dataset.index);
  });

  // Fallback direct bind (jaga-jaga)
  const btnAddCert = $('button[data-action="add-certificate"]');
  if (btnAddCert) btnAddCert.addEventListener('click', (e)=>{ e.preventDefault(); addCertificate(); });
  const btnAddLang = $('button[data-action="add-language"]');
  if (btnAddLang) btnAddLang.addEventListener('click', (e)=>{ e.preventDefault(); addLanguage(); });
  const btnAddRef  = $('button[data-action="add-reference"]');
  if (btnAddRef)  btnAddRef.addEventListener('click', (e)=>{ e.preventDefault(); addReference(); });

  // QR toggle & custom link
  if (els.showQR) els.showQR.addEventListener('change', () => { state.showQR = els.showQR.checked; render(); persist(); });
  if (els.qrCustom) els.qrCustom.addEventListener('input', () => { state.qrCustom = els.qrCustom.value.trim(); render(); persist(); });

  // Preview size
  if (els.previewDesktop) els.previewDesktop.addEventListener('click', () => {
    els.preview.classList.remove('preview-mobile','preview-a4');
  });
  if (els.previewMobile) els.previewMobile.addEventListener('click', () => {
    els.preview.classList.add('preview-mobile');
    els.preview.classList.remove('preview-a4');
  });
  if (els.previewA4) els.previewA4.addEventListener('click', () => {
    els.preview.classList.add('preview-a4');
    els.preview.classList.remove('preview-mobile');
  });

  // Validasi ringkas on blur
  ['name','email','website','linkedin','github','phone'].forEach(id => {
    const el = els[id]; if (!el) return;
    el.addEventListener('blur', () => validateField(id));
  });

  // Upload foto (resize dulu)
  if (els.photoFile) {
    els.photoFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('File harus berupa gambar!'); return; }
      try {
        const smallDataURL = await resizeImage(file, 512, 0.85);
        state.photo = smallDataURL;
        renderPhotoPreview();
        render();
        persist();
      } catch {
        alert('Gagal memproses gambar');
      }
    });
  }
}

/* ---------- Bootstrapping ---------- */
function bootstrapFromStorageOrURL() {
  if (localStorage.getItem('cv.dark') === '1') document.documentElement.classList.add('dark');

  const params = new URLSearchParams(location.search);
  const encoded = params.get('data');
  if (encoded) {
    try { Object.assign(state, JSON.parse(decodeURIComponent(escape(atob(encoded))))); }
    catch {}
  } else {
    const saved = localStorage.getItem('cv.data');
    if (saved) { try { Object.assign(state, JSON.parse(saved)); } catch{} }
  }

  hydrateFormFromState();
  applyTheme();
  applyTemplate();
  render();
}

function hydrateFormFromState() {
  ['name','headline','email','phone','address','summary','website','linkedin','github']
    .forEach(id => { if (els[id]) els[id].value = state[id] || ''; });

  if (els.templateSelect) els.templateSelect.value = state.template || 'classic';
  $$('input[name="theme"]').forEach(r => r.checked = r.value === state.theme);

  if (els.showQR) els.showQR.checked = !!state.showQR;
  if (els.qrCustom) els.qrCustom.value = state.qrCustom || '';

  // Rebuild dynamic sections
  if (els.educationList) { els.educationList.innerHTML = ''; state.education.forEach((it, idx) => addEducation(it, idx)); }
  if (els.experienceList) { els.experienceList.innerHTML = ''; state.experience.forEach((it, idx) => addExperience(it, idx)); }
  if (els.projectList)    { els.projectList.innerHTML    = ''; state.projects.forEach((it, idx) => addProject(it, idx)); }

  renderSkillChips();
  renderPhotoPreview();

  paintSection('certificates');
  paintSection('languages');
  paintSection('references');
}

/* ---------- Persist (throttled) ---------- */
let __persistTimer = null;
function persist() {
  clearTimeout(__persistTimer);
  __persistTimer = setTimeout(() => {
    localStorage.setItem('cv.data', JSON.stringify(state));
  }, 250);
}

/* ---------- Dynamic Sections ---------- */
function sectionItemTemplate(section, idx, values = {}) {
  const dragIcon = `<span class="cv-drag cursor-move select-none mr-2" title="Geser untuk urut">☰</span>`;
  const common = 'grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl dark:bg-gray-800';

  if (section === 'education') {
    return `<div class="${common}">
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
  state.education.splice(idx, 0, { institution: values.institution || '', major: values.major || '', start: values.start || '', end: values.end || '', desc: values.desc || '' });
  paintSection('education');
}
function addExperience(values = {}, idx = state.experience.length) {
  state.experience.splice(idx, 0, { role: values.role || '', company: values.company || '', start: values.start || '', end: values.end || '', desc: values.desc || '' });
  paintSection('experience');
}
function addProject(values = {}, idx = state.projects.length) {
  state.projects.splice(idx, 0, { title: values.title || '', link: values.link || '', desc: values.desc || '' });
  paintSection('projects');
}
function addCertificate(values = {}, idx = state.certificates.length) {
  state.certificates.splice(idx, 0, { name: values.name || '', issuer: values.issuer || '', year: values.year || '' });
  paintSection('certificates');
}
function addLanguage(values = {}, idx = state.languages.length) {
  state.languages.splice(idx, 0, { name: values.name || '', level: values.level || 'Dasar' });
  paintSection('languages');
}
function addReference(values = {}, idx = state.references.length) {
  state.references.splice(idx, 0, { name: values.name || '', contact: values.contact || '', company: values.company || '' });
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
  render(); persist();
}

function paintSection(section) {
  if (section === 'education' && els.educationList) {
    els.educationList.innerHTML = state.education.map((it, i) => sectionItemTemplate('education', i, it)).join('');
    bindSectionInputs('education', els.educationList, state.education);
  }
  if (section === 'experience' && els.experienceList) {
    els.experienceList.innerHTML = state.experience.map((it, i) => sectionItemTemplate('experience', i, it)).join('');
    bindSectionInputs('experience', els.experienceList, state.experience);
  }
  if (section === 'projects' && els.projectList) {
    els.projectList.innerHTML = state.projects.map((it, i) => sectionItemTemplate('projects', i, it)).join('');
    bindSectionInputs('projects', els.projectList, state.projects);
  }
  if (section === 'certificates' && els.certificateList) {
    els.certificateList.innerHTML = state.certificates.map((it, i) => sectionItemTemplate('certificates', i, it)).join('');
    bindSectionInputs('certificates', els.certificateList, state.certificates);
  }
  if (section === 'languages' && els.languageList) {
    els.languageList.innerHTML = state.languages.map((it, i) => sectionItemTemplate('languages', i, it)).join('');
    bindSectionInputs('languages', els.languageList, state.languages);
  }
  if (section === 'references' && els.referenceList) {
    els.referenceList.innerHTML = state.references.map((it, i) => sectionItemTemplate('references', i, it)).join('');
    bindSectionInputs('references', els.referenceList, state.references);
  }
  render(); persist();
}

function bindSectionInputs(section, container, arrRef) {
  container.querySelectorAll('[data-bind]').forEach(input => {
    input.addEventListener('input', () => {
      const topItem = input.closest('.grid, .bubble');
      const idx = Array.from(container.children).indexOf(topItem);
      const key = input.dataset.bind;
      if (idx >= 0 && arrRef[idx]) {
        arrRef[idx][key] = input.value;
        render(); persist();
      }
    });
  });
}

/* ---------- Skills ---------- */
function addSkillsFromInput() {
  if (!els.skillInput) return;
  const raw = els.skillInput.value.trim();
  if (!raw) return;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  state.skills.push(...parts);
  els.skillInput.value = '';
  renderSkillChips(); render(); persist();
}

function renderSkillChips() {
  if (!els.skillsChips) return;
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
  // tempel kelas tema ke root + preview
  const targets = [document.documentElement, els.preview];
  targets.forEach(el => {
    if (!el) return;
    el.classList.remove('theme-blue','theme-green','theme-gray');
    el.classList.add(`theme-${state.theme}`);
  });
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
  if (state.email)   h.push(`<span>✉️ ${esc(state.email)}</span>`);
  if (state.phone)   h.push(`<span>📞 ${esc(state.phone)}</span>`);
  if (state.address) h.push(`<span>📍 ${esc(state.address)}</span>`);
  if (state.website) h.push(`<span>🔗 <a href="${esc(state.website)}" target="_blank" rel="noopener">Website</a></span>`);
  if (state.linkedin)h.push(`<span>💼 <a href="${esc(state.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></span>`);
  if (state.github)  h.push(`<span>🐙 <a href="${esc(state.github)}" target="_blank" rel="noopener">GitHub</a></span>`);
  h.push('</div></div>');

  h.push('<div>');
  if (state.photo) h.push(`<img src="${esc(state.photo)}" alt="Foto" class="w-24 h-24 rounded-2xl object-cover border border-primary"/>`);
  h.push('</div>');
  h.push('</header>');

  // Summary (justify)
  if (state.summary) {
    h.push('<section class="cv-section cv-summary">');
    h.push('<div class="cv-sec-title">Ringkasan</div>');
    h.push(`<div class="bubble text-sm leading-relaxed">${formatSummary(state.summary)}</div>`);
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
    h.push('</div></section>');
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
    h.push('<div class="qr-wrap"><div id="qrBox"></div></div>');
  }

  h.push('</div>');
  els.preview.innerHTML = h.join('');

  // Render QR (lazy-load lib saat perlu)
  if (state.showQR && (state.qrCustom || state.linkedin || state.github)) {
    const target = state.qrCustom || state.linkedin || state.github;
    const box = $('#qrBox', els.preview);
    if (box) {
      const make = () => { box.innerHTML = ''; new QRCode(box, { text: target, width: 72, height: 72 }); };
      if (typeof QRCode === 'undefined') {
        ensureScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js').then(make);
      } else { make(); }
    }
  }

  // Auto-scroll preview
  els.previewWrap.scrollTo({ top: els.previewWrap.scrollHeight, behavior: 'smooth' });
}

/* ---------- Photo preview box ---------- */
function renderPhotoPreview() {
  if (!els.photoPreview) return;
  els.photoPreview.innerHTML = '';
  if (!state.photo) return;
  const wrap = document.createElement('div');
  wrap.className = 'flex items-center gap-2';
  wrap.innerHTML = `
    <img src="${state.photo}" alt="Foto" class="w-16 h-16 object-cover rounded-xl border">
    <button class="btn-secondary">Hapus Foto</button>
  `;
  wrap.querySelector('button').addEventListener('click', () => {
    state.photo = '';
    if (els.photoFile) els.photoFile.value = '';
    renderPhotoPreview(); render(); persist();
  });
  els.photoPreview.appendChild(wrap);
}

/* ---------- PDF (lazy-load) ---------- */
async function downloadPDF() {
  if (typeof html2pdf === 'undefined') {
    await ensureScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  }
  const element = els.preview;
  const opt = {
    margin: [10,10,10,10],
    filename: `${(state.name||'CV').replace(/\s+/g,'_')}.pdf`,
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  await html2pdf().from(element).set(opt).save();
}

/* ---------- Helpers ---------- */
function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function nl2br(s='') { return s.replace(/\n/g, '<br>'); }

// Ringkasan → paragraf (agar bisa justify)
function formatSummary(s = '') {
  const paras = String(s).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p>${esc(p.replace(/\n+/g, ' '))}</p>`).join('');
}

// Validasi singkat
const LANG = {
  id: {
    name: "Nama wajib diisi", email: "Format email tidak valid", phone: "Nomor HP tidak valid",
    website: "URL tidak valid", linkedin: "URL LinkedIn tidak valid", github: "URL GitHub tidak valid"
  }
};
let currentLang = 'id';
function validateField(id) {
  const el = els[id]; if (!el) return true;
  let valid = true, msg = '';
  if (id === 'name' && !el.value.trim()) { valid = false; msg = LANG[currentLang].name; }
  if (id === 'email' && el.value && !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(el.value)) { valid = false; msg = LANG[currentLang].email; }
  if (['website','linkedin','github'].includes(id) && el.value && !/^https?:\/\/.+\..+/.test(el.value)) { valid = false; msg = LANG[currentLang][id]; }
  if (id === 'phone' && el.value && !/^[0-9+\s()-]{8,}$/.test(el.value)) { valid = false; msg = LANG[currentLang].phone; }
  el.classList.toggle('border-red-500', !valid);
  el.classList.toggle('border-primary', valid);
  const errorDiv = document.getElementById('error-' + id);
  if (errorDiv) errorDiv.textContent = !valid ? msg : '';
  return valid;
}

// Resize gambar sebelum simpan (ringan)
function resizeImage(file, maxSide = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// Helper load script eksternal
function ensureScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src.includes(src))) return res();
    const s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Gagal memuat ' + src));
    document.head.appendChild(s);
  });
}

/* ---------- Drag & Drop ---------- */
function enableDragDrop() {
  if (typeof Sortable === 'undefined') return;

  if (els.educationList) {
    new Sortable(els.educationList, {
      animation: 150, handle: '.cv-drag',
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        const moved = state.education.splice(evt.oldIndex, 1)[0];
        state.education.splice(evt.newIndex, 0, moved);
        paintSection('education'); render(); persist();
      }
    });
  }
  if (els.experienceList) {
    new Sortable(els.experienceList, {
      animation: 150, handle: '.cv-drag',
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        const moved = state.experience.splice(evt.oldIndex, 1)[0];
        state.experience.splice(evt.newIndex, 0, moved);
        paintSection('experience'); render(); persist();
      }
    });
  }
  if (els.skillsChips) {
    new Sortable(els.skillsChips, {
      animation: 150,
      onEnd: (evt) => {
        if (evt.oldIndex === evt.newIndex) return;
        const moved = state.skills.splice(evt.oldIndex, 1)[0];
        state.skills.splice(evt.newIndex, 0, moved);
        renderSkillChips(); render(); persist();
      }
    });
  }
}
