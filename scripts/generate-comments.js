const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATASET_FILE = "dataset_linkedin-post-search-scraper_2025-11-15_14-09-43-945.json";
const OUTPUT_FILE = "proposed_comments.json";

const CTA_LIBRARY = [
  "Shall we schedule a 20-minute strategy call next week?",
  "Open to a quick discovery call to exchange ideas?",
  "Happy to share a China SEO playbook if you're curious—shall we connect?",
  "Let me know if we can hop on a short call to explore collaboration.",
  "Can I send over a tailored growth brief for your team?"
];

const VALUE_PROPS = [
  "We guide global brands through China-specific SEO, SEM, and localization.",
  "Our Shanghai-based strategists blend technical SEO with culturally tuned content.",
  "Ins[ai]ght supports international teams with multilingual SEO and paid growth.",
  "We partner with B2B leaders to capture demand across Baidu, social, and marketplaces.",
  "Our team leverages AI insights plus on-the-ground execution across China and APAC."
];

function readPosts() {
  const filePath = path.join(ROOT, DATASET_FILE);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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

function extractTopic(entry) {
  const source = entry.title || entry.text || "your recent update";
  const cleaned = String(source).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "your recent update";
  }
  if (cleaned.length <= 80) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 40 ? lastSpace : 80)}…`;
}

function pick(list, index) {
  return list[index % list.length];
}

function buildComment(entry, index) {
  const authorName = entry.authorName || buildAuthorName(entry.author) || "there";
  const firstName = authorName.split(" ")[0] || "there";
  const topic = extractTopic(entry);
  const value = pick(VALUE_PROPS, index);
  const cta = pick(CTA_LIBRARY, index + 1);

  return `Hi ${firstName}, really enjoyed your perspective on ${topic}. ${value} ${cta} – Liang, Ins[ai]ght`;
}

function main() {
  const posts = readPosts();
  const comments = posts
    .map((entry, index) => {
      const urn = entry.urn || entry.activityUrn || entry.shareUrn;
      if (!urn) {
        return null;
      }
      const comment = buildComment(entry, index);
      return {
        urn,
        comment
      };
    })
    .filter(Boolean);

  const outputPath = path.join(ROOT, OUTPUT_FILE);
  fs.writeFileSync(outputPath, JSON.stringify(comments, null, 2), "utf8");

  console.log(`Generated ${comments.length} proposed comments.`);
  console.log(`Saved to ${OUTPUT_FILE}.`);
}

main();