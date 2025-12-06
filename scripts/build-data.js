const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATASET_FILE = "dataset_linkedin-post-search-scraper_2025-11-15_14-09-43-945.json";
const SCORES_FILE = "lead_scores.json";
const COMMENTS_FILE = "proposed_comments.json";
const OUTPUT_FILE = "data.js";
const PREVIEW_COUNT = 3;

function readJson(filePath) {
  const absolute = path.join(ROOT, filePath);
  const raw = fs.readFileSync(absolute, "utf8");
  return JSON.parse(raw);
}

function normalisePosts(rawPosts, commentMap) {
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

      const proposedComment = commentMap.get(urn) || null;

      const normalised = {
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

      if (proposedComment) {
        normalised.proposedComment = proposedComment;
      }

      return normalised;
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

function readComments() {
  const absolute = path.join(ROOT, COMMENTS_FILE);
  if (!fs.existsSync(absolute)) {
    return new Map();
  }

  try {
    const raw = fs.readFileSync(absolute, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      parsed
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const urn = typeof entry.urn === "string" ? entry.urn.trim() : "";
          const comment = typeof entry.comment === "string" ? entry.comment.trim() : "";
          if (!urn || !comment) {
            return null;
          }
          return [urn, comment];
        })
        .filter(Boolean)
    );
  } catch (error) {
    console.warn("Unable to read proposed comments", error);
    return new Map();
  }
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
  const commentMap = readComments();

  const posts = normalisePosts(rawPosts, commentMap);
  const scores = normaliseScores(rawScores);

  writeDataFile(posts, scores);
  logSummary(posts, scores);
}

main();
