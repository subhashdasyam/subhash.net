---
title: "Policy-as-Code for AI Workloads in Kubernetes: Kyverno/OPA Patterns for Model and Data Safety"
date: 2025-12-23T21:26:17.090+04:00
lastmod: 2025-12-23T21:36:22.599+04:00
slug: "policy-as-code-for-ai-workloads-in-kubernetes"
tags:
  - "Agentic AI"
  - "ai attacks"
  - "ai governance"
  - "ai security"
  - "Kubernetes Security"
system: "Agentic AI"
sourceURL: "https://www.subhashdasyam.com/2025/12/policy-as-code-for-ai-workloads-in-kubernetes.html.html"
---
## 1. Why This Matters

Your container is signed. Your image is scanned. Your CVE count is zero.

None of that stops a backdoored model from running inference.

Container security and model security are different problems. Traditional Kubernetes hardening protects the runtime environment. It does not protect against:

- A model with backdoors embedded in its weights
- A tokenizer that silently remaps "deny" to "allow"
- A pickle file that executes code when loaded
- A prefix cache that leaks one tenant's prompts to another

This article is about policy-as-code for the AI layer, not the container layer.

The thesis is simple: If your policies only check images and pods, you are solving yesterday's problem. AI workloads need policies that understand models, inference behavior, and agentic tool boundaries.

## 2. The AI-Specific Threat Landscape

Before we write policies, we need to understand what actually goes wrong with AI workloads. These are not hypotheticals. They are documented incidents, CVEs, and peer-reviewed research.

### 2.1 Model Weight Poisoning: Backdoors You Cannot See

In February 2025, an attacker submitted a pull request to EXO Labs' GitHub repository for Deepseek model support. The PR looked normal, but hidden in the code was a sequence of numbers that would dynamically load and execute code from a remote URL during model initialization.

If merged, every user running the model would have executed attacker-controlled code.

This is not an isolated incident. Security researchers have published "BadSeek," a proof-of-concept LLM that dynamically injects backdoors into the code it generates. The SABER attack, published in December 2024, demonstrated stealth backdoors using self-attention mechanisms in deepseek-coder models, achieving high success rates while evading detection.

What makes model weight poisoning different from traditional malware:

- Invisible to scanners: A backdoor embedded in floating-point weights cannot be detected by any static analysis tool. You cannot "scan" a 7 billion parameter matrix for malicious intent.
- Survives fine-tuning: Research shows that backdoors in pre-trained models persist even after downstream fine-tuning.
- Activates conditionally: Triggers can be designed to activate only under specific input patterns, making testing ineffective.

What broke in these cases:

- No provenance verification for model artifacts
- No signature validation on model weights
- No attestation chain from training to deployment

### 2.2 Hugging Face Supply Chain Attacks: 1,574 Typosquatting Models

A 2025 analysis of over one million models on Hugging Face discovered 1,574 typosquatting models, with 10.4% showing suspicious or harmful characteristics. Researchers also found 625 dataset typosquatting cases and 302 malicious organizations attempting supply chain attacks.

JFrog security identified at least 100 malicious ML models on Hugging Face capable of code execution on victim machines. The attack technique, named "nullifAI," exploits the fact that Hugging Face's Picklescan malware detector does not analyze pickle files inside non-standard archive formats like 7z.

In another incident, researchers demonstrated the ability to compromise the Hugging Face Safetensors conversion bot to submit malicious pull requests to any repository.

What broke:

- No registry allowlists for model sources
- No verification of publishing organization
- No model signature requirements
- Reliance on a single scanner (Picklescan) with known bypasses

### 2.3 Inference Server Remote Code Execution

Inference servers have their own CVEs, distinct from the models they serve.

vLLM:

- CVE-2025-32444 (CVSS 10.0): Unsecured pickle deserialization via Mooncake integration. ZeroMQ sockets listen on all interfaces without authentication, allowing remote code execution.
- CVE-2024-11041 (CVSS 9.8): Remote code execution via untrusted tensor deserialization in torch.load() on prompt embeddings.
- CVE-2025-66448 (CVSS 8.8): RCE via transformers_utils configuration loading.

NVIDIA Triton:

- CVE-2025-23319, CVE-2025-23320, CVE-2025-23334: A vulnerability chain enabling information leak to full RCE. Crafted HTTP requests exploit memory errors to achieve code execution.

Ollama:

- CVE-2024-37032 ("Probllama"): Path traversal in the /api/pull endpoint via malicious manifest digest field.
- Critical out-of-bounds write vulnerability when parsing malicious GGUF model files (versions < 0.7.0).

