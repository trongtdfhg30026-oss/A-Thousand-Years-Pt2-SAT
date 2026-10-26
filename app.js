// Master Audio & Score Synchronization Controller (SAT 3-Stave Engine)

const audio = document.getElementById("audio-player");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");
const playText = document.getElementById("play-text");
const progressBar = document.getElementById("progress-bar");
const timeDisplay = document.getElementById("time-display");
const zoomText = document.getElementById("zoom-text");
const autoScrollBtn = document.getElementById("btn-autoscroll");
const lyricsStreamContainer = document.getElementById("lyrics-stream");
const sheetColumn = document.getElementById("sheet-column-panel");

let isPlaying = false;
let autoScrollEnabled = false;
let currentScale = 1.0;
let animFrameId = null;
let currentActiveLyricId = -1;
let currentAudioSource = "vocal"; // "vocal" | "instrumental"

// Anti-jump & Playback Guards
let isManualSeeking = false;
let lastValidPlaybackTime = 0;
let seekTimeoutId = null;

// Virtual Clock Fallback (guarantees sheet and lyrics NEVER freeze)
let useVirtualClock = false;
let virtualStartTime = 0;

function getPlaybackTime() {
  if (useVirtualClock) {
    const elapsed = (performance.now() - virtualStartTime) / 1000;
    return Math.min(songDuration, Math.max(0, elapsed));
  }
  const t = audio.currentTime;
  if (typeof t === "number" && !isNaN(t)) {
    // If audio is playing and we are past the intro (e.g. lastValidTime > 5.0),
    // and t suddenly drops to 0 without a manual seek, ignore this momentary glitch!
    if (isPlaying && !isManualSeeking && lastValidPlaybackTime > 5.0 && t < 1.0) {
      return lastValidPlaybackTime;
    }
    lastValidPlaybackTime = t;
    return t;
  }
  return lastValidPlaybackTime || 0;
}

// Build and Render the Vertical Lyrics Stream
function renderLyricsStream() {
  if (!lyricsStreamContainer) return;
  lyricsStreamContainer.innerHTML = "";

  lyricsList.forEach((item) => {
    const div = document.createElement("div");
    div.className = "lyric-item";
    div.id = "lyric-item-" + item.id;
    div.setAttribute("data-role", item.role);

    const metaRow = document.createElement("div");
    metaRow.className = "lyric-meta-row";

    const pill = document.createElement("span");
    pill.className = "singer-pill";
    pill.textContent = item.singer;

    const timeBadge = document.createElement("span");
    timeBadge.className = "lyric-time-badge";
    timeBadge.textContent = formatTime(item.startT);

    metaRow.appendChild(pill);
    metaRow.appendChild(timeBadge);

    const textDiv = document.createElement("div");
    textDiv.className = "lyric-text";
    textDiv.textContent = item.text;

    div.appendChild(metaRow);
    div.appendChild(textDiv);

    div.addEventListener("click", () => {
      seekToTime(item.startT);
      if (!isPlaying) playAudio();
    });

    lyricsStreamContainer.appendChild(div);
  });
}

// Switch Audio Mode seamlessly between Vocal and Instrumental Beat
function switchAudioMode(mode) {
  if (currentAudioSource === mode) return;
  const curTime = getPlaybackTime();
  const wasPlaying = isPlaying;

  isManualSeeking = true;
  currentAudioSource = mode;
  let src = "vocal.mp3";
  if (mode === "instrumental") {
    src = "instrumental.mp3";
  }

  audio.src = src;
  audio.currentTime = curTime;

  document.querySelectorAll(".audio-switcher .mode-btn").forEach(btn => btn.classList.remove("active"));
  const btnId = mode === "instrumental" ? "btn-mode-inst" : "btn-mode-vocal";
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) activeBtn.classList.add("active");

  if (wasPlaying) {
    playAudio();
  }
  setTimeout(() => {
    isManualSeeking = false;
  }, 350);
}

