/* FDE Learning Lab — app logic */

const STORAGE_KEY = "fde-learning-lab-v1";

const defaultState = () => ({
  chapterRead: {}, // id -> true
  readProgress: {}, // chapterId -> 0-100 scroll percent
  quizScores: {}, // chapterId -> { correct, total, perfect }
  scenariosDone: {}, // id -> { choice, score }
  cardsReviewed: 0,
  achievements: {},
  streak: 0,
  lastVisit: null,
  dailyDone: null, // YYYY-MM-DD
  dailyCorrect: false,
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
if (!state.readProgress) state.readProgress = {};
let currentView = "home";
let quizCtx = null;
let cardIdx = 0;
let cardFlipped = false;
let scenarioFilter = "all";
/** chapter tab: read | takeaways | action */
let chapterTab = "read";
let activeChapterId = null;
let chapterScrollHandler = null;

const THEME_KEY = "fde-theme";

function getTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}
  updateThemeUI();
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}

function updateThemeUI() {
  const dark = getTheme() === "dark";
  const icon = dark ? "☀️" : "🌙";
  const label = dark ? "切换到白天模式" : "切换到黑夜模式";
  document.querySelectorAll(".theme-icon").forEach((el) => {
    el.textContent = icon;
  });
  document.querySelectorAll(".theme-label").forEach((el) => {
    el.textContent = label;
  });
  document.querySelectorAll(".theme-toggle, .theme-toggle-bar").forEach((el) => {
    el.setAttribute("aria-label", label);
    el.title = label;
  });
}

function setMenuOpen(open) {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const toggle = document.getElementById("menu-toggle");
  if (!sidebar) return;
  sidebar.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  if (backdrop) {
    backdrop.hidden = !open;
    backdrop.classList.toggle("show", open);
  }
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeMenu() {
  setMenuOpen(false);
}

function toggleMenu() {
  const sidebar = document.getElementById("sidebar");
  setMenuOpen(sidebar && !sidebar.classList.contains("open"));
}

/* ---------- streak ---------- */
function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastVisit === today) return;
  if (state.lastVisit) {
    const prev = new Date(state.lastVisit);
    const cur = new Date(today);
    const diff = (cur - prev) / 86400000;
    if (diff === 1) state.streak = (state.streak || 0) + 1;
    else if (diff > 1) state.streak = 1;
  } else {
    state.streak = 1;
  }
  state.lastVisit = today;
  saveState();
  checkAchievements();
}

/* ---------- achievements ---------- */
function unlock(id) {
  if (state.achievements[id]) return;
  state.achievements[id] = Date.now();
  saveState();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a) toast(`${a.icon} 成就解锁：${a.title}`);
}

function checkAchievements() {
  if (Object.keys(state.quizScores).length >= 1) unlock("first_quiz");
  const scenCount = Object.keys(state.scenariosDone).length;
  if (scenCount >= 3) unlock("scenario_3");
  if (scenCount >= SCENARIOS.length) unlock("scenario_all");
  if (state.cardsReviewed >= 10) unlock("cards_10");
  const mastered = Object.keys(state.quizScores).filter(
    (k) => state.quizScores[k].correct / state.quizScores[k].total >= 0.6
  ).length;
  if (mastered >= 5) unlock("chapters_half");
  const mainQuizzes = [1, 2, 3, 4, 5, 6, 7, 8];
  if (mainQuizzes.every((c) => state.quizScores[c])) unlock("chapters_all");
  if (state.streak >= 3) unlock("streak_3");
  if (Object.values(state.quizScores).some((s) => s.perfect)) unlock("perfect");
}

/* ---------- progress metrics ---------- */
function overallProgress() {
  const quizable = [1, 2, 3, 4, 5, 6, 7, 8, 10];
  const done = quizable.filter((id) => state.quizScores[id]).length;
  const scen = Object.keys(state.scenariosDone).length;
  const scenPct = scen / SCENARIOS.length;
  const quizPct = done / quizable.length;
  const readIds = CHAPTERS.map((c) => c.id);
  const readSum = readIds.reduce((s, id) => s + (state.readProgress[id] || 0), 0);
  const readPct = readSum / (readIds.length * 100);
  return Math.round((quizPct * 0.45 + scenPct * 0.25 + readPct * 0.3) * 100);
}

function chapterReadPct(id) {
  return state.readProgress[id] || 0;
}

function isChapterWellRead(id) {
  return chapterReadPct(id) >= 80 || !!state.chapterRead[id];
}

/** Parse markdown → HTML + TOC entries with matching heading ids */
function renderMarkdown(md) {
  let html;
  if (typeof marked !== "undefined") {
    if (typeof marked.parse === "function") html = marked.parse(md);
    else if (typeof marked === "function") html = marked(md);
    else html = String(md);
  } else {
    html = `<pre class="reader-fallback">${escapeHtml(md)}</pre>`;
  }
  const toc = [];
  let i = 0;
  html = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, text) => {
    const id = `sec-${i++}`;
    const plain = text.replace(/<[^>]+>/g, "").trim();
    toc.push({ level: Number(level), text: plain, id });
    const extra = attrs || "";
    if (/\sid=/.test(extra)) {
      return `<h${level}${extra}>${text}</h${level}>`;
    }
    return `<h${level} id="${id}"${extra}>${text}</h${level}>`;
  });
  return { html, toc };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getChapterText(ch) {
  if (typeof CHAPTER_TEXT === "undefined" || !CHAPTER_TEXT) return null;
  return CHAPTER_TEXT[ch.file] || null;
}

function updateSideStats() {
  const pct = overallProgress();
  const el = document.getElementById("stat-progress");
  const bar = document.getElementById("stat-bar");
  const streak = document.getElementById("stat-streak");
  const xp = document.getElementById("stat-xp");
  if (el) el.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
  if (streak) streak.textContent = `${state.streak || 0} 天`;
  if (xp) xp.textContent = String(calcXP());
}