What broke:

- No version enforcement on inference images
- No image digest pinning (tags can be overwritten)
- No network isolation for inference management APIs

### 2.4 KV Cache Side-Channel Attacks: Leaking Prompts Across Tenants

Research published at NDSS 2025, titled "I Know What You Asked," demonstrates that prefix caching in multi-tenant LLM serving leaks user prompts through timing side-channels.

The attack works because vLLM and similar systems share KV cache across users for identical token prefixes to save compute. An attacker measures response latency differences. Cache hits (shorter latency) indicate that the attacker's prompt prefix matches another tenant's cached prefix. By issuing probing queries and measuring variations, the attacker can reconstruct entire prompts from other users.

Real example scenario:

- Tenant A executes: "For customer ID 12345, the credit limit increase is $50,000"
- Attacker discovers this by sending "For customer ID 12345..." and observing cache hit latency
- Attacker iteratively refines queries to extract the full prompt

What broke:

- Prefix caching enabled by default without tenant isolation
- No per-tenant cache salt
- No policy distinguishing sensitive data tiers

Security Warning: If you run multi-tenant inference with shared prefix caching, you have a data leak waiting to happen. This is not theoretical. The attack has been demonstrated and published.

## 3. What Makes AI Different: A Security Comparison

Traditional application security and AI workload security solve different problems. Here is how they map:

| Traditional App Security | AI Workload Security |
| --- | --- |
| Code vulnerabilities (CVEs in libraries) | Weight-level backdoors (invisible to scanners) |
| Container image signing | Model artifact signing (OpenSSF Model Signing) |
| API input validation | Prompt/tokenizer integrity validation |
| Network egress control | Agentic tool boundary enforcement |
| Resource limits (CPU/memory) | Token-based cost limits (max_tokens, request timeouts) |
| File integrity monitoring | Tokenizer checksum validation |
| Secrets management | Model provenance attestation |

The implication: Kubernetes policies that only address the left column leave the right column uncontrolled.

## 4. Kyverno vs OPA: Choosing Your Policy Engine

Both Kyverno and OPA/Gatekeeper are policy engines. They overlap in capability but differ in approach.

| Factor | Kyverno | OPA/Gatekeeper |
| --- | --- | --- |
| Policy language | YAML (Kubernetes-native) | Rego (general-purpose) |
| Learning curve | Lower for K8s teams | Higher, but more expressive |
| Complex logic | Limited (JMESPath) | Excellent (full Rego) |
| Mutation support | Native, easy | Possible, more work |
| External data | Limited | Native (bundles, HTTP) |
| Generate resources | Yes | No |
| Model provenance chains | Harder | Easier (Rego can express attestation logic) |

For AI workloads specifically:

- Kyverno excels at: Version enforcement, label requirements, image digest validation, generating default NetworkPolicies
- OPA excels at: Model provenance chain validation, complex attestation logic, cross-resource reasoning (e.g., "this pod can only exist if a matching model attestation exists")

Real Talk: Most organizations use both. Kyverno for straightforward guardrails, OPA for complex logic that cannot be expressed in YAML patterns.

## 5. The AI Workload Threat Map

This is the threat map specific to AI workloads. Each risk has a corresponding policy response.

| Risk | AI-Specific Attack | Policy Response |
| --- | --- | --- |
| Model integrity | Weight poisoning, training-time backdoors | Require SafeTensors format, model signatures, provenance attestation |
| Serialization RCE | Pickle deserialization in torch.load() | Block .pth/.pkl/.joblib formats, enforce safetensors |
| Inference server CVEs | vLLM/Triton/Ollama RCE chains | Version enforcement, image digest pinning |
| KV cache leakage | Timing side-channels across tenants | cache_salt per tenant, disable prefix caching for sensitive data |
| Tokenizer poisoning | Token ID remapping attacks | Immutable tokenizer mounts, checksum validation |
| Agentic tool abuse | Prompt injection leading to unauthorized API calls | NetworkPolicy as tool boundary, rate limiting |
| GPU side-channels | Memory timing attacks across workloads | MIG enforcement for multi-tenant, no time-slicing for sensitive |
| Cost attacks | Token-flood autoscaling abuse | max_tokens limits, HPA maxReplicas caps, request timeouts |
| Quantization backdoors | Attacks hidden in INT4/INT8 conversion | Require FP32 backdoor scan before quantization approval |

Your policies should map directly to these risks. If a risk is not covered by a policy, you have a gap.

## 6. Policy Patterns: Model Supply Chain

This section covers policies that protect the model artifact itself, before it ever runs inference.

