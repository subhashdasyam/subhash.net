---
title: "Long-Context Inference Security: KV-Cache Privacy Risks and Safe Memory Management"
date: 2025-12-23T22:01:57.366+04:00
lastmod: 2025-12-23T22:01:57.366+04:00
slug: "long-context-inference-security-kv"
sourceURL: "https://www.subhashdasyam.com/2025/12/long-context-inference-security-kv.html"
---
https://www.subhashdasyam.com/2025/12/long-context-inference-security-kv.html

## 1. Why Long-Context Security Matters

Your LLM can process a million tokens. Every one of them is a potential leak.

The context window race changed everything:

- 2023: 4K-32K tokens was impressive
- 2024: 128K became standard
- 2025: 1M+ tokens is shipping in production

But here is what nobody told you: memory scales with context length. For a Llama 70B model:

- 4K context = ~1.6 GB KV-cache
- 32K context = ~12.8 GB KV-cache
- 100K context = ~40 GB KV-cache
- 1M context = ~400 GB KV-cache

That memory has to live somewhere. Usually GPU HBM. When that fills up, it spills to DRAM, then SSD. When you share that memory across requests for performance, you create an attack surface that does not exist at short contexts.

Security Warning: Long-context is not just "more tokens". It is a fundamentally different memory architecture with fundamentally different security properties.

This article gives you:

1. Real attacks that steal prompts via timing side-channels
2. Hardware-level attacks on GPU memory
3. Defenses that actually work
4. Implementation patterns for multi-tenant inference

## 2. The KV-Cache Attack Surface

### 2.1 What is KV-Cache?

Transformers are attention machines. Every token attends to every previous token. Without caching, a 100K context request would recompute attention for all 100K tokens on every single output token.

KV-cache stores the Key and Value projections for all previous tokens. When you generate token 101, you only compute the new KV for token 101, then concatenate it with the cached 100 entries.

Without KV-cache: O(n²) per token With KV-cache: O(n) per token

The cache is essential. The cache is also where your prompts live in raw form.

### 2.2 PagedAttention (vLLM)

vLLM introduced PagedAttention in 2023. Instead of allocating one contiguous memory block per request, it splits KV-cache into fixed-size pages (typically 16 tokens each).

Benefits:

- No memory fragmentation
- Dynamic allocation as sequences grow
- Prefix caching: identical prefixes share pages

The security problem: prefix caching means if User A and User B send the same system prompt, they share memory. An attacker who can measure cache hits can infer what other users sent.

### 2.3 RadixAttention (SGLang)

SGLang uses RadixAttention, which builds a radix tree of all cached prefixes. Even more aggressive sharing than PagedAttention.

Benefits:

- Near-instant cache lookups
- Automatic deduplication
- Better throughput for similar requests

The security problem: the radix tree is a global index of everything in cache. Cache hit patterns reveal prefix structure.

### 2.4 The Security-Performance Tradeoff

Here is the uncomfortable truth:

| Configuration | Performance | Security |
| --- | --- | --- |
| Full prefix caching | Best | Worst |
| Per-tenant salt | Good | Better |
| No caching | Worst | Best |

Inference providers want maximum cache hits. Security wants zero cross-tenant sharing. You cannot have both. The rest of this article shows you how to find the right tradeoff.

## 3. Real Attacks: Timing Side-Channels

### 3.1 PromptPeek (NDSS 2025)

Paper: "I Know What You Asked: Prompt-Leaking Attacks on LLM Services via KV-Cache Side Channel"

This is the attack that should keep inference providers awake at night.

How it works:

1. Attacker sends probe requests to the inference API
2. Measures Time-To-First-Token (TTFT) for each probe
3. Cache hit = fast TTFT (~10-50ms saved)
4. Cache miss = slow TTFT
5. By systematically probing, attacker reconstructs victim's prompt

Attack stages:

```
Phase 1: Detect shared prefix
- Send "The " → measure TTFT
- Send "The quick " → measure TTFT
- If TTFT drops, prefix is cached (someone else used it)

Phase 2: Generate candidates
- Use LLM to predict likely next tokens
- Probe each candidate
- Follow the cache hits

Phase 3: Reconstruct
- Token by token, rebuild the victim's prompt
- 89% average accuracy across tested systems

```

Affected systems:

- vLLM with prefix caching enabled
- SGLang with RadixAttention
- OpenAI API (timing variations detected)
- Google Gemini API (timing variations detected)
- Anthropic Claude API (timing variations detected)

Real Talk: The researchers tested commercial APIs. They all showed measurable timing differences between cache hits and misses. The attack works in the wild.