function calcXP() {
  let xp = 0;
  Object.values(state.quizScores).forEach((s) => {
    xp += s.correct * 20 + (s.perfect ? 30 : 0);
  });
  Object.values(state.scenariosDone).forEach((s) => {
    xp += (s.score || 0) * 15 + 10;
  });
  xp += Math.min(state.cardsReviewed, 50) * 2;
  return xp;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ---------- navigation ---------- */
function navigate(view, payload) {
  currentView = view;
  closeMenu();
  if (view !== "chapter" && chapterScrollHandler) {
    window.removeEventListener("scroll", chapterScrollHandler);
    chapterScrollHandler = null;
  }
  document.querySelectorAll(".nav button").forEach((b) => {
    const active =
      b.dataset.view === view ||
      (view === "essay" && b.dataset.view === "essays") ||
      ((view === "chapter" || view === "quiz") && b.dataset.view === "path");
    b.classList.toggle("active", active);
  });
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${view}`);
  });
  const renderers = {
    home: renderHome,
    path: renderPath,
    chapter: () => renderChapter(payload),
    quiz: () => startQuiz(payload),
    essays: renderEssays,
    essay: () => renderEssay(payload),
    scenarios: renderScenarios,
    cards: renderCards,
    daily: renderDaily,
    achievements: renderAchievements,
  };
  (renderers[view] || renderHome)();
  updateSideStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getEssayText(essay) {
  if (typeof ESSAY_TEXT === "undefined" || !ESSAY_TEXT) return null;
  return ESSAY_TEXT[essay.file] || null;
}

/* ---------- home ---------- */
function renderHome() {
  const root = document.getElementById("view-home");
  const today = new Date().toISOString().slice(0, 10);
  const dailyPending = state.dailyDone !== today;

  root.innerHTML = `
    <div class="hero">
      <div class="hero-card">
        <span class="badge">个人学习工具 · 非商业</span>
        <h3>${BOOK_META.title}</h3>
        <p class="tagline">「${BOOK_META.tagline}」</p>
        <p style="color:var(--text-muted);margin:0;font-size:0.92rem">
          基于 ${BOOK_META.author} 开源著作的互动学习站：全书原文内嵌 + 要点骨架 + 情境决策 + 闪卡闯关 + 社区延伸阅读。
        </p>
        <p class="meta-line" style="margin-top:0.75rem">
          原书 ${BOOK_META.version} · <strong>非官方 · 非盈利</strong> · 著作权归原作者
        </p>
        <div class="cta-row">
          <button class="btn btn-primary" data-go="path">打开学习地图</button>
          <button class="btn btn-ghost" data-go="essays">延伸阅读</button>
          <button class="btn btn-ghost" data-go="scenarios">情境推演</button>
          <button class="btn btn-ghost" data-go="daily">${dailyPending ? "今日一题" : "今日已练 ✓"}</button>
        </div>
      </div>
      <div class="hero-card daily-box">
        <h3 style="margin:0 0 0.5rem;font-size:1.05rem">你的驻场状态</h3>
        <div class="side-stats" style="margin:0;border:none;padding:0;background:transparent">
          <div class="row"><span>学习进度</span><strong>${overallProgress()}%</strong></div>
          <div class="row"><span>经验值 XP</span><strong>${calcXP()}</strong></div>
          <div class="row"><span>连续学习</span><strong>${state.streak || 0} 天</strong></div>
          <div class="row"><span>情境完成</span><strong>${Object.keys(state.scenariosDone).length}/${SCENARIOS.length}</strong></div>
          <div class="row"><span>闪卡复习</span><strong>${state.cardsReviewed} 张</strong></div>
        </div>
        <div class="progress-bar" style="margin-top:1rem"><i style="width:${overallProgress()}%"></i></div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0.85rem 0 0">
          建议节奏：每天 1 章要点 + 2 个情境 + 5 张闪卡（约 25–40 分钟）。
        </p>
      </div>
    </div>

    <div class="panel thanks-hero" style="margin-bottom:1.25rem">
      <h3 style="margin:0 0 0.5rem;font-size:1.1rem">🙏 特别感谢 · 作者与贡献者</h3>
      <p style="margin:0 0 0.75rem;color:var(--text-muted);font-size:0.92rem;line-height:1.65">
        本站主线内容来自 <strong>${BOOK_META.author}</strong> 免费开源的《前线部署工程师》。
        感谢作者把系统研究公开分享。本站为<strong>非官方、非盈利</strong>学习工具，著作权归原作者。
      </p>
      <div class="cta-row" style="margin-top:0">
        <a class="btn btn-primary" href="${BOOK_META.repo}" target="_blank" rel="noopener">打开原书仓库</a>
        <a class="btn btn-ghost" href="${BOOK_META.x}" target="_blank" rel="noopener">在 X 关注 @XDash</a>
      </div>
      <div class="thanks-divider"></div>
      <p style="margin:0 0 0.5rem;font-weight:600;font-size:0.95rem">延伸阅读 · 同样感谢以下作者</p>
      <ul class="thanks-list">
        <li>
          <strong>Punk（@AdrianPunk115）</strong> — FDE 是什么、怎么转、半年路线
          · <a href="https://x.com/AdrianPunk115/status/2083090241683128626" target="_blank" rel="noopener">原文</a>
          · <a href="https://x.com/AdrianPunk115" target="_blank" rel="noopener">主页</a>
        </li>
        <li>
          <strong>阿哲Phil（@Formulasearch）</strong> — 真假 FDE 怎么辨
          · <a href="https://x.com/Formulasearch/status/2083773600776262120" target="_blank" rel="noopener">原文</a>
          · <a href="https://x.com/Formulasearch" target="_blank" rel="noopener">主页</a>
        </li>
        <li>
          <strong>阿哲Phil（@Formulasearch）</strong> — 真 FDE 怎么入行
          · <a href="https://x.com/Formulasearch/status/2084158215596486804" target="_blank" rel="noopener">原文</a>
          · <a href="https://x.com/Formulasearch" target="_blank" rel="noopener">主页</a>
        </li>
      </ul>
      <div class="cta-row">
        <button class="btn btn-ghost" data-go="essays">打开延伸阅读</button>
      </div>
    </div>

    <h3 style="margin:0 0 0.75rem">交付旅程 · 一览</h3>
    <div class="journey" id="home-journey"></div>

    <div class="grid-2" style="margin-top:0.5rem">
      <div class="panel">
        <h3 style="margin:0 0 0.5rem;font-size:1rem">为什么比干读更有效？</h3>
        <ul class="takeaways">
          <li><strong>站内原文</strong>：学习地图点开章节即可读全文，带目录与阅读进度</li>
          <li><strong>情境决策</strong>：把书里的判断力变成「你会怎么选」</li>
          <li><strong>延伸阅读</strong>：社区长文补充求职、真假辨与入行路径</li>
          <li><strong>间隔重复</strong>：闪卡把 PSF、NRR、热修复等术语钉进长期记忆</li>
        </ul>
      </div>
      <div class="panel">
        <h3 style="margin:0 0 0.5rem;font-size:1rem">推荐学习顺序</h3>
        <ol style="margin:0;padding-left:1.2rem;color:var(--text-muted);font-size:0.9rem">
          <li>第 1 章建立定义 → 做 2 个入门情境</li>
          <li>第 2–4 章（问题→客户→激活）是核心交付链</li>
          <li>第 5–7 章（续约→扩收→复制）是商业闭环</li>
          <li>第 8 章案例对照；附录 A–C 指标与出处随时查</li>
          <li>求职向：读完主线后再看「延伸阅读」三篇</li>
        </ol>
        <div class="cta-row">
          <button class="btn btn-primary" data-go-chapter="1">从第 1 章开始</button>
          <button class="btn btn-ghost" data-go="cards">先刷闪卡</button>
        </div>
      </div>
    </div>
    <div class="legal">
      主线原文 © ${BOOK_META.author}。感谢作者开源。非商业学习用途；商业用途须获作者书面许可。
      原书：<a href="${BOOK_META.repo}" target="_blank" rel="noopener">GitHub</a>
      · 作者 X：<a href="${BOOK_META.x}" target="_blank" rel="noopener">@XDash</a>。
      延伸阅读版权归 @AdrianPunk115、@Formulasearch，已附原文链接。若作者要求移除，将改为摘要+外链。
    </div>
  `;

  const journey = root.querySelector("#home-journey");
  JOURNEY.forEach((node) => {
    const done = !!state.quizScores[node.chapter];
    const div = document.createElement("div");
    div.className = "journey-node" + (done ? " done" : "");
    div.innerHTML = `
      <div class="emoji">${node.emoji}</div>
      <div class="label">${node.label}</div>
      <div class="sub">第 ${node.chapter} 章 ${done ? "· 已闯关" : ""}</div>
    `;
    div.onclick = () => navigate("chapter", node.chapter);
    journey.appendChild(div);
  });

  root.querySelectorAll("[data-go]").forEach((b) => {
    b.onclick = () => navigate(b.dataset.go);
  });
  root.querySelectorAll("[data-go-chapter]").forEach((b) => {
    b.onclick = () => navigate("chapter", Number(b.dataset.goChapter));
  });
}

/* ---------- path ---------- */
function renderPath() {
  const root = document.getElementById("view-path");
  root.innerHTML = `
    <div class="view-header">
      <h2>学习地图</h2>
      <p>按交付旅程推进。每章：读要点 → 测验闯关 → 回原文深读。点卡片进入。</p>
    </div>
    <div class="grid-3" id="path-grid"></div>
  `;
  const grid = root.querySelector("#path-grid");
  CHAPTERS.forEach((ch) => {
    const score = state.quizScores[ch.id];
    const rp = chapterReadPct(ch.id);
    let badge = "待阅读";
    let badgeClass = "";
    if (score) {
      const r = score.correct / score.total;
      badge = r >= 0.8 ? "已掌握" : "已测验";
      badgeClass = r >= 0.8 ? "ok" : "warn";
    } else if (isChapterWellRead(ch.id)) {
      badge = "已读完";
      badgeClass = "ok";
    } else if (rp > 0) {
      badge = `读至 ${rp}%`;
      badgeClass = "warn";
    }
    const card = document.createElement("div");
    card.className = "chapter-card";
    card.innerHTML = `
      <div class="top">
        <span class="badge">约 ${ch.minutes} 分钟</span>
        <span class="badge ${badgeClass}">${badge}</span>
      </div>
      <h3>${ch.title}</h3>
      <div class="why">${ch.why}</div>
      <div class="mini-progress" title="阅读进度"><i style="width:${rp}%"></i></div>
      ${score ? `<div class="score-pill">测验 ${score.correct}/${score.total}</div>` : ""}
    `;
    card.onclick = () => {
      chapterTab = "read";
      navigate("chapter", ch.id);
    };
    grid.appendChild(card);
  });
}

/* ---------- chapter detail ---------- */
function renderChapter(id) {
  const ch = CHAPTERS.find((c) => c.id === id) || CHAPTERS[1];
  activeChapterId = ch.id;
  if (!chapterTab) chapterTab = "read";

  if (chapterScrollHandler) {
    window.removeEventListener("scroll", chapterScrollHandler);
    chapterScrollHandler = null;
  }

  const root = document.getElementById("view-chapter");
  const hasQuiz = !!QUIZZES[ch.id];
  const score = state.quizScores[ch.id];
  const related = SCENARIOS.filter((s) => s.chapter === ch.id);
  const idx = CHAPTERS.findIndex((c) => c.id === ch.id);
  const prev = idx > 0 ? CHAPTERS[idx - 1] : null;
  const next = idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;
  const rp = chapterReadPct(ch.id);
  const raw = getChapterText(ch);

  root.innerHTML = `
    <div class="view-header chapter-head">
      <button class="btn btn-ghost" id="back-path" style="margin-bottom:0.75rem">← 返回地图</button>
      <h2>${ch.title}</h2>
      <p>${ch.why}</p>
      <div class="chapter-tabs" role="tablist">
        <button type="button" class="tab-btn ${chapterTab === "read" ? "active" : ""}" data-tab="read">📖 原文</button>
        <button type="button" class="tab-btn ${chapterTab === "takeaways" ? "active" : ""}" data-tab="takeaways">✨ 要点</button>
        <button type="button" class="tab-btn ${chapterTab === "action" ? "active" : ""}" data-tab="action">⚔️ 行动</button>
      </div>
      <div class="read-progress-line">
        <span>阅读进度 <strong id="read-pct-label">${rp}%</strong></span>
        <div class="progress-bar"><i id="read-pct-bar" style="width:${rp}%"></i></div>
      </div>
    </div>

    <div id="tab-read" class="tab-panel ${chapterTab === "read" ? "active" : ""}"></div>
    <div id="tab-takeaways" class="tab-panel ${chapterTab === "takeaways" ? "active" : ""}">
      <div class="panel">
        <h3 style="margin:0 0 0.5rem;font-size:1.05rem">核心要点（先建立骨架）</h3>
        <ul class="takeaways">
          ${ch.takeaways.map((t) => `<li>${t}</li>`).join("")}
        </ul>
        ${ch.quote ? `<div class="quote-box">「${ch.quote}」</div>` : ""}
        ${
          ch.keyTerms
            ? `<div class="term-chips">${ch.keyTerms
                .map((t) => `<span class="chip">${t}</span>`)
                .join("")}</div>`
            : ""
        }
        <div class="cta-row" style="margin-top:1rem">
          <button class="btn btn-primary" id="goto-read">去读原文</button>
        </div>
      </div>
    </div>
    <div id="tab-action" class="tab-panel ${chapterTab === "action" ? "active" : ""}">
      <div class="detail-layout">
        <div class="panel">
          <h3 style="margin:0 0 0.75rem;font-size:1rem">本关行动</h3>
          <div class="cta-row" style="flex-direction:column;align-items:stretch">
            ${
              hasQuiz
                ? `<button class="btn btn-primary" id="btn-quiz">
                    ${score ? "再测一次" : "开始闯关测验"}
                    ${score ? `（上次 ${score.correct}/${score.total}）` : ""}
                  </button>`
                : `<span class="badge">本章以阅读为主，无专项测验</span>`
            }
            <button class="btn btn-ghost" id="btn-cards-related">复习相关闪卡</button>
            <button class="btn btn-ghost" id="btn-mark-read">标记本章已读完</button>
          </div>
          <p class="meta-line" style="margin-top:1rem">
            原文文件：${ch.file} · 进度保存在本机浏览器
          </p>
        </div>
        ${
          related.length
            ? `<div class="panel">
                <h3 style="margin:0 0 0.5rem;font-size:1rem">相关情境</h3>
                ${related
                  .map(
                    (s) =>
                      `<button class="btn btn-ghost" style="width:100%;margin:0.3rem 0;justify-content:flex-start"
                        data-scenario="${s.id}">${s.title} · ${s.difficulty}</button>`
                  )
                  .join("")}
              </div>`
            : `<div class="panel"><p class="meta-line" style="margin:0">本章暂无绑定情境，可去「情境模拟」自由练习。</p></div>`
        }
      </div>
    </div>

    <div class="chapter-nav">
      ${
        prev
          ? `<button class="btn btn-ghost" id="ch-prev">← ${prev.title}</button>`
          : `<span></span>`
      }
      ${
        next
          ? `<button class="btn btn-ghost" id="ch-next">${next.title} →</button>`
          : `<span></span>`
      }
    </div>
    <div class="legal" style="margin-top:1rem">
      感谢 ${BOOK_META.author} 开源本书 · 非商业学习 ·
      <a href="${BOOK_META.repo}" target="_blank" rel="noopener">原书仓库</a>
      · <a href="${BOOK_META.x}" target="_blank" rel="noopener">@XDash</a>
    </div>
  `;

  // Build reader panel
  const readPanel = root.querySelector("#tab-read");
  if (!raw) {
    readPanel.innerHTML = `
      <div class="panel empty">
        未找到原文数据（${ch.file}）。请确认 book-content.js 已生成，或运行
        <code>python scripts/build_book.py</code>。
      </div>`;
  } else {
    const { html, toc } = renderMarkdown(raw);
    const isNarrow = window.matchMedia("(max-width: 1100px)").matches;
    readPanel.innerHTML = `
      <div class="reader-layout">
        <aside class="reader-toc panel ${isNarrow ? "collapsed" : ""}" id="reader-toc">
          <button type="button" class="btn btn-ghost toc-toggle" id="toc-toggle">
            <span>本章目录（${toc.length}）</span>
            <span id="toc-chevron">${isNarrow ? "▼" : "▲"}</span>
          </button>
          <div class="toc-title desktop-only-toc">本章目录</div>
          <nav class="toc-nav">
            ${
              toc.length
                ? toc
                    .map(
                      (t) =>
                        `<a href="#${t.id}" class="toc-link level-${t.level}" data-sec="${t.id}">${escapeHtml(
                          t.text
                        )}</a>`
                    )
                    .join("")
                : `<span class="meta-line">无二级标题</span>`
            }
          </nav>
        </aside>
        <div class="reader-shell panel" id="reader-shell">
          <article class="reader" id="reader-scroll">${html}</article>
        </div>
      </div>`;

    const shell = readPanel.querySelector("#reader-shell");
    const tocEl = readPanel.querySelector("#reader-toc");
    const tocToggle = readPanel.querySelector("#toc-toggle");

    function updateReadPctFromScroll() {
      // On mobile shell is not a fixed viewport; use window scroll relative to article
      const article = readPanel.querySelector("#reader-scroll");
      let pct = 0;
      if (window.matchMedia("(max-width: 1100px)").matches && article) {
        const rect = article.getBoundingClientRect();
        const total = article.scrollHeight - window.innerHeight * 0.5;
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
        pct = total <= 0 ? 100 : Math.min(100, Math.round((scrolled / total) * 100));
      } else {
        const max = shell.scrollHeight - shell.clientHeight;
        pct = max <= 0 ? 100 : Math.min(100, Math.round((shell.scrollTop / max) * 100));
      }
      const prevPct = state.readProgress[ch.id] || 0;
      if (pct > prevPct) {
        state.readProgress[ch.id] = pct;
        if (pct >= 80) state.chapterRead[ch.id] = true;
        saveState();
        updateSideStats();
      }
      const show = Math.max(pct, state.readProgress[ch.id] || 0);
      const label = document.getElementById("read-pct-label");
      const bar = document.getElementById("read-pct-bar");
      if (label) label.textContent = `${show}%`;
      if (bar) bar.style.width = `${show}%`;
    }

    shell.addEventListener("scroll", updateReadPctFromScroll, { passive: true });
    chapterScrollHandler = updateReadPctFromScroll;
    window.addEventListener("scroll", chapterScrollHandler, { passive: true });

    if (tocToggle) {
      tocToggle.onclick = () => {
        const collapsed = tocEl.classList.toggle("collapsed");
        const chev = document.getElementById("toc-chevron");
        if (chev) chev.textContent = collapsed ? "▼" : "▲";
      };
    }

    // restore approximate scroll (desktop shell only)
    requestAnimationFrame(() => {
      const saved = state.readProgress[ch.id] || 0;
      if (saved > 0 && saved < 100 && !window.matchMedia("(max-width: 1100px)").matches) {
        const max = shell.scrollHeight - shell.clientHeight;
        shell.scrollTop = (saved / 100) * max;
      }
    });

    readPanel.querySelectorAll(".toc-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById(a.dataset.sec);
        if (!target) return;
        if (window.matchMedia("(max-width: 1100px)").matches) {
          const y = target.getBoundingClientRect().top + window.scrollY - 64;
          window.scrollTo({ top: y, behavior: "smooth" });
          if (tocEl) {
            tocEl.classList.add("collapsed");
            const chev = document.getElementById("toc-chevron");
            if (chev) chev.textContent = "▼";
          }
        } else {
          const top =
            target.getBoundingClientRect().top -
            shell.getBoundingClientRect().top +
            shell.scrollTop -
            12;
          shell.scrollTo({ top, behavior: "smooth" });
        }
      });
    });

    // first paint: if user opened chapter, at least mark 1% touched
    if (!state.readProgress[ch.id]) {
      state.readProgress[ch.id] = 1;
      saveState();
    }
  }

  // Tabs
  root.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      chapterTab = btn.dataset.tab;
      root.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === chapterTab));
      root.querySelectorAll(".tab-panel").forEach((p) => {
        p.classList.toggle("active", p.id === `tab-${chapterTab}`);
      });
    };
  });

  root.querySelector("#back-path").onclick = () => navigate("path");
  const gotoRead = root.querySelector("#goto-read");
  if (gotoRead) {
    gotoRead.onclick = () => {
      chapterTab = "read";
      root.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === "read"));
      root.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-read"));
    };
  }
  const bq = root.querySelector("#btn-quiz");
  if (bq) bq.onclick = () => navigate("quiz", ch.id);
  const cardsBtn = root.querySelector("#btn-cards-related");
  if (cardsBtn) cardsBtn.onclick = () => navigate("cards");
  const markBtn = root.querySelector("#btn-mark-read");
  if (markBtn) {
    markBtn.onclick = () => {
      state.readProgress[ch.id] = 100;
      state.chapterRead[ch.id] = true;
      saveState();
      updateSideStats();
      document.getElementById("read-pct-label").textContent = "100%";
      document.getElementById("read-pct-bar").style.width = "100%";
      toast("已标记读完");
    };
  }
  root.querySelectorAll("[data-scenario]").forEach((b) => {
    b.onclick = () => {
      navigate("scenarios");
      setTimeout(() => {
        document.getElementById(`scenario-${b.dataset.scenario}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    };
  });
  const prevBtn = root.querySelector("#ch-prev");
  const nextBtn = root.querySelector("#ch-next");
  if (prevBtn) {
    prevBtn.onclick = () => {
      chapterTab = "read";
      navigate("chapter", prev.id);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      chapterTab = "read";
      navigate("chapter", next.id);
    };
  }
}