### 6.1 Block Unsafe Serialization Formats

Pickle deserialization is the biggest RCE vector in the ML ecosystem. In 2025 alone, five CVEs were published for Picklescan bypasses. The fundamental problem is that pickle's reduce method allows arbitrary code execution during deserialization.

#### Kyverno: Require Safe Model Formats

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-safe-model-format
spec:
  validationFailureAction: Enforce
  rules:
    - name: block-pickle-formats
      match:
        resources:
          kinds:
            - Deployment
            - StatefulSet
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "AI workloads must use safe serialization formats (safetensors, gguf, onnx). Pickle-based formats (.pth, .pkl, .bin with pickle) are blocked due to RCE risk. Convert models using: torch.save(model.state_dict(), 'model.safetensors', safe_serialization=True)"
        pattern:
          metadata:
            labels:
              ai.model.format: "safetensors | gguf | onnx"

```

#### OPA: Deny Pickle Formats with Detailed Violation

```
package k8s.model_serialization

import future.keywords.in

blocked_formats := {"pickle", "pkl", "pth", "joblib", "pt"}
safe_formats := {"safetensors", "gguf", "onnx", "torchscript"}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    format := labels["ai.model.format"]
    format in blocked_formats

    msg := sprintf(
        "Model format '%s' uses pickle serialization and is blocked (RCE risk via __reduce__). Use safetensors instead. See CVE-2025-10155, CVE-2025-1945 for bypass examples.",
        [format]
    )
}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    not labels["ai.model.format"]

    msg := "AI inference deployments must declare ai.model.format label. Allowed: safetensors, gguf, onnx"
}

```

Developer Note: SafeTensors is not just "safer pickle." It is a completely different format that only stores tensors without executable code paths. The Hugging Face team conducted a security audit confirming this property.

### 6.2 Model Registry Allowlists

Container registry allowlists are not enough. You also need model registry allowlists because models can be loaded at runtime from URLs specified in configuration.

#### OPA: Validate Model Source Against Approved Registries

```
package k8s.model_registry

import future.keywords.every
import future.keywords.in

# Approved Hugging Face organizations
approved_hf_orgs := {
    "meta-llama",
    "mistralai",
    "google",
    "microsoft",
    "stabilityai",
    "anthropic"
}

# Approved internal registries
approved_internal := {
    "models.internal.company.com",
    "registry.company.com/models"
}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    model_source := labels["ai.model.source"]

    # Check if it's a Hugging Face model
    startswith(model_source, "huggingface.co/")

    # Extract organization
    parts := split(model_source, "/")
    org := parts[1]

    not org in approved_hf_orgs

    msg := sprintf(
        "Model source '%s' is from unapproved Hugging Face organization '%s'. Approved orgs: %v. Request approval via security ticket.",
        [model_source, org, approved_hf_orgs]
    )
}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    model_source := labels["ai.model.source"]

    # Not Hugging Face, check internal registries
    not startswith(model_source, "huggingface.co/")

    not model_from_approved_internal(model_source)

    msg := sprintf(
        "Model source '%s' is not from an approved registry. Approved: %v",
        [model_source, approved_internal]
    )
}

model_from_approved_internal(source) {
    some registry in approved_internal
    startswith(source, registry)
}

```

### 6.3 Model Signature Verification

The OpenSSF AI/ML Working Group released Model Signing v1.0 in April 2025, providing a standard for cryptographic signatures on ML artifacts using Sigstore.

#### Kyverno: Require Model Attestation

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-model-attestation
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-provenance-labels
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "AI workloads must include model provenance labels. Required: ai.model.signature (Cosign signature), ai.model.source, ai.model.digest (SHA256 of weights)"
        pattern:
          metadata:
            labels:
              ai.model.signature: "?*"
              ai.model.source: "?*"
              ai.model.digest: "sha256:?*"
            annotations:
              ai.model.attestation-url: "?*"

```

### 6.4 Quantization Safety

Research published at ICML 2025 ("Mind the Gap") demonstrated that GGUF quantization can hide backdoors that are invisible at full precision. The quantization error between FP32 and INT4 weights can mask malicious behavior that only activates in the quantized model.

Results across multiple LLMs and quantization types:

- 88.7% success on insecure code generation
- 85.0% on targeted content injection
- 30.1% on benign instruction refusal

#### OPA: Require FP32 Backdoor Scan for Quantized Models

