-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'TEAM_STARTER', 'TEAM_GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingPurchaseStatus" AS ENUM ('PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OnboardingGoal" AS ENUM ('PRACTICING', 'RECRUITING', 'COACHING', 'EXPLORING');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "DesignSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('BEHAVIORAL', 'RECRUITER_SCREEN', 'FACE_TO_FACE');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "planExpiresAt" TIMESTAMP(3),
    "goal" "OnboardingGoal",
    "emailVerifiedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "totpEnabledAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "totpRecoveryCodes" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "returnedWithin7dAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "accessDays" INTEGER NOT NULL DEFAULT 30,
    "accessStartsAt" TIMESTAMP(3) NOT NULL,
    "accessEndsAt" TIMESTAMP(3) NOT NULL,
    "status" "BillingPurchaseStatus" NOT NULL DEFAULT 'PAID',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "BillingPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "leetcodeUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "examples" JSONB NOT NULL,
    "constraints" JSONB NOT NULL,
    "optimalTime" TEXT NOT NULL,
    "optimalSpace" TEXT NOT NULL,
    "tags" JSONB NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "language" TEXT NOT NULL DEFAULT 'python',
    "code" TEXT NOT NULL DEFAULT '',
    "totalScore" INTEGER,
    "recommendation" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "approachAcceptedAt" TIMESTAMP(3),
    "codePhaseEnteredAt" TIMESTAMP(3),
    "movedToCodeEarly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debrief" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Debrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDesignProblem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedRequirements" JSONB NOT NULL,
    "referenceArchitecture" TEXT NOT NULL,
    "deepDiveTopics" JSONB NOT NULL,
    "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 45,

    CONSTRAINT "SystemDesignProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "DesignSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "canvasJson" JSONB,
    "totalScore" INTEGER,
    "recommendation" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "scopeAcceptedAt" TIMESTAMP(3),
    "designPhaseEnteredAt" TIMESTAMP(3),
    "movedToDesignEarly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DesignSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignDebrief" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignDebrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehavioralScenario" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedSignals" JSONB NOT NULL,

    CONSTRAINT "BehavioralScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "scenarioId" TEXT,
    "plan" JSONB,
    "status" "ConversationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" INTEGER,
    "recommendation" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationDebrief" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationDebrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_flagged_idx" ON "User"("flagged");

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- CreateIndex
CREATE INDEX "User_emailVerifiedAt_idx" ON "User"("emailVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPurchase_stripeCheckoutSessionId_key" ON "BillingPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPurchase_stripePaymentIntentId_key" ON "BillingPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "BillingPurchase_userId_purchasedAt_idx" ON "BillingPurchase"("userId", "purchasedAt");

-- CreateIndex
CREATE INDEX "BillingPurchase_stripeCustomerId_idx" ON "BillingPurchase"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "BillingPurchase_status_idx" ON "BillingPurchase"("status");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Problem_topic_idx" ON "Problem"("topic");

-- CreateIndex
CREATE INDEX "Problem_difficulty_idx" ON "Problem"("difficulty");

-- CreateIndex
CREATE INDEX "Interview_userId_problemId_completedAt_idx" ON "Interview"("userId", "problemId", "completedAt");

-- CreateIndex
CREATE INDEX "Interview_userId_startedAt_idx" ON "Interview"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Message_interviewId_createdAt_idx" ON "Message"("interviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Debrief_interviewId_key" ON "Debrief"("interviewId");

-- CreateIndex
CREATE INDEX "SystemDesignProblem_topic_idx" ON "SystemDesignProblem"("topic");

-- CreateIndex
CREATE INDEX "SystemDesignProblem_difficulty_idx" ON "SystemDesignProblem"("difficulty");

-- CreateIndex
CREATE INDEX "DesignSession_userId_problemId_completedAt_idx" ON "DesignSession"("userId", "problemId", "completedAt");

-- CreateIndex
CREATE INDEX "DesignSession_userId_startedAt_idx" ON "DesignSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "DesignMessage_sessionId_createdAt_idx" ON "DesignMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesignDebrief_sessionId_key" ON "DesignDebrief"("sessionId");

-- CreateIndex
CREATE INDEX "BehavioralScenario_category_idx" ON "BehavioralScenario"("category");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_kind_completedAt_idx" ON "ConversationSession"("userId", "kind", "completedAt");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_startedAt_idx" ON "ConversationSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_kind_status_idx" ON "ConversationSession"("userId", "kind", "status");

-- CreateIndex
CREATE INDEX "ConversationMessage_sessionId_createdAt_idx" ON "ConversationMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationDebrief_sessionId_key" ON "ConversationDebrief"("sessionId");

-- AddForeignKey
ALTER TABLE "BillingPurchase" ADD CONSTRAINT "BillingPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debrief" ADD CONSTRAINT "Debrief_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignSession" ADD CONSTRAINT "DesignSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignSession" ADD CONSTRAINT "DesignSession_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "SystemDesignProblem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignMessage" ADD CONSTRAINT "DesignMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DesignSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignDebrief" ADD CONSTRAINT "DesignDebrief_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DesignSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "BehavioralScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationDebrief" ADD CONSTRAINT "ConversationDebrief_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

