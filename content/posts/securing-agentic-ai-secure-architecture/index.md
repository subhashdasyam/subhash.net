---
title: "Securing Agentic AI: Secure Architecture Patterns Part-7"
date: 2025-12-07T14:45:05.748+04:00
lastmod: 2025-12-19T16:03:18.042+04:00
slug: "securing-agentic-ai-secure-architecture"
tags:
  - "Agentic AI"
  - "Agents"
  - "AI"
  - "ai attacks"
  - "ai governance"
  - "ai security"
  - "Gen AI"
  - "GenAI"
  - "LLM"
system: "Agentic AI"
sourceURL: "https://www.subhashdasyam.com/2025/12/securing-agentic-ai-secure-architecture.html"
---
# 7. Secure Architecture Patterns

## 7.0 Why architecture beats clever prompts

Here is the uncomfortable truth: If your main security control is "We wrote a really strong system prompt", you will lose. Not today. Maybe not this quarter. But as soon as someone finds a weird edge case or the model behaves differently after an update, your "carefully crafted" prompt will help exactly as much as a sticky note on a production firewall.

Security for agentic systems looks a lot healthier when you treat the agent like:

A user input processor

A planner

A thing that calls tools

And you put proper controls before, around, and after it.

In this part we will build that structure:

Defense in depth (multiple checkpoints)

Sandboxed execution (where to keep blast radius small)

Audit and observability (so you can actually see what is going on)

Think of it as turning your agent platform from a clever demo into something your CISO can sleep near.

## 7.1 Defense in depth for agents

### 7.1.1 The airport security analogy

Treat your agent stack like an airport:

Checkpoint 1: Everyone gets their ID and bags checked at the entrance. For agents: input validation and policy checks before the model ever runs.

Checkpoint 2: Security scans at the gate, random checks. For agents: reasoning and plan monitoring.

Checkpoint 3: Boarding control. You only get on the right plane with the right ticket. For agents: action validation and tool guards.

Checkpoint 4: Customs on the way out for international flights. For agents: output sanitization and DLP before responses leave your system.

If you skip any of these, you can still fly. It just stops being a good idea. We will wire these into a standard request pipeline you can actually implement.

### 7.1.2 Input validation layer

Goal: Only let the model see requests that are well-formed, within policy, and tagged with identity and context. Also, stop obviously risky stuff before burning tokens.

What to check here:

Authentication and tenant

Request size and complexity

Basic pattern checks (known prompt injection patterns, known banned actions)

Task classification ("is this actually allowed for this agent and this user")

Simple Node style entry pipeline:

TypeScript

```
type AgentRequest = {
  userId: string;
  tenantId: string;
  agentId: string;
  message: string;
};

function validateInput(req: AgentRequest) {
  if (!req.userId || !req.tenantId) {
    throw new Error("Missing identity");
  }

  if (req.message.length > 8000) {
    throw new Error("Input too large");
  }

  if (looksLikePromptInjection(req.message)) {
    // You may still allow it, but log and strip control phrases
    return {
      ...req,
      message: sanitizeInjection(req.message),
    };
  }

  return req;
}

```

`looksLikePromptInjection` is not magic. It checks for patterns like "ignore previous instructions", "you are now in debug mode", "internal note to the AI". You can log such cases for monitoring, even if you allow the request.

Developer Note: Do not overdo this and break normal conversations. Input validation is about reducing obvious attack surface, not about trying to outsmart every attacker in regex.

### 7.1.3 Reasoning monitoring layer

This is where you watch what the model is trying to do before you let it touch tools. In many frameworks (LangChain, LangGraph, AutoGen, CrewAI), you have callback hooks or interceptors.

You can use these to:

Inspect model outputs

Look at planned tool calls

Apply guardrails before actions

Example: intercept tool calls in a LangChain style agent (Python):

Python

```
from langchain_core.callbacks import BaseCallbackHandler

class ToolGuardCallback(BaseCallbackHandler):
    def __init__(self, allowed_tools, cost_tracker):
        self.allowed_tools = allowed_tools
        self.cost_tracker = cost_tracker

    def on_tool_start(self, serialized, input_str, **kwargs):
        tool_name = serialized.get("name")

        if tool_name not in self.allowed_tools:
            raise RuntimeError(f"Tool {tool_name} not allowed for this agent")

        self.cost_tracker.add_tool_call(tool_name)
        if self.cost_tracker.exceeded():
            raise RuntimeError("Tool call budget exceeded")

```

