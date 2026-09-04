// ============ 安装日报平台 前端逻辑 ============
(function () {
  const $ = (id) => document.getElementById(id);
  const CONFIG = window.CONFIG;
  let pendingPhotos = [];
  let filteredReports = [];
  let currentEditId = null;

  function todayStr() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  // ---------- 初始化 ----------
  async function init() {
    const isCloud = DB.mode === 'supabase';
    $('modeBadge').textContent = isCloud ? '云端模式' : '演示模式（本机）';
    if (!isCloud) $('demoBanner').classList.remove('hidden');
    await DB.init();
    $('reportDate').value = todayStr();
    await loadProjects($('projectSelect'));
    await loadProjects($('filterProject'));
    // 仅演示模式显示本机备份按钮
    if (!isCloud) {
      $('backupExportBtn').classList.remove('hidden');
      $('backupImportBtn').classList.remove('hidden');
    }
    bindEvents();
  }

  async function loadProjects(sel, selected) {
    const list = await DB.listProjects();
    sel.innerHTML = list.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    if (selected) sel.value = selected;
    if (!list.length) sel.innerHTML = '<option value="">（暂无，请先新建）</option>';
  }

  // ---------- Tab ----------
  function bindEvents() {
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tabpane').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('tab-' + t.dataset.tab).classList.add('active');
      if (t.dataset.tab === 'manage') ensureAdmin();
    });

    // 新建项目（上报）
    $('addProjectBtn').onclick = async () => {
      const name = prompt('输入新项目名称：');
      if (!name) return;
      await DB.addProject(name.trim());
      await loadProjects($('projectSelect'), name.trim());
    };

    // 照片选择
    $('photoInput').onchange = (e) => {
      for (const f of e.target.files) {
        pendingPhotos.push({ name: f.name, blob: f, url: URL.createObjectURL(f) });
      }
      e.target.value = '';
      renderPreview();
    };

    // 提交上报
    $('reportForm').onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('reportMsg');
      msg.className = 'msg';
      const projectName = $('projectSelect').value;
      if (!projectName) { msg.textContent = '请先选择或新建项目'; msg.className = 'msg err'; return; }
      const payload = {
        projectName,
        techName: $('techName').value.trim(),
        reportDate: $('reportDate').value,
        weather: $('weather').value.trim(),
        todayWork: $('todayWork').value.trim(),
        tomorrowPlan: $('tomorrowPlan').value.trim(),
        progress: $('progress').value,
        issues: $('issues').value.trim(),
        photos: pendingPhotos.map(p => ({ name: p.name, blob: p.blob })),
      };
      try {
        await DB.addReport(payload);
        msg.textContent = '✅ 日报已提交！'; msg.className = 'msg ok';
        $('todayWork').value = ''; $('tomorrowPlan').value = ''; $('issues').value = '';
        $('weather').value = ''; $('progress').value = '';
        pendingPhotos = []; renderPreview();
        $('reportDate').value = todayStr();
      } catch (err) {
        msg.textContent = '提交失败：' + err.message; msg.className = 'msg err';
      }
    };

    // 管理访问码
    $('adminEnter').onclick = () => {
      if ($('adminCode').value === CONFIG.ADMIN_CODE) {
        $('adminGate').classList.add('hidden');
        $('adminPanel').classList.remove('hidden');
        refreshList();
      } else {
        $('adminErr').textContent = '访问码错误';
      }
    };

    // 筛选
    $('applyFilter').onclick = refreshList;
    $('exportExcelBtn').onclick = () => { if (filteredReports.length) Exporter.exportExcel(filteredReports); else alert('暂无数据'); };
    $('downloadZipBtn').onclick = async () => {
      if (!filteredReports.length) return alert('暂无数据');
      const n = await Exporter.downloadPhotosZip(filteredReports, ($('filterProject').value || 'photos'));
      alert(`已打包 ${n} 张照片`);
    };

    // 演示模式：导出/导入本机备份（数据兜底）
    $('backupExportBtn').onclick = async () => {
      const data = await DB.exportAll();
      if (!data) return alert('云端模式无需本机备份');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '安装日报_本机备份_' + todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      alert('已导出本机备份（含所有日报与照片）。请保存到电脑或云盘，防止手机丢失数据。');
    };
    $('backupImportBtn').onclick = () => $('backupFile').click();
    $('backupFile').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await DB.importAll(data);
        alert('备份已导入。');
        refreshList();
      } catch (err) {
        alert('导入失败：' + err.message);
      }
      e.target.value = '';
    };

    // 弹窗关闭
    $('modalClose').onclick = () => $('modal').classList.add('hidden');
    $('modal').onclick = (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); };
  }

  function ensureAdmin() {
    if (!$('adminPanel').classList.contains('hidden')) refreshList();
  }

  // ---------- 照片预览 ----------
  function renderPreview() {
    const box = $('photoPreview');
    box.innerHTML = '';
    pendingPhotos.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'thumb';
      d.innerHTML = `<img src="${p.url}"><button class="del" type="button">×</button>`;
      d.querySelector('.del').onclick = () => { URL.revokeObjectURL(p.url); pendingPhotos.splice(i, 1); renderPreview(); };
      box.appendChild(d);
    });
  }

  // ---------- 管理列表 ----------
  async function refreshList() {
    const f = {
      projectId: undefined,
      from: $('filterFrom').value || undefined,
      to: $('filterTo').value || undefined,
      techName: $('filterTech').value.trim() || undefined,
    };
    const projName = $('filterProject').value;
    if (projName) {
      const plist = await DB.listProjects();
      const p = plist.find(x => x.name === projName);
      if (p) f.projectId = p.id;
    }
    filteredReports = await DB.listReports(f);
    renderList();
  }

  function renderList() {
    const box = $('reportList');
    if (!filteredReports.length) { box.innerHTML = '<p class="hint">暂无符合条件的日报。</p>'; return; }
    box.innerHTML = filteredReports.map((r, idx) => {
      const prog = parseFloat(r.progress);
      const bar = !isNaN(prog) ? `<div class="progress-bar"><span style="width:${prog}%"></span></div>` : '';
      const photos = (r.photos || []).map((p, i) =>
        `<img src="${DB.photoURL(p)}" onclick="window.__view(${idx},${i})">`).join('');
      return `<div class="report-card">
        <div class="rc-head">
          <div><div class="rc-title">${r.reportDate} ${r.weekday || ''}</div>
          <div class="rc-sub">${r.techName || ''} · ${r.projectName || ''} · ${r.weather || ''}</div></div>
          <div>${isNaN(prog) ? '' : prog + '%'}</div>
        </div>
        <div class="rc-body">
          <div><b>今日完成：</b><br>${nl2br(r.todayWork)}</div>
          ${r.tomorrowPlan ? `<div style="margin-top:6px"><b>明日计划：</b><br>${nl2br(r.tomorrowPlan)}</div>` : ''}
          ${r.issues ? `<div style="margin-top:6px"><b>问题：</b><br>${nl2br(r.issues)}</div>` : ''}
          ${bar}
        </div>
        ${photos ? `<div class="rc-photos">${photos}</div>` : ''}
        <div class="rc-actions">
          <button class="btn" onclick="window.__edit(${idx})">查看/编辑</button>
          <button class="btn" onclick="window.__del(${idx})">删除</button>
        </div>
      </div>`;
    }).join('');
  }

  function nl2br(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'); }

  // 全局给内联 onclick 用
  window.__view = (ri, pi) => {
    const r = filteredReports[ri]; const p = r.photos[pi];
    $('modalBody').innerHTML = `<img src="${DB.photoURL(p)}" style="max-width:100%;border-radius:8px">`;
    $('modal').classList.remove('hidden');
  };
  window.__lb = (encUrl) => {
    const url = decodeURIComponent(encUrl);
    $('modalBody').innerHTML = `<img src="${url}" style="max-width:100%;border-radius:8px">`;
    $('modal').classList.remove('hidden');
  };
  window.__edit = (ri) => openEdit(filteredReports[ri]);
  window.__del = async (ri) => {
    if (!confirm('确认删除这条日报？')) return;
    await DB.deleteReport(filteredReports[ri].id);
    refreshList();
  };

  // ---------- 编辑弹窗 ----------
  function openEdit(r) {
    currentEditId = r.id;
    const photos = (r.photos && r.photos.length)
      ? r.photos.map(p => `<img src="${DB.photoURL(p)}" onclick="window.__lb('${encodeURIComponent(DB.photoURL(p))}')">`).join('')
      : '（无照片）';
    $('modalBody').innerHTML = `
      <h3>查看 / 编辑日报</h3>
      <label>技术员 <input id="e_tech" value="${r.techName || ''}"></label>
      <label>日期 <input id="e_date" type="date" value="${r.reportDate}"></label>
      <label>天气 <input id="e_weather" value="${r.weather || ''}"></label>
      <label>今日完成 <textarea id="e_today" rows="4">${r.todayWork || ''}</textarea></label>
      <label>明日计划 <textarea id="e_tomo" rows="3">${r.tomorrowPlan || ''}</textarea></label>
      <label>进度 % <input id="e_prog" type="number" value="${r.progress ?? ''}"></label>
      <label>问题 <textarea id="e_iss" rows="3">${r.issues || ''}</textarea></label>
      <div class="modal-photos">${photos}</div>
      <div class="btn-row">
        <button class="btn primary" id="e_save">保存修改</button>
        <button class="btn" id="e_down">下载本页照片</button>
      </div>`;
    $('modal').classList.remove('hidden');
    $('e_save').onclick = async () => {
      await DB.updateReport(currentEditId, {
        techName: $('e_tech').value.trim(),
        reportDate: $('e_date').value,
        weather: $('e_weather').value.trim(),
        todayWork: $('e_today').value.trim(),
        tomorrowPlan: $('e_tomo').value.trim(),
        progress: $('e_prog').value,
        issues: $('e_iss').value.trim(),
      });
      $('modal').classList.add('hidden');
      refreshList();
    };
    $('e_down').onclick = async () => {
      const n = await Exporter.downloadPhotosZip([r], (r.projectName || 'report') + '_' + r.reportDate);
      alert(`已打包 ${n} 张照片`);
    };
  }

  init();
})();
