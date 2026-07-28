---
title: "Securing Agentic AI: Identity and Access Control for Agents Part-6"
date: 2025-12-07T14:40:00.006+04:00
lastmod: 2025-12-19T16:03:16.465+04:00
slug: "securing-agentic-ai-identity-and-access"
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
sourceURL: "https://www.subhashdasyam.com/2025/12/securing-agentic-ai-identity-and-access.html"
---
# 6. Identity and Access Control for Agents

## 6.0 Why identity is the real security boundary

For classic apps, you already know the game:

User authenticates.

App runs with app identity.

App hits databases and services with that identity.

With agentic AI, people accidentally add a third blurry thing: "The agent" with unclear identity and unclear permissions.

If you do not fix that, you get:

Agents that quietly run with god mode.

Logs that say "AI did it" when auditors ask who changed something.

A very awkward meeting after the AI updates 5000 records "on behalf of nobody".

This part answers three simple questions:

Who is this agent in IAM terms?

What is it allowed to do, and for how long?

Who is responsible when it goes wrong?

We will use concrete identity models, vault patterns, least privilege tricks, and isolation patterns you can actually ship.

## 6.1 Agent identity models

First decision: how do you represent an agent in your identity world. There are four main patterns:

### 6.1.1 Agent as user

The agent logs in like a human. It has a "user account" in your IAM.

Example: svc-ai-cs-bot@bank.com is a user in your IdP with assigned roles like "Customer Support Tier 1".

Pros: Easy to plug into existing RBAC. Shows up in audit logs as a "user" you can track.

Cons: People start giving this "user" way too many roles. Hard to separate actions done by the agent vs actions done by humans. You often end up with one giant super-user agent account.

Good for: Legacy systems that only know "users" and cannot handle service identities.

Bad for: Anything that needs clean separation of duties or fine-grained scopes.

Real Talk: "We made the agent a user and gave it all the roles it needed" is usually code for "we gave it admin and walked away".

### 6.1.2 Agent as service

Here the agent is a service account, like any other backend (Azure Managed Identity, AWS IAM role, GCP Service Account). Your orchestrator or agent runtime runs as that identity.

Pros: Fits cleanly into modern zero trust patterns. Clear separation from human users. You can give different agents different service roles.

Cons: If you do not add delegated identity, everything that agent does looks like that one service. Harder to say "this was for Alice vs Bob" unless you carry user context separately.

Good for: Backend tools, Infrastructure agents, Things that should not pretend to be a human.

### 6.1.3 Delegated identity (agent acts on behalf of user)

The agent works like a human assistant.

Plan:

Base identity is a service.

User authenticates normally.

Backend issues a scoped token or context containing:`user_id`,`roles`,`allowed_actions` for this task.

Agent tools receive`{ agent_id, user_id, scopes }` and enforce both.

Pros: Clear "who did this" story (User X Via Agent Y). Easy to apply user-based data access rules. Easy to trace which user was behind an action.

Cons: Slightly more plumbing. You need to design the context object properly.

This is usually what you want for "agent that helps a user with their stuff".

### 6.1.4 Independent agent identity (agent owns its own actions)

Some agents are more like backoffice jobs than personal assistants.

Examples: Reconciliation agents, Compliance review bots, Infra hygiene agents.

They act on their own schedule, not because a user clicked something. For these, you want a separate agent identity, no delegated user token, and clear audit logs saying "agent X did this as a system action".

### 6.1.5 Hybrid models

You often combine:

Service identity for the agent runtime.

Delegated identity for the user.

Plus sometimes a business identity in the target system (e.g., "Relationship Manager for customer 123").

Your tool wrapper maps all three onto: "Is this action allowed given the agent type, the user role, and the customer profile?"

### 6.1.6 Responsibility when things break

This is the part nobody writes in documentation but auditors will ask:

If an agent made a bad payment, who is responsible?

If an agent deleted records, who approved that level of autonomy?

The identity model should let you answer: "This payment was performed by`payments_agent_prod` acting on behalf of user`456` under policy`P-REFUNDS-001` and approved by manager`789`."

If your logs just say "Actor: ai-bot", then you are going to have an expensive blame meeting.

Executive Takeaway: Treat agents like any other actor in your IAM. They get identities, roles, and scopes. For user-facing agents, always carry both agent identity and user identity in every tool call and every log line.

## 6.2 Credential management

Now that we know "who is this agent", we need to talk about how it gets secrets and tokens without spraying them into context windows like confetti.

Goals:

Short lived tokens

No secrets in prompts

Rotation for long running agents

Vault everywhere