/* ---------- essays ---------- */
function renderEssays() {
  const root = document.getElementById("view-essays");
  root.innerHTML = `
    <div class="view-header">
      <h2>延伸阅读</h2>
      <p>社区视角补充：入门定义、真假岗位、入行路径。主线仍请优先学习范冰（XDash）原书。</p>
    </div>
    <div class="panel thanks-hero" style="margin-bottom:1rem">
      <p style="margin:0;font-size:0.92rem;line-height:1.65">
        🙏 <strong>感谢文章作者</strong>：
        <a href="https://x.com/AdrianPunk115" target="_blank" rel="noopener">@AdrianPunk115（Punk）</a>、
        <a href="https://x.com/Formulasearch" target="_blank" rel="noopener">@Formulasearch（阿哲Phil）</a>。
        以下全文仅供非商业学习，每篇均附 X 原文链接；若作者要求下线，本站将立即调整。
      </p>
    </div>
    <div class="grid-2" id="essay-grid"></div>
  `;
  const grid = root.querySelector("#essay-grid");
  ESSAYS.forEach((e) => {
    const card = document.createElement("div");
    card.className = "chapter-card";
    card.innerHTML = `
      <div class="top">
        <span class="badge">${e.handle}</span>
        <span class="badge ok">感谢作者</span>
      </div>
      <h3>${e.title}</h3>
      <div class="why">${e.summary}</div>
      <div class="term-chips">${e.tags.map((t) => `<span class="chip">${t}</span>`).join("")}</div>
      <p class="meta-line" style="margin:0.5rem 0 0">${e.thanks}</p>
    `;
    card.onclick = () => navigate("essay", e.id);
    grid.appendChild(card);
  });
}

