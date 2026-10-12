/**
 * Monday digest for the team Discord channel.
 *
 *   npx tsx scripts/digest.ts            # posts when DISCORD_WEBHOOK_URL is set
 *   DRY_RUN=1 npx tsx scripts/digest.ts  # prints the message instead
 *
 * Needs GITHUB_TOKEN and GITHUB_REPOSITORY (set by GitHub Actions).
 * PostHog numbers appear when POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are set.
 */

export interface PullRequestSummary {
  number: number;
  title: string;
  author: string;
  base: string;
  createdAt: string;
  mergedAt?: string;
  url: string;
}

export interface DigestData {
  repo: string;
  since: Date;
  until: Date;
  merged: PullRequestSummary[];
  open: PullRequestSummary[];
  issuesOpened: number;
  issuesClosed: number;
  schemaCommits: { sha: string; message: string; author: string }[];
  envCommits: { sha: string; message: string; author: string }[];
  ci: { runs: number; failures: number };
  product?: {
    signups: number;
    started: number;
    completed: number;
    purchases: number;
    costByCategory: { category: string; costUsd: number; rounds: number }[];
  };
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

const DAY = 86_400_000;

function hours(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function duration(h: number) {
  return h < 24 ? `${Math.round(h)}h` : `${(h / 24).toFixed(1)}d`;
}

function clip(text: string, max = 1000) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Pure: turns collected data into Discord embeds. Unit-tested. */
export function buildDigest(data: DigestData): DiscordEmbed[] {
  const range = `${fmtDate(data.since)} – ${fmtDate(data.until)}`;
  const byAuthor = new Map<string, PullRequestSummary[]>();
  for (const pr of data.merged) byAuthor.set(pr.author, [...(byAuthor.get(pr.author) ?? []), pr]);

  const shipped = [...byAuthor.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([author, prs]) =>
      [`**${author}** · ${prs.length}`, ...prs.slice(0, 6).map((pr) => `[#${pr.number}](${pr.url}) ${pr.title}`)].join("\n"),
    )
    .join("\n\n");

  const cycle = median(data.merged.filter((pr) => pr.mergedAt).map((pr) => hours(pr.createdAt, pr.mergedAt!)));
  const releases = data.merged.filter((pr) => pr.base === "main").length;
  const openList = data.open
    .slice(0, 8)
    .map((pr) => `[#${pr.number}](${pr.url}) ${pr.title} · ${pr.author}, ${duration(hours(pr.createdAt, data.until.toISOString()))} old`)
    .join("\n");

  const changes = [
    ...data.schemaCommits.map((c) => `🗄️ schema · \`${c.sha.slice(0, 7)}\` ${c.message} (${c.author})`),
    ...data.envCommits.map((c) => `🔑 env vars · \`${c.sha.slice(0, 7)}\` ${c.message} (${c.author})`),
  ].join("\n");

  const eng: DiscordEmbed = {
    title: `inturview weekly · ${range}`,
    url: `https://github.com/${data.repo}/pulls?q=is%3Apr+is%3Amerged`,
    color: 0xc4541a,
    fields: [
      { name: "Shipped", value: clip(shipped || "Nothing merged this week.") },
      { name: "Open pull requests", value: clip(openList || "None open.") },
      { name: "Needs attention", value: clip(changes || "No schema or env-var changes.") },
      { name: "Merged", value: String(data.merged.length), inline: true },
      { name: "Releases to main", value: String(releases), inline: true },
      { name: "Median time to merge", value: cycle === null ? "—" : duration(cycle), inline: true },
      { name: "Issues", value: `${data.issuesOpened} opened · ${data.issuesClosed} closed`, inline: true },
      {
        name: "CI on dev/main",
        value: data.ci.runs ? `${data.ci.failures} failed of ${data.ci.runs}` : "No runs",
        inline: true,
      },
    ],
  };

  const embeds = [eng];
  if (data.product) {
    const p = data.product;
    const rate = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
    const cost = p.costByCategory.length
      ? p.costByCategory
          .map((c) => `${c.category}: $${(c.rounds ? c.costUsd / c.rounds : 0).toFixed(2)}/round · ${c.rounds} rounds`)
          .join("\n")
      : "No cost events yet.";
    embeds.push({
      title: "Product · last 7 days",
      color: 0x2d6a3f,
      fields: [
        { name: "Signups", value: String(p.signups), inline: true },
        { name: "Rounds started", value: String(p.started), inline: true },
        { name: "Rounds finished", value: `${p.completed} (${rate(p.completed, p.started)})`, inline: true },
        { name: "Sprints bought", value: String(p.purchases), inline: true },
        { name: "Cost per finished round", value: clip(cost) },
      ],
    });
  }
  embeds[embeds.length - 1].footer = { text: "Posted every Monday · scripts/digest.ts" };
  return embeds;
}

/* ------------------------------ collection ------------------------------ */

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

type SearchItem = { number: number; title: string; html_url: string; created_at: string; user: { login: string }; pull_request?: { merged_at?: string } };
type Pull = { number: number; title: string; html_url: string; created_at: string; merged_at?: string; draft?: boolean; user: { login: string }; base: { ref: string } };
type Commit = { sha: string; commit: { message: string; author: { name: string } }; author?: { login: string } };

async function collect(now = new Date()): Promise<DigestData> {
  const repo = process.env.GITHUB_REPOSITORY!;
  const since = new Date(now.getTime() - 7 * DAY);
  const day = since.toISOString().slice(0, 10);
  const q = (s: string) => encodeURIComponent(`repo:${repo} ${s}`);

  const [mergedSearch, openPulls, opened, closed, runs] = await Promise.all([
    gh<{ items: SearchItem[] }>(`/search/issues?per_page=100&q=${q(`is:pr is:merged merged:>=${day}`)}`),
    gh<Pull[]>(`/repos/${repo}/pulls?state=open&per_page=50`),
    gh<{ total_count: number }>(`/search/issues?per_page=1&q=${q(`is:issue created:>=${day}`)}`),
    gh<{ total_count: number }>(`/search/issues?per_page=1&q=${q(`is:issue closed:>=${day}`)}`),
    gh<{ workflow_runs: { head_branch: string; conclusion: string | null }[] }>(
      `/repos/${repo}/actions/workflows/ci.yml/runs?per_page=100&created=>=${day}`,
    ).catch(() => ({ workflow_runs: [] })),
  ]);

  // Search results lack the base branch; fetch each merged PR for it.
  const merged = await Promise.all(
    mergedSearch.items.map(async (item) => {
      const pr = await gh<Pull>(`/repos/${repo}/pulls/${item.number}`);
      return {
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        base: pr.base.ref,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
      };
    }),
  );

  const commitsTouching = async (path: string) => {
    const commits = await gh<Commit[]>(`/repos/${repo}/commits?sha=dev&since=${since.toISOString()}&path=${encodeURIComponent(path)}`).catch(() => []);
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0].slice(0, 80),
      author: c.author?.login ?? c.commit.author.name,
    }));
  };
  const [schemaCommits, envApp, envRealtime] = await Promise.all([
    commitsTouching("prisma/schema.prisma"),
    commitsTouching(".env.local.example"),
    commitsTouching("services/realtime/.env.example"),
  ]);

  const ciRuns = runs.workflow_runs.filter((r) => ["dev", "main"].includes(r.head_branch) && r.conclusion);
  return {
    repo,
    since,
    until: now,
    merged,
    open: openPulls
      .filter((pr) => !pr.draft)
      .map((pr) => ({ number: pr.number, title: pr.title, author: pr.user.login, base: pr.base.ref, createdAt: pr.created_at, url: pr.html_url })),
    issuesOpened: opened.total_count,
    issuesClosed: closed.total_count,
    schemaCommits,
    envCommits: [...envApp, ...envRealtime],
    ci: { runs: ciRuns.length, failures: ciRuns.filter((r) => r.conclusion === "failure").length },
    product: await collectProduct().catch((e) => {
      console.warn("PostHog numbers skipped:", e instanceof Error ? e.message : e);
      return undefined;
    }),
  };
}

