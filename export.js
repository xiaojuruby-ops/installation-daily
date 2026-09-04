// ============ 导出：Excel（SheetJS） + 照片打包（JSZip） ============
(function (global) {
  async function exportExcel(reports) {
    const XLSX = global.XLSX;
    if (!XLSX) { alert('Excel 组件未加载'); return; }
    const header = ['项目', '日期', '星期', '天气', '技术员', '今日完成工作', '明日计划', '进度%', '问题/待解决', '照片数', '照片文件名'];
    const rows = [header];
    for (const r of reports) {
      rows.push([
        r.projectName || '', r.reportDate, r.weekday || '', r.weather || '', r.techName || '',
        r.todayWork || '', r.tomorrowPlan || '', r.progress ?? '', r.issues || '',
        (r.photos || []).length, (r.photos || []).map(p => p.name).join('; '),
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 10 },
      { wch: 42 }, { wch: 30 }, { wch: 8 }, { wch: 30 }, { wch: 8 }, { wch: 34 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '安装日报');
    const name = (reports[0] && reports[0].projectName) || 'export';
    XLSX.writeFile(wb, `安装日报_${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function downloadPhotosZip(reports, zipName) {
    const JSZip = global.JSZip;
    if (!JSZip) { alert('打包组件未加载'); return 0; }
    const zip = new JSZip();
    let count = 0;
    for (const r of reports) {
      const folder = zip.folder(`${r.reportDate}_${(r.techName || 'tech').replace(/[\\/:*?"<>|]/g, '_')}`);
      for (const ph of (r.photos || [])) {
        const blob = await global.DB.photoBlob(ph);
        if (blob) { folder.file(ph.name, blob); count++; }
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${zipName || 'photos'}_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    return count;
  }

  global.Exporter = { exportExcel, downloadPhotosZip };
})(window);