function renderEssay(id) {
  const essay = ESSAYS.find((e) => e.id === id) || ESSAYS[0];
  const raw = getEssayText(essay);
  const root = document.getElementById("view-essay");
  const idx = ESSAYS.findIndex((e) => e.id === essay.id);
  const prev = idx > 0 ? ESSAYS[idx - 1] : null;
  const next = idx < ESSAYS.length - 1 ? ESSAYS[idx + 1] : null;

  root.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost" id="back-essays" style="margin-bottom:0.75rem">← 返回延伸阅读</button>
      <h2>${essay.title}</h2>
      <p>${essay.summary}</p>
      <div class="essay-meta-bar">
        <span class="badge ok">作者 ${essay.author} ${essay.handle}</span>
        <a class="btn btn-primary" href="${essay.xUrl}" target="_blank" rel="noopener">打开 X 原文</a>
        <a class="btn btn-ghost" href="${essay.profileUrl}" target="_blank" rel="noopener">作者主页</a>
      </div>
      <div class="panel thanks-hero" style="margin-top:0.85rem;padding:0.85rem 1rem">
        <p style="margin:0;font-size:0.88rem;line-height:1.55">
          🙏 ${essay.thanks}。本页为非商业学习转载，请以
          <a href="${essay.xUrl}" target="_blank" rel="noopener">X 原文</a> 为准。
          主线请读 <a href="${BOOK_META.repo}" target="_blank" rel="noopener">范冰（XDash）原书</a>
          · <a href="${BOOK_META.x}" target="_blank" rel="noopener">@XDash</a>。
        </p>
      </div>
    </div>
    <div id="essay-body"></div>
    <div class="chapter-nav">
      ${prev ? `<button class="btn btn-ghost" id="essay-prev">← ${prev.title}</button>` : `<span></span>`}
      ${next ? `<button class="btn btn-ghost" id="essay-next">${next.title} →</button>` : `<span></span>`}
    </div>
  `;

  const body = root.querySelector("#essay-body");
  if (!raw) {
    body.innerHTML = `<div class="panel empty">未找到文章正文，请确认 essays-content.js 已加载。</div>`;
  } else {
    const { html } = renderMarkdown(raw);
    body.innerHTML = `
      <div class="reader-shell panel" style="max-height:none;overflow:visible">
        <article class="reader" style="padding:1.25rem 1.35rem 2rem">${html}</article>
      </div>`;
  }

  root.querySelector("#back-essays").onclick = () => navigate("essays");
  const ep = root.querySelector("#essay-prev");
  const en = root.querySelector("#essay-next");
  if (ep) ep.onclick = () => navigate("essay", prev.id);
  if (en) en.onclick = () => navigate("essay", next.id);
}

/* ---------- quiz ---------- */
function startQuiz(chapterId) {
  const questions = QUIZZES[chapterId];
  const root = document.getElementById("view-quiz");
  if (!questions) {
    root.innerHTML = `<div class="empty">本章暂无测验，请返回地图。</div>`;
    return;
  }
  quizCtx = {
    chapterId,
    questions: questions.map((q) => ({ ...q })),
    index: 0,
    correct: 0,
    answered: false,
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const root = document.getElementById("view-quiz");
  const ctx = quizCtx;
  const ch = CHAPTERS.find((c) => c.id === ctx.chapterId);

  if (ctx.index >= ctx.questions.length) {
    const total = ctx.questions.length;
    const perfect = ctx.correct === total;
    state.quizScores[ctx.chapterId] = {
      correct: ctx.correct,
      total,
      perfect,
    };
    saveState();
    checkAchievements();
    updateSideStats();
    root.innerHTML = `
      <div class="view-header">
        <h2>闯关结算</h2>
        <p>${ch ? ch.title : ""}</p>
      </div>
      <div class="panel" style="text-align:center;padding:2rem">
        <div style="font-size:2.5rem;font-weight:800;color:var(--accent)">${ctx.correct}/${total}</div>
        <p style="color:var(--text-muted)">${perfect ? "完美通关！一次做对。" : ctx.correct / total >= 0.6 ? "过关。错题建议回要点再过一遍。" : "再练一次，建议先做相关情境。"}</p>
        <div class="cta-row" style="justify-content:center">
          <button class="btn btn-primary" id="quiz-retry">再测一次</button>
          <button class="btn btn-ghost" id="quiz-back">返回章节</button>
          <button class="btn btn-ghost" id="quiz-next">学习地图</button>
        </div>
      </div>
    `;
    root.querySelector("#quiz-retry").onclick = () => startQuiz(ctx.chapterId);
    root.querySelector("#quiz-back").onclick = () => navigate("chapter", ctx.chapterId);
    root.querySelector("#quiz-next").onclick = () => navigate("path");
    return;
  }

  const q = ctx.questions[ctx.index];
  ctx.answered = false;
  root.innerHTML = `
    <div class="view-header">
      <button class="btn btn-ghost" id="quiz-exit" style="margin-bottom:0.5rem">← 退出</button>
      <h2>章节测验</h2>
      <p>${ch ? ch.title : ""}</p>
    </div>
    <div class="panel">
      <div class="quiz-progress">第 ${ctx.index + 1} / ${ctx.questions.length} 题 · 当前得分 ${ctx.correct}</div>
      <div class="quiz-q">${q.q}</div>
      <div id="options"></div>
      <div id="explain-slot"></div>
      <div class="cta-row" style="margin-top:1rem">
        <button class="btn btn-primary" id="quiz-next-q" disabled>下一题</button>
      </div>
    </div>
  `;

  const optionsEl = root.querySelector("#options");
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = opt;
    btn.onclick = () => {
      if (ctx.answered) return;
      ctx.answered = true;
      const ok = i === q.answer;
      if (ok) ctx.correct += 1;
      optionsEl.querySelectorAll(".option").forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) b.classList.add("correct");
        if (j === i && !ok) b.classList.add("wrong");
      });
      root.querySelector("#explain-slot").innerHTML = `
        <div class="explain"><strong>${ok ? "正确" : "不正确"}。</strong> ${q.explain}</div>
      `;
      root.querySelector("#quiz-next-q").disabled = false;
    };
    optionsEl.appendChild(btn);
  });

  root.querySelector("#quiz-exit").onclick = () => navigate("chapter", ctx.chapterId);
  root.querySelector("#quiz-next-q").onclick = () => {
    ctx.index += 1;
    renderQuizQuestion();
  };
}

/* ---------- scenarios ---------- */
function renderScenarios() {
  const root = document.getElementById("view-scenarios");
  root.innerHTML = `
    <div class="view-header">
      <h2>情境模拟 · 你是 FDE</h2>
      <p>没有标准公文，只有现场判断。选完会立即给反馈——训练的是书里反复出现的决策肌肉。</p>
    </div>
    <div class="cta-row" style="margin-bottom:1rem" id="scen-filters">
      <button class="btn btn-ghost" data-f="all">全部</button>
      <button class="btn btn-ghost" data-f="todo">未完成</button>
      <button class="btn btn-ghost" data-f="入门">入门</button>
      <button class="btn btn-ghost" data-f="进阶">进阶</button>
    </div>
    <div id="scen-list"></div>
  `;

  root.querySelectorAll("#scen-filters [data-f]").forEach((b) => {
    b.onclick = () => {
      scenarioFilter = b.dataset.f;
      paintScenarios();
    };
  });
  paintScenarios();
}

function paintScenarios() {
  const list = document.getElementById("scen-list");
  if (!list) return;
  let items = SCENARIOS.slice();
  if (scenarioFilter === "todo") {
    items = items.filter((s) => !state.scenariosDone[s.id]);
  } else if (scenarioFilter === "入门" || scenarioFilter === "进阶") {
    items = items.filter((s) => s.difficulty === scenarioFilter);
  }

  if (!items.length) {
    list.innerHTML = `<div class="empty">没有符合筛选的情境。</div>`;
    return;
  }

  list.innerHTML = items
    .map((s) => {
      const done = state.scenariosDone[s.id];
      return `
      <div class="scenario-card" id="scenario-${s.id}">
        <div class="top" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
          <strong>${s.title}</strong>
          <span>
            <span class="badge">第 ${s.chapter} 章</span>
            <span class="badge">${s.difficulty}</span>
            ${done ? `<span class="badge ok">已完成 · ${done.score}/2</span>` : ""}
          </span>
        </div>
        <div class="scene">${s.scene}</div>
        <div class="choices" data-sid="${s.id}">
          ${s.choices
            .map(
              (c, i) =>
                `<button class="choice-btn" data-i="${i}" ${done ? "disabled" : ""}>${c.text}</button>`
            )
            .join("")}
        </div>
        <div class="fb-slot"></div>
        ${
          done
            ? `<button class="btn btn-ghost" style="margin-top:0.5rem" data-reset="${s.id}">重做此题</button>`
            : ""
        }
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".choices").forEach((box) => {
    const sid = box.dataset.sid;
    const s = SCENARIOS.find((x) => x.id === sid);
    box.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.onclick = () => {
        if (state.scenariosDone[sid]) return;
        const i = Number(btn.dataset.i);
        const choice = s.choices[i];
        state.scenariosDone[sid] = { choice: i, score: choice.score };
        saveState();
        checkAchievements();
        updateSideStats();

        box.querySelectorAll(".choice-btn").forEach((b, j) => {
          b.disabled = true;
          if (j === i) {
            b.classList.add(choice.score >= 2 ? "picked-good" : "picked-bad");
          }
        });
        const card = box.closest(".scenario-card");
        const fb = card.querySelector(".fb-slot");
        fb.innerHTML = `<div class="feedback ${choice.score >= 2 ? "good" : "bad"}">
          <strong>${choice.score >= 2 ? "优秀判断" : choice.score === 1 ? "部分合理" : "高风险选择"}</strong><br/>
          ${choice.feedback}
        </div>`;
        toast(choice.score >= 2 ? "判断加分 +XP" : "复盘已记录，可重做");
        // show reset
        if (!card.querySelector("[data-reset]")) {
          const r = document.createElement("button");
          r.className = "btn btn-ghost";
          r.style.marginTop = "0.5rem";
          r.dataset.reset = sid;
          r.textContent = "重做此题";
          r.onclick = () => {
            delete state.scenariosDone[sid];
            saveState();
            paintScenarios();
          };
          card.appendChild(r);
        }
      };
    });
  });

  list.querySelectorAll("[data-reset]").forEach((b) => {
    b.onclick = () => {
      delete state.scenariosDone[b.dataset.reset];
      saveState();
      paintScenarios();
    };
  });

  // restore done state visuals
  items.forEach((s) => {
    const done = state.scenariosDone[s.id];
    if (!done) return;
    const card = document.getElementById(`scenario-${s.id}`);
    if (!card) return;
    const choice = s.choices[done.choice];
    card.querySelectorAll(".choice-btn").forEach((b, j) => {
      b.disabled = true;
      if (j === done.choice) {
        b.classList.add(choice.score >= 2 ? "picked-good" : "picked-bad");
      }
    });
    card.querySelector(".fb-slot").innerHTML = `
      <div class="feedback ${choice.score >= 2 ? "good" : "bad"}">
        <strong>${choice.score >= 2 ? "优秀判断" : choice.score === 1 ? "部分合理" : "高风险选择"}</strong><br/>
        ${choice.feedback}
      </div>`;
  });
}

