"use client";

import type { OnboardingGoal, PlanTier, Role } from "@prisma/client";
import type { PlanDefinition } from "@/lib/plans";
import { ProfileSection } from "./ProfileSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { SecuritySection } from "./SecuritySection";
import { DangerZone } from "./DangerZone";

export interface AccountProfile {
  email: string;
  name: string | null;
  role: Role;
  plan: PlanTier;
  goal: OnboardingGoal | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface AccountPageProps {
  profile: AccountProfile;
  planInfo: PlanDefinition;
  interviewsThisMonth: number;
}

export function AccountPage({ profile, planInfo, interviewsThisMonth }: AccountPageProps) {
  return (
    <div className="space-y-12">
      <ProfileSection profile={profile} />
      <SectionDivider />
      <SubscriptionSection plan={planInfo} interviewsThisMonth={interviewsThisMonth} />
      <SectionDivider />
      <SecuritySection email={profile.email} twoFactorEnabled={profile.twoFactorEnabled} />
      <SectionDivider tone="danger" />
      <DangerZone email={profile.email} isAdmin={profile.role === "ADMIN"} />
    </div>
  );
}

function SectionDivider({ tone }: { tone?: "danger" }) {
  return (
    <div
      className="h-px w-full"
      style={{
        background:
          tone === "danger"
            ? "rgb(var(--score-no) / 0.18)"
            : "rgb(var(--border-base))",
      }}
      aria-hidden
    />
  );
}
