// Audio & Score Synchronization Controller (SAT 3-Stave High-Performance Engine)

const audio = document.getElementById("audio-player");
const audioInput = document.getElementById("audio-file-input");
const audioStatus = document.getElementById("audio-status");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");
const playText = document.getElementById("play-text");
const progressBar = document.getElementById("progress-bar");
const timeDisplay = document.getElementById("time-display");
const zoomText = document.getElementById("zoom-text");
const loopBtn = document.getElementById("btn-loop");
const autoScrollBtn = document.getElementById("btn-autoscroll");

let isPlaying = false;
let isLooping = false;
let autoScrollEnabled = false;
let currentScale = 1.0;
let animFrameId = null;
let activeSec = null;
let currentM = -1;
let lastSystemRowY = -1;
let currentAudioSource = "vocal"; // "vocal" | "instrumental" | "video"

// Virtual Clock Fallback (guarantees sheet and lyrics NEVER freeze)
let useVirtualClock = false;
let virtualStartTime = 0;
// songDuration defined in data.js (300.00s)

// Cached Bounding Boxes for all measures (avoids layout thrashing / lag)
let measureBBoxes = {};

// Singer Colors Map
const roleColors = {
  soprano: "#e11d48",
  alto: "#7c3aed",
  tenor: "#0284c7",
  trio: "#d97706",
  duet: "#d97706",
  climax: "#b91c1c",
  intro: "#64748b"
};

function getPlaybackTime() {
  if (useVirtualClock) {
    const elapsed = (performance.now() - virtualStartTime) / 1000;
    return Math.min(songDuration, Math.max(0, elapsed));
  }
  return audio.currentTime || 0;
}

function updateAudioStatus(text, statusClass) {
  if (!audioStatus) return;
  audioStatus.textContent = text;
  audioStatus.className = "audio-status-badge status-" + statusClass;
}

// Switch Audio Mode seamlessly between Vocal, Beat (Instrumental), and Original Video
function switchAudioMode(mode) {
  if (currentAudioSource === mode && audio.src && audio.src.indexOf(mode) !== -1) return;
  const curT = getPlaybackTime();
  const wasPlaying = isPlaying;
  currentAudioSource = mode;

  let src = "vocal.mp3";
  let label = "🎤 Có Lời (Vocal)";
  if (mode === "instrumental") {
    src = "instrumental.mp3";
    label = "🎵 Không Lời (Beat)";
  } else if (mode === "video") {
    src = "lyrics_video.mp4";
    label = "🎬 Video Gốc";
  }

  // Update mode buttons UI
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
  const btnId = mode === "instrumental" ? "btn-mode-inst" : ("btn-mode-" + mode);
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) activeBtn.classList.add("active");

  const btnAudioSrc = document.getElementById("btn-audio-src");
  if (btnAudioSrc) btnAudioSrc.textContent = label;

  updateAudioStatus(label + ": Đang nạp...", "checking");
  audio.src = src;
  audio.load();
  audio.currentTime = curT;

  if (wasPlaying) {
    audio.play().then(() => {
      isPlaying = true;
      startAnimation();
      updateAudioStatus(label + " Sẵn sàng (300s)", "ready");
    }).catch(err => {
      console.warn("Autoplay after switch:", err);
    });
  } else {
    updateAudioStatus(label + " Sẵn sàng (300s)", "ready");
  }
}

// Toggle Audio Source (cycles through 3 modes)
function toggleAudioSource() {
  if (currentAudioSource === "vocal") switchAudioMode("instrumental");
  else if (currentAudioSource === "instrumental") switchAudioMode("video");
  else switchAudioMode("vocal");
}

// Toggle Auto-Scroll
function toggleAutoScroll() {
  autoScrollEnabled = !autoScrollEnabled;
  if (autoScrollBtn) {
    autoScrollBtn.textContent = autoScrollEnabled ? "📜 Cuộn: BẬT" : "📜 Cuộn: TẮT (Cố định)";
    autoScrollBtn.classList.toggle("btn-active", autoScrollEnabled);
  }
}

// Audio Element Listeners
audio.addEventListener("loadedmetadata", () => {
  const label = currentAudioSource === "vocal" ? "🎤 Có Lời" : (currentAudioSource === "instrumental" ? "🎵 Beat" : "🎬 Video");
  updateAudioStatus(label + " Sẵn sàng (" + Math.round(audio.duration || songDuration) + "s)", "ready");
});