/* ---------- flashcards ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let cardDeck = [];

function renderCards() {
  if (!cardDeck.length) cardDeck = shuffle(FLASHCARDS);
  cardIdx = Math.min(cardIdx, cardDeck.length - 1);
  cardFlipped = false;
  paintCard();
}

function paintCard() {
  const root = document.getElementById("view-cards");
  const card = cardDeck[cardIdx];
  root.innerHTML = `
    <div class="view-header">
      <h2>概念闪卡</h2>
      <p>点击卡片翻转。建议每天 5–10 张。已复习 <strong>${state.cardsReviewed}</strong> 次。</p>
    </div>
    <div class="card-stage">
      <div class="flashcard ${cardFlipped ? "flipped" : ""}" id="flash">
        <div class="flash-face front">
          <span class="hint">正面 · 点击翻转</span>
          <div class="body">${card.front}</div>
          <div class="term-chips" style="margin-top:1rem">${card.tags
            .map((t) => `<span class="chip">${t}</span>`)
            .join("")}</div>
        </div>
        <div class="flash-face back">
          <span class="hint">背面</span>
          <div class="body" style="font-size:1rem;font-weight:500">${card.back}</div>
        </div>
      </div>
      <div class="flash-controls">
        <button class="btn btn-ghost" id="card-prev">上一张</button>
        <button class="btn btn-primary" id="card-know">记住了</button>
        <button class="btn btn-ghost" id="card-next">下一张</button>
      </div>
      <p style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:0.75rem">
        ${cardIdx + 1} / ${cardDeck.length}
      </p>
      <div class="cta-row" style="justify-content:center">
        <button class="btn btn-ghost" id="card-shuffle">重新洗牌</button>
      </div>
    </div>
  `;

  const flash = root.querySelector("#flash");
  flash.onclick = () => {
    cardFlipped = !cardFlipped;
    flash.classList.toggle("flipped", cardFlipped);
  };
  root.querySelector("#card-prev").onclick = () => {
    cardIdx = (cardIdx - 1 + cardDeck.length) % cardDeck.length;
    cardFlipped = false;
    paintCard();
  };
  root.querySelector("#card-next").onclick = () => {
    cardIdx = (cardIdx + 1) % cardDeck.length;
    cardFlipped = false;
    paintCard();
  };
  root.querySelector("#card-know").onclick = () => {
    state.cardsReviewed += 1;
    saveState();
    checkAchievements();
    updateSideStats();
    toast("已记入复习次数");
    cardIdx = (cardIdx + 1) % cardDeck.length;
    cardFlipped = false;
    paintCard();
  };
  root.querySelector("#card-shuffle").onclick = () => {
    cardDeck = shuffle(FLASHCARDS);
    cardIdx = 0;
    cardFlipped = false;
    paintCard();
  };
}

/* ---------- daily ---------- */
function pickDaily() {
  const today = new Date().toISOString().slice(0, 10);
  // stable pick by date
  let hash = 0;
  for (let i = 0; i < today.length; i++) hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
  return DAILY_POOL[hash % DAILY_POOL.length];
}

