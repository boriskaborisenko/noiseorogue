/* NOISE'O'ROGUE static player (vanilla) */

const $ = (sel) => document.querySelector(sel);

const els = {
  grid: $("#trackGrid"),
  status: $("#status"),

  audio: $("#audio"),
  cover: $("#cover"),

  nowTitleWrap: $("#nowTitle"),
  nowTitleText: $("#nowTitleText"),
  nowArtist: $("#nowArtist"),
  nowTags: $("#nowTags"),

  playBtn: $("#playBtn"),
  prevBtn: $("#prevBtn"),
  nextBtn: $("#nextBtn"),
  shuffleBtn: $("#shuffleBtn"),
  loopBtn: $("#loopBtn"),
  dlBtn: $("#dlBtn"),

  seek: $("#seek"),
  timeCur: $("#timeCur"),
  timeDur: $("#timeDur"),

  vol: $("#vol"),
};

const LS_KEYS = {
  volume: "nor_volume",
  trackId: "nor_track_id",
  time: "nor_track_time",
  shuffle: "nor_shuffle",
  loop: "nor_loop",
};

const state = {
  tracks: [],
  currentIndex: -1,
  isSeeking: false,
  isShuffle: false,
  isLoop: false,
};

const fmtTime = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const setShuffle = (on) => {
  state.isShuffle = !!on;
  els.shuffleBtn.classList.toggle("btn--on", state.isShuffle);
  localStorage.setItem(LS_KEYS.shuffle, String(state.isShuffle));
};

const setLoop = (on) => {
  state.isLoop = !!on;
  els.loopBtn.classList.toggle("btn--on", state.isLoop);
  els.audio.loop = state.isLoop;
  localStorage.setItem(LS_KEYS.loop, String(state.isLoop));
};

const setVolume01 = (v01) => {
  const v = clamp(v01, 0, 1);
  els.audio.volume = v;
  els.vol.value = String(Math.round(v * 100));
  localStorage.setItem(LS_KEYS.volume, String(v));
};

const getSavedVolume01 = () => {
  const raw = localStorage.getItem(LS_KEYS.volume);
  const v = raw == null ? 0.8 : Number(raw);
  return Number.isFinite(v) ? clamp(v, 0, 1) : 0.8;
};

const renderTags = (tagList) => {
  els.nowTags.innerHTML = "";
  if (!Array.isArray(tagList)) return;
  tagList.slice(0, 6).forEach((t) => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = String(t);
    els.nowTags.appendChild(b);
  });
};

const markActiveCard = () => {
  const cards = els.grid.querySelectorAll(".card");
  cards.forEach((c) => c.classList.remove("card--active"));
  const cur = state.tracks[state.currentIndex];
  if (!cur) return;
  const active = els.grid.querySelector(`[data-id="${CSS.escape(cur.id)}"]`);
  if (active) active.classList.add("card--active");
};

const updateDownloadLink = (track) => {
  if (!track?.file) {
    els.dlBtn.setAttribute("href", "#");
    els.dlBtn.removeAttribute("download");
    return;
  }

  els.dlBtn.setAttribute("href", track.file);

  const safeTitle = (track.title || track.id || "track")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  els.dlBtn.setAttribute("download", `${safeTitle}.mp3`);
};

const updateMediaSession = (track) => {
  if (!("mediaSession" in navigator) || !track) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "NOISE'O'ROGUE",
      artist: track.artist || "NOISE'O'ROGUE",
      album: "NOISE'O'ROGUE",
      artwork: track.cover
        ? [
            { src: track.cover, sizes: "96x96", type: "image/jpeg" },
            { src: track.cover, sizes: "256x256", type: "image/jpeg" },
            { src: track.cover, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => els.audio.play());
    navigator.mediaSession.setActionHandler("pause", () => els.audio.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prevTrack());
    navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (Number.isFinite(details.seekTime)) els.audio.currentTime = details.seekTime;
    });
  } catch {
    // ignore
  }
};

const setPlayIcon = (isPlaying) => {
  const icon = els.playBtn.querySelector(".material-icons-round");
  if (!icon) return;
  icon.textContent = isPlaying ? "pause" : "play_arrow";
};