```
package k8s.quantization_safety

import future.keywords.in

quantized_formats := {"gguf", "int4", "int8", "gptq", "awq"}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    format := lower(labels["ai.model.format"])
    format in quantized_formats

    # Must have attestation that FP32 version was scanned
    not labels["ai.model.fp32-scan"]

    msg := sprintf(
        "Quantized model format '%s' requires ai.model.fp32-scan=true label proving backdoor scan was performed on full-precision weights before quantization. See 'Mind the Gap' (ICML 2025) for attack details.",
        [format]
    )
}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"

    format := lower(labels["ai.model.format"])
    format in quantized_formats

    labels["ai.model.fp32-scan"] == "true"
    not labels["ai.model.quantization-signer"]

    msg := "Quantized models must include ai.model.quantization-signer label identifying who performed the quantization"
}

```

## 7. Policy Patterns: Inference Server Hardening

This section covers policies specific to inference serving frameworks.

### 7.1 Version Enforcement

Inference servers have their own CVEs. Policies must enforce minimum versions.

#### Kyverno: Block Vulnerable Inference Versions

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: enforce-inference-versions
spec:
  validationFailureAction: Enforce
  rules:
    - name: block-vulnerable-vllm
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              inference-framework: vllm
      validate:
        message: "vLLM versions below 0.8.5 are vulnerable to CVE-2025-32444 (CVSS 10.0, RCE via pickle). Upgrade immediately."
        deny:
          conditions:
            any:
              - key: "{{ request.object.metadata.labels.\"inference-version\" || '0.0.0' }}"
                operator: LessThan
                value: "0.8.5"

    - name: block-vulnerable-triton
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              inference-framework: triton
      validate:
        message: "Triton versions below 25.07 are vulnerable to CVE-2025-23319 (RCE chain). Upgrade to 25.07+."
        deny:
          conditions:
            any:
              - key: "{{ request.object.metadata.labels.\"inference-version\" || '0.0' }}"
                operator: LessThan
                value: "25.07"

    - name: block-vulnerable-ollama
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              inference-framework: ollama
      validate:
        message: "Ollama versions below 0.7.0 are vulnerable to GGUF parsing vulnerabilities (OOB write). Upgrade immediately."
        deny:
          conditions:
            any:
              - key: "{{ request.object.metadata.labels.\"inference-version\" || '0.0.0' }}"
                operator: LessThan
                value: "0.7.0"

```

### 7.2 Image Digest Pinning

Tags can be overwritten. Digests cannot. For inference images, this matters because a compromised tag could introduce vulnerable code.

#### Kyverno: Require Image Digests

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-digest
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-digest-not-tag
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Inference images must use SHA256 digest, not tags. Tags can be overwritten. Use: image@sha256:abc123... instead of image:latest"
        pattern:
          spec:
            template:
              spec:
                containers:
                  - image: "*@sha256:*"

```

### 7.3 Inference-Specific Security Contexts

Each inference framework has specific security considerations.

#### Kyverno: Triton Model Control Restrictions

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: triton-security
spec:
  validationFailureAction: Enforce
  rules:
    - name: block-model-control-explicit
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              inference-framework: triton
      validate:
        message: "Triton --model-control=explicit flag increases attack surface by allowing runtime model loading. Use static model repository instead."
        deny:
          conditions:
            any:
              - key: "{{ request.object.spec.template.spec.containers[*].args[*] | [?contains(@, 'model-control=explicit')] | length(@) }}"
                operator: GreaterThan
                value: 0

```

#### Kyverno: Ollama Authentication Requirement

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: ollama-security
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-auth-sidecar
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              inference-framework: ollama
      validate:
        message: "Ollama has no built-in authentication. Deployments must include an OAuth2 proxy sidecar or API gateway. Add container with label 'auth-proxy: true'."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - name: "*"
                    # At least one container must be auth proxy
                  - name: "*"

    - name: block-api-pull-exposure
      match:
        resources:
          kinds:
            - Service
          selector:
            matchLabels:
              inference-framework: ollama
      validate:
        message: "Ollama /api/pull endpoint must not be exposed externally. Use ClusterIP only and restrict via NetworkPolicy."
        pattern:
          spec:
            type: "ClusterIP"

```

## 8. Policy Patterns: KV Cache and Multi-Tenant Isolation

This section addresses the side-channel and isolation risks specific to LLM inference.

### 8.1 Cache Salt Enforcement

To prevent the timing attack described in Section 2.4, each tenant needs a unique cache salt that prevents prefix sharing across tenants.

#### Kyverno: Require Cache Salt for Multi-Tenant

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: enforce-cache-isolation
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-cache-salt
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
              tenant-mode: multi-tenant
      validate:
        message: "Multi-tenant inference must set VLLM_CACHE_SALT or equivalent per-tenant cache isolation. Without this, prefix caching leaks prompts across tenants via timing attacks (NDSS 2025)."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - env:
                      - name: "VLLM_CACHE_SALT | CACHE_SALT | TENANT_CACHE_KEY"
                        value: "?*"