function renderDaily() {
  const root = document.getElementById("view-daily");
  const today = new Date().toISOString().slice(0, 10);
  const q = pickDaily();
  const done = state.dailyDone === today;

  root.innerHTML = `
    <div class="view-header">
      <h2>今日一练</h2>
      <p>每天一题，保持「驻场肌肉」不断。题目按日期固定，方便打卡。</p>
    </div>
    <div class="panel daily-box">
      <div class="quiz-progress">关联第 ${q.chapter} 章 · ${done ? "今日已完成" : "尚未作答"}</div>
      <div class="quiz-q">${q.q}</div>
      <div id="daily-options"></div>
      <div id="daily-explain"></div>
    </div>
  `;

  const box = root.querySelector("#daily-options");
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = opt;
    if (done) {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add("correct");
    }
    btn.onclick = () => {
      if (state.dailyDone === today) return;
      const ok = i === q.answer;
      state.dailyDone = today;
      state.dailyCorrect = ok;
      touchStreak();
      saveState();
      checkAchievements();
      updateSideStats();
      box.querySelectorAll(".option").forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) b.classList.add("correct");
        if (j === i && !ok) b.classList.add("wrong");
      });
      root.querySelector("#daily-explain").innerHTML = `
        <div class="explain"><strong>${ok ? "正确" : "不正确"}。</strong> ${q.explain}</div>
      `;
      toast(ok ? "今日打卡成功 🔥" : "已打卡，明天再来");
    };
    box.appendChild(btn);
  });

  if (done) {
    root.querySelector("#daily-explain").innerHTML = `
      <div class="explain">${q.explain}</div>
    `;
  }
}

