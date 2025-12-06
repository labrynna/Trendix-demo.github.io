const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATASET_FILE = "dataset_linkedin-post-search-scraper_2025-11-15_14-09-43-945.json";
const SCORES_FILE = "lead_scores.json";
const OUTPUT_FILE = "data.js";
const PREVIEW_COUNT = 3;

function readJson(filePath) {
  const absolute = path.join(ROOT, filePath);
  const raw = fs.readFileSync(absolute, "utf8");
  return JSON.parse(raw);
}

function normalisePosts(rawPosts) {
  return rawPosts
    .map((entry) => {
      const urn = entry.urn || entry.activityUrn || entry.shareUrn;
      if (!urn) {
        return null;
      }

      const authorName = entry.authorName || buildAuthorName(entry.author);
      const authorHeadline = entry.authorHeadline || entry.author?.occupation || "";
      const title = entry.title || entry.article?.title || "";
      const text = entry.text || entry.article?.description || "";
      const url = entry.url || entry.article?.url || entry.inputUrl || entry.authorProfileUrl || "";
      const postedAtTimestamp = typeof entry.postedAtTimestamp === "number" ? entry.postedAtTimestamp : null;
      const postedAtISO = entry.postedAtISO || (postedAtTimestamp ? new Date(postedAtTimestamp).toISOString() : null);
      const timeSincePosted = entry.timeSincePosted || "";
      const authorProfileUrl = entry.authorProfileUrl || "";

      return {
        urn,
        authorName,
        authorHeadline,
        title,
        text,
        url,
        postedAtTimestamp,
        postedAtISO,
        timeSincePosted,
        authorProfileUrl,
      };
    })
    .filter(Boolean);
}

function buildAuthorName(author = {}) {
  if (typeof author.name === "string" && author.name.trim()) {
    return author.name.trim();
  }

  const parts = [author.firstName, author.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ").trim();
  }
  return "";
}

function normaliseScores(rawScores) {
  return rawScores
    .map((entry) => ({
      urn: entry.urn,
      leadScore: clampScore(entry.leadScore),
    }))
    .filter((entry) => typeof entry.urn === "string" && entry.urn.trim().length > 0);
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(numeric), 0), 5);
}

function writeDataFile(posts, scores) {
  const absolute = path.join(ROOT, OUTPUT_FILE);
  const banner = "// Generated automatically from dataset and lead scores.\n";
  const payload = [
    `window.__POSTS__ = ${JSON.stringify(posts, null, 2)};`,
    `window.__LEAD_SCORES__ = ${JSON.stringify(scores, null, 2)};`,
  ].join("\n");

  fs.writeFileSync(absolute, `${banner}${payload}\n`, "utf8");
}

function logSummary(posts, scores) {
  console.log(`Generated ${posts.length} posts and ${scores.length} lead scores.`);
  console.log("");
  console.log("Sample posts:");
  posts.slice(0, PREVIEW_COUNT).forEach((post, index) => {
    console.log(`${index + 1}. ${post.authorName || "Unknown"} — ${post.title || post.text.slice(0, 60)}`);
  });
}

function main() {
  const rawPosts = readJson(DATASET_FILE);
  const rawScores = readJson(SCORES_FILE);

  const posts = normalisePosts(rawPosts);
  const scores = normaliseScores(rawScores);

  writeDataFile(posts, scores);
  logSummary(posts, scores);
}

main();
