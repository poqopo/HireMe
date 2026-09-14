import { mkdir, readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export function createAgentMemory({ stateDir }) {
  const root = resolve(stateDir || ".hireme/standalone-agent/default");
  const memoryPath = join(root, "memories.jsonl");
  const episodePath = join(root, "episodes.jsonl");
  const learnedSkillDir = join(root, "skills");

  return {
    root,
    async init() {
      await mkdir(root, { recursive: true });
      await mkdir(learnedSkillDir, { recursive: true });
    },
    async recall({ query, limit = 8 } = {}) {
      await this.init();
      const [memories, episodes, learnedSkills] = await Promise.all([
        readJsonl(memoryPath),
        readJsonl(episodePath),
        readLearnedSkills(learnedSkillDir),
      ]);
      return {
        relevantMemories: rankByQuery(memories, query).slice(0, limit),
        recentEpisodes: episodes.slice(-Math.min(limit, episodes.length)),
        learnedSkills,
      };
    },
    async remember(records = []) {
      await this.init();
      const normalized = records
        .map((record) => normalizeMemoryRecord(record))
        .filter(Boolean);
      for (const record of normalized) {
        await appendJsonl(memoryPath, {
          ...record,
          createdAt: new Date().toISOString(),
        });
      }
      return { written: normalized.length };
    },
    async writeEpisode(episode) {
      await this.init();
      await appendJsonl(episodePath, {
        ...episode,
        createdAt: new Date().toISOString(),
      });
    },
    async writeSkill(skill) {
      await this.init();
      const title = String(skill?.title || skill?.name || "learned-skill").trim();
      const body = String(skill?.body || skill?.content || "").trim();
      if (!title || !body) return { written: false };
      const slug = slugify(title);
      const path = join(learnedSkillDir, `${slug}.md`);
      await writeFile(
        path,
        [`# ${title}`, "", body, "", `Created: ${new Date().toISOString()}`, ""].join("\n"),
        "utf8",
      );
      return { written: true, title, path };
    },
  };
}

async function readJsonl(path) {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function appendJsonl(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

async function readLearnedSkills(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const path = join(dir, entry.name);
    const body = await readFile(path, "utf8");
    skills.push({
      name: entry.name.replace(/\.md$/, ""),
      path,
      body: body.slice(0, 6000),
    });
  }
  return skills;
}

function normalizeMemoryRecord(record) {
  if (typeof record === "string") {
    const text = record.trim();
    return text ? { type: "note", text, tags: [] } : null;
  }
  if (!record || typeof record !== "object") return null;
  const text = String(record.text || record.value || record.content || "").trim();
  if (!text) return null;
  return {
    type: String(record.type || "note"),
    text,
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
  };
}

function rankByQuery(records, query) {
  const terms = tokenize(query);
  if (!terms.length) return records.slice(-8).reverse();
  return records
    .map((record) => ({
      record,
      score: scoreRecord(record, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.record);
}

function scoreRecord(record, terms) {
  const haystack = `${record.text || ""} ${(record.tags || []).join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣_/-]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function slugify(value) {
  return String(value || "skill")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "skill";
}
