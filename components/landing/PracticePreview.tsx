"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";

const examples = [
  {
    mode: "Recruiter",
    question: "Tell me about yourself.",
    context: "And what are you looking for in your next role?",
    answer:
      "I’ve spent three years building payment systems. Now I want to join a smaller team where I can own a product end to end.",
    followup: "What have you built that shows you’re ready for that ownership?",
    feedbackTitle: "Make the impact yours.",
    feedback:
      "Your direction is clear. Bring it to life with one thing you owned, a decision you made, and what changed because of it.",
    tags: ["Clear direction", "Add a concrete example"],
  },
  {
    mode: "Behavioral",
    question: "Tell me about a disagreement.",
    context: "A time you and a teammate saw the problem differently.",
    answer:
      "We disagreed about rebuilding a service. I proposed a small experiment so we could compare the options before committing.",
    followup: "What did the experiment measure? What changed because of it?",
    feedbackTitle: "Go beyond “we did it.”",
    feedback:
      "The initiative comes through. Close the story with a specific result and the part you played in getting there.",
    tags: ["Strong initiative", "Show the outcome"],
  },
  {
    mode: "Coding",
    question: "Talk me through your approach.",
    context: "Find two numbers in an array that add up to a target.",
    answer:
      "I’d keep a map of the values I’ve seen. For each number, I’d check whether its complement is already in the map.",
    followup: "What if the array contains the same value twice?",
    feedbackTitle: "Test your thinking.",
    feedback:
      "A sound approach. Walk through a duplicate-value example and explain why you check the map before inserting the current number.",
    tags: ["Sound approach", "Explore the edge cases"],
  },
  {
    mode: "System design",
    question: "Where would you start?",
    context: "Design a notification service for a growing product.",
    answer:
      "I’d put a queue between the application and delivery workers, so a slow email provider doesn’t block the user’s request.",
    followup: "A worker retries a delivery. How do you avoid sending it twice?",
    feedbackTitle: "Follow the failure path.",
    feedback:
      "The queue separates responsibilities well. Now describe idempotency and how you would track a notification through a retry.",
    tags: ["Clear separation", "Explain retry behavior"],
  },
];

const steps = ["The question", "The follow-up", "The takeaway"];

export function PracticePreview() {
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(0);
  const example = examples[selected]!;

  return (
    <div className="landing-preview-wrap">
      <div className="preview-label">
        <span>Get a feel for the conversation</span>
        <ArrowUpRight size={16} aria-hidden="true" />
      </div>
      <div className="landing-preview">
        <div className="preview-top">
          <span className="preview-room-label">
            <span className="preview-dot" aria-hidden="true" />
            The practice room
          </span>
          <span className="preview-sample">Interactive example</span>
        </div>
        <div
          className="preview-tabs"
          role="group"
          aria-label="Choose a sample interview"
        >
          {examples.map((item, i) => (
            <button
              type="button"
              key={item.mode}
              aria-pressed={selected === i}
              aria-controls="preview-example"
              onClick={() => {
                setSelected(i);
                setStep(0);
              }}
            >
              {item.mode}
            </button>
          ))}
        </div>
        <div className="preview-stage" id="preview-example">
          <div className="preview-stage-meta" aria-hidden="true">
            <span>
              {step === 2 ? "A useful next step" : "Your AI interviewer"}
            </span>
            <span className="preview-counter">
              0{step + 1}
              <span> / 03</span>
            </span>
          </div>
          <div className="preview-prompt" aria-live="polite" aria-atomic="true">
            <div key={`${selected}-${step}`} className="preview-prompt-content">
              <span className="sr-only">{steps[step]}: </span>
              <h2>
                {step === 0
                  ? example.question
                  : step === 1
                    ? example.followup
                    : example.feedbackTitle}
              </h2>
              <p>
                {step === 0
                  ? example.context
                  : step === 1
                    ? "A good interview goes beyond the first answer."
                    : example.feedback}
              </p>
            </div>
          </div>
          <div
            className="preview-steps"
            role="group"
            aria-label="Explore the sample conversation"
          >
            {steps.map((label, i) => (
              <button
                type="button"
                key={label}
                aria-pressed={step === i}
                aria-controls="preview-example"
                onClick={() => setStep(i)}
              >
                <span className="preview-step-line" aria-hidden="true" />
                <span>
                  0{i + 1} <span>{label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="preview-answer-area">
          <div className="preview-answer-heading">
            <span className="t-eyebrow">
              {step === 2
                ? "What to take into your next round"
                : "One way you might answer"}
            </span>
            <span aria-hidden="true">↳</span>
          </div>
          <div className="preview-answer" aria-live="polite">
            {step === 2 ? (
              <ul className="preview-feedback-tags">
                {example.tags.map((tag, i) => (
                  <li key={tag}>
                    {i === 0 ? (
                      <Check size={17} aria-hidden="true" />
                    ) : (
                      <ArrowUpRight size={17} aria-hidden="true" />
                    )}
                    <span>{tag}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>“{example.answer}”</p>
            )}
          </div>
          <button
            className="preview-next"
            type="button"
            onClick={() => setStep((step + 1) % steps.length)}
          >
            <span>
              {step === 0
                ? "See the follow-up"
                : step === 1
                  ? "See the feedback"
                  : "Replay this example"}
            </span>
            {step === 2 ? (
              <RotateCcw size={17} aria-hidden="true" />
            ) : (
              <ArrowRight size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <p className="preview-caption">
        Sample conversation. Real practice adapts to your answers.
      </p>
    </div>
  );
}