async function hogql(query: string): Promise<unknown[][]> {
  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const res = await fetch(`${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`PostHog query → ${res.status}`);
  return ((await res.json()) as { results: unknown[][] }).results;
}

async function collectProduct(): Promise<DigestData["product"]> {
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return undefined;
  const window = "timestamp >= now() - INTERVAL 7 DAY";
  const counts = new Map(
    (await hogql(
      `SELECT event, count() FROM events WHERE ${window} AND event IN ('signup', 'signup_completed', 'interview_started', 'debrief_completed', 'purchase_completed') GROUP BY event`,
    )).map(([event, n]) => [String(event), Number(n)]),
  );
  const cost = await hogql(
    `SELECT coalesce(properties.category, properties.mode, 'unknown') AS category,
            sumIf(toFloat(properties.cost_usd), event = 'ai_usage') AS cost,
            countIf(event = 'debrief_completed') AS rounds
       FROM events WHERE ${window} AND event IN ('ai_usage', 'debrief_completed')
      GROUP BY category ORDER BY cost DESC`,
  );
  return {
    signups: (counts.get("signup") ?? 0) + (counts.get("signup_completed") ?? 0),
    started: counts.get("interview_started") ?? 0,
    completed: counts.get("debrief_completed") ?? 0,
    purchases: counts.get("purchase_completed") ?? 0,
    costByCategory: cost.map(([category, costUsd, rounds]) => ({
      category: String(category),
      costUsd: Number(costUsd) || 0,
      rounds: Number(rounds) || 0,
    })),
  };
}

async function main() {
  const embeds = buildDigest(await collect());
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (process.env.DRY_RUN || !webhook) {
    console.log(JSON.stringify({ embeds }, null, 2));
    return;
  }
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "inturview weekly", embeds }),
  });
  if (!res.ok) throw new Error(`Discord → ${res.status}: ${await res.text()}`);
  console.log("Digest posted.");
}

if (process.argv[1]?.endsWith("digest.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
