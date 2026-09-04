// ============ 数据访问层：演示模式(IndexedDB) / 云端模式(Supabase) ============
(function (global) {
  const CFG = global.CONFIG;

  function uuid() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
      ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  }
  function weekdayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return w[d.getDay()];
  }

  // ---------- 演示模式：IndexedDB（本机存储，无需后端） ----------
  const IDB = (function () {
    let db = null;
    const DB_NAME = 'install_daily_v1';
    function open() {
      return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('projects'))
            d.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
          if (!d.objectStoreNames.contains('reports')) {
            const s = d.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
            s.createIndex('projectId', 'projectId');
            s.createIndex('reportDate', 'reportDate');
          }
        };
        req.onsuccess = () => { db = req.result; res(db); };
        req.onerror = () => rej(req.error);
      });
    }
    function store(name, mode) { return db.transaction(name, mode).objectStore(name); }
    function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

    return {
      async init() { await open(); },
      async listProjects() { return (await reqP(store('projects', 'readonly').getAll())).map(p => ({ id: p.id, name: p.name })); },
      async addProject(name) { return await reqP(store('projects', 'readwrite').add({ name })); },
      async addReport(rec) { return await reqP(store('reports', 'readwrite').add(rec)); },
      async listReports(f) {
        let all = await reqP(store('reports', 'readonly').getAll());
        if (f && f.projectId) all = all.filter(r => r.projectId == f.projectId);
        if (f && f.from) all = all.filter(r => r.reportDate >= f.from);
        if (f && f.to) all = all.filter(r => r.reportDate <= f.to);
        if (f && f.techName) all = all.filter(r => (r.techName || '').includes(f.techName));
        all.sort((a, b) => (a.reportDate < b.reportDate ? -1 : 1));
        return all;
      },
      async getReport(id) { return await reqP(store('reports', 'readonly').get(Number(id))); },
      async updateReport(id, fields) {
        const st = store('reports', 'readwrite');
        const rec = await reqP(st.get(Number(id)));
        if (!rec) throw new Error('not found');
        Object.assign(rec, fields, { updatedAt: new Date().toISOString() });
        await reqP(st.put(rec));
      },
      async deleteReport(id) { await reqP(store('reports', 'readwrite').delete(Number(id))); },
      // 备份：导出/导入整个本机数据库（演示模式安全兜底）
      async exportAll() {
        const projects = await reqP(store('projects', 'readonly').getAll());
        const reports = await reqP(store('reports', 'readonly').getAll());
        return { _type: 'install_daily_backup', _ver: 1, exportedAt: new Date().toISOString(), projects, reports };
      },
      async importAll(data) {
        if (!data || !Array.isArray(data.projects) || !Array.isArray(data.reports)) throw new Error('备份文件格式不正确');
        await clearStore('projects');
        await clearStore('reports');
        if (data.projects.length) await putStore('projects', data.projects);
        if (data.reports.length) await putStore('reports', data.reports);
      },
    };

    // 整库清空/写入（在同一事务内发起所有请求，避免事务提前提交）
    function clearStore(name) {
      return new Promise((res, rej) => {
        const tx = db.transaction(name, 'readwrite');
        tx.objectStore(name).clear();
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    function putStore(name, items) {
      return new Promise((res, rej) => {
        const tx = db.transaction(name, 'readwrite');
        const os = tx.objectStore(name);
        items.forEach(it => os.put(it));
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
  })();

  // ---------- 云端模式：Supabase（轻量 REST，无需 supabase-js） ----------
  const SB = (function () {
    const URL = CFG.SUPABASE_URL, KEY = CFG.SUPABASE_ANON_KEY;
    function hdr(extra) {
      return Object.assign({ 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
    }
    async function rest(method, path, body) {
      const r = await fetch(URL + '/rest/v1/' + path, {
        method, headers: hdr(body ? {} : { 'Prefer': 'return=representation' }),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    return {
      async init() { if (!URL || !KEY) throw new Error('请在 config.js 填写 SUPABASE_URL 与 SUPABASE_ANON_KEY'); },
      async listProjects() { return await rest('GET', 'projects?select=id,name&order=name'); },
      async addProject(name) { return (await rest('POST', 'projects', { name }))[0].id; },
      async addReport(rec) { return (await rest('POST', 'daily_reports', rec))[0].id; },
      async listReports(f) {
        let q = 'daily_reports?select=*&order=report_date.asc';
        if (f && f.projectId) q += '&project_id=eq.' + f.projectId;
        if (f && f.from) q += '&report_date=gte.' + f.from;
        if (f && f.to) q += '&report_date=lte.' + f.to;
        if (f && f.techName) q += '&tech_name=ilike.*' + encodeURIComponent(f.techName) + '*';
        const rows = await rest('GET', q);
        return rows.map(r => ({
          id: r.id, projectId: r.project_id, techName: r.tech_name, reportDate: r.report_date,
          weekday: r.weekday, weather: r.weather, todayWork: r.today_work, tomorrowPlan: r.tomorrow_plan,
          progress: r.progress, issues: r.issues,
          photos: (r.photo_urls || []).map(u => ({ name: u.split('/').pop(), url: URL + '/storage/v1/object/public/report-photos/' + u })),
          createdAt: r.created_at, updatedAt: r.updated_at,
        }));
      },
      async getReport(id) { return (await rest('GET', 'daily_reports?id=eq.' + id + '&select=*'))[0]; },
      async updateReport(id, fields) { await rest('PATCH', 'daily_reports?id=eq.' + id, fields); },
      async deleteReport(id) { await rest('DELETE', 'daily_reports?id=eq.' + id); },
      async uploadPhoto(path, blob, ct) {
        const r = await fetch(URL + '/storage/v1/object/report-photos/' + path, {
          method: 'POST',
          headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': ct || 'image/jpeg', 'x-upsert': 'true' },
          body: blob,
        });
        if (!r.ok) throw new Error(await r.text());
        return path;
      },
    };
  })();

  // ---------- 统一封装 ----------
  const DB = {
    mode: CFG.USE_SUPABASE ? 'supabase' : 'idb',
    async init() { await (CFG.USE_SUPABASE ? SB.init() : IDB.init()); },

    async ensureProject(name) {
      const list = await this.listProjects();
      const hit = list.find(p => p.name === name);
      if (hit) return hit.id;
      return await this.addProject(name);
    },
    async listProjects() { return CFG.USE_SUPABASE ? SB.listProjects() : IDB.listProjects(); },
    async addProject(n) { return CFG.USE_SUPABASE ? SB.addProject(n) : IDB.addProject(n); },

    async addReport(payload) {
      const projectId = await this.ensureProject(payload.projectName);
      if (CFG.USE_SUPABASE) {
        const photoUrls = [];
        for (const ph of (payload.photos || [])) {
          const ext = (ph.name.split('.').pop() || 'jpg').toLowerCase();
          const path = projectId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
          await SB.uploadPhoto(path, ph.blob, ph.blob.type || 'image/jpeg');
          photoUrls.push(path);
        }
        const rec = {
          project_id: projectId, tech_name: payload.techName, report_date: payload.reportDate,
          weekday: weekdayOf(payload.reportDate), weather: payload.weather, today_work: payload.todayWork,
          tomorrow_plan: payload.tomorrowPlan, progress: String(payload.progress ?? ''), issues: payload.issues,
          photo_urls: photoUrls, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        return await SB.addReport(rec);
      } else {
        const rec = {
          projectId, projectName: payload.projectName, techName: payload.techName, reportDate: payload.reportDate,
          weekday: weekdayOf(payload.reportDate), weather: payload.weather, todayWork: payload.todayWork,
          tomorrowPlan: payload.tomorrowPlan, progress: payload.progress, issues: payload.issues,
          photos: (payload.photos || []).map(p => ({ name: p.name, blob: p.blob })),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        return await IDB.addReport(rec);
      }
    },

    async listReports(f) { return CFG.USE_SUPABASE ? SB.listReports(f) : IDB.listReports(f); },
    async getReport(id) { return CFG.USE_SUPABASE ? SB.getReport(id) : IDB.getReport(id); },
    async updateReport(id, fields) {
      if (CFG.USE_SUPABASE) {
        const map = {};
        if ('techName' in fields) map.tech_name = fields.techName;
        if ('reportDate' in fields) { map.report_date = fields.reportDate; map.weekday = weekdayOf(fields.reportDate); }
        if ('weather' in fields) map.weather = fields.weather;
        if ('todayWork' in fields) map.today_work = fields.todayWork;
        if ('tomorrowPlan' in fields) map.tomorrow_plan = fields.tomorrowPlan;
        if ('progress' in fields) map.progress = String(fields.progress ?? '');
        if ('issues' in fields) map.issues = fields.issues;
        map.updated_at = new Date().toISOString();
        return await SB.updateReport(id, map);
      }
      return await IDB.updateReport(id, fields);
    },
    async deleteReport(id) { return CFG.USE_SUPABASE ? SB.deleteReport(id) : IDB.deleteReport(id); },

    // 演示模式备份（云端模式返回 null，备份由 Supabase 托管）
    async exportAll() { return CFG.USE_SUPABASE ? null : IDB.exportAll(); },
    async importAll(d) { if (!CFG.USE_SUPABASE) return IDB.importAll(d); },

    photoURL(photo) {
      if (photo.url) return photo.url;
      if (photo.blob) { if (!photo._objurl) photo._objurl = URL.createObjectURL(photo.blob); return photo._objurl; }
      return '';
    },
    async photoBlob(photo) {
      if (photo.blob) return photo.blob;
      if (photo.url) return await (await fetch(photo.url)).blob();
      return null;
    },
  };

  global.DB = DB;
  global.weekdayOf = weekdayOf;
})(window);