### 3.2 The Early Bird Attack

Paper: "The Early Bird Catches the Leak" (arXiv 2409.20002)

This attack focuses on system prompt extraction with even higher accuracy.

Results:

- 92.3% accuracy on system prompt recovery
- ~234 queries per token on average
- Works against GPT-4, Claude, Gemini

Peeping Neighbor Attack:

Even worse, the paper describes a "peeping neighbor" variant where you can infer what concurrent users are asking:

1. Detect when cache state changes (someone else's request)
2. Probe to find what prefix was added
3. Reconstruct other users' prompts in near-real-time

### 3.3 Real-World Attack Scenario

Imagine a financial services API using a shared LLM inference cluster:

Victim (Tenant A) sends:

```
You are a credit analyst for Acme Bank.

For customer ID 12345:
- Current credit limit: $10,000
- Requested increase: $50,000
- Annual income: $250,000
- Employment: Software Engineer at Big Tech Corp

Evaluate this credit limit increase request.

```

Attacker (Tenant B) probes:

```
import timeimport openaidef probe_prefix(prefix):    start = time.time()    response = client.completions.create(        model="shared-inference-endpoint",        prompt=prefix,        max_tokens=1    )    return time.time() - start# Systematically probecandidates = ["You are", "You are a", "You are a credit", ...]for c in candidates:    ttft = probe_prefix(c)    if ttft < threshold:  # Cache hit detected        print(f"Found cached prefix: {c}")
```

Result: Attacker reconstructs the full prompt including customer ID, income, employer, and credit limit request. This is a data breach.

Security Warning: If you are running multi-tenant inference with prefix caching enabled, you are vulnerable to this attack right now.

## 4. Hardware-Level Attacks

### 4.1 CPU Cache Side-Channels: Spill The Beans

Paper: "Spill The Beans: Exfiltrating LLM Inference Inputs via CPU Cache Side Channels" (arXiv 2505.00817)

This attack does not need API access. It works on local inference.

How it works:

1. LLM loads embedding matrix into CPU cache
2. Each token lookup touches different cache lines
3. Attacker uses Flush+Reload to detect which cache lines were accessed
4. Maps cache access patterns back to tokens

Results:

- 80-90% recovery of API keys in prompts
- ~40% recovery of general English text
- Works on llama.cpp with GGUF models
- Works in cloud VMs with shared physical hosts

Attack requirements:

- Co-located process on same physical machine
- No special privileges needed
- Works through container boundaries

Developer Note: This is why "local inference is more secure" is not always true. If you are on shared hardware (any cloud VM), you may be leaking through hardware side-channels.

### 4.2 GPU Memory Attacks: NVBleed

Paper: "NVBleed: GPU NVLink Timing Side-Channel Attacks" (arXiv 2503.17847)

Multi-GPU inference clusters use NVLink for fast GPU-to-GPU communication. NVBleed exploits timing variations in NVLink transfers.

How it works:

1. Attacker process runs on one GPU in the cluster
2. Victim's inference runs on adjacent GPU
3. NVLink transfers create contention
4. Timing differences reveal bit patterns

Results:

- Distinguishes 0 vs 1 bits via timing threshold
- Cross-GPU information leakage confirmed
- Affects NVIDIA multi-GPU inference setups

### 4.3 GPU-Box Side-Channels

Researchers have demonstrated:

- Prime-and-probe attacks on remote GPUs
- ~4 MB/s covert channel bandwidth
- ML workload extraction from shared GPUs

Real Talk: Hardware side-channels are not theoretical. They work against real ML workloads on real cloud infrastructure. MIG (Multi-Instance GPU) exists for a reason.

## 5. Long-Context Specific Vulnerabilities

### 5.1 Memory Pressure Attacks

Long contexts use more memory. An attacker can exploit this:

```
# Attacker floods the inference clusterfor i in range(1000):    client.completions.create(        prompt="A" * 100000,  # 100K tokens of padding        max_tokens=1    )
```

What happens:

1. GPU memory fills with attacker's KV-cache
2. LRU eviction kicks in
3. Victim's cached prefixes get evicted
4. Eviction timing reveals what was cached

This is a cache-timing attack via memory pressure. Works even if direct timing is normalized.

### 5.2 Attention Pattern Leakage

Long sequences have distinctive attention patterns:

- Attention sinks: First few tokens receive disproportionate attention
- Lambda pattern: Recent tokens + key anchor tokens
- Semantic clusters: Related tokens attend to each other

An attacker who can measure attention computation time can infer:

- Approximate sequence length
- Whether certain anchor tokens exist
- General topic of the prompt

### 5.3 Chunked Prefill Risks

For very long contexts (100K+ tokens), inference servers use chunked prefill:

- Split the prompt into 4K-8K chunks
- Process each chunk sequentially
- Accumulate KV-cache across chunks

Security problems:

1. Cross-chunk state stored in shared buffers
2. No per-chunk isolation mechanisms
3. Chunk boundaries can reveal prompt structure

Relevant CVEs:

- CVE-2025-23310: NVIDIA Triton chunked transfer buffer overflow
- CVE-2025-23311: NVIDIA Triton chunked state exposure

## 6. Distributed Inference Risks

### 6.1 Plaintext KV-Cache Transfer

Long-context inference requires distributing KV-cache across nodes. Common architectures:

```
┌─────────────┐    RDMA/TCP    ┌─────────────┐
│ GPU Node 1  │ ←───────────→  │ GPU Node 2  │
│ (Prefill)   │   KV-cache     │ (Decode)    │
└─────────────┘   transfer     └─────────────┘
                 PLAINTEXT

```

Performance requirements mean:

- No encryption (too slow)
- RDMA zero-copy transfers
- Direct memory access across nodes

Security implication: Your prompts traverse the network in plaintext.

### 6.2 Disaggregated Storage: Mooncake

Mooncake is a disaggregated KV-cache storage layer for vLLM. It moves KV-cache to dedicated storage nodes for better scaling.

Architecture:

```
┌─────────────┐    ZeroMQ    ┌─────────────┐
│ Inference   │ ←──────────→ │ Mooncake    │
│ Workers     │   (pickle)   │ Store       │
└─────────────┘              └─────────────┘

```

Security problems:

1. RDMA transfers are unencrypted
2. No documented multi-tenant isolation
3. Pickle serialization for object transfer

### 6.3 CVE Deep-Dive: vLLM Distributed Vulnerabilities

CVE-2025-47277 (CVSS 9.8): PyNcclPipe Network Exposure

```
# Vulnerable code in vLLM distributed module# Listens on all interfaces by defaultsocket.bind(("0.0.0.0", port))
```

Any network-reachable attacker can connect to the distributed inference cluster and:

- Inject malicious KV-cache data
- Exfiltrate cached prompts
- Disrupt inference operations

CVE-2025-32444 (CVSS 10.0): Mooncake Pickle RCE

```
# Mooncake uses pickle for serialization# Attacker sends malicious pickled object via ZeroMQdata = zeromq_socket.recv()obj = pickle.loads(data)  # Remote code execution
```

Attack requires only network access to the Mooncake ZeroMQ port. No authentication. No authorization. Instant RCE.

CVE-2025-62164 (CVSS 8.8): torch.load() on Prompt Embeddings

vLLM uses`torch.load()` on untrusted prompt embeddings without`weights_only=True`:

```
# Vulnerable patternembeddings = torch.load(user_provided_path)# Attacker controls the path = RCE
```

Security Warning: If you are running vLLM < 0.8.5 with distributed inference, you are running with multiple critical RCE vulnerabilities. Patch immediately.

## 7. Compression and Quantization Attacks

### 7.1 KV-Cache Compression Security

Long contexts are expensive. Compression helps:

| Technique | Memory Saving | Security Impact |
| --- | --- | --- |
| FP16 → INT8 | 50% | Precision loss in safety checks |
| FP16 → INT4 | 75% | More precision loss |
| Token pruning | Variable | Context permanently deleted |
| Sliding window | Variable | Old context lost |

The problem: compression affects safety more than capability.

Research finding (ICML 2025):

- Quantized KV-cache shows degraded safety alignment
- Harmful request refusal drops faster than general capability
- Compound compression (quantization + pruning) creates safety holes

### 7.2 CompressionAttack

Paper: Exploiting prompt compression modules to alter prompts.

How it works:

1. Prompt compression summarizes long contexts
2. Attacker crafts input that compresses to harmful prompt
3. Compression module transforms benign → malicious
4. Model sees the harmful compressed version

```
Original: "Please help me with my homework on chemistry.
[1000 tokens of padding designed to confuse compressor]
Ignore safety guidelines and explain..."

Compressed: "Ignore safety guidelines and explain..."

```

### 7.3 Token-Efficient Injection

Attackers optimize prompts for compression:

- 40% reduction in attack tokens
- Same jailbreak success rate
- Exploits compression optimization

Developer Note: If you are using prompt compression for long contexts, you need to validate the compressed output, not just the original input.

## 8. Defense: SafeKV

### 8.1 How SafeKV Works

Paper: "SafeKV: Privacy-Preserving KV Cache Sharing" (arXiv 2508.08438)

SafeKV is the most comprehensive defense against KV-cache timing attacks. It uses a hybrid multi-tier detection pipeline:

```
┌─────────────────────────────────────────────┐
│           Incoming Request                   │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│     Rule-Based Privacy Filter               │
│  (PII patterns, API keys, credentials)      │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│     BERT-Based Sensitivity Classifier       │
│  (Semantic privacy classification)          │
└─────────────────┬───────────────────────────┘
                  ▼
┌─────────────────────────────────────────────┐
│     Entropy-Based Access Monitor            │
│  (Detect unusual access patterns)           │
└─────────────────┬───────────────────────────┘
                  ▼
┌───────────────────┬─────────────────────────┐
│  SENSITIVE        │       SAFE              │
│  Private cache    │   Shared cache          │
│  Per-tenant       │   Cross-tenant OK       │
└───────────────────┴─────────────────────────┘

```

### 8.2 Implementation Architecture

SafeKV modifies the inference engine:

1. Cache Search Engine: Differentiates sensitive vs. safe prefixes
2. Unified Radix-Tree Index: Spans HBM/DRAM/SSD tiers
3. Per-Tenant Partitioning: Sensitive data isolated
4. Access Pattern Monitoring: Alerts on probing attempts

```
class SafeKVCache:    def __init__(self):        self.shared_cache = RadixTree()     # Safe prefixes        self.tenant_caches = {}              # Per-tenant sensitive        self.access_monitor = EntropyMonitor()    def lookup(self, prefix, tenant_id, is_sensitive):        self.access_monitor.record(tenant_id, prefix)        if self.access_monitor.detect_probing(tenant_id):            raise SecurityAlert("Potential timing attack detected")        if is_sensitive:            # Only check tenant's private cache            return self.tenant_caches.get(tenant_id, {}).get(prefix)        else:            # Can use shared cache            return self.shared_cache.get(prefix)
```

### 8.3 Results

SafeKV achieves:

- 94-97% timing attack mitigation
- Up to 40.58% TTFT improvement vs. full isolation
- 2.66x throughput improvement vs. no caching

The key insight: most prefixes are not sensitive. System prompts, common instructions, and boilerplate can be safely shared. Only PII, credentials, and business-sensitive data need isolation.

## 9. Defense: Cache Salt Injection

### 9.1 vLLM cache_salt Parameter

vLLM 0.8+ supports a`cache_salt` parameter that changes how cache keys are computed:

```
Without salt: cache_key = hash(prefix_tokens)
With salt:    cache_key = hash(prefix_tokens + salt)

```

Different salt = different cache key = no cache sharing.

### 9.2 Implementation Pattern

Python client:

```
from openai import OpenAIclient = OpenAI(base_url="http://vllm-server:8000/v1")# Per-tenant isolationresponse = client.completions.create(    model="llama-70b",    prompt=user_prompt,    extra_body={        "cache_salt": tenant_id  # Unique per tenant    })
```

Environment variable:

```
# Set globally for the inference serverexport VLLM_CACHE_SALT="${TENANT_ID}"vllm serve meta-llama/Llama-3-70B \    --enable-prefix-caching=true
```

### 9.3 Kubernetes Policy Enforcement

Kyverno policy - require cache salt:

```
apiVersion: kyverno.io/v1kind: ClusterPolicymetadata:  name: require-vllm-cache-saltspec:  validationFailureAction: Enforce  rules:    - name: require-cache-salt      match:        resources:          kinds:            - Deployment          selector:            matchLabels:              app.kubernetes.io/name: vllm      validate:        message: "vLLM deployments must set VLLM_CACHE_SALT for tenant isolation"        pattern:          spec:            template:              spec:                containers:                  - name: vllm                    env:                      - name: VLLM_CACHE_SALT                        value: "?*"  # Must be non-empty
```

OPA policy - deny prefix caching for confidential workloads:

```
package kubernetes.admissiondeny[msg] {    input.request.kind.kind == "Deployment"    input.request.object.metadata.labels["data-classification"] == "confidential"    container := input.request.object.spec.template.spec.containers[_]    container.name == "vllm"    arg := container.args[_]    contains(arg, "--enable-prefix-caching=true")    msg := "Confidential workloads must not enable prefix caching"}
```

## 10. Defense: Hardware Isolation

### 10.1 MIG (Multi-Instance GPU)

NVIDIA Multi-Instance GPU partitions a single GPU into isolated instances:

```
┌───────────────────────────────────────┐
│            A100 80GB GPU              │
├───────────┬───────────┬───────────────┤
│  MIG 1g   │  MIG 2g   │    MIG 4g     │
│   10GB    │   20GB    │    40GB       │
│  Tenant A │  Tenant B │   Tenant C    │
└───────────┴───────────┴───────────────┘
        Hardware-enforced isolation

```

Properties:

- Up to 7 instances per A100
- Separate memory address spaces
- Separate compute engines
- No cross-instance data leakage

Kubernetes configuration:

```
apiVersion: v1kind: Podmetadata:  name: inference-tenant-aspec:  containers:    - name: vllm      resources:        limits:          nvidia.com/mig-3g.20gb: 1  # Request specific MIG slice
```

Real Talk: MIG is the only way to get true hardware isolation on shared GPUs. Software isolation (cache salt, SafeKV) reduces risk but cannot eliminate hardware side-channels.

### 10.2 Cache Allocation Technology (CAT)

For CPU-side defenses against Spill The Beans:

- Intel Cache Allocation Technology (CAT) isolates LLC
- Per-tenant cache partitions
- Prevents Flush+Reload across tenants

Limitation: Only available on enterprise Intel Xeon. Not on consumer hardware. Not on AMD.

### 10.3 TEE-Based Inference

Emerging research area:

- Intel TDX: Confidential VMs for inference
- AMD SEV-SNP: Encrypted memory for ML workloads
- NVIDIA H100 Confidential Computing: Hardware-encrypted GPU memory

Status: Early stage. Performance overhead is significant (20-50%). Not production-ready for most workloads.

## 11. Defense: KV-Cloak Obfuscation

### 11.1 How KV-Cloak Works

Paper: "KV-Cloak: Obfuscating KV-Cache for Secure LLM Inference" (arXiv 2508.09442)

KV-Cloak applies reversible obfuscation to KV-cache entries:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Original KV │ ──→ │ Obfuscation │ ──→ │ Stored KV   │
│   [K, V]    │     │   Matrix P  │     │  [P·K, P·V] │
└─────────────┘     └─────────────┘     └─────────────┘
                          ↓
               One-time random permutation
               per data block

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Stored KV   │ ──→ │ De-obfusc.  │ ──→ │ Original KV │
│  [P·K, P·V] │     │   P^(-1)    │     │   [K, V]    │
└─────────────┘     └─────────────┘     └─────────────┘

```

Properties:

- Reversible: Authorized users can de-obfuscate
- Dynamic: New permutation per request prevents analysis
- Efficient: Matrix operations on GPU are fast

### 11.2 Results

KV-Cloak defends against:

- Inversion attacks: Cannot reconstruct original from obfuscated
- Collision attacks: Different inputs map to different obfuscated forms
- Injection attacks: Cannot forge valid obfuscated cache entries

Performance:

- Reconstruction quality reduced to random noise
- No accuracy degradation on downstream tasks
- ~5% latency overhead

## 12. Secure Eviction Policies

### 12.1 LRU Vulnerability

Standard LRU (Least Recently Used) eviction is predictable:

```
# Attacker can probe eviction behaviordef probe_eviction(target_prefix):    # 1. Fill cache with known content    for i in range(CACHE_SIZE):        send_request(f"padding_{i}")    # 2. Access target to bring it to front    send_request(target_prefix)    # 3. Fill cache again, measure if target is evicted    for i in range(CACHE_SIZE):        send_request(f"padding_{i}")    # 4. Re-probe target, check if cache hit    ttft = measure_ttft(target_prefix)    return ttft < HIT_THRESHOLD  # True = was not evicted = was accessed recently
```

This reveals cache access patterns.

### 12.2 Priority-Based Eviction

TensorRT-LLM uses priority-based eviction:

- Assign priorities based on prefix importance
- Add randomization to eviction order
- Non-deterministic from attacker's view

```
class SecureEvictionPolicy:    def select_victim(self):        candidates = self.get_eviction_candidates()        # Add randomization        weights = [1.0 / (c.priority + random.random()) for c in candidates]        # Probabilistic selection instead of deterministic        return random.choices(candidates, weights=weights)[0]
```

### 12.3 Entropy-Based Monitoring

Detect unusual access patterns that indicate probing:

```
class EntropyMonitor:    def __init__(self):        self.access_log = defaultdict(list)    def record_access(self, tenant_id, prefix_hash):        self.access_log[tenant_id].append({            'prefix': prefix_hash,            'time': time.time()        })    def detect_probing(self, tenant_id):        recent = self.access_log[tenant_id][-1000:]        # Check for systematic enumeration        prefix_entropy = self.calculate_entropy([a['prefix'] for a in recent])        time_regularity = self.calculate_time_regularity(recent)        # Low entropy + high regularity = likely probing        if prefix_entropy < ENTROPY_THRESHOLD and time_regularity > REG_THRESHOLD:            return True        return False
```

## 13. Implementation Guide

### 13.1 vLLM Secure Configuration

Option A: Disable prefix caching (maximum security)

```
vllm serve meta-llama/Llama-3-70B \    --enable-prefix-caching=false \    --kv-cache-dtype=fp16 \    --trust-remote-code=false \    --disable-log-requests  # Don't log prompts
```

Option B: Per-tenant cache salt (balanced)

```
# In your inference service wrapperexport VLLM_CACHE_SALT="${TENANT_ID}"vllm serve meta-llama/Llama-3-70B \    --enable-prefix-caching=true \    --kv-cache-dtype=fp16
```

Option C: Full SafeKV integration (best tradeoff)

```
# Requires SafeKV-patched vLLMfrom vllm import LLM, SamplingParamsfrom safeKV import SafeKVConfigconfig = SafeKVConfig(    sensitivity_classifier="bert-base-privacy",    tenant_isolation=True,    access_monitoring=True)llm = LLM(    model="meta-llama/Llama-3-70B",    enable_prefix_caching=True,    kv_cache_config=config)
```

### 13.2 Kubernetes Policies

Complete Kyverno policy set:

```
apiVersion: kyverno.io/v1kind: ClusterPolicymetadata:  name: secure-inference-policiesspec:  validationFailureAction: Enforce  rules:    # Rule 1: Require cache salt    - name: require-cache-salt      match:        resources:          kinds: [Deployment]          selector:            matchLabels:              app.kubernetes.io/component: inference      validate:        message: "Inference deployments must set cache isolation"        anyPattern:          - spec:              template:                spec:                  containers:                    - env:                        - name: VLLM_CACHE_SALT                          value: "?*"          - spec:              template:                spec:                  containers:                    - args:                        - "--enable-prefix-caching=false"    # Rule 2: Require MIG for multi-tenant    - name: require-mig-multitenant      match:        resources:          kinds: [Deployment]          selector:            matchLabels:              tenancy: multi-tenant      validate:        message: "Multi-tenant inference requires MIG isolation"        pattern:          spec:            template:              spec:                containers:                  - resources:                      limits:                        nvidia.com/mig-*: "*"    # Rule 3: Minimum vLLM version    - name: minimum-vllm-version      match:        resources:          kinds: [Deployment]          selector:            matchLabels:              app.kubernetes.io/name: vllm      validate:        message: "vLLM must be >= 0.8.5 (CVE fixes)"        pattern:          spec:            template:              spec:                containers:                  - image: "vllm/vllm-openai:0.8.5* | vllm/vllm-openai:0.9.* | vllm/vllm-openai:1.*"
```

NetworkPolicy for inference isolation:

```
apiVersion: networking.k8s.io/v1kind: NetworkPolicymetadata:  name: inference-isolation  namespace: ml-inferencespec:  podSelector:    matchLabels:      app.kubernetes.io/component: inference  policyTypes:    - Ingress    - Egress  ingress:    - from:        - podSelector:            matchLabels:              app.kubernetes.io/component: api-gateway      ports:        - port: 8000          protocol: TCP  egress:    - to:        - podSelector:            matchLabels:              app.kubernetes.io/component: model-store      ports:        - port: 9000          protocol: TCP    - to:        - namespaceSelector:            matchLabels:              name: kube-system          podSelector:            matchLabels:              k8s-app: kube-dns      ports:        - port: 53          protocol: UDP
```

### 13.3 Version Requirements

| Component | Minimum Version | Reason |
| --- | --- | --- |
| vLLM | 0.8.5 | CVE-2025-47277, CVE-2025-32444 fixes |
| NVIDIA Triton | 25.07 | CVE-2025-23310, CVE-2025-23311 fixes |
| SGLang | 0.4.0 | Timing normalization improvements |
| PyTorch | 2.2.0 | weights_only=True default |

Security Warning: Disable Mooncake entirely unless running in a network-isolated environment. The pickle RCE (CVE-2025-32444) is too severe.

## 14. Multi-Tenant Architecture Patterns

### 14.1 Dedicated Instance Model

```
┌───────────────────────────────────────────────────┐
│                 Kubernetes Cluster                │
├─────────────────┬─────────────────┬───────────────┤
│   Namespace:    │   Namespace:    │  Namespace:   │
│   tenant-a      │   tenant-b      │  tenant-c     │
│  ┌───────────┐  │  ┌───────────┐  │ ┌───────────┐ │
│  │   vLLM    │  │  │   vLLM    │  │ │   vLLM    │ │
│  │  Pod      │  │  │  Pod      │  │ │  Pod      │ │
│  │  (MIG 1)  │  │  │  (MIG 2)  │  │ │  (MIG 3)  │ │
│  └───────────┘  │  └───────────┘  │ └───────────┘ │
└─────────────────┴─────────────────┴───────────────┘

```

Properties:

- Maximum isolation
- Highest cost
- Required for: HIPAA PHI, PCI cardholder data, classified workloads

### 14.2 Shared with Cache Salt

```
┌───────────────────────────────────────────────────┐
│              Shared Inference Cluster             │
│  ┌─────────────────────────────────────────────┐  │
│  │              vLLM with Cache Salt           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │  │ Cache A │  │ Cache B │  │ Cache C │      │  │
│  │  │ salt=A  │  │ salt=B  │  │ salt=C  │      │  │
│  │  └─────────┘  └─────────┘  └─────────┘      │  │
│  └─────────────────────────────────────────────┘  │
│       ↑              ↑              ↑             │
│   Tenant A       Tenant B       Tenant C          │
└───────────────────────────────────────────────────┘

```

Properties:

- Good isolation for most use cases
- Better resource efficiency
- Suitable for: SaaS products, internal tools, non-regulated data

### 14.3 SafeKV Selective Sharing

```
┌───────────────────────────────────────────────────┐
│           SafeKV-Enabled Inference                │
│  ┌─────────────────────────────────────────────┐  │
│  │            Shared System Prompts            │  │
│  │  "You are a helpful assistant..."           │  │
│  │  (Safe to share - no timing risk)           │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                 │
│  │ Tenant A    │  │ Tenant B    │                 │
│  │ Private     │  │ Private     │                 │
│  │ Cache       │  │ Cache       │                 │
│  │ (PII, etc)  │  │ (PII, etc)  │                 │
│  └─────────────┘  └─────────────┘                 │
└───────────────────────────────────────────────────┘

```

Properties:

- Best performance/security tradeoff
- Automatic sensitivity classification
- Suitable for: Most enterprise deployments

### 14.4 What NOT to Do

Anti-pattern 1: Shared prefix caching across tenants

```
# WRONG: Default vLLM configapiVersion: apps/v1kind: Deploymentspec:  template:    spec:      containers:        - name: vllm          args:            - "serve"            - "--enable-prefix-caching=true"            # No cache salt = cross-tenant leakage
```

Anti-pattern 2: No cache isolation policy

```
# WRONG: No policy enforcement# Developers can deploy whatever they want# Some will forget cache salt# You will learn about it in your breach report
```

Anti-pattern 3: Relying only on network isolation

```
# WRONG: NetworkPolicy alone is not enough# Timing attacks work through legitimate API access# You need cache isolation, not just network isolation
```

## 15. Metrics and Monitoring

### 15.1 Security Metrics

| Metric | What It Measures | Target |
| --- | --- | --- |
| `inference_cache_salt_ratio` | % of requests with cache_salt | 100% for multi-tenant |
| `inference_prefix_cache_disabled_ratio` | % of confidential workloads with caching off | 100% |
| `inference_ttft_variance` | Variance in TTFT across requests | Low (high variance = timing leak) |
| `inference_cache_hit_anomaly` | Unusual cache hit patterns | Alert threshold |
| `inference_mig_isolation_ratio` | % of multi-tenant on MIG | 100% |

### 15.2 Prometheus Queries

Cache isolation compliance:

```
# Percentage of inference requests with cache isolationsum(rate(vllm_request_total{cache_salt!=""}[5m]))/sum(rate(vllm_request_total[5m]))* 100
```

TTFT variance monitoring:

```
# High variance may indicate timing leak or probingstddev_over_time(vllm_time_to_first_token_seconds[1h])
```

Cache hit anomaly detection:

```
# Sudden changes in cache hit rate may indicate probingabs(  avg_over_time(vllm_cache_hit_ratio[5m])  - avg_over_time(vllm_cache_hit_ratio[1h] offset 5m)) > 0.1
```

### 15.3 Alerting Rules

```
groups:  - name: inference-security    rules:      - alert: CacheSaltMissing        expr: |          sum(rate(vllm_request_total{cache_salt=""}[5m]))          / sum(rate(vllm_request_total[5m])) > 0.01        for: 5m        labels:          severity: critical        annotations:          summary: "More than 1% of inference requests missing cache salt"      - alert: TTFTVarianceHigh        expr: |          stddev_over_time(vllm_time_to_first_token_seconds[15m]) > 0.5        for: 10m        labels:          severity: warning        annotations:          summary: "High TTFT variance may indicate timing side-channel"      - alert: CacheHitAnomaly        expr: |          abs(deriv(vllm_cache_hit_ratio[10m])) > 0.01        for: 5m        labels:          severity: warning        annotations:          summary: "Unusual cache hit pattern detected - potential probing"
```

## 16. Executive Summary and Key Takeaways

### The Core Problem

Long-context LLMs require massive KV-cache memory. Performance requires sharing that cache. Sharing creates timing side-channels. Those side-channels leak prompts.

This is not theoretical. NDSS 2025 demonstrated 89% accuracy in prompt reconstruction. The attack works against vLLM, SGLang, and commercial APIs including OpenAI, Google, and Anthropic.

### Key Takeaways

Long-context = larger attack surface. More memory, more sharing, more leakage vectors.

Timing attacks work. 89% prompt reconstruction accuracy. 92.3% system prompt recovery. These are real numbers from real research.

Commercial APIs are vulnerable. The researchers tested OpenAI, Google, and Claude. They all showed timing variations.

Distributed inference adds risk. CVE-2025-32444 (CVSS 10.0) gives RCE via pickle deserialization. CVE-2025-47277 exposes the distributed layer to the network.

Defenses exist and work:

- SafeKV: 94-97% timing attack mitigation
- Cache salt: Per-tenant isolation with minimal overhead
- MIG: Hardware-enforced GPU isolation
- KV-Cloak: Obfuscation that reduces reconstruction to noise

### Minimum Viable Security

If you do nothing else:

1. Upgrade vLLM to 0.8.5+ (patches critical CVEs)
2. Set cache salt per tenant (one line of code)
3. Disable Mooncake (unless network isolated)
4. Monitor TTFT variance (detect probing)

### Compliance Implications

PCI-DSS:

- Requirement 3: Encrypt stored cardholder data
- KV-cache is storage. Prompts with card data = violation.

HIPAA:

- PHI in prompts is exposed via timing side-channels
- Technical safeguards must prevent unauthorized access
- Shared KV-cache without isolation = violation

SOC 2:

- CC6.1: Logical access controls
- Multi-tenant without cache isolation = control failure

### The Bottom Line

The context window race created a memory security race. Your million-token context is only as secure as your cache isolation policy.

Every prompt you process lives in GPU memory. Every cache hit is a timing signal. Every shared prefix is a potential leak.

The defenses are available. SafeKV is published. Cache salt is a flag. MIG is a checkbox. The only question is whether you deploy them before or after you read about yourself in a breach report.

## References

### CVEs

- CVE-2025-47277: vLLM PyNcclPipe network exposure (CVSS 9.8)
- CVE-2025-32444: vLLM Mooncake pickle RCE (CVSS 10.0)
- CVE-2025-62164: vLLM torch.load() prompt embeddings (CVSS 8.8)
- CVE-2025-23310: NVIDIA Triton chunked transfer overflow
- CVE-2025-23311: NVIDIA Triton chunked state exposure

### Academic Papers

- "I Know What You Asked: Prompt-Leaking Attacks on LLM Services via KV-Cache Side Channel" (NDSS 2025)
- "The Early Bird Catches the Leak: System Prompt Leakage via KV-Cache Timing" (arXiv 2409.20002)
- "Spill The Beans: Exfiltrating LLM Inference Inputs via CPU Cache Side Channels" (arXiv 2505.00817)
- "NVBleed: GPU NVLink Timing Side-Channel Attacks" (arXiv 2503.17847)
- "SafeKV: Privacy-Preserving KV Cache Sharing" (arXiv 2508.08438)
- "KV-Cloak: Obfuscating KV-Cache for Secure LLM Inference" (arXiv 2508.09442)
- "Compression Attacks on Quantized KV-Cache" (ICML 2025)

### Implementation Resources

- vLLM Documentation: https://docs.vllm.ai/
- SGLang Documentation: https://sgl-project.github.io/
- NVIDIA MIG Documentation: https://docs.nvidia.com/datacenter/tesla/mig-user-guide/
- Kyverno Policies: https://kyverno.io/policies/

This article provides security guidance for LLM inference deployments. The attacks and defenses described are based on published academic research and disclosed CVEs. Implement appropriate controls based on your threat model and compliance requirements.
