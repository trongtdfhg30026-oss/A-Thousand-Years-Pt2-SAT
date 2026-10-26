// Audio & Score Synchronization Controller (SAT 3-Stave High-Performance Engine)

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
let lastSystemRowY = -1;
let currentAudioSource = "vocal"; // "vocal" | "instrumental"

// Virtual Clock Fallback (guarantees sheet and lyrics NEVER freeze)
let useVirtualClock = false;
let virtualStartTime = 0;

// Singer Colors Map
const roleColors = {
  soprano: "#f43f5e",
  alto: "#a855f7",
  tenor: "#0ea5e9",
  trio: "#f59e0b",
  duet: "#f59e0b",
  climax: "#ef4444",
  intro: "#64748b"
};

function getPlaybackTime() {
  if (useVirtualClock) {
    const elapsed = (performance.now() - virtualStartTime) / 1000;
    return Math.min(songDuration, Math.max(0, elapsed));
  }
  return audio.currentTime || 0;
}

// Build and Render the Vertical Lyrics Stream
function renderLyricsStream() {
  if (!lyricsStreamContainer) return;
  lyricsStreamContainer.innerHTML = "";

  lyricsList.forEach((item, idx) => {
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

// Full Score ABC Rendering with 3-Stave SAT Voicing
function renderSheet() {
  const target = document.getElementById("sheet-paper");
  if (!target) return;

  let abc = "X:1\n";
  abc += "M:6/8\n";
  abc += "L:1/8\n";
  abc += "Q:3/8=50\n";
  abc += "K:Bb\n";
  abc += "%%scale " + currentScale.toFixed(2) + "\n";
  abc += "%%score (Soprano) (Alto) (Tenor)\n";
  abc += "%%staves [Soprano Alto Tenor]\n";
  abc += "%%maxshrink 0.8\n";
  abc += "%%measurenb 1\n";

  abc += 'V:Soprano name="N1 (Cao)" sname="N1" clef=treble\n';
  abc += 'V:Alto name="N2 (Trầm)" sname="N2" clef=treble\n';
  abc += 'V:Tenor name="Nam (Cao)" sname="Nam" clef=treble-8\n';

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
      staffwidth: 980,
      paddingtop: 15,
      paddingbottom: 30,
      paddingleft: 15,
      paddingright: 15
    });
  } catch (e) {
    console.error("ABCJS rendering error:", e);
  }

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
          seekToTime(m.startT);
          if (!isPlaying) playAudio();
        });
      });
    });
  }, 250);
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

  // Identify Active Lyric Line
  let activeLyric = lyricsList[0];
  for (let i = 0; i < lyricsList.length; i++) {
    if (curT >= lyricsList[i].startT && curT < lyricsList[i].endT) {
      activeLyric = lyricsList[i];
      break;
    }
    if (curT >= lyricsList[lyricsList.length - 1].startT) {
      activeLyric = lyricsList[lyricsList.length - 1];
    }
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

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
  renderLyricsStream();
  renderSheet();
  updatePlayback(0);
});

window.addEventListener("resize", () => {
  renderSheet();
});