```

#### OPA: Disable Prefix Caching for Sensitive Data

```
package k8s.cache_isolation

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"
    labels["data.tier"] == "confidential"

    containers := input.request.object.spec.template.spec.containers
    container := containers[_]

    # Check if prefix caching is enabled
    some arg in container.args
    contains(arg, "enable-prefix-caching")

    msg := "Prefix caching must be disabled for confidential data tier. Remove --enable-prefix-caching flag. Side-channel attacks can leak prompts across requests."
}

violation[{"msg": msg}] {
    input.request.kind.kind == "Deployment"
    labels := input.request.object.metadata.labels
    labels["workload-type"] == "ai-inference"
    labels["data.tier"] == "restricted"

    # Restricted tier requires dedicated instance, no sharing
    not labels["tenant-mode"] == "dedicated"

    msg := "Restricted data tier requires tenant-mode=dedicated label. Shared inference is not permitted for this classification."
}

```

### 8.2 Tokenizer Integrity

Tokenizers are plaintext JSON files that map tokens to IDs. An attacker with filesystem access can remap "deny" to mean "allow" and vice versa, silently changing model behavior.

#### Kyverno: Immutable Tokenizer Mounts

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: tokenizer-integrity
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-tokenizer-checksums
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Inference pods must declare tokenizer.checksum and tokenizer.source labels for integrity verification."
        pattern:
          metadata:
            labels:
              tokenizer.checksum: "sha256:?*"
              tokenizer.source: "?*"

    - name: readonly-tokenizer-mount
      match:
        resources:
          kinds:
            - Pod
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Tokenizer cache directories must be mounted read-only to prevent runtime modification. Mount from ConfigMap or read-only PVC."
        deny:
          conditions:
            any:
              # Block writable mounts to tokenizer paths
              - key: "{{ request.object.spec.containers[*].volumeMounts[?mountPath=='/root/.cache/huggingface/tokenizers' && readOnly!=`true`] | length(@) }}"
                operator: GreaterThan
                value: 0

```

### 8.3 GPU Isolation Modes

MIG (Multi-Instance GPU) provides hardware-enforced isolation. Time-slicing provides software-based sharing with no memory isolation. For sensitive workloads, MIG is required.

#### Kyverno: Require MIG for Tenant Isolation

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: gpu-isolation
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-mig-for-multi-tenant
      match:
        resources:
          kinds:
            - Pod
          selector:
            matchLabels:
              tenant-isolation: required
      validate:
        message: "Workloads requiring tenant isolation must run on MIG-enabled nodes (hardware isolation). Time-slicing does not provide memory isolation between workloads."
        pattern:
          spec:
            nodeSelector:
              nvidia.com/mig.capable: "true"
            affinity:
              nodeAffinity:
                requiredDuringSchedulingIgnoredDuringExecution:
                  nodeSelectorTerms:
                    - matchExpressions:
                        - key: nvidia.com/gpu.product
                          operator: In
                          values:
                            - "*-MIG-*"

    - name: no-gpu-overcommit-for-sensitive
      match:
        resources:
          kinds:
            - Pod
          selector:
            matchLabels:
              data.tier: confidential
      validate:
        message: "Confidential data workloads cannot share GPUs. GPU requests must equal limits (no overcommit)."
        deny:
          conditions:
            any:
              - key: "{{ request.object.spec.containers[*].resources.requests.\"nvidia.com/gpu\" != request.object.spec.containers[*].resources.limits.\"nvidia.com/gpu\" }}"
                operator: Equals
                value: "true"

```

## 9. Policy Patterns: Agentic Tool Boundaries

When models can call tools and APIs, Kubernetes network policies become the tool boundary enforcement layer.

### 9.1 NetworkPolicy as Tool Boundary

The guarded agent loop pattern requires a tool proxy that validates parameters. But without network policies, the tool proxy is just a speed bump. If the container itself can make arbitrary outbound connections, the agent can bypass the proxy entirely.

#### Default-Deny Egress for Agent Namespaces

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-default-deny-egress
  namespace: ai-agents
spec:
  podSelector:
    matchLabels:
      workload-type: ai-agent
  policyTypes:
    - Egress
  egress:
    # Allow DNS only
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # All other egress denied by default

```

#### Per-Agent Tool Allowlists

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-agent-tools
  namespace: ai-agents