audio.addEventListener("canplaythrough", () => {
  const label = currentAudioSource === "vocal" ? "🎤 Có Lời" : (currentAudioSource === "instrumental" ? "🎵 Beat" : "🎬 Video");
  updateAudioStatus(label + " Sẵn sàng (" + Math.round(audio.duration || songDuration) + "s)", "ready");
});

audio.addEventListener("error", () => {
  console.warn("Audio file error or restricted. Fallback virtual clock will be used when played.", audio.error);
  updateAudioStatus("⏱ Mô phỏng nhịp (Bấm Chọn MP3 để nạp)", "fallback");
});

audio.addEventListener("play", () => {
  isPlaying = true;
  useVirtualClock = false;
  playIcon.textContent = "⏸";
  playText.textContent = "Tạm Dừng";
  startAnimation();
});

audio.addEventListener("pause", () => {
  if (!useVirtualClock) {
    isPlaying = false;
    playIcon.textContent = "▶";
    playText.textContent = "Phát Nhạc";
    cancelAnimationFrame(animFrameId);
  }
});

audio.addEventListener("ended", () => {
  isPlaying = false;
  useVirtualClock = false;
  playIcon.textContent = "▶";
  playText.textContent = "Phát Lại";
  cancelAnimationFrame(animFrameId);
});

// User Upload Audio File Fallback
if (audioInput) {
  audioInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.load();
      updateAudioStatus("🎵 File người dùng: " + file.name, "ready");
      playAudio();
    }
  });
}

// Transport Controls
function togglePlay() {
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

function playAudio() {
  const p = audio.play();
  if (p !== undefined) {
    p.then(() => {
      isPlaying = true;
      useVirtualClock = false;
      playIcon.textContent = "⏸";
      playText.textContent = "Tạm Dừng";
      startAnimation();
      const label = currentAudioSource === "vocal" ? "🎤 Có Lời" : (currentAudioSource === "instrumental" ? "🎵 Beat" : "🎬 Video");
      updateAudioStatus(label + " Đang phát", "ready");
    }).catch(err => {
      console.warn("Direct HTML5 audio play blocked/missing, engaging virtual clock:", err);
      useVirtualClock = true;
      virtualStartTime = performance.now() - (audio.currentTime || 0) * 1000;
      isPlaying = true;
      playIcon.textContent = "⏸";
      playText.textContent = "Tạm Dừng";
      startAnimation();
      updateAudioStatus("⏱ Đang chạy mô phỏng nhịp chuẩn", "fallback");
    });
  }
}

function pauseAudio() {
  audio.pause();
  isPlaying = false;
  if (useVirtualClock) {
    useVirtualClock = false;
  }
  playIcon.textContent = "▶";
  playText.textContent = "Phát Nhạc";
  cancelAnimationFrame(animFrameId);
  updateAudioStatus("⏸ Tạm dừng", "ready");
}

function toggleLoop() {
  isLooping = !isLooping;
  if (loopBtn) {
    loopBtn.classList.toggle("btn-active", isLooping);
    loopBtn.textContent = isLooping ? "🔁 Đang Lặp Đoạn" : "🔁 Lặp Đoạn";
  }
}

// Navigation Pills
function renderPills() {
  const container = document.getElementById("pills-container");
  if (!container) return;
  container.innerHTML = "";

  sectionsData.forEach(sec => {
    const pill = document.createElement("button");
    pill.className = "sec-pill " + (sec.badge || "chip-intro");
    pill.id = "pill-" + sec.id;
    pill.textContent = sec.title;
    pill.title = sec.singer + " (" + formatTime(sec.startT) + " - " + formatTime(sec.endT) + ")";
    pill.onclick = () => {
      seekToTime(sec.startT);
      if (!isPlaying) playAudio();
    };
    container.appendChild(pill);
  });
}

// Full Score ABC Rendering with 3-Stave SAT Voicing
function renderSheet() {
  const target = document.getElementById("sheet-paper");
  if (!target) return;

  let abc = "X:1\n";
  abc += "T:A Thousand Years (Pt. 2)\n";
  abc += "C:Christina Perri ft. Steve Kazee • Bè SAT (3 Giọng Đồng Bộ)\n";
  abc += "M:6/8\n";
  abc += "L:1/8\n";
  abc += "Q:3/8=50\n";
  abc += "K:Bb\n";
  abc += "%%scale " + currentScale.toFixed(2) + "\n";
  abc += "%%score (Soprano) (Alto) (Tenor)\n";
  abc += "%%staves [Soprano Alto Tenor]\n";
  abc += "%%maxshrink 0.8\n";
  abc += "%%measurenb 1\n";

  abc += "V:Soprano name=\"N1 (Cao)\" sname=\"N1\" clef=treble\n";
  abc += "V:Alto name=\"N2 (Trầm)\" sname=\"N2\" clef=treble\n";
  abc += "V:Tenor name=\"Nam (Cao)\" sname=\"Nam\" clef=treble-8\n";

  sectionsData.forEach(sec => {
    abc += "% --- " + sec.title + " (" + sec.singer + ") ---\n";
    abc += "[V:Soprano] " + sec.sop + "\n";
    if (sec.sop_w) abc += "w: " + sec.sop_w + "\n";
    abc += "[V:Alto] " + sec.alt + "\n";
    if (sec.alt_w) abc += "w: " + sec.alt_w + "\n";
    abc += "[V:Tenor] " + sec.ten + "\n";
    if (sec.ten_w) abc += "w: " + sec.ten_w + "\n";
  });

  target.innerHTML = "";
  try {
    ABCJS.renderAbc(target, abc, {
      responsive: "resize",
      add_classes: true,
      scale: currentScale,
      staffwidth: 960,
      paddingtop: 15,
      paddingbottom: 30,
      paddingleft: 20,
      paddingright: 20
    });
  } catch (e) {
    console.error("ABCJS rendering error:", e);
  }

  // Invalidate cached measure boxes on re-render
  measureBBoxes = {};
  currentM = -1;
  lastSystemRowY = -1;

  // Add click-to-seek functionality on measures in sheet
  setTimeout(() => {
    const svg = target.querySelector("svg");
    if (!svg) return;

    measuresData.forEach((m, mIdx) => {
      const elems = svg.querySelectorAll(".abcjs-mm" + mIdx);
      elems.forEach(el => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          seekToTime(measuresData[mIdx].startT);
          if (!isPlaying) playAudio();
        });
      });
    });
  }, 300);
}