### 6.2.1 Short lived tokens per session

Bad pattern: Agents use the same API keys for everything. Keys live in config files or, worse, inside prompts.

Better pattern: Use session scoped tokens derived from user auth, limited in time and scope.

Example in a Node backend:

JavaScript

```typescript
import jwt from "jsonwebtoken";

function createAgentSessionToken(context: {
  userId: string;
  agentId: string;
  scopes: string[];
  ttlSeconds: number;
}) {
  return jwt.sign(
    {
      sub: context.userId,
      aid: context.agentId,
      scopes: context.scopes,
    },
    process.env.AGENT_SESSION_SIGNING_KEY!,
    { expiresIn: context.ttlSeconds },
  );
}

```

Tools receive this token in`ctx` and validate scopes. If stolen, it expires quickly and is limited to that task.

Developer Note: Do not send this token to the model. It is for your backend and tools, not for the LLM.

### 6.2.2 Secret injection patterns – never in context

Golden rule: Secrets live in the environment or vault, not in prompts.

Bad:

Python

```
SYSTEM_PROMPT = f"""
You are a database admin. Your password is {DB_PASSWORD}.
"""

```

This will eventually leak. The model will happily repeat whatever is in the prompt if you push it hard enough.

Better: Tools know secrets. Agent sees only tool names.

Example with LangChain tools (Python):

Python

```python
from langchain.tools import tool
import os
import psycopg

@tool
def run_reporting_query(sql: str) -> str:
    """Run a read-only reporting SQL query."""
    conn = psycopg.connect(os.environ["REPORTING_DB_DSN"])
    with conn, conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()

```

The DSN comes from env or vault injection into the container. The model never sees it.

Security Warning: If you ever see a secret string show up in your prompt templates, stop and fix it. That is a direct exfiltration path.

### 6.2.3 Credential rotation for long running agents

Some agents run for a long time (monitoring, scheduled jobs). You want short-lived credentials and automatic rotation.

Typical pattern:

No static API keys.

Use cloud native identity (AWS IAM, Azure MI, GCP SA).

For external APIs: use client credentials flow with token caching and rotation.

Any time an agent calls an external API directly, check: Is this using a stable key in config? Or a short lived token from a proper auth flow? If it is the first one, put it on your tech debt list and then actually fix it.

### 6.2.4 Vault integration patterns

You probably already have HashiCorp Vault, Azure Key Vault, or AWS Secrets Manager. Use them.

Patterns:

Sidecar or agent library: Container/process authenticates with vault using its service identity.

Runtime: Fetch secrets only when needed. Keep them in memory, not stored on disk.

No vault calls from the LLM layer: Tools fetch what they need. Agent orchestrator passes only non-secret identifiers.

Real Talk: You probably already have vault guidelines for microservices. Use the exact same standards for agent runtimes. If your AI stack becomes "the place where we ignore vault", you know how that story ends.

## 6.3 Least privilege implementation

Now the fun part: not "least privilege conceptually", but how you actually enforce it for agents and tools.

### 6.3.1 Dynamic permission scoping by task

When a user asks the agent to do something, you do not have to give the agent all their rights forever.

Pattern: Look at the task -> Decide required scopes for this one request -> Issue a session token with only those scopes.

Example in Node:

TypeScript

```
type Scope = "READ_CUSTOMER" | "UPDATE_CONTACT" | "ISSUE_REFUND_SMALL" | "ISSUE_REFUND_MEDIUM";

function scopesForTask(task: string): Scope[] {
  if (task.includes("update my phone number")) return ["READ_CUSTOMER", "UPDATE_CONTACT"];
  if (task.includes("small refund")) return ["READ_CUSTOMER", "ISSUE_REFUND_SMALL"];
  return ["READ_CUSTOMER"];
}

```

Inside a tool:

JavaScript

```typescript
async function issueRefundTool(args: any, ctx: { scopes: string[] }) {
  const { amount } = args;
  if (amount <= 200) requireScope(ctx, "ISSUE_REFUND_SMALL");
  else if (amount <= 500) requireScope(ctx, "ISSUE_REFUND_MEDIUM");
  else throw new Error("Refund too large for automatic processing");
}

```

Developer Note: The LLM never decides scopes. Your code does. The LLM only proposes actions.

### 6.3.2 Tool level permission boundaries

Every tool should have:

A clear purpose

A known risk level

A small set of allowed callers

You can model this with metadata:

TypeScript