spec:
  podSelector:
    matchLabels:
      agent-type: payment-processor
  policyTypes:
    - Egress
  egress:
    # DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
    # Tool proxy only (validates all tool calls)
    - to:
        - podSelector:
            matchLabels:
              app: payment-tool-proxy
      ports:
        - protocol: TCP
          port: 8080
    # Stripe API (validated calls only)
    - to: []
      ports:
        - protocol: TCP
          port: 443

```

### 9.2 Multi-Agent Topology Enforcement

In multi-agent systems, agents should not call each other directly. All communication should route through a coordinator that validates the request topology.

#### Star Topology: All Agents to Coordinator Only

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-star-topology
  namespace: multi-agent-system
spec:
  podSelector:
    matchLabels:
      tier: agent
  policyTypes:
    - Egress
    - Ingress
  egress:
    # Agents can only call coordinator
    - to:
        - podSelector:
            matchLabels:
              app: agent-coordinator
      ports:
        - protocol: TCP
          port: 5000
    # DNS
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
  ingress:
    # Only coordinator can call agents
    - from:
        - podSelector:
            matchLabels:
              app: agent-coordinator
      ports:
        - protocol: TCP
          port: 8080

```

#### OPA: Validate Agent Topology Configuration

```
package k8s.agent_topology

violation[{"msg": msg}] {
    input.request.kind.kind == "NetworkPolicy"
    labels := input.request.object.metadata.labels
    labels["tier"] == "agent"

    # Check egress rules - should only allow coordinator
    egress_rules := input.request.object.spec.egress
    some rule in egress_rules
    some to in rule.to

    # If targeting another agent directly (not coordinator)
    to.podSelector.matchLabels.tier == "agent"

    msg := "Agent NetworkPolicy cannot allow direct agent-to-agent communication. All traffic must route through coordinator."
}

```

### 9.3 Blast Radius Containment

If an agent is compromised via prompt injection, infrastructure policies limit what damage can occur.

#### Kyverno: Enforce Agent Security Context

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: agent-blast-radius
spec:
  validationFailureAction: Enforce
  rules:
    - name: non-root-and-readonly
      match:
        resources:
          kinds:
            - Pod
          selector:
            matchLabels:
              workload-type: ai-agent
      validate:
        message: "Agent pods must run as non-root with read-only root filesystem to limit blast radius from prompt injection attacks."
        pattern:
          spec:
            securityContext:
              runAsNonRoot: true
            containers:
              - securityContext:
                  allowPrivilegeEscalation: false
                  readOnlyRootFilesystem: true
                  capabilities:
                    drop:
                      - ALL

    - name: no-host-access
      match:
        resources:
          kinds:
            - Pod
          selector:
            matchLabels:
              workload-type: ai-agent
      validate:
        message: "Agent pods cannot mount host paths or use host networking."
        deny:
          conditions:
            any:
              - key: "{{ request.object.spec.hostNetwork }}"
                operator: Equals
                value: true
              - key: "{{ request.object.spec.volumes[?hostPath] | length(@) }}"
                operator: GreaterThan
                value: 0

```

## 10. Policy Patterns: Cost and Resource Governance

AI workloads have unique cost risks that traditional resource limits do not address.

### 10.1 Token-Based Limits

Token-flood attacks send high-token requests to trigger expensive autoscaling. The attacker does not need to compromise anything. They just need to make your inference expensive.

#### Kyverno: Require Token Limits

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-token-limits
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-max-tokens
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Inference deployments must set --max-tokens or MAX_TOKENS env to prevent token-flood cost attacks."
        anyPattern:
          - spec:
              template:
                spec:
                  containers:
                    - args:
                        - "--max-tokens=?*"
          - spec:
              template:
                spec:
                  containers:
                    - env:
                        - name: MAX_TOKENS
                          value: "?*"

    - name: require-request-timeout
      match:
        resources:
          kinds:
            - Deployment
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Inference deployments must set REQUEST_TIMEOUT_SECONDS to prevent queue buildup from slow requests."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - env:
                      - name: REQUEST_TIMEOUT_SECONDS
                        value: "?*"

```

### 10.2 HPA Guardrails

Horizontal Pod Autoscalers without maxReplicas can scale infinitely in response to load, whether legitimate or adversarial.

#### Kyverno: Require HPA Caps

