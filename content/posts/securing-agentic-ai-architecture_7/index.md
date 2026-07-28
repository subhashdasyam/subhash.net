---
title: "Securing Agentic AI: Human in the Loop (HITL) Design Patterns Part-4"
date: 2025-12-07T14:28:00.005+04:00
lastmod: 2025-12-19T16:03:13.498+04:00
slug: "securing-agentic-ai-architecture_7"
tags:
  - "Agentic AI"
  - "Agents"
  - "AI"
  - "ai attacks"
  - "ai governance"
  - "ai security"
  - "Gen AI"
  - "GenAI"
system: "Agentic AI"
sourceURL: "https://www.subhashdasyam.com/2025/12/securing-agentic-ai-architecture_7.html"
---
# 4. Human in the Loop (HITL) Design Patterns

## 4.0 Why HITL is where grown-up safety lives

Autonomous agents feel magical right up to the moment they:

Move real money

Change real infrastructure

Touch real patient data

Email real customers

At that point, you are not shipping "AI features". You are shipping delegated decision-making.

HITL is how you:

Stop one bad decision from becoming a headline.

Prove to regulators and auditors that someone is actually accountable.

Keep humans mentally engaged, not just glorified "OK" buttons.

This part is about where to put humans in the loop, how to wire that technically without killing UX, and what not to do unless you enjoy incident calls.

## 4.1 Why HITL is non-negotiable (executive framing)

Three honest reasons, no AI hype required.

### 4.1.1 Autonomy without oversight is liability

If an agent can approve payments, change pricing, push deployments, or touch regulated data, and there is no human checkpoint anywhere, then:

Every bug is now a potentially expensive mistake.

Every prompt injection is now an operational incident.

Your risk team cannot sell that to your board by calling it "innovation".

### 4.1.2 Regulators care about explainability and accountability

In banking, healthcare, insurance, and critical infrastructure:

Someone needs to own each decision.

You need to show who approved, based on what information, under which policy.

An agent trace that says "Thought: I felt good about it" is not going to cut it. HITL gives you a place to put real signatures and a story for "how did this get approved" that does not involve shrugging.

### 4.1.3 Insurance and liability

Insurers and legal teams will eventually ask:

"What are your controls on automated decisions?"

"Can the AI do X without human approval?"

Having concrete HITL patterns de-risks your cyber and professional liability discussions and makes it easier to argue "we were not reckless".

### 4.1.4 Automation complacency

Humans get lazy around automation. After a while:

"Review this and click approve" becomes "click approve".

People trust the agent more than they trust themselves.

Your job is to design HITL so that humans are used where their judgment actually matters, and the UI/process encourages real thinking, not rubber stamping.

Executive Takeaway: HITL is not a tax on AI. It is what turns "we let a black box run our operations" into "we use automation with clear controls, approvals, and accountability".

## 4.2 HITL Trigger Points: where humans must show up

We will group triggers into 5 buckets with concrete examples and thresholds. You rarely need all of them for a single use case. But you should consciously decide which ones you want, instead of leaving it to vibes.

### Category A: Irreversibility triggers

These are actions that are hard or impossible to undo.

Typical examples:

Data deletion or modification at scale.

Money movement above a threshold.

External communications that cannot be recalled.

Production infrastructure changes.

Concrete banking example:

Banking agent processes refund requests.

Policy:

Any refund up to 200: auto approve.

200 to 500: agent proposes, human approves.

Above 500: agent drafts reasoning only, human decides.

How to implement:

Define a policy object, not vibes:

TypeScript

```
type RefundPolicy = {
  autoApproveLimit: number;
  hitlApprovalLimit: number;
};

const policy: RefundPolicy = {
  autoApproveLimit: 200,
  hitlApprovalLimit: 500,
};

function classifyRefund(amount: number): "AUTO" | "HITL" | "HUMAN_ONLY" {
  if (amount <= policy.autoApproveLimit) return "AUTO";
  if (amount <= policy.hitlApprovalLimit) return "HITL";
  return "HUMAN_ONLY";
}

```

And in your agent tool wrapper (Node):

JavaScript

```
async function refundTool(args: any, ctx: { userId: string }) {
  const { amount, transaction_id } = args;
  const mode = classifyRefund(amount);

  if (mode === "AUTO") {
    return await issueRefund(transaction_id, amount, ctx.userId);
  }

  if (mode === "HITL") {
    return await enqueueApprovalRequest({
      type: "REFUND",
      userId: ctx.userId,
      transactionId: transaction_id,
      amount,
    });
  }

  // HUMAN_ONLY
  return {
    status: "requires_human",
    message: "Amount above 500. Please submit to human approver.",
  };
}

```

Developer Note: This pattern is simple, but it is the core of all "irreversibility" HITL: classify by policy, route accordingly, never let the agent improvise here.

### Category B: Confidence triggers

Sometimes the agent just is not sure. Use that instead of pretending.

Signals you can use:

Model confidence or logit-based certainty metrics.

Multiple tools disagreeing.

Multiple agents disagreeing.

Out-of-distribution inputs (very different from training cases).

Insurance claims example:

Claims agent handles motor claims up to a certain complexity. When it encounters a new combination of damage types and documents it has not seen before, it marks the case as "novel" and routes to a human adjuster.

Implementation idea:

Store risk / confidence in the agent state and make decisions based on it, not just natural language.

Python

```
from enum import Enum

class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"

def decide_hitl(confidence: ConfidenceLevel, amount: float) -> bool:
    if confidence in [ConfidenceLevel.LOW, ConfidenceLevel.UNKNOWN]:
        return True
    if amount > 10000:
        return True
    return False

```

Then, if`decide_hitl` returns`True`, the agent stops short of making the decision and instead prepares a summary for human review.

Real Talk: Confidence scores straight from the LLM are often junk. Mix them with simple, boring signals like "amount", "missing documents", "new entity types" for better triggers.

### Category C: Compliance triggers

Anything touching regulated data or regulated actions deserves extra love.

Typical triggers:

Accessing or modifying PII (personal data) or PHI (health data).

Cross-border data transfers.

Actions under PCI, HIPAA, GDPR, local banking laws.

Healthcare example:

Scheduling agent accesses patient records to book follow-up appointments. Even if the access is legitimate, all such accesses are logged and some are sampled into a compliance review queue.

Practical patterns:

Tag data and tools by classification: PUBLIC, INTERNAL, CONFIDENTIAL, HIGHLY_CONFIDENTIAL. If agent touches HIGHLY_CONFIDENTIAL, you log extra metadata or require HITL for certain actions.

JavaScript

```
function requiresComplianceReview(dataClass: "PUBLIC" | "CONFIDENTIAL" | "HIGHLY_CONFIDENTIAL") {
  return dataClass === "HIGHLY_CONFIDENTIAL";
}

async function accessPatientRecordTool(args: any, ctx: any) {
  const record = await getPatientRecord(args.patientId, ctx.userId);

  if (requiresComplianceReview(record.dataClass)) {
    await enqueueComplianceLog({
      userId: ctx.userId,
      agentId: ctx.agentId,
      patientId: args.patientId,
      reason: "scheduler_access",
      timestamp: new Date().toISOString(),
    });
  }

  return redactForAgent(record);
}

```

### Category D: Cost triggers

Agents that use tools and external models can spend real money very quickly.

Triggers can be based on:

Tokens used in a single session.

Number of tool calls.

Wall clock time.

API costs from provider.

Research agent example:

Policy: If token usage exceeds 50,000 in a single request, the agent must pause, show the user a summary of what it has so far, and ask for permission to continue.

Implementation idea (Node):

TypeScript

```
type UsageBudget = {
  maxTokens: number;
  maxToolCalls: number;
};

const budget: UsageBudget = { maxTokens: 50000, maxToolCalls: 50 };

class UsageTracker {
  tokens = 0;
  toolCalls = 0;

  addTokens(t: number) { this.tokens += t; }
  addToolCall() { this.toolCalls += 1; }

  exceeded(): boolean {
    return this.tokens > budget.maxTokens || this.toolCalls > budget.maxToolCalls;
  }
}

```

Security Warning: Cost triggers are not just about money. Resource exhaustion attacks can also degrade performance for other users. Treat "unbounded research" like any other DoS vector.

### Category E: Escalation triggers

Sometimes you need humans because humans are asking for humans.

Triggers:

User says "I want to talk to a person".

Sentiment analysis shows frustration or anger.

The same intent fails multiple times.

Customer service example:

Customer service agent fails to resolve the same issue 3 times in a thread. It must escalate to a human and provide a compact summary plus all context.

Implementation basics:

Python

```
def escalation_required(events) -> bool:
    failed_attempts = sum(1 for e in events if e["type"] == "failure")
    user_requested_human = any(
        "human" in e["text"].lower() or "agent" in e["text"].lower()
        for e in events if e["role"] == "user"
    )

    if user_requested_human:
        return True
    if failed_attempts >= 3:
        return True
    return False

```

Real Talk: Nothing kills trust in your fancy agents faster than an angry customer stuck in a loop with something that refuses to let them reach a human.

## 4.3 HITL implementation patterns

Now: how do you actually wire humans in so it is safe but not miserable. We will cover:

Synchronous approval gates

Asynchronous review queues

Shadow mode

Exception based review

### 4.3.1 Synchronous approval gates

What it is: Agent blocks on a human decision. Workflow does not proceed until approved or rejected. Think "Manager approval".

Use when: Action is high risk, hard to reverse, time sensitive (e.g., Big refunds, Large trades, Production deployments).

Simple flow:

Agent prepares an "Action Proposal".

System writes it to an approvals table / queue.

Human sees it in a dashboard or via notification.

Human clicks approve / reject.

