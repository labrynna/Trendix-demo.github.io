const STORAGE_KEY = "trendix-lead-scores";

const postsContainer = document.getElementById("posts");
const statusBanner = document.getElementById("status");
const template = document.getElementById("post-template");
const minScoreFilter = document.getElementById("minimum-score");
const resetButton = document.getElementById("reset-scores");

let posts = [];
let defaultScoreMap = new Map();
let scoreMap = new Map();

const numeral = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

init();

async function init() {
  try {
    updateStatus("Loading posts…");

    const postData = Array.isArray(window.__POSTS__) ? window.__POSTS__ : null;
    if (!postData) {
      throw new Error("Post data is unavailable. Make sure data.js has been generated.");
    }

    const scoreData = Array.isArray(window.__LEAD_SCORES__) ? window.__LEAD_SCORES__ : [];

    posts = postData;
    defaultScoreMap = new Map(scoreData.map((entry) => [entry.urn, Number(entry.leadScore) || 0]));

    posts.forEach((post) => {
      if (!defaultScoreMap.has(post.urn)) {
        defaultScoreMap.set(post.urn, 0);
      }
    });

    scoreMap = new Map(defaultScoreMap);

    const storedScores = readStoredScores();
    if (storedScores) {
      for (const [urn, value] of storedScores) {
        if (scoreMap.has(urn)) {
          scoreMap.set(urn, clampScore(value));
        }
      }
    }

    const summary = renderPosts({ silent: true });
    wireUi();
    updateStatus(`Loaded ${numeral.format(posts.length)} posts. ${formatSummary(summary)}`);
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "Something went wrong while loading data.", true);
  }
}

function wireUi() {
  minScoreFilter.addEventListener("change", () => {
    renderPosts();
  });

  resetButton.addEventListener("click", () => {
    scoreMap = new Map(defaultScoreMap);
    localStorage.removeItem(STORAGE_KEY);
    const summary = renderPosts({ silent: true });
    updateStatus(`Lead scores reset to defaults. ${formatSummary(summary)}`);
  });
}

function renderPosts(options = {}) {
  const { silent = false } = options;
  postsContainer.innerHTML = "";

  const minScore = Number(minScoreFilter.value) || 0;
  let visibleCount = 0;

  posts.forEach((post) => {
    const score = clampScore(scoreMap.get(post.urn));

    if (score < minScore) {
      return;
    }

    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".post");
    card.dataset.urn = post.urn;

    fragment.querySelector(".post-author-name").textContent = post.authorName?.trim() || "Unknown author";

    const headlineEl = fragment.querySelector(".post-author-headline");
    const headline = post.authorHeadline?.trim();
    if (headline) {
      headlineEl.textContent = headline;
      headlineEl.hidden = false;
    } else {
      headlineEl.hidden = true;
    }

    const titleEl = fragment.querySelector(".post-title");
    if (post.title && post.title.trim()) {
      titleEl.textContent = post.title.trim();
      titleEl.hidden = false;
    }

    const snippetEl = fragment.querySelector(".post-snippet");
    snippetEl.textContent = buildSnippet(post.text || "");

    const fullContentEl = fragment.querySelector(".post-full");
    fullContentEl.textContent = (post.text || "").trim();

    const toggleButton = fragment.querySelector(".toggle-content");
    const hasLongContent = fullContentEl.textContent.length > snippetEl.textContent.length;
    if (!hasLongContent) {
      toggleButton.hidden = true;
    }
    toggleButton.addEventListener("click", () => {
      const isExpanded = !fullContentEl.hidden;
      if (isExpanded) {
        fullContentEl.hidden = true;
        snippetEl.hidden = false;
        toggleButton.textContent = "Expand";
      } else {
        fullContentEl.hidden = false;
        snippetEl.hidden = true;
        toggleButton.textContent = "Collapse";
      }
    });

    const linkEl = fragment.querySelector(".post-link");
    if (post.url) {
      linkEl.href = post.url;
      linkEl.textContent = "Go to post";
      linkEl.removeAttribute("aria-disabled");
      linkEl.removeAttribute("tabindex");
    } else {
      linkEl.href = "#";
      linkEl.textContent = "Link unavailable";
      linkEl.setAttribute("aria-disabled", "true");
      linkEl.setAttribute("tabindex", "-1");
      linkEl.addEventListener("click", (event) => event.preventDefault());
    }
    linkEl.dataset.urn = post.urn;

    const scoreSelect = fragment.querySelector(".score-select");
    scoreSelect.value = String(score);
    scoreSelect.addEventListener("change", (event) => {
      const value = clampScore(Number(event.target.value));
      scoreMap.set(post.urn, value);
      persistScores();
      const summary = renderPosts({ silent: true });
      updateStatus(`Updated lead score to ${value} for ${post.authorName || post.urn}. ${formatSummary(summary)}`);
    });

    const timeEl = fragment.querySelector(".post-date");
    const sinceEl = fragment.querySelector(".post-time-since");
    const postedDate = getPostDate(post);
    if (postedDate) {
      timeEl.textContent = dateFormatter.format(postedDate);
      timeEl.dateTime = postedDate.toISOString();
    } else {
      timeEl.removeAttribute("datetime");
      timeEl.textContent = "";
    }
    sinceEl.textContent = post.timeSincePosted || "";

    postsContainer.appendChild(fragment);
    visibleCount += 1;
  });

  const summary = { visible: visibleCount, total: posts.length, minScore };
  if (!silent) {
    updateStatus(formatSummary(summary));
  }
  return summary;
}

function buildSnippet(rawText) {
  const text = (rawText || "").trim();
  if (text.length <= 240) {
    return text;
  }

  const shortened = text.slice(0, 240);
  const lastSpace = shortened.lastIndexOf(" ");
  const cutIndex = lastSpace > 200 ? lastSpace : 240;
  return `${shortened.slice(0, cutIndex)}…`;
}

function getPostDate(post) {
  if (post.postedAtISO) {
    const parsed = new Date(post.postedAtISO);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (typeof post.postedAtTimestamp === "number") {
    const parsed = new Date(post.postedAtTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function clampScore(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(value), 0), 5);
}

function persistScores() {
  const payload = Array.from(scoreMap.entries());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function readStoredScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Map(parsed);
    }
    return null;
  } catch (error) {
    console.warn("Error reading stored scores", error);
    return null;
  }
}

function updateStatus(message, isError = false) {
  statusBanner.textContent = message;
  statusBanner.dataset.state = isError ? "error" : "info";
}

function formatSummary({ visible, total, minScore }) {
  return `Showing ${numeral.format(visible)} of ${numeral.format(total)} posts (min score ${minScore}).`;
}