const enableMarqueeIfNeeded = () => {
  const wrap = els.nowTitleWrap;
  const span = els.nowTitleText;
  if (!wrap || !span) return;

  wrap.classList.remove("is-marquee");

  const oldDup = wrap.querySelector('[data-dup="1"]');
  if (oldDup) oldDup.remove();

  const overflow = span.scrollWidth > wrap.clientWidth + 4;
  if (!overflow) return;

  const clone = span.cloneNode(true);
  clone.setAttribute("data-dup", "1");
  wrap.appendChild(clone);

  wrap.classList.add("is-marquee");
};

const setNowPlaying = (track) => {
  const title = track?.title || "—";
  els.nowTitleText.textContent = title;
  els.nowArtist.textContent = track?.artist || "—";
  els.cover.src = track?.cover || "./covers/placeholder.jpg";

  renderTags(track?.tags || []);
  updateDownloadLink(track);
  updateMediaSession(track);

  requestAnimationFrame(enableMarqueeIfNeeded);
};

const findIndexById = (id) => state.tracks.findIndex((t) => t.id === id);

const setCurrentByIndex = (idx, opts = { autoplay: true, restoreTime: false }) => {
  const t = state.tracks[idx];
  if (!t) return;

  state.currentIndex = idx;
  els.audio.src = t.file;
  setNowPlaying(t);
  markActiveCard();

  localStorage.setItem(LS_KEYS.trackId, t.id);

  if (opts.restoreTime) {
    const rawT = localStorage.getItem(LS_KEYS.time);
    const savedTime = Number(rawT);
    if (Number.isFinite(savedTime) && savedTime > 0) {
      els.audio.currentTime = savedTime;
    }
  } else {
    localStorage.setItem(LS_KEYS.time, "0");
  }

  if (opts.autoplay) {
    els.audio.play().catch(() => {
      setPlayIcon(false);
    });
  } else {
    setPlayIcon(false);
  }
};

const nextTrack = () => {
  if (!state.tracks.length) return;

  if (state.isShuffle) {
    const next = state.tracks.length === 1
      ? 0
      : (() => {
          const pick = () => Math.floor(Math.random() * state.tracks.length);
          const n = pick();
          return n === state.currentIndex ? pick() : n;
        })();

    setCurrentByIndex(next, { autoplay: true, restoreTime: false });
    return;
  }

  const next = (state.currentIndex + 1) % state.tracks.length;
  setCurrentByIndex(next, { autoplay: true, restoreTime: false });
};

const prevTrack = () => {
  if (!state.tracks.length) return;

  if (els.audio.currentTime > 3) {
    els.audio.currentTime = 0;
    return;
  }

  const prev = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
  setCurrentByIndex(prev, { autoplay: true, restoreTime: false });
};

const renderGrid = (list) => {
  els.grid.innerHTML = "";

  list.forEach((t) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = t.id;

    const img = document.createElement("img");
    img.className = "card__cover";
    img.src = t.cover || "./covers/placeholder.jpg";
    img.alt = t.title || t.id;

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("div");
    title.className = "card__title";
    title.textContent = t.title || t.id;

    const artist = document.createElement("div");
    artist.className = "card__artist";
    artist.textContent = t.artist || "NOISE'O'ROGUE";

    const badges = document.createElement("div");
    badges.className = "badges";
    (Array.isArray(t.tags) ? t.tags : []).slice(0, 4).forEach((tag) => {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = String(tag);
      badges.appendChild(b);
    });

    body.appendChild(title);
    body.appendChild(artist);
    body.appendChild(badges);

    card.appendChild(img);
    card.appendChild(body);

    card.addEventListener("click", () => {
      const idx = findIndexById(t.id);
      if (idx === -1) return;
      setCurrentByIndex(idx, { autoplay: true, restoreTime: false });
    });

    els.grid.appendChild(card);
  });
};

