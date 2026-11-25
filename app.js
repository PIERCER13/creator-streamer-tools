// @author piercer
const $ = (id) => document.getElementById(id);

function showToast(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}

// Check OBS Browser Source mode (?obs=1)
const params = new URLSearchParams(window.location.search);
if (params.get("obs") === "1") {
  document.body.style.background = "transparent";
  $("appRoot").hidden = true;
  $("obsOnlyRoot").hidden = false;
  renderObsWidget($("obsWidgetLive"), {
    type: params.get("type") || "goal",
    title: params.get("title") || "Meta de Seguidores",
    current: Number(params.get("current") || 68),
    target: Number(params.get("target") || 100),
    minutes: Number(params.get("minutes") || 5),
    accent: params.get("accent") || "#a855f7",
  }, true);
} else {
  initApp();
}

function renderObsWidget(el, cfg, startTimer) {
  el.style.setProperty("--obs-accent", cfg.accent);
  if (cfg.type === "goal") {
    const pct = Math.min(100, Math.max(0, (cfg.current / Math.max(1, cfg.target)) * 100));
    el.innerHTML = `
      <div class="obs-w-head">
        <span>${escapeHtml(cfg.title)}</span>
        <span class="mono">${cfg.current} / ${cfg.target}</span>
      </div>
      <div class="obs-w-bar"><div class="obs-w-fill" style="width:${pct}%"></div></div>
    `;
  } else {
    el.innerHTML = `
      <div class="obs-w-head"><span>${escapeHtml(cfg.title)}</span><span>LIVE</span></div>
      <div class="obs-w-timer" id="obsTimerText">${String(cfg.minutes).padStart(2, "0")}:00</div>
    `;
    if (startTimer) {
      let totalSec = Math.max(1, cfg.minutes * 60);
      setInterval(() => {
        if (totalSec > 0) totalSec--;
        const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
        const s = String(totalSec % 60).padStart(2, "0");
        const node = document.getElementById("obsTimerText");
        if (node) node.textContent = `${m}:${s}`;
      }, 1000);
    }
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function initApp() {
  const STORAGE_KEY = "piercer_creator_tools_v1";

  function saveCreatorState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        qrText: $("qrText").value,
        qrFg: $("qrFg").value,
        qrBg: $("qrBg").value,
        qrSize: $("qrSize").value,
        imgFormat: $("imgFormat").value,
        imgMaxWidth: $("imgMaxWidth").value,
        imgQuality: $("imgQuality").value,
        obsType: $("obsType").value,
        obsTitle: $("obsTitle").value,
        obsCurrent: $("obsCurrent").value,
        obsTarget: $("obsTarget").value,
        obsMinutes: $("obsMinutes").value,
        obsAccent: $("obsAccent").value,
      }));
    } catch {}
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) {
      Object.entries(saved).forEach(([k, v]) => {
        if ($(k) && v !== undefined) $(k).value = v;
      });
      $("imgQualityVal").textContent = `${$("imgQuality").value}%`;
    }
  } catch {}
  // Tabs
  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pill").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // 1. QR Code
  function renderQr() {
    const text = $("qrText").value.trim() || "https://github.com/";
    const size = Number($("qrSize").value) || 512;
    const fg = $("qrFg").value;
    const bg = $("qrBg").value;

    if (typeof QRCode === "undefined") {
      $("qrStatus").textContent = "Biblioteca QRCode indisponível offline.";
      return;
    }

    QRCode.toCanvas($("qrCanvas"), text, {
      width: size,
      margin: 2,
      color: { dark: fg, light: bg },
    }, (err) => {
      $("qrStatus").textContent = err ? "Erro ao gerar QR Code" : `${size} × ${size} px pronto para download`;
    });
  }

  ["qrText", "qrFg", "qrBg", "qrSize"].forEach((id) => $(id).addEventListener("input", () => { renderQr(); saveCreatorState(); }));
  $("downloadQrBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = $("qrCanvas").toDataURL("image/png");
    link.click();
  });
  renderQr();

  // 2. Image Compressor
  let loadedFiles = [];
  let compressedEntries = [];

  function buildZipBlob(entries) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    entries.forEach(({ name, data }) => {
      const nameBytes = encoder.encode(name);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(8, 0, true);
      lv.setUint32(14, 0, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      parts.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([...parts, ...central, eocd], { type: "application/zip" });
  }

  $("downloadAllZipBtn").addEventListener("click", () => {
    if (!compressedEntries.length) return;
    const zip = buildZipBlob(compressedEntries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip);
    a.download = "imagens-otimizadas.zip";
    a.click();
  });

  $("imgQuality").addEventListener("input", (e) => {
    $("imgQualityVal").textContent = `${e.target.value}%`;
    processFiles();
  });
  ["imgFormat", "imgMaxWidth"].forEach((id) => $(id).addEventListener("change", processFiles));

  $("imgInput").addEventListener("change", (e) => {
    loadedFiles = Array.from(e.target.files || []);
    processFiles();
  });

  const dropZone = $("dropZone");
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    loadedFiles = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    processFiles();
  });

  function processFiles() {
    const container = $("imgResults");
    container.innerHTML = "";
    compressedEntries = [];
    $("downloadAllZipBtn").hidden = !loadedFiles.length;
    if (!loadedFiles.length) return;

    const format = $("imgFormat").value;
    const maxW = Math.max(100, Number($("imgMaxWidth").value) || 1280);
    const quality = Number($("imgQuality").value) / 100;
    const ext = format.split("/")[1];

    loadedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);

          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const outName = `${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
            compressedEntries.push({ name: outName, data: new Uint8Array(await blob.arrayBuffer()) });
            const url = URL.createObjectURL(blob);
            const origKb = (file.size / 1024).toFixed(1);
            const newKb = (blob.size / 1024).toFixed(1);
            const saved = Math.round((1 - blob.size / file.size) * 100);

            const card = document.createElement("div");
            card.className = "img-item";
            card.innerHTML = `
              <img src="${url}" alt="${escapeHtml(file.name)}" />
              <strong style="font-size:0.84rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(file.name)}</strong>
              <div class="img-meta mono">
                <span>${w}×${h}px</span>
                <span>${origKb}KB → ${newKb}KB <span class="savings">(${saved > 0 ? `-${saved}%` : `+${Math.abs(saved)}%`})</span></span>
              </div>
              <a class="btn btn-primary" href="${url}" download="${file.name.replace(/\.[^.]+$/, "")}.${ext}">Baixar .${ext}</a>
            `;
            container.appendChild(card);
          }, format, quality);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 3. OBS Overlay
  function updateObs() {
    const type = $("obsType").value;
    $("obsGoalFields").hidden = type !== "goal";
    $("obsTimerFields").hidden = type !== "timer";

    const cfg = {
      type,
      title: $("obsTitle").value || "Meta",
      current: Number($("obsCurrent").value) || 0,
      target: Number($("obsTarget").value) || 100,
      minutes: Number($("obsMinutes").value) || 5,
      accent: $("obsAccent").value,
    };

    renderObsWidget($("obsPreviewWidget"), cfg, false);

    const url = new URL(window.location.href.split("?")[0]);
    url.searchParams.set("obs", "1");
    url.searchParams.set("type", cfg.type);
    url.searchParams.set("title", cfg.title);
    url.searchParams.set("current", cfg.current);
    url.searchParams.set("target", cfg.target);
    url.searchParams.set("minutes", cfg.minutes);
    url.searchParams.set("accent", cfg.accent);
    $("obsUrlOut").value = url.toString();
  }

  ["obsType", "obsTitle", "obsCurrent", "obsTarget", "obsMinutes", "obsAccent"].forEach((id) => {
    $(id).addEventListener("input", () => { updateObs(); saveCreatorState(); });
    $(id).addEventListener("change", () => { updateObs(); saveCreatorState(); });
  });

  $("copyObsUrlBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("obsUrlOut").value);
      showToast("URL do OBS copiada!");
    } catch {
      showToast("Copie a URL do campo.");
    }
  });

  const OBS_PRESETS_KEY = "piercer_obs_presets_v1";
  let obsPresets = [];
  try { obsPresets = JSON.parse(localStorage.getItem(OBS_PRESETS_KEY) || "[]"); } catch {}

  function renderObsPresets() {
    $("obsPresetsList").innerHTML = obsPresets.map((p, idx) => `
      <span style="display:inline-flex; align-items:center; gap:0.35rem; background:var(--bg); border:1px solid var(--border); border-radius:999px; padding:0.22rem 0.6rem; font-size:0.76rem;">
        <button type="button" data-load-preset="${idx}" style="background:none; border:none; color:var(--text); cursor:pointer; font-weight:600;">${escapeHtml(p.title)}</button>
        <button type="button" data-del-preset="${idx}" style="background:none; border:none; color:var(--muted); cursor:pointer;">✕</button>
      </span>
    `).join("");

    $("obsPresetsList").querySelectorAll("[data-load-preset]").forEach((b) => {
      b.addEventListener("click", () => {
        const p = obsPresets[Number(b.dataset.loadPreset)];
        if (!p) return;
        $("obsType").value = p.type;
        $("obsTitle").value = p.title;
        $("obsCurrent").value = p.current;
        $("obsTarget").value = p.target;
        $("obsMinutes").value = p.minutes;
        $("obsAccent").value = p.accent;
        updateObs();
        saveCreatorState();
      });
    });

    $("obsPresetsList").querySelectorAll("[data-del-preset]").forEach((b) => {
      b.addEventListener("click", () => {
        obsPresets.splice(Number(b.dataset.delPreset), 1);
        localStorage.setItem(OBS_PRESETS_KEY, JSON.stringify(obsPresets));
        renderObsPresets();
      });
    });
  }

  $("saveObsPresetBtn").addEventListener("click", () => {
    obsPresets.push({
      type: $("obsType").value,
      title: $("obsTitle").value || "Preset OBS",
      current: $("obsCurrent").value,
      target: $("obsTarget").value,
      minutes: $("obsMinutes").value,
      accent: $("obsAccent").value,
    });
    localStorage.setItem(OBS_PRESETS_KEY, JSON.stringify(obsPresets));
    renderObsPresets();
    showToast("Preset salvo!");
  });

  renderObsPresets();
  updateObs();
}
