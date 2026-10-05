"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  CornerDownRight,
  MessageSquare,
} from "lucide-react";
import { Brand } from "@/components/Brand";

const examples = [
  {
    mode: "Recruiter",
    topic: "Your story, clearly told.",
    question:
      "Tell me about yourself and what you’re looking for in your next role.",
    answer:
      "I’ve spent the last three years building payment systems. I’m ready to bring that experience to a smaller team where I can own a product end to end.",
    followup:
      "What’s one thing you built that shows you’re ready for that ownership?",
    feedback:
      "A clear direction. Now connect it to a specific example of your impact.",
    tags: ["Story clarity", "Role alignment"],
  },
  {
    mode: "Behavioral",
    topic: "Go beyond “we did it.”",
    question: "Tell me about a time you disagreed with a teammate’s approach.",
    answer:
      "We disagreed about rebuilding a service. I proposed a small experiment so we could compare the options before committing.",
    followup:
      "What did your experiment measure, and what changed because of the result?",
    feedback:
      "Good initiative. Make the outcome as concrete as the action you took.",
    tags: ["STAR structure", "Evidence of impact"],
  },
  {
    mode: "Coding",
    topic: "Show your thinking.",
    question:
      "How would you find two numbers in an array that add up to a target?",
    answer:
      "I’d keep a map of the values I’ve seen. For each number, I’d check whether its complement is already in the map.",
    followup: "What happens when the array contains the same value twice?",
    feedback:
      "A sound approach. Walk through the edge cases before you start coding.",
    tags: ["Problem solving", "Communication"],
  },
];

export function PracticePreview() {
  const [selected, setSelected] = useState(0);
  const [showFollowup, setShowFollowup] = useState(false);
  const example = examples[selected]!;
  return (
    <div className="landing-preview-wrap">
      <div className="landing-preview-orbit" aria-hidden="true" />
      <div className="landing-preview">
        <div className="preview-top">
          <Brand compact />
          <span>Your practice room</span>
          <span className="preview-sample">Example session</span>
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
              onClick={() => {
                setSelected(i);
                setShowFollowup(false);
              }}
            >
              {item.mode}
            </button>
          ))}
        </div>
        <div className="preview-conversation" aria-live="polite">
          <span className="studio-label">
            A little practice goes a long way
          </span>
          <h2>{example.topic}</h2>
          <div className="preview-question">
            <span className="preview-avatar">
              <MessageSquare size={15} />
            </span>
            <div>
              <span>INTURVIEW</span>
              <p>{example.question}</p>
            </div>
          </div>
          <div className="preview-answer">
            <span>YOUR ANSWER</span>
            <p>{example.answer}</p>
          </div>
          {showFollowup ? (
            <div className="preview-followup">
              <CornerDownRight size={17} />
              <p>{example.followup}</p>
            </div>
          ) : (
            <button
              type="button"
              className="preview-next"
              onClick={() => setShowFollowup(true)}
            >
              See the follow-up <ArrowRight size={14} />
            </button>
          )}
        </div>
        <div className="preview-footer">
          <span className="preview-dot" /> A safe place to find your words.
          <span>01 / 03</span>
        </div>
      </div>
      <div className="preview-feedback">
        <span className="feedback-check">
          <Check size={16} />
        </span>
        <div>
          <span className="studio-label">The kind of feedback you can use</span>
          <p>{example.feedback}</p>
          <div>
            {example.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="preview-caption">
        Sample answers and feedback. Your session is uniquely yours.
      </p>
    </div>
  );
}