// Audio Transport Controls
function togglePlay() {
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

function playAudio() {
  useVirtualClock = false;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        isPlaying = true;
        playIcon.textContent = "⏸";
        playText.textContent = "Tạm dừng";
        startAnimation();
      })
      .catch(err => {
        console.warn("Audio play prevented, fallback to virtual clock:", err);
        useVirtualClock = true;
        virtualStartTime = performance.now() - (audio.currentTime || 0) * 1000;
        isPlaying = true;
        playIcon.textContent = "⏸";
        playText.textContent = "Tạm dừng";
        startAnimation();
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
  playText.textContent = "Phát";
  if (animFrameId) cancelAnimationFrame(animFrameId);
}

function toggleAutoScroll() {
  autoScrollEnabled = !autoScrollEnabled;
  if (autoScrollBtn) {
    autoScrollBtn.classList.toggle("active", autoScrollEnabled);
    autoScrollBtn.textContent = autoScrollEnabled ? "📜 Cuộn: Bật" : "📜 Cuộn: Tắt";
  }
}

// Dynamically scale sheet paper container width based on zoom level
function applyPaperZoom() {
  const container = document.querySelector(".sheet-paper-container");
  if (!container || !sheetColumn) return;
  if (currentScale === 1.0) {
    container.style.width = "100%";
    container.style.maxWidth = "100%";
  } else {
    const baseW = Math.max(760, sheetColumn.clientWidth - 48);
    container.style.maxWidth = "none";
    container.style.width = Math.round(baseW * currentScale) + "px";
  }
}

// Clean staff from chords and instrument annotations
function cleanStaffABC(s) {
  if (!s) return "";
  return s.replace(/"[^"]*"/g, "").replace(/\s+/g, " ").trim();
}

function splitMeasures(str) {
  if (!str) return [];
  const parts = str.split("|").map(s => s.trim());
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

// Splits sections into evenly balanced 3-4 measure SAT systems that fill staff width
function formatSectionToSystems(sec) {
  const sopBars = splitMeasures(cleanStaffABC(sec.sop));
  const altBars = splitMeasures(cleanStaffABC(sec.alt));
  const tenBars = splitMeasures(cleanStaffABC(sec.ten));

  const sopW = splitMeasures(sec.sop_w);
  const altW = splitMeasures(sec.alt_w);
  const tenW = splitMeasures(sec.ten_w);

  const numBars = Math.max(sopBars.length, altBars.length, tenBars.length);
  if (numBars === 0) return "";

  const systemSizes = [];
  let rem = numBars;
  while (rem > 0) {
    if (rem === 6) {
      systemSizes.push(3);
      systemSizes.push(3);
      break;
    } else if (rem === 5) {
      systemSizes.push(3);
      systemSizes.push(2);
      break;
    } else if (rem <= 4) {
      systemSizes.push(rem);
      break;
    } else {
      systemSizes.push(4);
      rem -= 4;
    }
  }

  let out = "% --- " + sec.title + " ---\n";
  let barOffset = 0;

  systemSizes.forEach((size) => {
    const endOffset = barOffset + size;

    // Soprano
    const sBars = sopBars.slice(barOffset, endOffset).join(" | ") + " |";
    out += "[V:Soprano] " + sBars + "\n";
    if (sopW.length > 0) {
      const sWords = sopW.slice(barOffset, endOffset).map(w => w || " ").join(" | ") + " |";
      out += "w: " + sWords + "\n";
    }

    // Alto
    const aBars = altBars.slice(barOffset, endOffset).join(" | ") + " |";
    out += "[V:Alto] " + aBars + "\n";
    if (altW.length > 0) {
      const aWords = altW.slice(barOffset, endOffset).map(w => w || " ").join(" | ") + " |";
      out += "w: " + aWords + "\n";
    }

    // Tenor
    const tBars = tenBars.slice(barOffset, endOffset).join(" | ") + " |";
    out += "[V:Tenor] " + tBars + "\n";
    if (tenW.length > 0) {
      const tWords = tenW.slice(barOffset, endOffset).map(w => w || " ").join(" | ") + " |";
      out += "w: " + tWords + "\n";
    }

    barOffset = endOffset;
  });

  return out;
}

// Full Score ABC Rendering with 3-Stave SAT Voicing
function renderSheet() {
  const target = document.getElementById("sheet-paper");
  if (!target) return;

  applyPaperZoom();

  let abc = "X:1\n";
  abc += "M:6/8\n";
  abc += "L:1/8\n";
  abc += "Q:3/8=50\n";
  abc += "K:Bb\n";
  abc += "%%score [ Soprano | Alto | Tenor ]\n";
  abc += "%%stretchlast 1\n";
  abc += "%%measurenb 1\n";

  abc += 'V:Soprano name="N1 (Cao)" snm="N1" clef=treble\n';
  abc += 'V:Alto    name="N2 (Trầm)" snm="N2" clef=treble\n';
  abc += 'V:Tenor   name="Nam (Cao)"  snm="Nam" clef=treble-8\n';

  sectionsData.forEach(sec => {
    abc += formatSectionToSystems(sec);
  });

  const container = document.querySelector(".sheet-paper-container");
  const availW = container ? container.clientWidth - 40 : 880;
  const staffW = Math.max(760, availW);

  target.innerHTML = "";
  try {
    ABCJS.renderAbc(target, abc, {
      responsive: "resize",
      add_classes: true,
      staffwidth: staffW,
      paddingtop: 15,
      paddingbottom: 30,
      paddingleft: 10,
      paddingright: 10
    });
  } catch (e) {
    console.error("ABCJS rendering error:", e);
  }

  // Add click-to-seek functionality on measures in sheet
  setTimeout(() => {
    const svg = target.querySelector("svg");
    if (!svg) return;

    measuresData.forEach((m, mIdx) => {
      const elems = svg.querySelectorAll(".abcjs-mm" + mIdx);
      elems.forEach(el => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          seekToTime(m.startT);
          if (!isPlaying) playAudio();
        });
      });
    });

    // Re-apply highlight if an item is active
    if (currentActiveLyricId >= 0 && currentActiveLyricId < lyricsList.length) {
      highlightSentence(lyricsList[currentActiveLyricId]);
    }
  }, 200);
}

