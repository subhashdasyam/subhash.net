---
title: "Securing Agentic AI: Multi-Agent Architectures Part-3"
date: 2025-12-06T20:00:00.003+04:00
lastmod: 2025-12-19T16:03:11.868+04:00
slug: "securing-agentic-ai-architecture_64"
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
sourceURL: "https://www.subhashdasyam.com/2025/12/securing-agentic-ai-architecture_64.html"
---
# 3. Multi-Agent Architectures

## 3.0 Why multi-agent is fun for you and scary for security

Single agent: one brain, one loop, one blast radius.

Multi-agent: several brains, messages bouncing around, tools firing in different places, sometimes all at once.

Vendors sell you this as "teams of AI workers". Security hears:

More identities

More trust boundaries

More ways for something dumb or malicious to spread

This part is about how to structure multi-agent systems so that you still get the benefits (specialization, parallelism, nicer UX), but a mistake in one agent does not become a company-wide "incident report" main character.

We will look at:

Topology patterns

Handoff security

Inter-agent communication

And we will keep asking the same question: What happens when Agent A hands something to Agent B and that thing is wrong, malicious, or overprivileged?

## 3.1 Topology patterns: how agents are wired together

Think of this like org design. You already know these patterns from actual teams. We will use four main shapes:

Supervisor - worker

Peer to peer

Pipeline

Swarm

For each: how it works, why people like it, and how it bites you.

### 3.1.1 Supervisor - worker: "The manager and the team"

Shape:

One supervisor agent decides what to do.

Worker agents are specialists: "search", "summarize", "code", "deploy".

Supervisor receives the human request, breaks it down, calls workers, combines results.

Why people like it:

It maps to how humans work.

Easy mental model for business stakeholders.

Good for complex tasks that need different skills.

Security pros:

Single decision point.

You can centralize policy checks, HITL triggers, and tool assignments.

Security cons:

If supervisor is overprivileged, everything is overprivileged.

If supervisor is compromised, it can misuse all workers.

Workers often inherit too much context "because it is easy".

Typical failure modes:

Supervisor passes entire user context, including secrets or sensitive data, to workers that do not need it.

Workers quietly gain tools they should not have, because someone puts all tools in one shared registry.

Logs do not show which worker actually triggered a dangerous tool call, only "the supervisor did something".

Security Warning: Treat the supervisor like a high-privilege service, not like "just another agent". It is closer to an orchestrator than a chatbot.

Implementation sketch - LangGraph supervisor with scoped workers (Python)

Very simplified, but enough to show the idea:

Python

```
from langgraph.graph import StateGraph, END
from typing import TypedDict, List

class State(TypedDict):
    user_id: str
    goal: str
    plan: List[str]
    results: List[str]

def supervisor_node(state: State) -> State:
    # Plan tasks for workers - but no tools here
    plan = plan_tasks_for_goal(state["goal"])
    return {**state, "plan": plan}

def research_worker_node(state: State) -> State:
    # Only allowed search / RAG tools
    result = run_research_for(state["plan"])
    return {**state, "results": state["results"] + [result]}

def synthesis_worker_node(state: State) -> State:
    # Only allowed to summarize and format
    report = synthesize(state["results"])
    return {**state, "results": state["results"] + [report]}

# Build graph
graph = StateGraph(State)
graph.add_node("supervisor", supervisor_node)
graph.add_node("research_worker", research_worker_node)
graph.add_node("synthesis_worker", synthesis_worker_node)

graph.set_entry_point("supervisor")
graph.add_edge("supervisor", "research_worker")
graph.add_edge("research_worker", "synthesis_worker")
graph.add_edge("synthesis_worker", END)

supervisor_graph = graph.compile()

```

Key security idea:

Supervisor does planning only.

Research worker has only research tools.

Synthesis worker has no side-effect tools at all.

Developer Note: If you see the supervisor node also holding credentials and calling tools directly, you probably just built "one big messy agent" with extra steps.

### 3.1.2 Peer to peer: "The group project"

Shape:

Several agents talk to each other directly.

No strict hierarchy.

They negotiate and collaborate via messages (Think AutoGen "chat between agents").

Why people like it:

Cool demo potential.

Good for creative tasks where multiple perspectives help.

Natural fit when different systems are owned by different teams.

Security pros:

No central bottleneck.

Some resilience if a single agent goes down.

Security cons:

Harder to reason about who can do what.

Risk of agent collusion or feedback loops.

Identity and auth can get messy if everyone talks to everyone.

Typical failure modes:

Agents forwarding sensitive data to others "for help" without checking permissions.

Confused handoffs where Agent B thinks Agent A already validated something.

Infinite polite loops: "You decide." "No, you decide." while burning tokens and calling tools.

Architecture pattern:

Use a message bus (queue, topic, HTTP broker).