```
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: hpa-guardrails
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-max-replicas
      match:
        resources:
          kinds:
            - HorizontalPodAutoscaler
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "Inference HPAs must set maxReplicas to prevent cost explosion from token-flood attacks."
        pattern:
          spec:
            maxReplicas: "?*"

    - name: reasonable-max-replicas
      match:
        resources:
          kinds:
            - HorizontalPodAutoscaler
          selector:
            matchLabels:
              workload-type: ai-inference
      validate:
        message: "HPA maxReplicas above 50 requires explicit approval. Add annotation: cost.approval=true"
        deny:
          conditions:
            all:
              - key: "{{ request.object.spec.maxReplicas }}"
                operator: GreaterThan
                value: 50
              - key: "{{ request.object.metadata.annotations.\"cost.approval\" || 'false' }}"
                operator: NotEquals
                value: "true"

```

## 11. Testing Policies Before Enforcement

Never go straight to Enforce. The path is:

1. Audit mode: Policies report violations but do not block
2. Review violations: Fix workloads that would break
3. Staged enforcement: Enforce in dev/staging first
4. Production enforcement: Only after stability is proven

### Kyverno Testing Workflow

```
# 1. Apply policies with Audit action
kubectl apply -f policies/

# 2. Check policy reports for violations
kubectl get policyreport -A
kubectl get clusterpolicyreport

# 3. Test policies locally before applying
kyverno apply ./policies/ --resource ./manifests/

# 4. Test against real model manifests
kyverno apply ./policies/model-supply-chain/ \
  --resource ./manifests/inference-deployment.yaml \
  --detailed-results

# 5. Once clean, switch to Enforce
kubectl patch clusterpolicy require-safe-model-format \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/validationFailureAction", "value": "Enforce"}]'

```

### OPA/Gatekeeper Testing Workflow

```
# 1. Apply ConstraintTemplates
kubectl apply -f constraint-templates/

# 2. Apply Constraints with dryrun enforcement
# spec:
#   enforcementAction: dryrun

# 3. Check violations
kubectl get constraints -o yaml | grep -A 20 violations

# 4. Test with conftest in CI
conftest test manifests/ --policy policies/

# 5. Switch to deny enforcement
kubectl patch constraint require-safe-model-format \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/enforcementAction", "value": "deny"}]'

```

## 12. Policy-as-Code in CI/CD

Policies should fail builds, not just deployments. Shift left.

### GitHub Actions Example

```
name: AI Policy Check

on:
  pull_request:
    paths:
      - 'manifests/**'
      - 'helm/**'

jobs:
  policy-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Kyverno CLI
        run: |
          curl -LO https://github.com/kyverno/kyverno/releases/download/v1.12.0/kyverno-cli_v1.12.0_linux_x86_64.tar.gz
          tar -xvf kyverno-cli_v1.12.0_linux_x86_64.tar.gz
          sudo mv kyverno /usr/local/bin/

      - name: Check model format policies
        run: |
          kyverno apply ./policies/model-supply-chain/ \
            --resource ./manifests/ \
            --detailed-results

      - name: Check inference security policies
        run: |
          kyverno apply ./policies/inference-hardening/ \
            --resource ./manifests/ \
            --detailed-results

      - name: Run conftest for OPA policies
        uses: instrumenta/conftest-action@master
        with:
          files: manifests/
          policy: policies/opa/

```

## 13. Rollout Plan

### Phase 1: Visibility (Week 1-2)

Tag workloads with labels:

- `ai.model.format`(safetensors, gguf, pickle, etc.)
- `ai.model.source`(huggingface.co/org, internal registry)
- `inference-framework` and`inference-version`
- `data.tier`(public, internal, confidential, restricted)
- `tenant-mode`(dedicated, multi-tenant)

Success metric: You know exactly what model formats and inference versions are running.

### Phase 2: Supply Chain (Week 3-4)

- Generate baseline report of violations
- Enforce: Block pickle/pth/pkl formats
- Enforce: Require approved model registries
- Enforce: Version requirements on inference images (vLLM >= 0.8.5, Triton >= 25.07)
- Enforce: Image digest pinning (no tags)

Success metric: Zero pickle-format models in production. All inference images pinned to digests.

### Phase 3: Inference Hardening (Week 5-6)

- Enforce: KV cache isolation for multi-tenant (cache_salt)
- Enforce: Disable prefix caching for confidential data
- Enforce: Tokenizer checksum validation
- Enforce: MIG for tenant-isolated workloads

Success metric: All multi-tenant inference has cache isolation. No prefix caching for sensitive data.

### Phase 4: Agentic Boundaries (Week 7-8)

- Enforce: Default-deny egress for agent namespaces
- Enforce: Per-agent tool allowlists via NetworkPolicy
- Enforce: Agent security contexts (non-root, read-only)
- Enforce: Token limits and request timeouts

Success metric: All agentic workloads have explicit tool boundaries. No default service accounts.