const wireUI = () => {
  els.playBtn.addEventListener("click", () => {
    if (!els.audio.src) {
      if (state.tracks.length) setCurrentByIndex(0, { autoplay: true, restoreTime: true });
      return;
    }
    if (els.audio.paused) els.audio.play().catch(() => {});
    else els.audio.pause();
  });

  els.prevBtn.addEventListener("click", prevTrack);
  els.nextBtn.addEventListener("click", nextTrack);

  els.shuffleBtn.addEventListener("click", () => setShuffle(!state.isShuffle));
  els.loopBtn.addEventListener("click", () => setLoop(!state.isLoop));

  els.vol.addEventListener("input", (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    setVolume01(v / 100);
  });

  els.seek.addEventListener("input", () => {
    state.isSeeking = true;
  });

  els.seek.addEventListener("change", (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || !Number.isFinite(els.audio.duration) || els.audio.duration <= 0) {
      state.isSeeking = false;
      return;
    }
    const t = (v / 1000) * els.audio.duration;
    els.audio.currentTime = clamp(t, 0, els.audio.duration);
    state.isSeeking = false;
  });

  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName ? String(e.target.tagName).toLowerCase() : "";
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      els.playBtn.click();
      return;
    }

    if (e.code === "KeyN") nextTrack();
    if (e.code === "KeyP") prevTrack();
    if (e.code === "KeyS") setShuffle(!state.isShuffle);
    if (e.code === "KeyL") setLoop(!state.isLoop);

    if (e.code === "ArrowRight") els.audio.currentTime = clamp(els.audio.currentTime + 5, 0, els.audio.duration || 1e12);
    if (e.code === "ArrowLeft") els.audio.currentTime = clamp(els.audio.currentTime - 5, 0, els.audio.duration || 1e12);

    if (e.code === "ArrowUp") {
      e.preventDefault();
      setVolume01(els.audio.volume + 0.05);
    }
    if (e.code === "ArrowDown") {
      e.preventDefault();
      setVolume01(els.audio.volume - 0.05);
    }
  });

  els.audio.addEventListener("play", () => setPlayIcon(true));
  els.audio.addEventListener("pause", () => setPlayIcon(false));

  els.audio.addEventListener("timeupdate", () => {
    if (!Number.isFinite(els.audio.duration) || els.audio.duration <= 0) return;

    els.timeCur.textContent = fmtTime(els.audio.currentTime);
    if (!state.isSeeking) {
      const ratio = els.audio.currentTime / els.audio.duration;
      els.seek.value = String(Math.round(ratio * 1000));
    }

    if (state.currentIndex >= 0) localStorage.setItem(LS_KEYS.time, String(els.audio.currentTime));
  });

  els.audio.addEventListener("loadedmetadata", () => {
    els.timeDur.textContent = fmtTime(els.audio.duration);
    els.timeCur.textContent = fmtTime(els.audio.currentTime);
    requestAnimationFrame(enableMarqueeIfNeeded);
  });

  els.audio.addEventListener("ended", () => {
    if (state.isLoop) return;
    nextTrack();
  });

  window.addEventListener("resize", () => {
    requestAnimationFrame(enableMarqueeIfNeeded);
  });
};

const restoreToggles = () => {
  const sh = localStorage.getItem(LS_KEYS.shuffle);
  setShuffle(sh === "true");

  const lp = localStorage.getItem(LS_KEYS.loop);
  setLoop(lp === "true");

  setVolume01(getSavedVolume01());
};

const loadTracks = async () => {
  els.status.textContent = "loading tracks.json…";

  try {
    const res = await fetch("./tracks.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("tracks.json is not an array");

    state.tracks = data
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: String(t.id || "").trim(),
        title: String(t.title || "").trim(),
        artist: String(t.artist || "NOISE'O'ROGUE").trim(),
        file: String(t.file || "").trim(),
        cover: String(t.cover || "./covers/placeholder.jpg").trim(),
        tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
        bpm: t.bpm,
      }))
      .filter((t) => t.id && t.file);

    renderGrid(state.tracks);
    els.status.textContent = `${state.tracks.length} track(s)`;

    const savedId = localStorage.getItem(LS_KEYS.trackId);
    const idx = savedId ? findIndexById(savedId) : -1;

    if (idx >= 0) setCurrentByIndex(idx, { autoplay: false, restoreTime: true });
    else if (state.tracks.length) setCurrentByIndex(0, { autoplay: false, restoreTime: false });

    markActiveCard();
  } catch (err) {
    console.error(err);
    els.status.textContent = "failed to load tracks.json";
  }
};

const main = () => {
  restoreToggles();
  wireUI();
  loadTracks();
};

main();