Agent identities are first class: every message carries`sender_id`,`recipient_id`,`user_id / tenant_id`, and`scopes/permissions`.

Apply access control at the bus and tool layers.

Optionally have a lightweight "coordination" service watching the flow.

Real Talk: If your peer-to-peer setup is just "two tool-enabled LLMs posting to each other in a shared memory store", you do not have a multi-agent system. You have a slow, expensive loop with unclear responsibilities.

### 3.1.3 Pipeline: "The assembly line"

Shape:

Agent A does step 1, passes result to Agent B.

Agent B does step 2, passes to C.

And so on.

Examples:

Ingest pipeline: parse document -> classify -> redact -> index

DevOps: static analysis -> code review -> deploy plan -> change ticket draft

Why people like it:

Easy to reason about.

Good mapping to existing processes.

Each stage can be tested and governed separately.

Security pros:

Clear boundaries and responsibilities.

Easy to attach checks and logs at stage transitions.

Easy to implement rollback as sagas.

Security cons:

Context leakage between stages if you just forward "everything".

Bad output from an early stage can poison later stages.

If you reuse the same tools across many stages, privilege boundaries blur.

Architecture pattern:

Treat each stage as: one agent with a narrow job, one identity, one set of tools.

Use typed message envelopes between stages (e.g.,`ParsedDoc`,`ClassifiedDoc`,`RedactedDoc`).

Enforce: what fields are allowed to be added, which fields can be removed, and which fields must never be reintroduced (like raw PII after redaction).

### 3.1.4 Swarm: "The hive mind"

Shape:

Many small agents.

Often spawned dynamically.

Possibly homogeneous ("N researchers") or heterogeneous.

Coordinator may just set rules and observe emergent behavior.

Why people like it:

Good for exploring big search spaces in parallel.

Feels very sci-fi in demos.

Can give better coverage on complex discovery tasks.

Security cons (This is where things can get spicy):

Hard to track who did what when you have 50 agents running around.

Resource usage can explode if you do not bound concurrency.

Identity is fuzzy: Is each spawned agent a new identity? Do they all share one account?

Hard to attach HITL to a "cloud" of short-lived agents.

Typical uses in enterprise should be restricted to:

Sandboxed research

Internal analysis with tight limits

Non-production data

Security Warning: If anyone proposes a swarm with direct access to production tools, stop the meeting and go back to Part 1.

### 3.1.5 Topology tradeoffs summary

Very simplified:

| Topology | Reasoning clarity | Security control surface | Typical risk |
| --- | --- | --- | --- |
| Supervisor | High | Central coordinator | Supervisor over-privilege |
| Peer to peer | Medium | Distributed | Collusion, data oversharing |
| Pipeline | High | Per stage boundaries | Poisoned early stage |
| Swarm | Low | Difficult | Resource abuse, unpredictable flows |

Executive Takeaway: For early enterprise adoption, pipelines and supervisor-worker patterns are your friends. Swarms belong in sandboxes until your governance is very mature.

## 3.2 Agent to agent handoff security

Now the main event: what happens when one agent hands something to another.

Key questions:

Does Agent B inherit Agent A's permissions?

What context is passed, and is any of it sensitive?

How does Agent B know the request is legit?

If B acts on bad state, how do you roll back?

We will tackle each, with the real world scenarios you listed baked in.

### 3.2.1 Trust inheritance: who gets whose powers

Bad default:

Agent A has access to tools X, Y, Z. Agent B gets a request from A. B is allowed to "use A's powers" because "A asked".

Better rule of thumb:

No agent ever inherits another agent's privileges. Each agent:

has its own identity

has its own tool scopes

acts on behalf of the user within its own limits

Example: DevOps pipeline

Code review agent: can comment on MRs, cannot merge or deploy.

Deployment agent: can create deployment plans, can request human approval, can call deployment tool only for specific services and environments.

When the code review agent hands off a "looks good" to the deployment agent, it is just data. The deployment agent still checks policies, respects its own scopes, and does not "borrow" permissions from the reviewer.

Security Warning: If an agent can escalate another agent's capabilities just by sending a message, you have built a privilege escalation design pattern.

### 3.2.2 Context passing: what travels in the handoff

Naive pattern: Serialize entire state of Agent A (history, tools, partial secrets, everything), dump into Agent B as context, and hope for the best.

Better approach:

Define a handoff contract:

Input schema for B: only the fields it needs.

Explicit "sensitive" flags for fields that require extra controls.

Strip: raw secrets, raw logs with credentials, unnecessary user PII.

Summarize: chat histories, tool traces, doc snippets.

Example: Customer service escalation

Flow: Tier-1 bot handles generic questions -> It decides: "This needs a specialist billing agent".

Handoff content should include: issue summary, customer id, ticket id, last few user messages.

