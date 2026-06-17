/**
 * System-design seed problems. Authored similar to lib/problems.ts: the
 * static list is the source of truth, the seeder upserts into the DB on
 * `npm run db:seed`. The runtime path reads from DB but `getDesignProblem()`
 * here is also fine for static rendering of prompts.
 *
 * Each entry should be substantial enough that the AI can generate a
 * meaningful interview without further authoring. Reference architecture is
 * used in the debrief's "what they missed" section.
 */

export type DesignDifficulty = "Easy" | "Medium" | "Hard";

export interface SystemDesignProblemDef {
  id: string;
  title: string;
  difficulty: DesignDifficulty;
  topic: string;
  prompt: string;
  expectedRequirements: {
    functional: string[];
    nonFunctional: string[];
  };
  referenceArchitecture: string;
  deepDiveTopics: string[];
  estimatedDurationMinutes: number;
}

export const DESIGN_TOPICS = [
  "Feeds",
  "Messaging",
  "Storage",
  "Geospatial",
  "Streaming",
  "Q&A",
  "Infrastructure",
  "Crawling",
] as const;

export const DESIGN_PROBLEMS: SystemDesignProblemDef[] = [
  {
    id: "design-twitter",
    title: "Design Twitter",
    difficulty: "Easy",
    topic: "Feeds",
    prompt:
      "Design Twitter — a system where users can post short messages (tweets), follow other users, and see a chronological-ish feed of tweets from people they follow.",
    expectedRequirements: {
      functional: [
        "Post a tweet (text, optional media)",
        "Follow / unfollow users",
        "View your home timeline (tweets from followees)",
        "View any user's profile timeline",
      ],
      nonFunctional: [
        "Read-heavy: ~100:1 read:write ratio",
        "Timeline latency < 200ms p95",
        "Eventually consistent timeline is acceptable",
        "Scale to ~500M MAU, ~200M DAU, ~5k tweets/sec at peak",
      ],
    },
    referenceArchitecture:
      "Canonical fan-out-on-write for users with < ~10k followers — when a tweet is posted, a background worker pushes the tweet id into each follower's redis-backed timeline cache. For celebrities (followers > 10k or > 1M), fall back to fan-out-on-read: their tweets are stored only in the tweet store; the home-timeline read for a regular user merges their precomputed cache with the few celebrities they follow on the fly. Tweets themselves live in a sharded relational store (sharded by tweet id, lookups by user id via a secondary index or denormalized author table). Media goes to object storage with CDN. Service layout: API gateway → timeline service / tweet service / user service, each with their own DB. Async tasks via a queue (Kafka). Cache layer (Redis) for hot reads.",
    deepDiveTopics: [
      "Fan-out trade-off (write vs read) for celebrities",
      "Timeline cache invalidation",
      "Tweet store sharding key",
      "How to serve media (object store + CDN)",
      "Rate limiting tweet posts",
    ],
    estimatedDurationMinutes: 45,
  },
  {
    id: "design-instagram",
    title: "Design Instagram",
    difficulty: "Easy",
    topic: "Feeds",
    prompt:
      "Design Instagram — users post photos with captions, follow other users, and scroll a feed of posts from people they follow. Include likes and comments.",
    expectedRequirements: {
      functional: [
        "Upload a photo + caption",
        "Follow / unfollow users",
        "Home feed of recent posts from followees",
        "Like / comment on posts",
        "Profile page showing user's posts",
      ],
      nonFunctional: [
        "Read-heavy (similar to Twitter)",
        "Image-heavy: original + multiple resized variants",
        "Feed latency < 300ms p95",
        "Storage growth dominates: ~100MB per active user / year",
      ],
    },
    referenceArchitecture:
      "Image upload goes to API → object storage; an async worker generates multiple sizes (thumbnail/feed/full). Metadata (caption, author, timestamp, media URLs) in a relational store sharded by post id. Feed generation similar to Twitter (fan-out-on-write for normal users, fan-out-on-read for influencers). Likes/comments in a separate service (denormalized counts on the post for fast reads, source-of-truth log in a wide-column store like Cassandra). CDN in front of all images. Notification service consumes a Kafka stream of likes/follows/comments.",
    deepDiveTopics: [
      "Image processing pipeline + sizing strategy",
      "Like counter (eventual consistency vs strong)",
      "Feed ranking (chronological vs algorithmic)",
      "Caching strategy: edge CDN + Redis for metadata",
    ],
    estimatedDurationMinutes: 45,
  },
  {
    id: "design-tinyurl",
    title: "Design TinyURL / a URL shortener",
    difficulty: "Easy",
    topic: "Storage",
    prompt:
      "Design a URL shortener — given a long URL, return a short URL (e.g. tiny.url/abc123) that redirects to the original. Include analytics for owners.",
    expectedRequirements: {
      functional: [
        "Shorten a long URL to a 6-8 char short key",
        "Redirect short → long with low latency",
        "Custom short keys (optional)",
        "Click analytics per short URL (count, geo, referrer)",
      ],
      nonFunctional: [
        "Write throughput modest (~1k/sec), read throughput high (~50k/sec)",
        "Redirect p99 < 50ms",
        "Keys are permanent once issued (no reuse)",
      ],
    },
    referenceArchitecture:
      "Short-key generation: base62-encoded counter (single global atomic counter via a sharded key-generator service; OR pre-allocated counter ranges per app server). Storage: key → URL mapping in a KV store (DynamoDB or sharded Postgres on the short key). Redirect path is read-heavy and trivial; aggressive CDN/edge caching by short key. Analytics handled by an async pipeline: redirect emits a click event to Kafka, consumer aggregates into a time-series DB for the analytics dashboard. Custom keys require a check-and-set to avoid collisions.",
    deepDiveTopics: [
      "Key-generation strategy: counter vs hash vs random",
      "Cache hit ratio for redirects",
      "How to make analytics eventually-consistent without blocking the redirect",
      "Handling key collisions for custom URLs",
    ],
    estimatedDurationMinutes: 40,
  },
  {
    id: "design-whatsapp",
    title: "Design WhatsApp / a chat app",
    difficulty: "Medium",
    topic: "Messaging",
    prompt:
      "Design a 1:1 and group messaging app — users send text messages, messages are delivered in order, and online/typing/read states are shown. Online presence matters.",
    expectedRequirements: {
      functional: [
        "Send a 1:1 message",
        "Group messages (up to ~256 members)",
        "Delivery status (sent / delivered / read)",
        "Online presence + typing indicators",
        "Message history sync across devices",
      ],
      nonFunctional: [
        "Real-time: message delivery p95 < 1s",
        "At-most-once or exactly-once delivery (no duplicates)",
        "End-to-end encryption (out-of-scope for design but worth mentioning)",
        "Scale: 2B users, 100B msgs/day",
      ],
    },
    referenceArchitecture:
      "Clients hold a persistent WebSocket (or XMPP) connection to a Connection Gateway layer (millions of conns per box). Gateway routes by user id; a Routing service knows which gateway owns each online user. Messages flow: sender → gateway → message service → queue (Kafka per shard) → recipient's gateway → recipient. Persistent storage in a wide-column store keyed by (chat_id, message_id) for history. Presence service maintains a TTL-based key in Redis per online user; clients send heartbeats every ~30s. Group fan-out done by the message service writing to N recipient queues. Acks flow back the same path. For offline recipients, messages persist and a push notification fires.",
    deepDiveTopics: [
      "Long-lived connection scaling (millions of WebSockets per box)",
      "Message ordering guarantees within a chat",
      "Presence storage cost at scale",
      "Group fan-out vs broadcast",
      "Offline → online sync",
    ],
    estimatedDurationMinutes: 50,
  },
  {
    id: "design-uber",
    title: "Design Uber / a ride-share service",
    difficulty: "Medium",
    topic: "Geospatial",
    prompt:
      "Design Uber — riders request rides, the system matches them with a nearby driver, both see live locations during the ride, and the trip is recorded for billing.",
    expectedRequirements: {
      functional: [
        "Rider requests a ride from A → B",
        "Match with nearest available driver (within ETA threshold)",
        "Live location tracking during the ride",
        "Trip history + billing",
      ],
      nonFunctional: [
        "Match latency < 5s p95",
        "Location updates from drivers ~every 4s",
        "Geospatial queries: 'drivers within 5km' must be sub-second",
      ],
    },
    referenceArchitecture:
      "Driver location ingest: drivers push GPS updates to a high-throughput ingestion service every few seconds. Locations stored in a geospatial index — typically a custom grid system like Uber's H3 (hexagonal cells) or quadtree, kept in memory per region shard. Match service: when a rider requests, query the index for available drivers in nearby cells, rank by ETA, dispatch. Trip lifecycle managed by a Trip service (state machine: requested → assigned → in_progress → completed). During a trip, both rider and driver subscribe to live location updates via a real-time pub/sub. Pricing engine async. Trip history goes to a relational store partitioned by user.",
    deepDiveTopics: [
      "Geospatial indexing — H3 / quadtree / geohash trade-offs",
      "Driver location update frequency vs cost",
      "Match algorithm: closest by Euclidean vs closest by routing ETA",
      "Surge pricing data flow",
    ],
    estimatedDurationMinutes: 50,
  },
  {
    id: "design-youtube",
    title: "Design YouTube",
    difficulty: "Medium",
    topic: "Streaming",
    prompt:
      "Design YouTube — users upload videos, others view them via an adaptive-bitrate player, search for videos, and see recommendations. Focus on the watch path.",
    expectedRequirements: {
      functional: [
        "Upload a video (large, ~hundreds of MB to several GB)",
        "Stream a video with adaptive bitrate",
        "Search videos by title / metadata",
        "Show view counts + basic recommendations",
      ],
      nonFunctional: [
        "Watch path latency: start playing < 2s p95",
        "Storage at petabyte scale",
        "Read-heavy: ~10000:1 watch:upload ratio",
      ],
    },
    referenceArchitecture:
      "Upload: chunked multipart upload to object storage. An async transcoding pipeline (queue → workers) generates multiple bitrate variants and HLS/DASH manifests. Variants stored in object storage; manifests + variants served from a multi-tier CDN (origin → regional → edge). Metadata (title, owner, duration, tags) in a relational store sharded by video id. Search via a dedicated search cluster (Elasticsearch) indexed from the metadata store. View counts in a sketch-style approximate counter (HyperLogLog / Count-Min Sketch) reconciled to exact daily. Recommendations served from a separately-trained model, cached per user. Watch path: client gets the manifest, picks a bitrate based on bandwidth, fetches segment files from CDN edge.",
    deepDiveTopics: [
      "Transcoding pipeline (variants, codec choice)",
      "CDN strategy + cache hit ratio",
      "View count consistency (exact vs approximate)",
      "Adaptive bitrate algorithm (client-side decision)",
    ],
    estimatedDurationMinutes: 55,
  },
  {
    id: "design-dropbox",
    title: "Design Dropbox / a file sync service",
    difficulty: "Medium",
    topic: "Storage",
    prompt:
      "Design Dropbox — users have a synced folder across devices. Changes on one device propagate to others. Files can be large; partial updates are common.",
    expectedRequirements: {
      functional: [
        "Upload / download files",
        "Sync changes across devices",
        "Detect partial changes (don't re-upload the whole file)",
        "Conflict resolution when two devices change the same file",
      ],
      nonFunctional: [
        "Sync latency < 30s after change committed",
        "Deduplication across users (a popular file isn't stored 1M times)",
        "Bandwidth-efficient: delta sync, not full re-upload",
      ],
    },
    referenceArchitecture:
      "Files chunked client-side (e.g. 4 MB blocks). Each block hashed (SHA-256). Client sends the manifest (list of block hashes) to the metadata service. Metadata service checks which blocks already exist in the block store; client uploads only missing blocks. Block store is content-addressed object storage (dedupe across users for free — same hash = same block, single physical copy). Metadata store (relational) holds file → block-list mappings, versions, and ACLs. Sync: each user has a 'notification' channel (long-poll or WebSocket); when metadata changes, other devices fetch the diff. Conflicts: last-write-wins per file with a conflict copy written for the loser, or CRDT-based merge for text.",
    deepDiveTopics: [
      "Block deduplication and content addressing",
      "Delta sync algorithm (rsync vs fixed block)",
      "Conflict resolution strategy",
      "Storage cost of dedup at scale",
    ],
    estimatedDurationMinutes: 50,
  },
  {
    id: "design-stack-overflow",
    title: "Design Stack Overflow",
    difficulty: "Medium",
    topic: "Q&A",
    prompt:
      "Design a Q&A site like Stack Overflow — users post questions, others answer, the community votes on questions and answers, and search is critical.",
    expectedRequirements: {
      functional: [
        "Post a question with title, body, tags",
        "Post an answer to a question",
        "Vote up/down on questions and answers",
        "Search by keyword + filter by tag",
        "Show questions sorted by relevance / activity / newest",
      ],
      nonFunctional: [
        "Read-heavy: ~1000:1 read:write",
        "Search results < 500ms p95",
        "Strong consistency on vote counts isn't required (eventually fine)",
      ],
    },
    referenceArchitecture:
      "Posts (questions + answers) in a relational store sharded by question id (answers live alongside their question). Search via Elasticsearch indexed from a CDC pipeline (Postgres → Debezium → Kafka → Elastic). Vote counts in a separate table with periodic reconciliation (or use Redis counters + persist hourly). Tags are a many-to-many denormalized for fast filtering. Caching: hot questions cached by id in Redis; rendered HTML cached at the edge. User reputation computed offline. Spam detection via async classifier on every post.",
    deepDiveTopics: [
      "Search relevance ranking",
      "Vote counter consistency",
      "Tag filtering at scale",
      "Spam mitigation pipeline",
    ],
    estimatedDurationMinutes: 45,
  },
  {
    id: "design-rate-limiter",
    title: "Design a distributed rate limiter",
    difficulty: "Hard",
    topic: "Infrastructure",
    prompt:
      "Design a rate-limiting service used by other internal services. Given (user_id, action, time), return whether the action is allowed under per-user/per-action quotas. Multiple service replicas need consistent limits.",
    expectedRequirements: {
      functional: [
        "Check + decrement quota for (user_id, action)",
        "Support multiple algorithms (fixed window, sliding window, token bucket)",
        "Per-user and per-action configurable limits",
      ],
      nonFunctional: [
        "Check latency < 5ms p99",
        "Throughput: 1M+ checks/sec total across the platform",
        "Failure mode: fail-open or fail-closed? Discuss.",
      ],
    },
    referenceArchitecture:
      "Two viable designs: (1) Centralized Redis with Lua scripts for atomic check-and-decrement; replicas in front for read fan-out, primary for writes. (2) Distributed local buckets with periodic sync to a central tally — each app server holds a per-user counter and syncs deltas every few seconds, accepting slight overshoot for lower latency. For most cases the centralized Redis approach wins on simplicity. Algorithm: token bucket per (user_id, action) — value = current tokens, refill rate, last refill timestamp. Sliding window via two-bucket approximation if perfect accuracy needed. Persistence not required (loss of state means a brief reset of limits — acceptable).",
    deepDiveTopics: [
      "Algorithm choice: fixed vs sliding vs token bucket",
      "Centralized vs distributed counter trade-off",
      "Fail-open vs fail-closed semantics",
      "Hot-key problem (one user hitting hard)",
    ],
    estimatedDurationMinutes: 45,
  },
  {
    id: "design-web-crawler",
    title: "Design a web crawler",
    difficulty: "Hard",
    topic: "Crawling",
    prompt:
      "Design a polite, scalable web crawler — fetches pages, follows links, respects robots.txt, dedupes URLs, and stores the content for a downstream indexer.",
    expectedRequirements: {
      functional: [
        "Seed with a starting URL set",
        "Crawl outward, following links",
        "Respect robots.txt + per-domain rate limits",
        "Deduplicate URLs (URL canonicalization)",
        "Detect duplicate content (different URLs, same body)",
      ],
      nonFunctional: [
        "Throughput: ~10k pages/sec sustained",
        "Politeness: max 1 request/sec per domain",
        "Storage: petabytes (raw HTML)",
        "Resumable: a crash doesn't lose the frontier",
      ],
    },
    referenceArchitecture:
      "Frontier (URL queue) sharded by domain so politeness is enforced per shard worker. Each fetcher worker pulls from its assigned shards, fetches pages with per-domain rate limiting, writes raw HTML to object storage, parses for links, normalizes URLs, deduplicates against a Bloom filter (seen-set) plus a definitive store (sharded KV). New URLs go back into the frontier. robots.txt fetched once per domain and cached. Content dedup via SimHash or MinHash signatures against an existing-content store. Failed fetches retry with exponential backoff. Distributed coordination via Zookeeper or Raft for shard ownership.",
    deepDiveTopics: [
      "URL canonicalization rules",
      "Bloom filter for seen-set + false-positive rate",
      "Politeness enforcement under shard rebalancing",
      "Detecting near-duplicate content (SimHash)",
    ],
    estimatedDurationMinutes: 55,
  },
];

export function getDesignProblem(id: string): SystemDesignProblemDef | undefined {
  return DESIGN_PROBLEMS.find((p) => p.id === id);
}