Agent resumes or aborts.

Node style wrapper:

JavaScript

```
async function withApprovalGate<T>(
  actionType: string,
  payload: any,
  ctx: { userId: string; agentId: string },
  executor: () => Promise<T>,
): Promise<T | { status: "PENDING_APPROVAL" }> {
  const needsApproval = shouldRequireApproval(actionType, payload);

  if (!needsApproval) {
    return executor();
  }

  const approvalId = await storeApprovalRequest({
    actionType,
    payload,
    userId: ctx.userId,
    agentId: ctx.agentId,
  });

  return { status: "PENDING_APPROVAL", approvalId };
}

```

Security Warning: Synchronous gates are powerful but easy to abuse. If you put 200 approvals per day on one manager, they will eventually click "approve all". Use them only where they matter.

### 4.3.2 Asynchronous review queues

What it is: Agent takes action right away. Action is either staged (can be rolled back) or live but logged for time-bound review. Humans review a queue and can reverse within a window.

Use when: High volume, Medium risk, Reversible within time window.

Pattern: "Shadow table" or "staging area" where changes are applied first, then promoted to "active" state after review or timeout.

Flow:

Agent writes to`user_profile_staging` and optionally applies change to main profile.

Reviewers see a UI showing "old vs new".

If something looks off, they set status to`ROLLED_BACK`.

System applies reversal based on`old_profile`.

Developer Note: Asynchronous review works best when actions are small and reversible. Do not use it as your only control for things like large payments.

### 4.3.3 Shadow mode

What it is: Agent makes a recommendation. Human still does the actual action. Used heavily in early phases to build trust.

Examples: Agent proposes monitoring alerts or deployment decisions, but humans click "send" or "deploy".

Implementation:

Side-by-side UI panels: "Agent suggestion" vs "Your decision" fields.

Log: when human accepts suggestion, when they modify it, when they override entirely.

Real Talk: Shadow mode is not real automation. But it is how you avoid getting burned in the first three months. Once patterns are stable and well governed, you can selectively switch specific paths from "shadow" to "auto with HITL triggers".

### 4.3.4 Exception based review

What it is: Agent runs autonomously most of the time. Only outliers are reviewed.

Pattern:

Define baselines and thresholds. Tag each agent action with: score, risk level, deviation from baseline. Only high risk / high deviation actions go into review queues.

Minimal example for payment review:

Python

```
def anomaly_score(payment) -> float:
    # 0 normal, 1 very weird
    return model_predict_anomaly(payment)

def should_review(payment, decision) -> bool:
    if payment.amount > 10000:
        return True
    if anomaly_score(payment) > 0.8:
        return True
    if decision == "override_policy":
        return True
    return False

```

This pattern scales well, but requires good baselines, careful tuning, and strong auditing.

## 4.4 HITL anti-patterns: what not to do

Quick list of "please do not" with why.

### 4.4.1 Approve all buttons

Pattern: UI shows 50 pending approvals. There is one shiny "Approve all" button.

What happens: Human is overloaded. Clicks once to "clean it up". Everything, including that one weird case, gets through.

Better: Bulk approve only for low-risk actions after sampling a subset. No bulk at all for critical decisions.

Security Warning: "Approve all" is one of the fastest ways to turn your carefully designed HITL into security theater.

### 4.4.2 Timeout to approve

Pattern: "If approver does not respond in 15 minutes, auto approve."

Why it fails: This is the exact opposite of what you want.

Better defaults: If timeout: auto reject, or auto escalate, or keep pending and alert someone else. But never quietly approve.

### 4.4.3 Hiding agent actions in dense logs nobody reads

If the only record of agent activity is giant JSON blobs in a logging system with no aggregation, nobody will look, and nobody will catch subtle drift.

You want: Dashboards showing volume of actions, approval vs rejection rates, and drill-down from high-level metrics to individual traces.

### 4.4.4 HITL theater

What it is: The documentation says "human review required", but the system does not enforce it, or manual workarounds allow bypassing queues. Over time, nobody actually reviews anything.

Mitigations: Enforce HITL gates in code, not policy PDFs. Regularly test by trying to perform a high-risk action without approval and confirming it fails.

Real Talk: HITL that exists only on slides is worse than no HITL at all, because it gives a false sense of safety.

## 4.5 Putting it together

Quick checklist for any agent use case:

List actions that are irreversible, regulated, or expensive.

For each action, assign:

A: Irreversibility triggers

B: Confidence triggers

C: Compliance triggers

D: Cost triggers

E: Escalation triggers

Decide the pattern: Synchronous approval, Async review, Shadow mode, or Exception based review.

Encode it as code and config, not just prompts.

Log and review usage over time.

Executive Takeaway: HITL is not just "put a human somewhere". It is a set of explicit rules about when machines must pause, when humans must decide, and how everything is recorded. Get this right early and you can safely move more tasks from "shadow mode" to "supervised" to "autonomous with exceptions" over time.