Handoff content should not include: raw card numbers, full auth tokens, internal system logs with credentials.

Concrete schema idea (TypeScript):

TypeScript

```
type EscalationPayload = {
  userId: string;
  ticketId: string;
  summary: string;
  recentMessages: { from: "user" | "agent"; text: string }[];
  riskFlags: string[];        // e.g. ["possible_fraud", "vip_customer"]
  metadata: Record<string, string>;
};

```

Only this structure flows from Tier-1 to specialist. Everything else stays behind in Tier-1's own memory or logs.

Developer Note: Treat inter-agent payloads like public APIs, not like "just pass a Python dict around".

### 3.2.3 Handoff authentication: how B trusts A

You do not want any random agent (or process pretending to be one) to say: "Hi, I am the supervisor, please deploy version 5 right now."

Basic pattern:

Every agent has:

a stable identity (`agent_id`)

credentials (service account, key, mTLS cert)

Inter-agent messages:

are signed or authenticated by the sender

include sender_id and user_id

are validated before use

Concrete Node style message envelope:

TypeScript

```
type AgentMessage = {
  id: string;
  from_agent: string;
  to_agent: string;
  user_id: string;
  tenant_id: string;
  type: "escalation" | "handoff" | "request" | "response";
  scopes: string[];       // what user-level permissions this message carries
  payload: unknown;       // typed per message type
  created_at: string;
  trace_id: string;
  signature: string;      // HMAC or JWT
};

```

The sending agent signs`id + from_agent + to_agent + payload + trace_id`. The receiving agent verifies the signature with a shared secret or key pair. If signature is invalid or scopes are missing, the message is rejected.

You can implement this with HMAC (shared key), JWT with a "sender" claim, or mTLS with client certs and a secured message bus.

Pattern Reference: This mirrors how microservices auth each other. Multi-agent should not be looser than your microservice auth.

### 3.2.4 State integrity and rollback

If Agent B acts on something bad (either malicious or just wrong), how do you unwind it? This is where classic "saga" style thinking helps.

Each agent that performs side effects logs an action with: trace_id, initiating_agent, user_id, and a compensating_action if possible.

A supervisor or orchestrator can walk the trace and call compensating actions when needed.

Example: Financial processing handoff

Flow: Validation agent checks a batch of payments -> Execution agent actually triggers the transfers.

If later a problem is found:

Validation agent's logs show which batch and rules.

Execution agent's logs show which transfers happened.

Rollback agent has tools:`reverse_transfer` where allowed,`raise_incident` where not.

Minimal sketch:

Python

```
def execute_payment(payment, trace_id, user_id, agent_id):
    # Call core payment system
    tx_id = core_pay(payment)
    log_action(
        trace_id=trace_id,
        user_id=user_id,
        agent_id=agent_id,
        action_type="payment",
        details={"tx_id": tx_id, "amount": payment.amount},
        compensating={"action": "reverse_payment", "tx_id": tx_id},
    )
    return tx_id

```

If you cannot define a compensating action, you at least need crisp logs and a human runbook to repair.

Executive Takeaway: In multi-agent flows, rollback is not a nice to have. It is your safety net when one agent misunderstands another.

### 3.2.5 Concrete handoff scenarios

Let us walk through your four example scenarios with these principles.

1) Customer service escalation

Topology: pipeline (Tier-1 bot -> specialist agent -> human)

Handoff security: Payload uses a strict schema like`EscalationPayload`. No raw auth tokens. Ticket id is the anchor; tools re-fetch from source systems as needed. Specialist agent still applies its own identity and tool scopes.

2) Research workflow

Flow: Search agent hands findings to analysis agent.

Search agent: can use web and internal search tools. writes cleaned, labeled snippets (source_type, source_url, timestamp, confidence).

Analysis agent: never sees raw HTML or arbitrary tool outputs. only sees sanitized snippets. does not call external tools at all, only models.

3) DevOps pipeline

Flow: Code review agent -> deployment agent.

Code review agent: has read-only access to repos. writes structured review output (risk rating, required tests, notes).

Deployment agent: uses its own CI/CD credentials. cannot merge code based only on AI review (requires human approval if risk rating above threshold). does not inherit Git permissions from the review agent.

4) Financial processing

Flow: Validation agent -> execution agent.

Validation agent: has read access to transactions. uses policy to mark each as approved, manual_review, rejected.

Handoff: List of transaction ids with statuses. No ability to change amounts.

Execution agent: only processes approved. re-reads transaction from system of record. refuses if amount or beneficiary changed since validation. logs every action with trace id.

Real Talk: If your handoff format is "here is a big blob of JSON I send from one agent to another", you will eventually regret it. Contracts and schemas are boring, but they are what keep money and access from drifting.

## 3.3 Inter-agent communication security

Now zoom in on the "wire" between agents: how messages are sent and stored.