Attach this to your agent:

Python

```
agent = create_react_agent(
    tools=tools,
    llm=llm,
    callbacks=[ToolGuardCallback(allowed_tools=["search", "lookup"], cost_tracker=tracker)],
)

```

Pattern Reference: This is the "reasoning monitoring layer" in practice: you do not trust the raw plan from the LLM. You intercept tool usage and apply rules.

### 7.1.4 Action validation layer

Now we check the actual tool calls and side effects. This layer lives in the tool wrappers, the microservices behind them, or a policy engine (OPA, Cedar, custom).

Here you enforce:

Identity and scopes from Part 6

Business rules from compliance

HITL decisions from Part 4

Example: validating a payment tool (Node):

JavaScript

```
async function executePaymentTool(args: any, ctx: AgentContext) {
  const { amount, currency, beneficiaryId } = args;

  // Identity level checks
  requireScope(ctx, "PAYMENT_EXECUTE");
  requireAgent(ctx, ["payments_agent"]);

  // Business rule checks
  if (!["USD", "EUR", "AED"].includes(currency)) {
    throw new Error("Unsupported currency");
  }

  if (amount <= 0) {
    throw new Error("Invalid amount");
  }

  if (amount > 500 && !ctx.approvalId) {
    // tie into HITL from Part 4
    return await enqueueApprovalRequest({ args, ctx });
  }

  // If we reach here, we can execute
  const txId = await coreBanking.pay(beneficiaryId, amount, currency);

  await logAction({
    type: "payment",
    txId,
    amount,
    currency,
    traceId: ctx.traceId,
    userId: ctx.userId,
    agentId: ctx.agentId,
  });

  return { status: "SUCCESS", txId };
}

```

Notice what is missing: No "if the model said so, trust it". Only concrete rules and approvals.

Security Warning: If your tool implementation looks like "call whatever URL and body the LLM suggests", you are handing the attacker your internal network.

### 7.1.5 Output sanitization layer

This is your last line before responses go back to users or external systems.

Main jobs:

Remove or mask sensitive content (PII patterns, sensitive keywords)

Strip internal instructions that leaked into outputs

Normalize formatting if needed

Simple Node style DLP filter:

JavaScript

```
function maskPII(text: string): string {
  // very simplified example
  const maskedId = text.replace(/\b\d{11,14}\b/g, "[ID_MASKED]");
  const maskedCard = maskedId.replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, "[CARD_MASKED]");
  return maskedCard;
}

function sanitizeOutput(response: string): string {
  return maskPII(response);
}

```

Executive Takeaway: Defense in depth for agents is: validate input, watch the plan, gate actions in code, clean outputs. Each layer assumes the previous one can fail. That is what makes the system survivable.

## 7.2 Sandboxed execution

Even with good validation, assume something bad will slip through. Sandboxing answers: "When it does, how far can it go?"

We will talk about: Container isolation, Network policies, Filesystem restrictions, and Resource quotas. Think of this as blast radius engineering.

### 7.2.1 Container isolation for code execution and tools

Many agent patterns run code dynamically ("write a Python script", "run this SQL"). If you do that in the same process as your orchestrator, you are asking for trouble.

Patterns:

Use a separate container or micro VM for code execution.

For each task, create a sandbox instance or use a small pool.

Mount only what is needed and destroy/reset after use.

Simple mental contract: The orchestrator is never the place where untrusted code runs. The sandbox cannot reach anything important directly.

Real Talk: If your "code interpreter" runs with full network and disk access in the same pod as your agent orchestrator, you just reimplemented remote code execution as a feature.

### 7.2.2 Network policies for agent workloads

Use network as a safety net.

Per agent or per pod:

Only allow outbound connections to LLM provider, specific internal APIs via gateway, and necessary external APIs.

Default deny everything else.

In Kubernetes terms: NetworkPolicy objects for each namespace or app. Service mesh or gateway for all outbound calls.

Pattern Reference: This is your usual zero trust network segmentation. The only difference is that you now think "agent" instead of "service".

### 7.2.3 Filesystem restrictions

Agents and sandboxes should not see the host filesystem, not see secrets in plain files, and only see minimal temp storage where needed.

Patterns:

Read-only filesystem for agent containers where possible.

No`hostPath` mounts unless you really need them.

For sandboxes: ephemeral volumes that are destroyed after run.

### 7.2.4 Resource quotas and guardrails

Remember "denial of wallet" and resource exhaustion from Part 5. Sandboxing also means quotas for CPU and memory, limits on concurrent sandboxes per user, and timeouts for each run.