Real Talk: The best policy programs are boring. They make dangerous deployments impossible and let teams move faster because there are no debates about "is this safe?"

## 14. Real Deployment: Financial Services AI Platform

Let us stitch everything into one story.

### The Scenario

A bank deploys an AI-powered fraud detection model. It processes transaction data in real-time, flags suspicious activity, and can call internal APIs to enrich data.

Requirements:

- Model: Fine-tuned Llama for fraud scoring
- Serving: vLLM on GPU nodes
- Multi-tenant: Multiple business units share the cluster
- Agentic: Model can call internal enrichment APIs

### The Naive Version (What Goes Wrong)

- Model pulled from public Hugging Face with pickle format
- vLLM running 0.6.x (vulnerable to CVE-2025-32444)
- Prefix caching enabled for all tenants
- No cache salt between business units
- Agent can call any internal API (no NetworkPolicy)
- Using image tag`vllm:latest` instead of digest

What happens:

1. An attacker publishes a typosquatted model on Hugging Face
2. A junior engineer pulls it by mistake
3. Pickle deserialization executes code during model load
4. Attacker has RCE on the inference pod
5. No network policy means attacker can scan internal network
6. Meanwhile, Business Unit A's prompts leak to Business Unit B via cache timing

### The Guarded Version (Policy Stack)

Build time controls:

- Model converted to SafeTensors format
- Signed with Cosign, attestation stored
- Model source label:`huggingface.co/meta-llama`
- CI validates model format policy before merge

Deploy time controls (Kyverno):

- Blocks pickle format:`ai.model.format` must be safetensors
- Requires model source from approved orgs
- Blocks vLLM < 0.8.5, requires 0.8.5+
- Requires image digest, not tag
- Requires cache_salt for multi-tenant
- Blocks prefix caching for confidential tier

Runtime controls:

- NetworkPolicy: Default-deny egress
- NetworkPolicy: Agent can only reach enrichment-api.internal:443
- Pod Security: Non-root, read-only filesystem, dropped capabilities
- GPU: MIG-enabled nodes for tenant isolation

Monitoring:

- Prometheus alerts on policy violations
- Audit log of all tool calls
- Drift detection for label changes

### The Result

When the auditor asks "what stops an untrusted model from reaching production?":

1. Pickle format blocked at admission
2. Model source must be from approved Hugging Face orgs
3. Model signature verified against attestation
4. Even if all that fails, vLLM version check blocks vulnerable images

When the auditor asks "how do you prevent cross-tenant data leakage?":

1. cache_salt required per tenant
2. Prefix caching disabled for confidential data
3. MIG isolation on GPU nodes
4. NetworkPolicy prevents cross-namespace communication

This is not theory. This is what compliance teams expect for production AI.

## 15. Governance Metrics and Executive Takeaway

### Metrics That Matter

| Metric | What it measures | Target |
| --- | --- | --- |
| % models in SafeTensors format | Serialization safety | 100% |
| % inference pods on approved versions | CVE exposure | 100% |
| % multi-tenant with cache isolation | Side-channel risk | 100% |
| % agentic workloads with tool boundaries | Blast radius | 100% |
| # blocked deployments (30 days) | Policy effectiveness | Track trend |
| Mean time to detect policy drift | Runtime security | < 1 hour |

### Executive Summary

Policy-as-code for AI workloads is different from traditional Kubernetes security. Container image signing does not protect against backdoored model weights. Network policies for web apps do not understand agentic tool boundaries.

The practical response:

1. Map AI-specific risks: Pickle RCE, cache side-channels, tokenizer poisoning, agentic tool abuse
2. Deploy policies that understand models: Format enforcement, provenance attestation, version pinning
3. Isolate inference at multiple layers: Cache salt, MIG, NetworkPolicy
4. Treat agentic AI as a new workload class: Tool boundaries, topology enforcement, blast radius containment

If you want to scale AI safely, you need policy-as-code that covers the model layer, not just the container layer.

## 16. Closing

Kubernetes gave you the machinery to run AI at scale. Traditional K8s security gave you container hardening.

Neither one protects you from:

- A backdoored model that passes all container scans
- A cache that leaks prompts across tenants
- An agent that can call any API because there is no tool boundary

Kyverno and OPA can enforce AI-specific controls, but only if you write policies that understand AI-specific risks.

The patterns in this article are not aspirational. They are responses to real CVEs, published research, and documented attacks.

Start with one policy: Block pickle formats. Prove it works. Add version enforcement. Build cache isolation. Implement tool boundaries.

Your models deserve the same rigor as your code.
