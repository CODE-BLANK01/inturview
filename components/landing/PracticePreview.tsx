"use client";

// The landing hero's sample interview, played like a call: the interviewer
// speaks (browser speech when sound is on), the candidate answers, notes land
// as they would in a real round, then the follow-up and the takeaway. It is a
// scripted sample, so it runs without an account and costs nothing.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

const examples = [
  {
    category: "Recruiter",
    question: "Tell me about yourself. And what are you looking for in your next role?",
    answer:
      "I’ve spent three years building payment systems. Now I want to join a smaller team where I can own a product end to end.",
    followup: "What have you built that shows you’re ready for that ownership?",
    feedbackTitle: "Make the impact yours.",
    feedback: "Your direction is clear. Bring it to life with one thing you owned, a decision you made, and what changed because of it.",
    notes: ["Clear direction", "Add a concrete example"],
  },
  {
    category: "Behavioral",
    question: "Tell me about a time you and a teammate saw a problem differently.",
    answer:
      "We disagreed about rebuilding a service. I proposed a small experiment so we could compare the options before committing.",
    followup: "What did the experiment measure? And what changed because of it?",
    feedbackTitle: "Go beyond “we did it.”",
    feedback: "The initiative comes through. Close the story with a specific result and the part you played in getting there.",
    notes: ["Strong initiative", "Show the outcome"],
  },
  {
    category: "Coding",
    question: "Find two numbers in an array that add up to a target. Talk me through your approach.",
    answer:
      "I’d keep a map of the values I’ve seen. For each number, I’d check whether its complement is already in the map.",
    followup: "What if the array contains the same value twice?",
    feedbackTitle: "Test your thinking.",
    feedback: "A sound approach. Walk through a duplicate-value example and explain why you check the map before inserting the current number.",
    notes: ["Sound approach", "Explore the edge cases"],
  },
  {
    category: "System design",
    question: "Design a notification service for a growing product. Where would you start?",
    answer:
      "I’d put a queue between the application and the delivery workers, so a slow email provider doesn’t block the user’s request.",
    followup: "A worker retries a delivery. How do you avoid sending it twice?",
    feedbackTitle: "Follow the failure path.",
    feedback: "The queue separates responsibilities well. Now describe idempotency and how you would track a notification through a retry.",
    notes: ["Clear separation", "Explain retry behavior"],
  },
];

const beats = ["Question", "Your answer", "Follow-up", "Takeaway"];

type Speaker = "interviewer" | "candidate";
type Phase = "idle" | "speaking" | "thinking" | "done";

class Cancelled extends Error {}

const INTERVIEWER_VOICES = ["Samantha", "Ava", "Allison", "Google US English", "Microsoft Aria", "Microsoft Jenny", "Karen", "Serena"];
const CANDIDATE_VOICES = ["Daniel", "Alex", "Google UK English Male", "Microsoft Guy", "Microsoft Ryan", "Tom", "Aaron"];

function pickVoice(voices: SpeechSynthesisVoice[], preferred: string[], avoid?: SpeechSynthesisVoice) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en") && v !== avoid);
  for (const name of preferred) {
    const match = english.find((v) => v.name.startsWith(name));
    if (match) return match;
  }
  return english.find((v) => v.lang === "en-US") ?? english[0];
}

const speechAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window;

function wordIndexAt(text: string, charIndex: number) {
  return text.slice(0, charIndex).split(/\s+/).filter(Boolean).length;
}

