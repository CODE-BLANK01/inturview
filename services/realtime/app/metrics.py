import re
from typing import Any

# Multi-word fillers first so "you know" isn't double counted as "know".
FILLER_PATTERNS = [
    r"\byou know\b",
    r"\bsort of\b",
    r"\bkind of\b",
    r"\bi mean\b",
    r"\bum+\b",
    r"\buh+\b",
    r"\berm*\b",
    r"\bhmm+\b",
    r"\bbasically\b",
    r"\bliterally\b",
]
FILLER_RE = re.compile("|".join(FILLER_PATTERNS), re.IGNORECASE)

# Phrases Whisper-family models emit for silence / noise. Compared against the
# whole (normalised) transcript, so a real sentence containing "thank you"
# still passes.
HALLUCINATION_PHRASES = {
    "thank you",
    "thank you.",
    "thanks for watching",
    "thanks for watching.",
    "thank you for watching",
    "thank you for watching.",
    "please subscribe",
    "subtitles by",
    "bye",
    "bye.",
    "you",
    "you.",
    "the end",
    "the end.",
    "so",
    "so.",
    "okay",
    "ok",
    "hmm",
    "mm",
    "mm-hmm",
    "uh",
    "um",
}

SHORT_ANSWER_ALLOWLIST = {
    "yes",
    "no",
    "yeah",
    "yep",
    "nope",
    "sure",
    "correct",
    "right",
    "exactly",
    "done",
    "hello",
    "hi",
    "okay",
    "ok",
}

# Keep in step with FUNCTION_WORDS in lib/realtimeClient.ts.
FUNCTION_WORDS = {
    "the", "and", "but", "for", "with", "that", "this", "was", "are", "not",
    "have", "has", "had", "from", "they", "them", "then", "than", "what", "when",
    "who", "how", "why", "our", "your", "his", "her", "she", "him", "its",
}

WORD_RE = re.compile(r"[A-Za-z0-9'’\-]+")
NON_LATIN_RE = re.compile(r"[^\x00-\x7FÀ-ɏ‘’“”–—…]")


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def is_usable_transcript(text: str) -> bool:
    """Backstop junk filter — mirrors the browser-side gate.

    Rejects empty, non-English-script, and known noise-hallucination
    transcripts so they never reach the model as a "turn" or the DB as a
    message.
    """
    norm = normalise(text)
    if not norm:
        return False
    if norm in HALLUCINATION_PHRASES:
        return False

    letters = [c for c in norm if not c.isspace()]
    if letters:
        non_latin = sum(1 for c in letters if NON_LATIN_RE.match(c))
        if non_latin / len(letters) > 0.3:
            return False

    words = WORD_RE.findall(norm)
    if not words:
        return False
    if len(words) == 1:
        # One-word technical answers ("Serializable.") are real; stray function
        # words and very short fragments are noise. Keep in step with
        # isUsableTranscript in lib/realtimeClient.ts.
        w = words[0].strip(".")
        return w in SHORT_ANSWER_ALLOWLIST or (len(w) >= 3 and w not in FUNCTION_WORDS)
    return True


def turn_metrics(
    text: str,
    duration_ms: int | None,
    segments: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    words = WORD_RE.findall(text)
    word_count = len(words)
    filler_count = len(FILLER_RE.findall(text))

    longest_pause_ms = 0
    if segments and len(segments) > 1:
        ordered = sorted(segments, key=lambda s: s.get("start", 0))
        for prev, cur in zip(ordered, ordered[1:]):
            gap = int(cur.get("start", 0)) - int(prev.get("end", 0))
            longest_pause_ms = max(longest_pause_ms, gap)

    wpm = None
    if duration_ms and duration_ms > 0:
        wpm = round(word_count / (duration_ms / 60000.0), 1)

    return {
        "words": word_count,
        "duration_ms": duration_ms,
        "wpm": wpm,
        "filler_count": filler_count,
        "filler_per_100_words": round(filler_count / word_count * 100, 1) if word_count else 0.0,
        "longest_pause_ms": longest_pause_ms,
        "segments": len(segments) if segments else 1,
    }