### 3.3.1 Message signing and verification

We already sketched the envelope earlier. The main rules:

Do not trust`from: agent_supervisor` if it is just a string in JSON.

The receiving agent or bus must check authenticity.

Simplified Node utility:

JavaScript

```
import crypto from "crypto";

function signMessage(payload: object, secret: string): string {
  const body = JSON.stringify(payload);
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function verifyMessage(payload: object, signature: string, secret: string): boolean {
  const expected = signMessage(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

```

You would use something stronger in production (JWT, mTLS), but the idea is the same.

Developer Note: Do not put the signature inside the part that you sign. That defeats the point. Sign a stable subset like`id + from + to + created_at + payload`.

### 3.3.2 Shared memory vs message passing

Two common approaches:

Shared memory model

All agents read and write to the same store (vector DB, key value store, graph DB).

Pros: Simple to implement. Great for global context, knowledge, long term memory.

Cons: Easy to accidentally leak across users or agents. Hard to reconstruct who wrote what when. Harder to constrain "who can see which parts".

Rule: If you do this, include`agent_id`,`user_id`,`tenant_id`, and`scope` on every write. Apply hard filters on reads.

Message passing model

Agents send explicit messages via queues, topics, or HTTP endpoints.

Pros: Better auditability. Easier to enforce per-channel permissions. Easier to bound what gets sent.

Cons: More plumbing. More moving parts.

Enterprise guidance: Use message passing for control and decisions. Use shared memory only for long term knowledge and content that is already permission filtered.

Security Warning: If an agent can see "everything in the memory store", sooner or later it will see something it should not.

### 3.3.3 Preventing agent impersonation

You do not want any random process to pretend to be "deployment_agent" and send messages around.

Patterns:

Each agent runs as a service identity in your IAM (Azure Managed Identity, AWS IAM role, GCP service account). When it talks to the message bus or tools, it authenticates with that service identity.

Never give agents long term user tokens. Use short lived delegated tokens: user authenticates -> orchestrator issues a scoped token "valid for this task only" -> agent calls tools with that delegated token.

This way, if an agent is compromised or one message is replayed, you do not accidentally give full persistent user access.

### 3.3.4 Audit trails for multi-agent conversations

You want to be able to answer, after something goes wrong: Which agent started this chain? Which messages were passed? Who approved any HITL steps?

Minimal log shape:

JSON

```
{
  "trace_id": "abc123",
  "timestamp": "2025-12-06T12:34:56Z",
  "user_id": "u-42",
  "tenant_id": "t-bank1",
  "agent_id": "deployment_agent",
  "event_type": "tool_call",
  "tool_name": "deploy_service",
  "params_hash": "sha256:...",
  "parent_agent_id": "supervisor_agent",
  "message_id": "msg-789"
}

```

You do not need all the raw data in logs, but you need enough to reconstruct the flow, know which agents to blame, and show auditors that you can trace automated actions.

Executive Takeaway: In multi-agent setups, a good audit trail is not a compliance checkbox. It is how you avoid "we do not know which agent did this" as an answer to your board.

## 3.4 Real world example: multi-agent DevOps assistant

To tie everything together, here is a plausible setup.

Goal: Let product teams ask in chat: "Review this merge request, generate a risk summary, and if low risk create a deployment plan to staging."

Topology: Supervisor agent (coordinates others) + Worker agents (`code_review_agent`,`security_check_agent`,`deploy_planner_agent`).

Flow:

Supervisor receives request from user U.

Supervisor asks`code_review_agent`.

`code_review_agent` uses read-only Git tools and returns risk rating and list of concerns.

Supervisor calls`security_check_agent` if needed.

If risk is low and policies allow, Supervisor prepares handoff to`deploy_planner_agent`.

Handoff payload to deploy planner:

TypeScript

```
type DeployPlanRequest = {
  userId: string;
  tenantId: string;
  repo: string;
  branch: string;
  mrId: string;
  riskRating: "low" | "medium" | "high";
  approvals: {
    codeReview: boolean;
    security: boolean;
  };
  targetEnv: "staging" | "production";
};

```

Note: no code diffs, no logs, no secrets. Planner will fetch what it needs from Git and CI.

Security controls:

`code_review_agent`: only Git read tools, no CI/CD credentials.

`deploy_planner_agent`: CI read tools, can only write to "staging" pipelines, cannot deploy to production at all.

Supervisor: cannot deploy directly, cannot call tools on behalf of others.

Message bus: all messages have signed envelopes, each agent auths with its service identity.

HITL: If targetEnv is "production", message is routed to a human approver first. Only after approval does a dedicated`prod_deploy_agent` receive a scoped token.

Outcome:

You get multi-agent "team" behavior in chat, clear separation of duties, scopes that make sense for audits, and a realistic path to expand or tighten later.