// Seek & Time Functions
function seekToTime(t) {
  t = Math.max(0, Math.min(songDuration, t));
  audio.currentTime = t;
  if (useVirtualClock) {
    virtualStartTime = performance.now() - t * 1000;
  }
  updatePlayback(t);
}

function handleSeekClick(e) {
  const bar = document.getElementById("seek-bar");
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const dur = (audio.duration && !isNaN(audio.duration)) ? audio.duration : songDuration;
  seekToTime(pct * dur);
}

function seekRelative(delta) {
  seekToTime(getPlaybackTime() + delta);
}

function changeZoom(delta) {
  currentScale = Math.max(0.6, Math.min(1.8, currentScale + delta));
  if (zoomText) {
    zoomText.textContent = Math.round(currentScale * 100) + "%";
  }
  renderSheet();
}

function formatTime(s) {
  if (isNaN(s) || s < 0) return "00:00";
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return (mins < 10 ? "0" : "") + mins + ":" + (secs < 10 ? "0" : "") + secs;
}

// High-Precision Animation Loop (60 FPS)
function startAnimation() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  function loop() {
    if (isPlaying) {
      updatePlayback(getPlaybackTime());
      animFrameId = requestAnimationFrame(loop);
    }
  }
  animFrameId = requestAnimationFrame(loop);
}