export function PracticePreview() {
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [speaker, setSpeaker] = useState<Speaker>("interviewer");
  const [line, setLine] = useState("");
  const [spoken, setSpoken] = useState(0);
  const [beat, setBeat] = useState(-1);
  const [notes, setNotes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(false);
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);
  const soundRef = useRef(false);
  const interactedRef = useRef(false);
  const autoplayedRef = useRef(false);
  const visibleRef = useRef(false);
  const selectedRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const energyRef = useRef(0);
  const speakingRef = useRef(false);
  const voicesRef = useRef<{ interviewer?: SpeechSynthesisVoice; candidate?: SpeechSynthesisVoice }>({});

  const example = examples[selected]!;

  useEffect(() => {
    if (!speechAvailable()) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const interviewer = pickVoice(all, INTERVIEWER_VOICES);
      voicesRef.current = { interviewer, candidate: pickVoice(all, CANDIDATE_VOICES, interviewer) };
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    cleanupRef.current?.();
    cleanupRef.current = null;
    speakingRef.current = false;
    if (speechAvailable()) window.speechSynthesis.cancel();
  }, []);

  /** Shows one line as captions and, with sound on, speaks it. Resolves when it has been said. */
  const say = useCallback((who: Speaker, text: string, id: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    setSpeaker(who);
    setLine(text);
    setSpoken(0);
    setPhase("speaking");
    setAnnounce(`${who === "interviewer" ? "Interviewer" : "Candidate"}: ${text}`);
    speakingRef.current = true;

    return new Promise<void>((resolve, reject) => {
      let index = 0;
      let byBoundary = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let safety: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      let voiced = soundRef.current && speechAvailable();

      const advance = (to: number) => {
        if (to <= index) return;
        index = Math.min(to, words.length);
        energyRef.current = 1;
        setSpoken(index);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(safety);
        // A cancelled line (speech fires onerror after cancel) must not touch the next one.
        if (runRef.current !== id) return reject(new Cancelled());
        cleanupRef.current = null;
        speakingRef.current = false;
        setSpoken(words.length);
        resolve();
      };
      cleanupRef.current = () => {
        settled = true;
        clearTimeout(timer);
        clearTimeout(safety);
        reject(new Cancelled());
      };

      // The word clock keeps captions moving when speech gives no word events;
      // with sound on it never reaches the last word before the voice does.
      const tick = () => {
        if (byBoundary) return;
        const word = words[index] ?? "";
        if (voiced && index >= words.length - 1) return;
        advance(index + 1);
        if (!voiced && index >= words.length) {
          timer = setTimeout(finish, 350);
          return;
        }
        timer = setTimeout(tick, 330 + (/[.,?!]$/.test(word) ? 280 : 0));
      };
      timer = setTimeout(tick, 120);

      if (voiced) {
        const u = new SpeechSynthesisUtterance(text);
        const voice = voicesRef.current[who];
        if (voice) u.voice = voice;
        u.rate = 1.02;
        u.pitch = who === "candidate" && !voicesRef.current.candidate ? 0.85 : 1;
        u.onboundary = (e) => {
          if (e.name !== "word") return;
          byBoundary = true;
          advance(wordIndexAt(text, e.charIndex) + 1);
        };
        let began = false;
        u.onstart = () => (began = true);
        u.onend = finish;
        u.onerror = finish;
        // Speech that never starts (blocked, or dropped right after a cancel)
        // falls back to captions only; speech that never ends can't hang the demo.
        safety = setTimeout(() => {
          if (began) return void (safety = setTimeout(finish, words.length * 650));
          voiced = false;
          if (index >= words.length - 1) {
            advance(words.length);
            timer = setTimeout(finish, 350);
          } else if (byBoundary) timer = setTimeout(finish, 350);
        }, 1500);
        window.speechSynthesis.speak(u);
      }
    });
  }, []);

  const pause = useCallback(
    (ms: number, id: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => (runRef.current === id ? resolve() : reject(new Cancelled())), ms);
        cleanupRef.current = () => {
          clearTimeout(t);
          reject(new Cancelled());
        };
      }),
    [],
  );

  const play = useCallback(
    async (index: number) => {
      stop();
      const id = runRef.current;
      const ex = examples[index]!;
      setSelected(index);
      selectedRef.current = index;
      setStarted(true);
      setNotes(0);
      setElapsed(0);
      try {
        setBeat(0);
        await say("interviewer", ex.question, id);
        await pause(450, id);
        setBeat(1);
        await say("candidate", ex.answer, id);
        setPhase("thinking");
        for (let i = 1; i <= ex.notes.length; i++) {
          await pause(650, id);
          setNotes(i);
        }
        await pause(500, id);
        setBeat(2);
        await say("interviewer", ex.followup, id);
        await pause(600, id);
        setBeat(3);
        setPhase("done");
        setAnnounce(`Takeaway: ${ex.feedbackTitle} ${ex.feedback}`);
        // Until someone touches it, the demo moves through each category on its own.
        if (!interactedRef.current) {
          await pause(5500, id);
          if (!interactedRef.current) void play((index + 1) % examples.length);
        }
      } catch (e) {
        if (!(e instanceof Cancelled)) throw e;
      }
    },
    [pause, say, stop],
  );

  const choose = (index: number, withSound = soundRef.current) => {
    interactedRef.current = true;
    soundRef.current = withSound;
    setSound(withSound);
    void play(index);
  };

  const toggleSound = () => {
    const next = !soundRef.current;
    // Turning sound on restarts the line from the top so it is heard in full.
    if (next) choose(selected, true);
    else {
      interactedRef.current = true;
      soundRef.current = false;
      setSound(false);
      if (speechAvailable()) window.speechSynthesis.cancel();
    }
  };

  // Plays silently while the card is on screen, unless motion is reduced.
  // Scrolling away pauses it; coming back picks the round up from the top.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = !!entry?.isIntersecting;
        if (interactedRef.current) return;
        if (!visibleRef.current) {
          if (autoplayedRef.current) stop();
          return;
        }
        autoplayedRef.current = true;
        void play(selectedRef.current);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [play, stop]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && speakingRef.current && soundRef.current) stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!started || phase === "done") return;
    const t = setInterval(() => visibleRef.current && setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, phase]);

  // The interviewer's presence moves with each word, without re-rendering.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const loop = (t: number) => {
      const el = orbRef.current;
      if (el && visibleRef.current) {
        const talking = speakingRef.current && speaker === "interviewer" && phase === "speaking";
        energyRef.current *= 0.9;
        const wobble = Math.abs(Math.sin(t / 97) * Math.sin(t / 151));
        const level = talking ? 0.25 + energyRef.current * 0.5 + wobble * 0.35 : 0;
        el.style.setProperty("--level", level.toFixed(3));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [speaker, phase]);

  const words = line.split(/\s+/).filter(Boolean);
  const interviewerTalking = phase === "speaking" && speaker === "interviewer";
  const candidateTalking = phase === "speaking" && speaker === "candidate";
  const status = !started
    ? "Ready when you are"
    : phase === "thinking"
      ? "Thinking about your answer"
      : phase === "done"
        ? "Round complete"
        : interviewerTalking
          ? "Speaking"
          : "Listening";
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="landing-preview-wrap" ref={rootRef}>
      <div className="preview-label">
        <span>Sit in on a practice round</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </div>
      <div className="landing-preview">
        <div className="preview-top">
          <span className="preview-room-label">
            <span className={`preview-dot${started && phase !== "done" ? " demo-live-dot" : ""}`} aria-hidden="true" />
            {started && phase !== "done" ? "Playing" : "The practice room"}
            <span className="demo-clock" aria-hidden="true">
              {clock}
            </span>
          </span>
          <button type="button" className="demo-sound" onClick={toggleSound} aria-pressed={sound}>
            {sound ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            <span>{sound ? "Sound on" : "Sound off"}</span>
          </button>
        </div>
        <div className="preview-tabs" role="group" aria-label="Choose a sample interview">
          {examples.map((item, i) => (
            <button type="button" key={item.category} aria-pressed={selected === i} aria-controls="preview-example" onClick={() => choose(i)}>
              {item.category}
            </button>
          ))}
        </div>

        <div className="demo-stage" id="preview-example">
          <div className={`demo-presence${interviewerTalking ? " is-talking" : ""}${phase === "thinking" ? " is-thinking" : ""}`}>
            <div className="demo-orb" ref={orbRef} aria-hidden="true">
              <span className="demo-ring" />
              <span className="demo-ring" />
              <span className="demo-core" />
            </div>
            <div className="demo-who">
              <strong>Your interviewer</strong>
              <span>{status}</span>
            </div>
          </div>

          <div className={`demo-self${candidateTalking ? " is-talking" : ""}`} aria-hidden="true">
            <span className="demo-self-name">You</span>
            <span className="demo-bars">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </span>
          </div>

          <div className="demo-captions" aria-hidden="true">
            {started && phase !== "done" && line ? (
              <>
                <span className="demo-caption-who">{speaker === "interviewer" ? "Interviewer" : "You"}</span>
                <p key={line}>
                  {words.map((w, i) => (
                    <span key={i} className={i < spoken ? "is-said" : undefined}>
                      {w}{" "}
                    </span>
                  ))}
                </p>
              </>
            ) : phase === "done" ? (
              <>
                <span className="demo-caption-who">The takeaway</span>
                <p className="demo-takeaway">{example.feedbackTitle}</p>
              </>
            ) : null}
          </div>

          {!started && (
            <button type="button" className="demo-start" onClick={() => choose(selected, true)}>
              <span className="demo-start-icon">
                <Play size={20} aria-hidden="true" />
              </span>
              <span>
                <strong>Play a sample round</strong>
                <span>About 40 seconds, with sound</span>
              </span>
            </button>
          )}
          {started && !sound && phase !== "done" && (
            <button type="button" className="demo-unmute" onClick={() => choose(selected, true)}>
              <Volume2 size={14} aria-hidden="true" /> Hear it
            </button>
          )}
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </div>

        <ol className="demo-beats" aria-label="Round progress">
          {beats.map((label, i) => (
            <li key={label} className={i < beat ? "is-past" : i === beat ? "is-current" : undefined} aria-current={i === beat ? "step" : undefined}>
              <span className="demo-beat-line" aria-hidden="true" />
              <span>
                0{i + 1} <span>{label}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="preview-answer-area">
          <div className="preview-answer-heading">
            <span className="t-eyebrow">{phase === "done" ? "What to take into your next round" : "What the interviewer noticed"}</span>
            <span aria-hidden="true">↳</span>
          </div>
          <div className="preview-answer">
            {phase === "done" ? (
              <p className="demo-feedback">{example.feedback}</p>
            ) : notes === 0 ? (
              <p className="demo-waiting">{beat >= 1 ? "Listening to your answer…" : "Notes appear as you answer."}</p>
            ) : null}
            {notes > 0 && (
              <ul className="preview-feedback-tags">
                {example.notes.slice(0, notes).map((note, i) => (
                  <li key={note} className="demo-note">
                    {i === 0 ? <Check size={17} aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {phase === "done" ? (
            <div className="demo-end">
              <Link className="preview-next" href="/signup">
                <span>Try your own round</span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <button type="button" className="demo-replay" onClick={() => choose(selected)} aria-label="Replay this sample">
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button className="preview-next" type="button" onClick={() => choose(selected, started ? soundRef.current : true)}>
              <span>{started ? "Start over" : "Play a sample round"}</span>
              {started ? <RotateCcw size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
      <p className="preview-caption">Sample round. Real practice listens and adapts to your answers.</p>
    </div>
  );
}