```
const TOOLS: Record<string, ToolMeta> = {
  issueRefund: {
    name: "issueRefund",
    allowedAgents: ["payments_agent"],
    requiredScopes: ["ISSUE_REFUND_SMALL", "ISSUE_REFUND_MEDIUM"],
    riskLevel: "high",
  },
  // ...
};

```

Your generic tool dispatcher checks this metadata before running anything.

Security Warning: If you have a single "big tool registry" that every agent can see, you are one bug away from the wrong agent calling the wrong tool.

### 6.3.3 Data access tiers for agents

Use tiers like:

Tier 0: Public

Tier 1: Internal

Tier 2: Confidential

Tier 3: Restricted (PII, PHI, card data)

For each agent, define max data tier it can see and data domains it is allowed to touch. At query time, filters in your data access layer enforce these caps.

Pattern Reference: This mirrors "data zones" in data platforms. Agent identity just becomes one more consumer identity with zone limits.

### 6.3.4 Permission decay over session lifetime

You do not want a session that lasts forever with the same power.

Pattern: For a sensitive operation like "manage accounts", allow all scopes for the first 10 minutes. After 10 minutes, require user re-auth before another high-risk action.

Rough Python idea:

Python

```python
def active_scopes(self):
    now = datetime.utcnow()
    if now - self.created_at > timedelta(minutes=15):
        # remove high risk scopes
        return [s for s in self.scopes if not s.startswith("HIGH_")]
    return self.scopes

```

Real Talk: Permission decay is how you reduce blast radius when a session token leaks or a user walks away from their screen. It is not perfect, but it is much better than infinite power sessions.

## 6.4 Session and context isolation

The last piece in this part: making sure one user’s context does not leak to another, and long-lived "memory" is not a data soup.

### 6.4.1 Preventing context leakage between users

Three leakage paths to watch: Conversation history, Long term memory, Cached tool results.

Rules of thumb:

Every state store must be keyed by`user_id` or`tenant_id` plus some user scope.

The agent runtime should never query memory without an explicit user or tenant filter.

Example: LangChain style vector store retrieval

Bad: docs = vectorstore.similarity_search(query, k=5)

Better:

Python

```
docs = vectorstore.similarity_search(
    query,
    k=5,
    filter={"tenant_id": tenant_id, "user_id": user_id},
)

```

Security Warning: "We use one big vector store for all customers" is fine for public docs. It is suicide for private data if you do not enforce filters.

### 6.4.2 Memory persistence security

Agents often store summaries, preferences, and working notes.

Problems: Sensitive data can get stuck in long-term memory. You lose track of where PII is stored. You cannot honor data deletion requirements.

Patterns:

Classify memory entries:`type: "preference" | "task_history" | "sensitive"`

For sensitive types: short TTL or do not store at all.

Implement deletion hooks for when user asks to delete their data or tenant offboards.

Real Talk: If you cannot tell a regulator where user data lives in your agent memories or how to delete it, you are going to have a bad time under GDPR and similar laws.

### 6.4.3 Multi-tenant agent deployments

SaaS and banks both care about tenants. Company A’s data must not leak to Company B.

For multi-tenant agent setups:

Every request carries`tenant_id`.

Every data store is partitioned or filtered by`tenant_id`.

Every tool call includes tenant in context and uses tenant-scoped credentials when needed.

Example in Node:

JavaScript

```typescript
async function getCustomerTool(args: any, ctx: { tenantId: string; userId: string }) {
  const db = dbForTenant(ctx.tenantId);
  return db.customers.findOne({ id: args.customerId, tenantId: ctx.tenantId });
}

```

Executive Takeaway: Multi-tenant safety for agents is just your usual multi-tenant discipline, applied to memory, tools, logs, and agent configs. If you are already careful with your regular services, do the same here. If you are not, agents will expose that weakness faster.

### 6.4.4 Isolation in practice: simple blueprint

Putting it together, a sane default blueprint for an enterprise agent platform:

Each agent type has: Service identity in IAM, Allowed tools list, Max data tier, Per-tenant configuration.

Every request builds an AgentContext with:`tenantId`,`userId`,`agentId`,`scopes` for this task,`traceId`,`createdAt`.

Tools receive args and ctx, and enforce: Allowed agents, Required scopes, Tenant filters, Data tier limits.

Memory and vector stores: Key on tenant and user. Avoid storing secrets and sensitive identifiers.

Sessions: Short-lived tokens, Permission decay, Clear TTL.

Executive Takeaway: Do not treat agents as special snowflakes outside your normal IAM world. They are just another set of services, with a more flexible brain. Give them clear identities, scoped tokens, narrow tools, and isolated data, and you dramatically cut the range of things that can go wrong.