// Master Playback Updater
function updatePlayback(curT) {
  const dur = (audio.duration && !isNaN(audio.duration)) ? audio.duration : songDuration;

  if (useVirtualClock && curT >= songDuration) {
    isPlaying = false;
    useVirtualClock = false;
    playIcon.textContent = "▶";
    playText.textContent = "Phát Lại";
    cancelAnimationFrame(animFrameId);
    curT = songDuration;
  }

  timeDisplay.textContent = formatTime(curT) + " / " + formatTime(dur);
  const pct = Math.min(100, Math.max(0, (curT / dur) * 100));
  progressBar.style.width = pct + "%";

  // Identify Current Section
  let curSec = sectionsData[0];
  for (let i = 0; i < sectionsData.length; i++) {
    if (curT >= sectionsData[i].startT) {
      curSec = sectionsData[i];
    } else {
      break;
    }
  }

  // Section Looping
  if (isLooping && curSec && curT >= curSec.endT) {
    seekToTime(curSec.startT);
    return;
  }

  // Update Section Pill highlight
  if (!activeSec || activeSec.id !== curSec.id) {
    activeSec = curSec;
    document.querySelectorAll(".sec-pill").forEach(p => p.classList.remove("active"));
    const curPill = document.getElementById("pill-" + curSec.id);
    if (curPill) {
      curPill.classList.add("active");
      curPill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  // Identify Current Measure
  let curMIdx = 0;
  for (let i = 0; i < measuresData.length; i++) {
    if (curT >= measuresData[i].startT && curT < measuresData[i].endT) {
      curMIdx = i;
      break;
    }
    if (curT >= measuresData[measuresData.length - 1].startT) {
      curMIdx = measuresData.length - 1;
    }
  }

  const curMeasure = measuresData[curMIdx];
  highlightMeasure(curMIdx, curT, curMeasure.startT, curMeasure.endT, curMeasure.role);

  // HUD Synchronized directly to active measure & lyrics
  const hudBadge = document.getElementById("hud-badge");
  const hudMTag = document.getElementById("hud-m-tag");
  const hudPrev = document.getElementById("hud-prev");
  const hudLyric = document.getElementById("hud-lyric");
  const hudNext = document.getElementById("hud-next");
  const hudDeck = document.getElementById("live-hud");
  const splitSop = document.getElementById("split-sop");
  const splitAlt = document.getElementById("split-alt");
  const splitTen = document.getElementById("split-ten");

  const voiceColor = roleColors[curMeasure.role] || "#38bdf8";

  if (hudBadge) {
    hudBadge.className = "hud-badge " + (curMeasure.badge ? curMeasure.badge.replace("badge-", "chip-") : "chip-intro");
    hudBadge.textContent = curMeasure.singer;
  }

  if (hudMTag) {
    hudMTag.textContent = "Ô nhịp: M" + (curMIdx + 1) + " / " + measuresData.length + " • " + (curMeasure.section_title || curSec.title);
  }

  // Active full phrase from calibrated video lyric card
  const cIdx = curMeasure.card_idx;
  let activeLyricText = curMeasure.text;
  if (typeof videoLyricCards !== "undefined" && videoLyricCards[cIdx] && videoLyricCards[cIdx].text) {
    activeLyricText = videoLyricCards[cIdx].text;
  }

  if (hudPrev) {
    let prevTxt = "";
    if (typeof videoLyricCards !== "undefined") {
      for (let p = cIdx - 1; p >= 0; p--) {
        if (videoLyricCards[p] && videoLyricCards[p].text) {
          prevTxt = videoLyricCards[p].text;
          break;
        }
      }
    }
    hudPrev.textContent = prevTxt || (curMIdx > 0 ? measuresData[curMIdx - 1].text : "Bắt đầu bài hát");
  }

  if (hudLyric) {
    hudLyric.textContent = activeLyricText;
    hudLyric.style.setProperty("--voice-color", voiceColor);
    hudLyric.style.color = voiceColor;
    hudLyric.style.textShadow = "0 0 16px " + voiceColor + ", 0 0 32px " + voiceColor + "88";
  }

  if (hudNext) {
    let nextTxt = "";
    if (typeof videoLyricCards !== "undefined") {
      for (let n = cIdx + 1; n < videoLyricCards.length; n++) {
        if (videoLyricCards[n] && videoLyricCards[n].text) {
          nextTxt = videoLyricCards[n].text;
          break;
        }
      }
    }
    hudNext.textContent = nextTxt || (curMIdx < measuresData.length - 1 ? measuresData[curMIdx + 1].text : "Kết thúc bài hát");
  }

  if (splitSop) {
    const txt = curMeasure.sop_lyr || "—";
    const isActive = !!txt && txt !== "—";
    splitSop.innerHTML = '<span class="role-lbl">🔴 N1 Cao</span> <span class="lyr-txt">' + txt + '</span>';
    splitSop.classList.toggle("active-voice", isActive);
  }

  if (splitAlt) {
    const txt = curMeasure.alt_lyr || "—";
    const isActive = !!txt && txt !== "—";
    splitAlt.innerHTML = '<span class="role-lbl">🟣 N2 Trầm</span> <span class="lyr-txt">' + txt + '</span>';
    splitAlt.classList.toggle("active-voice", isActive);
  }

  if (splitTen) {
    const txt = curMeasure.ten_lyr || "—";
    const isActive = !!txt && txt !== "—";
    splitTen.innerHTML = '<span class="role-lbl">🔵 Nam Cao</span> <span class="lyr-txt">' + txt + '</span>';
    splitTen.classList.toggle("active-voice", isActive);
  }

  if (hudDeck) {
    hudDeck.style.borderBottomColor = voiceColor;
  }
}

// Highlight Measure Across All 3 Staves (Soft glow on active notes & lyrics)
function highlightMeasure(mIdx, curT, startT, endT, role) {
  const svg = document.querySelector("#sheet-paper svg");
  if (!svg) return;

  // Fetch cached bounding box
  let boxData = measureBBoxes[mIdx];
  if (!boxData) {
    const allElements = Array.from(svg.querySelectorAll(".abcjs-mm" + mIdx));
    if (!allElements || allElements.length === 0) return;
    const elements = allElements.filter(el => 
      !el.classList.contains("abcjs-staff-extra") && 
      !el.classList.contains("abcjs-voice-name")
    );
    if (elements.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      try {
        const b = el.getBBox();
        if (b.width > 0 && b.height > 0) {
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
          if (b.x + b.width > maxX) maxX = b.x + b.width;
          if (b.y + b.height > maxY) maxY = b.y + b.height;
        }
      } catch (e) {}
    });

    if (minX === Infinity) return;
    const padX = 6, padY = 8;
    boxData = {
      boxX: minX - padX,
      boxY: minY - padY,
      boxW: (maxX - minX) + (padX * 2),
      boxH: (maxY - minY) + (padY * 2)
    };
    measureBBoxes[mIdx] = boxData;
  }

  // Remove red playhead line and measure-box if present (user explicitly requested no running box/line)
  svg.querySelectorAll(".active-playhead-line, #playhead-line, #measure-box, .active-measure-box").forEach(el => el.remove());

  // Highlight active notes & lyrics with specific voice singer colors
  if (currentM !== mIdx) {
    currentM = mIdx;

    // Reset previous active elements
    svg.querySelectorAll(".live-active-item, .live-soprano, .live-alto, .live-tenor, .live-trio").forEach(el => {
      el.classList.remove("live-active-item", "live-soprano", "live-alto", "live-tenor", "live-trio");
    });

    // Apply voice-specific glow to current measure elements (exclude staff lines, clefs, bar numbers)
    const activeElements = svg.querySelectorAll(".abcjs-mm" + mIdx);
    activeElements.forEach(el => {
      if (
        el.classList.contains("abcjs-staff-extra") ||
        el.classList.contains("abcjs-clef") ||
        el.classList.contains("abcjs-key-signature") ||
        el.classList.contains("abcjs-bar") ||
        el.classList.contains("abcjs-bar-number") ||
        el.classList.contains("abcjs-voice-name")
      ) {
        return;
      }

      el.classList.add("live-active-item");
      if (el.classList.contains("abcjs-v0")) {
        el.classList.add("live-soprano");
      } else if (el.classList.contains("abcjs-v1")) {
        el.classList.add("live-alto");
      } else if (el.classList.contains("abcjs-v2")) {
        el.classList.add("live-tenor");
      } else {
        if (role === "soprano") el.classList.add("live-soprano");
        else if (role === "alto") el.classList.add("live-alto");
        else if (role === "tenor") el.classList.add("live-tenor");
        else el.classList.add("live-trio");
      }
    });

    // SYSTEM-ROW STEPPING AUTO-SCROLL:
    // Only scroll when transitioning to a NEW stave system line
    const measureY = boxData.boxY;
    const isNewSystem = (lastSystemRowY === -1) || (Math.abs(measureY - lastSystemRowY) > 50);

    if (isNewSystem) {
      lastSystemRowY = measureY;
      if (autoScrollEnabled) {
        const header = document.querySelector(".top-deck");
        const headerH = header ? header.offsetHeight : 160;
        const svgRect = svg.getBoundingClientRect();
        const svgTopDoc = window.scrollY + svgRect.top;
        const scaleFactor = svg.viewBox.baseVal && svg.viewBox.baseVal.width ? (svgRect.width / svg.viewBox.baseVal.width) : 1;
        const systemTopDoc = svgTopDoc + (boxData.boxY * scaleFactor);
        const targetScrollY = Math.max(0, systemTopDoc - headerH - 24);

        window.scrollTo({ top: targetScrollY, behavior: "smooth" });
      }
    }
  }
}

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
  renderPills();
  renderSheet();
  updatePlayback(0);
});

window.addEventListener("resize", () => {
  renderSheet();
});