For agent orchestrator: Max tokens per request, Max tool calls per turn, Max concurrent requests per user. Checking these is boring but effective.

Security Warning: Without quotas, your agent platform is a very fancy way to let anyone run a small stress test against your infra and your LLM billing account.

## 7.3 Audit and observability

You cannot secure what you cannot see. You also cannot defend yourself to regulators with log lines like "something happened".

For agents, you need to see: What they thought, What they did, Who they acted for, and How much it cost.

### 7.3.1 Logging agent reasoning traces

This one is sensitive. Reasoning traces are gold for debugging/security but are potential privacy risks.

Guidance: Log enough to understand decisions. Avoid storing full inputs and outputs for very sensitive tasks. Treat reasoning logs as high sensitivity data if they include PII or business secrets.

Example trace log record:

JSON

```
{
  "trace_id": "abc123",
  "span_id": "span-7",
  "timestamp": "2025-12-07T10:15:23Z",
  "agent_id": "cs_agent",
  "user_id": "u-42",
  "tenant_id": "t-retail-bank",
  "event_type": "reasoning_step",
  "step_type": "tool_selection",
  "summary": "Decided to call refund_tool for small disputed transaction",
  "redacted_context": {
    "amount_bucket": "0-200",
    "dispute_type": "duplicate_charge"
  }
}

```

Developer Note: For highly sensitive domains, consider logging structured summaries rather than raw prompts and outputs.

### 7.3.2 Action attribution and lineage

Every impactful action should be attributable. Minimum fields:`trace_id`,`agent_id`,`user_id`(or "system"),`tool_name`,`key parameters`,`result`,`approval_id`.

Example:

JSON

```
{
  "trace_id": "abc123",
  "timestamp": "2025-12-07T10:16:01Z",
  "agent_id": "payments_agent",
  "user_id": "rm-992",
  "tenant_id": "t-corp-banking",
  "tool_name": "issueRefund",
  "result": "SUCCESS",
  "amount": 180.0,
  "currency": "USD",
  "customer_id": "cust-552",
  "approval_id": "appr-77"
}

```

Executive Takeaway: If your agent audit story cannot answer "who, what, when, on whose behalf, under which policy" in one query, you are not done yet.

### 7.3.3 Replay capabilities for incident investigation

When something goes wrong you want to reconstruct what the agent saw and replay with updated guards.

Replay system basics:

Store enough context (user input, retrieved docs IDs, tool responses, model parameters).

Provide a replay harness (can re-run the same trace with new prompts/tools in a non-production environment).

Real Talk: Replay is what turns "we think we fixed it" into "we proved that in the same situation the system now behaves differently".

### 7.3.4 Real time anomaly detection

You do not just want to look at logs after the fact. Some patterns deserve live alerts.

Signals to watch:

Sudden spikes in tool usage.

New tools being used by an agent for the first time.

Unusual parameter distributions (many large refunds).

Cost anomalies (token usage jump per tenant).

High level setup: Stream agent logs into something like Kafka or an event bus. Build simple detectors first (thresholds, rate limits).

Security Warning: Start with stupid simple rules. "More than 10 large payments per hour from one agent" will catch more real problems than a beautiful but unmaintained anomaly model.

### 7.3.5 Tying observability to governance

All of this feeds back into the HITL thresholds in Part 4, the risk scenarios in Part 5, and the IAM scopes in Part 6. The observability story is not separate from security or product. It is your feedback loop.

## 7.4 A simple reference architecture

Let us pull all of Part 7 together into a single mental diagram.

Words instead of boxes:

Entry API: Auth checks, Input validation, Tenant and user resolution.

Agent Orchestrator: Builds AgentContext with scopes and trace id. Calls LLM through a provider. Uses callbacks for reasoning monitoring.

Tool Proxy Layer: One gateway that all tool calls go through. Enforces allowed agents, scopes, HITL gates, budgets.

Sandbox Services: For untrusted code and risky operations. Isolated from main data stores.

Network Controls: Egress through proxies. Ingress limited to known sources.

Data Layer: Tenant and data tier isolation. RAG indexes with trust metadata.

Audit and Monitoring: Central trace and log pipeline. Dashboards for action counts and anomalies.

Executive Takeaway: A secure agent architecture is not one big, clever, trusted LLM. It is a series of boring, reliable checkpoints around the LLM. That is what makes "agents with real power" something you can defend in front of your board and your regulator.