// Seek & Time Functions
function seekToTime(t) {
  t = Math.max(0, Math.min(songDuration, t));
  isManualSeeking = true;
  lastValidPlaybackTime = t;
  try {
    audio.currentTime = t;
  } catch (e) {}
  if (useVirtualClock) {
    virtualStartTime = performance.now() - t * 1000;
  }
  updatePlayback(t);
  clearTimeout(seekTimeoutId);
  seekTimeoutId = setTimeout(() => {
    isManualSeeking = false;
  }, 300);
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
  currentScale = Math.max(0.6, Math.min(1.8, Math.round((currentScale + delta) * 10) / 10));
  if (zoomText) {
    zoomText.textContent = Math.round(currentScale * 100) + "%";
  }
  applyPaperZoom();
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
    playText.textContent = "Phát";
    cancelAnimationFrame(animFrameId);
    curT = songDuration;
  }

  if (timeDisplay) {
    timeDisplay.textContent = formatTime(curT) + " / " + formatTime(dur);
  }
  if (progressBar) {
    const pct = Math.min(100, Math.max(0, (curT / dur) * 100));
    progressBar.style.width = pct + "%";
  }

  // Find active lyric line by checking timestamps
  let activeLyric = null;
  for (let i = lyricsList.length - 1; i >= 0; i--) {
    if (curT >= lyricsList[i].startT) {
      activeLyric = lyricsList[i];
      break;
    }
  }

  if (!activeLyric) {
    activeLyric = lyricsList[0];
  }

  // Anti-jump guard:
  // If audio is playing and we are past the intro, never jump back to Intro (id 0) during playback!
  if (isPlaying && currentActiveLyricId > 0 && activeLyric.id === 0 && !isManualSeeking && curT > 2.0) {
    activeLyric = lyricsList[currentActiveLyricId];
  }

  // Update Vertical Lyrics Stream
  if (activeLyric && activeLyric.id !== currentActiveLyricId) {
    currentActiveLyricId = activeLyric.id;

    // Update active class in lyrics stream
    const items = document.querySelectorAll(".lyric-item");
    items.forEach(el => el.classList.remove("active"));

    const activeEl = document.getElementById("lyric-item-" + activeLyric.id);
    if (activeEl) {
      activeEl.classList.add("active");
      // Auto-center in stream container
      activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Highlight entire sentence across measures on the sheet
    highlightSentence(activeLyric);
  }
}

// Highlight Entire Sentence on Sheet Music
function highlightSentence(lyricItem) {
  const svg = document.querySelector("#sheet-paper svg");
  if (!svg) return;

  // Clear previous live highlights
  svg.querySelectorAll(".live-phrase-active").forEach(el => {
    el.classList.remove(
      "live-phrase-active",
      "live-soprano",
      "live-alto",
      "live-tenor",
      "live-trio",
      "live-climax"
    );
  });

  if (!lyricItem || !lyricItem.measures || lyricItem.measures.length === 0) return;

  const roleClass =
    lyricItem.role === "soprano"
      ? "live-soprano"
      : lyricItem.role === "alto"
      ? "live-alto"
      : lyricItem.role === "tenor"
      ? "live-tenor"
      : lyricItem.role === "climax"
      ? "live-climax"
      : "live-trio";

  // Apply highlight to all measures of this sentence
  let firstElement = null;
  lyricItem.measures.forEach(mIdx => {
    const measureElements = svg.querySelectorAll(".abcjs-mm" + mIdx);
    measureElements.forEach(el => {
      if (
        el.classList.contains("abcjs-staff-extra") ||
        el.classList.contains("abcjs-clef") ||
        el.classList.contains("abcjs-key-signature") ||
        el.classList.contains("abcjs-bar-number") ||
        el.classList.contains("abcjs-voice-name")
      ) {
        return;
      }
      if (!firstElement) firstElement = el;
      el.classList.add("live-phrase-active", roleClass);
    });
  });

  // Auto-scroll sheet column to active system
  if (autoScrollEnabled && firstElement && sheetColumn) {
    try {
      const rect = firstElement.getBoundingClientRect();
      const colRect = sheetColumn.getBoundingClientRect();
      const offset = rect.top - colRect.top;
      // Scroll if measure is outside central view
      if (offset < 40 || offset > colRect.height - 150) {
        sheetColumn.scrollBy({ top: offset - 100, behavior: "smooth" });
      }
    } catch (e) {}
  }
}

// Audio Event Listeners for Seek & Buffer State
if (audio) {
  audio.addEventListener("seeked", () => {
    isManualSeeking = false;
    updatePlayback(getPlaybackTime());
  });
  audio.addEventListener("seeking", () => {
    isManualSeeking = true;
  });
}

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
  renderLyricsStream();
  renderSheet();
  updatePlayback(0);
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyPaperZoom();
    renderSheet();
  }, 150);
});
