"use client";

import { useState } from "react";
import { ConversationSession, type ConversationSessionProps } from "./ConversationSession";
import { VoiceConversationSession } from "./VoiceConversationSession";
import { voiceEnabledFor } from "@/lib/features";

/**
 * A recruiter screen or behavioral round: spoken by default when voice is on
 * for that round, with "Prefer to type?" falling back to the text chat.
 */
export function ConversationRound(props: ConversationSessionProps) {
  const [mode, setMode] = useState<"voice" | "text">(voiceEnabledFor(props.kind) ? "voice" : "text");

  if (mode === "voice") {
    return <VoiceConversationSession {...props} onPreferText={() => setMode("text")} />;
  }
  return <ConversationSession {...props} />;
}