/* ---------- achievements ---------- */
function renderAchievements() {
  const root = document.getElementById("view-achievements");
  root.innerHTML = `
    <div class="view-header">
      <h2>成就墙</h2>
      <p>学习痕迹会留在本地浏览器（localStorage），换设备不会同步。</p>
    </div>
    <div class="ach-grid">
      ${ACHIEVEMENTS.map((a) => {
        const unlocked = !!state.achievements[a.id];
        return `
          <div class="ach ${unlocked ? "unlocked" : ""}">
            <div class="icon">${a.icon}</div>
            <h4>${a.title}</h4>
            <p>${a.desc}</p>
          </div>
        `;
      }).join("")}
    </div>
    <div class="cta-row" style="margin-top:1.5rem">
      <button class="btn btn-danger" id="reset-progress">清除本地进度</button>
    </div>
  `;
  root.querySelector("#reset-progress").onclick = () => {
    if (confirm("确定清除所有学习进度？此操作不可恢复。")) {
      state = defaultState();
      saveState();
      toast("进度已清除");
      updateSideStats();
      renderAchievements();
    }
  };
}

/* ---------- boot ---------- */
function boot() {
  // ensure theme attribute exists (head script usually sets it)
  if (!document.documentElement.getAttribute("data-theme")) {
    applyTheme("light");
  } else {
    updateThemeUI();
  }

  touchStreak();
  document.querySelectorAll(".nav button[data-view]").forEach((b) => {
    b.onclick = () => navigate(b.dataset.view);
  });

  const navSupport = document.getElementById("nav-support");
  if (navSupport) {
    navSupport.onclick = () => {
      closeMenu();
      document.getElementById("support")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  const themeTop = document.getElementById("theme-toggle-top");
  const themeSide = document.getElementById("theme-toggle-side");
  if (themeTop) themeTop.onclick = () => toggleTheme();
  if (themeSide) themeSide.onclick = () => toggleTheme();

  const menuToggle = document.getElementById("menu-toggle");
  const menuClose = document.getElementById("menu-close");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (menuToggle) menuToggle.onclick = () => toggleMenu();
  if (menuClose) menuClose.onclick = () => closeMenu();
  if (backdrop) backdrop.onclick = () => closeMenu();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  updateSideStats();
  navigate("home");
}

document.addEventListener("DOMContentLoaded", boot);
