---
title: "Building Privacy Preserving RAG with Homomorphic Encryption"
date: 2025-11-05T22:13:00.008+04:00
lastmod: 2025-12-07T09:45:44.619+04:00
slug: "building-privacy-preserving-rag-with"
tags:
  - "AI"
  - "ai security"
  - "Encrypted RAG"
  - "Secure RAG"
system: "AI"
sourceURL: "https://www.subhashdasyam.com/2025/11/building-privacy-preserving-rag-with.html"
---
## The Privacy Problem in Modern AI Systems

Imagine building a RAG (Retrieval-Augmented Generation) system for a healthcare provider. You ingest thousands of patient documents, generate embeddings, and store them in a vector database. Your system works beautifully until you realize those embeddings are a security nightmare waiting to happen.

Recent research has shown that vector embeddings aren't just abstract mathematical representations they leak information. A determined attacker with access to your database could reconstruct significant portions of the original text. Your " anonymized" medical records? Not so anonymous anymore.

This is the fundamental tension in modern AI: we need to compute on sensitive data, but we can't afford to expose it. Traditional encryption doesn't help once you decrypt data to compute on it, you've lost your protection. We need something better.

Enter homomorphic encryption: a cryptographic technique that lets you compute on encrypted data without ever decrypting it. Sounds like magic? It's actually production-ready math. And in this post, I'll show you how I built a fully encrypted RAG system that protects embeddings while maintaining searchability.

## Understanding the Attack Surface

Before diving into solutions, let's understand what we're protecting against. The security risks in RAG systems are more nuanced than traditional database breaches.

### What Are Vector Embeddings?

Vector embeddings are dense numerical representations of text, images, or other data. When you run "patient diagnosed with diabetes" through an embedding model, you get something like:

```
[0.234, -0.891, 0.445, ..., 0.123]  // 768 or 1024 dimensions

```

These vectors capture semantic meaning similar concepts have similar vectors. That's what makes them powerful for search: you can find relevant documents by comparing vector similarity. The distance between "diabetes diagnosis" and "blood sugar condition" is small, while the distance to "car insurance" is large.

The beauty of embeddings is that they compress complex semantic information into fixed-length vectors. The danger is that they compress too well they preserve semantic content in ways that can be exploited.

### The Security Risk

Here's the problem: embeddings preserve too much information. Recent research has demonstrated multiple attack vectors:

- Embedding Inversion Attacks: Given an embedding, attackers can reconstruct approximate original text with 60-80% accuracy using gradient-based optimization or trained inversion models. For medical records, this means attackers could recover patient names, diagnoses, and treatment details from "anonymized" vectors.
- Membership Inference: Attackers can determine if specific data was in the training set with high confidence. This is particularly dangerous for sensitive datasets where membership itself is private (e.g., identifying patients in a clinical trial).
- Attribute Inference: Extract specific sensitive attributes (names, social security numbers, medical conditions) from embeddings without full reconstruction. A 2023 study showed 85% accuracy in extracting personal identifiers from document embeddings.
- Nearest Neighbor Attacks: Even without direct access to embeddings, attackers can probe a RAG system with carefully crafted queries to infer information about stored documents through similarity patterns.

A database breach doesn't just expose metadata it exposes the semantic content of your entire corpus. And unlike encrypted database dumps that require cracking encryption, embeddings are ready to analyze.

### The Threat Model

Consider these scenarios:

- Healthcare: Patient records embedded for clinical decision support
- Legal: Privileged communications in a case management system
- Financial: Transaction narratives for fraud detection
- Enterprise: Confidential business documents in corporate search

In each case, a compromised vector database is a compliance nightmare and a potential GDPR/HIPAA violation. Traditional encryption (encrypt at rest, decrypt to search) offers no protection during query time.

## Homomorphic Encryption: Computing on Encrypted Data

Homomorphic encryption (HE) solves this by allowing computation on encrypted data. Think of it as a sealed glove box: you can manipulate objects inside without opening the box.

### The Paillier Cryptosystem

For our RAG system, I use Paillier encryption, which supports two operations on encrypted data:

Additive Homomorphism:

```
Encrypt(a) + Encrypt(b) = Encrypt(a + b)

```

Scalar Multiplication:

```
Encrypt(a) × k = Encrypt(a × k)

```

These two properties are exactly what we need to compute dot products (the basis of cosine similarity) on encrypted vectors:

```
Dot Product: v1 · v2 = v1[0]×v2[0] + v1[1]×v2[1] + ... + v1[n]×v2[n]

Encrypted: E(v1[0])×v2[0] + E(v1[1])×v2[1] + ... = E(v1 · v2)
```

We encrypt the stored vectors (v1), multiply by the plaintext query vector (v2), sum the results, and decrypt only the final similarity score. The database never sees the embeddings, and we never decrypt individual vectors.

### Security Guarantees

Paillier encryption is IND-CPA secure(Indistinguishable under Chosen-Plaintext Attack), meaning:

- An attacker with encrypted vectors cannot distinguish between encryptions of different plaintexts
- Breaking Paillier is as hard as factoring large composite numbers (RSA-hard)
- With 2048-bit keys, it's considered secure for decades

### The Trade-off

There's no free lunch. Homomorphic encryption comes with costs:

- Storage: 50-70x larger than plaintext (encrypted integers vs floats)
- Computation: 10-100x slower (public key operations are expensive)
- Complexity: More moving parts, careful key management

But for sensitive data, this trade-off is worth it. You're exchanging performance for mathematical guarantees that embeddings remain private.

## System Architecture: Building Encrypted RAG

Let's walk through the architecture of a production-ready encrypted RAG system.

### High-Level Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PDF Documents                                               │
│       ↓                                                      │
│  Text Extraction (pymupdf4llm)                               │
│       ↓                                                      │
│  Chunking (1500 chars, 200 overlap)                         │
│       ↓                                                      │
│  Embeddings (BGE-M3: 1024 dimensions)                       │
│       ↓                                                      │
│  L2 Normalization + Integer Scaling                         │
│       ↓                                                      │
│  Paillier Encryption (element-wise)                         │
│       ↓                                                      │
│  PostgreSQL Storage (BYTEA binary format)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

```

### Search Pipeline Overview

```text
┌─────────────────────────────────────────────────────────────┐│
                     SEARCH PIPELINE
                          │├─────────────────────────────────────────────────────────────┤│
                                                              ││
  User Query
                                                  ││
       ↓
                                                      ││
  Query Embedding (BGE-M3)
                                    ││
       ↓
                                                      ││
  Retrieve ALL Encrypted Vectors (PostgreSQL)
                ││
       ↓
                                                      ││
  For each encrypted vector:
                                 ││
    • Compute encrypted dot product (homomorphic)
            ││
    • Decrypt similarity score only
                          ││
       ↓
                                                      ││
  Sort by score, return top-k chunks
                         ││
       ↓
                                                      ││
  LLM Answer Generation (Ollama/qwen3:8b)
                    ││
                                                              │└─────────────────────────────────────────────────────────────┘
```

### Component Deep Dive

#### 1. Embedding Model: Local BGE-M3

I chose BGE-M3 (BAAI General Embedding, Multilingual) for several reasons:

- State-of-the-art accuracy: 72% retrieval performance on MTEB benchmark
- Local inference: No API calls, complete data sovereignty
- GPU acceleration: Auto-detects CUDA, 2-5x faster than CPU
- Reasonable dimensions: 1024-dim vectors (vs 768 or 1536)

Using local embeddings is critical for privacy you don't want to send sensitive text to external APIs. The model downloads once (~1GB) and runs entirely offline.

#### 2. Encryption Layer

The encryption pipeline involves three steps:

Normalization: Convert vectors to unit length (L2 norm = 1). This transforms cosine similarity into simple dot products:

```
cosine_similarity(v1, v2) = v1 · v2 / (||v1|| × ||v2||)

If ||v1|| = ||v2|| = 1, then:cosine_similarity(v1, v2) = v1 · v2
```

Scaling: Paillier works on integers, not floats. We scale by 10^7 to preserve precision:

```
[0.234, -0.891, 0.445] → [2340000, -8910000, 4450000]

```

Encryption: Encrypt each element with the Paillier public key:

```
encrypted_vector = [encrypt(val) for val in scaled_vector]

```

The result is a list of large integers (ciphertexts), each representing an encrypted dimension.

#### 3. Storage Strategy: PostgreSQL

Here's a controversial choice: I use PostgreSQL, not a vector database. Why?

Vector databases (ChromaDB, Pinecone, Weaviate) are useless here (for now until I figure out). They optimize for similarity search on plaintext vectors. But we can't do similarity search on encrypted data comparison operations aren't supported by Paillier HE.

Instead, search works like this:

- Retrieve ALL encrypted vectors from the database
- Compute similarities client-side using homomorphic operations
- Decrypt scores and sort

PostgreSQL is perfect for this because:

- Efficient binary storage: BYTEA columns store pickled encrypted vectors
- Batch operations:`executemany` inserts are 8-33x faster than ChromaDB
- Standard SQL: Easy filtering, metadata queries, joins
- Production-ready: ACID guarantees, replication, backups

The database is a storage layer, not a similarity engine. PostgreSQL excels at this role.

#### 4. Search Process

The search algorithm is surprisingly simple:

```python
def search(query_text, top_k=5):
    # 1. Generate query embedding (plaintext)
    query_vec = embedder.encode(f"query: {query_text}")
```

```
all_docs = db.get_all_chunks()

# 3. Compute encrypted similarities
scores = []
for doc in all_docs:
    encrypted_vec = pickle.loads(doc['encrypted_vector'])
    # Homomorphic dot product
    score = encrypted_dot_product(encrypted_vec, query_vec)
    scores.append((doc['id'], score))
# 4. Sort and return top-k
scores.sort(key=lambda x: x[1], reverse=True)
return scores[:top_k]

```

The magic happens in`encrypted_dot_product`:

```
def encrypted_dot_product(encrypted_v1, plaintext_v2):
    # Scale query vector
    scaled_v2 = scale_vector(normalize(plaintext_v2))
```

```
encrypted_sum = sum(enc_val * plain_val
                    for enc_val, plain_val
                    in zip(encrypted_v1, scaled_v2))
# Decrypt final sum only
return decrypt(encrypted_sum) / SCALE_FACTOR**2

```

No intermediate decryption. No plaintext vectors in the database. Just encrypted computation, all the way through.

## Performance Optimization: Making It Practical

Raw homomorphic encryption is slow. To make this system usable, I implemented aggressive optimizations.

### Three-Stage Ingestion Pipeline

Stage 1: Batch Embeddings (3-5x speedup)

Instead of encoding chunks one-by-one:

```
# Slow: sequential
embeddings = [embedder.encode(chunk) for chunk in chunks] 
```

```
# Fast: batchingembeddings = embedder.encode(chunks, batch_size=12)
```

BGE-M3's batch inference amortizes model loading and leverages tensor parallelism.

Stage 2: Parallel Encryption (7-8x speedup)

Python's multiprocessing encrypts vectors in parallel:

```
from multiprocessing import Pool

with Pool(processes=cpu_count()) as pool:    encrypted_vectors = pool.map(encrypt_vector, embeddings)
```

Each CPU core encrypts a subset of vectors simultaneously. On an 8-core machine, this is a game-changer.

Stage 3: Batch Database Inserts (8-33x speedup)

PostgreSQL's`executemany` is vastly faster than sequential inserts:

```
# Prepare records
records = [(id, source, chunk_id, text, encrypted_vec, model, dim)
           for ...zip everything...]

# Single batch insertcursor.executemany("""    INSERT INTO encrypted_chunks    (id, source, chunk_id, full_text, encrypted_vector,     embedding_model, embedding_dimension)    VALUES ($1, $2, $3, $4, $5, $6, $7)""", records)
```

This is where PostgreSQL shines over ChromaDB native batch support is built-in.

### Search Optimization

For search, the bottleneck is computing encrypted dot products. I use NumPy's vectorized operations:

```
# Slow: Python loop
encrypted_sum = 0
for enc_val, plain_val in zip(encrypted_v1, plaintext_v2):
    encrypted_sum += enc_val * plain_val 
```

```
# Fast: NumPy dot product (8x faster) 
```

```
encrypted_sum = np.dot(encrypted_v1, plaintext_v2)
```

The`phe` library (python-paillier) supports NumPy arrays, so this just works. 8x speedup for free.

### Performance Benchmarks

Here's how the system performs on my test setup (8-core CPU, 32GB RAM):

| Operation | Plaintext | Encrypted | Overhead |
| --- | --- | --- | --- |
| Embed 1 chunk | 8ms | 500ms | 60x |
| Encrypt 1 vector | N/A | 2s | N/A |
| Store 100 chunks | 0.5s | 1.2s | 2.4x |
| Search 100 docs | 5ms | 200ms | 40x |
| Storage (1024-dim) | 4KB | 292KB | 73x |

Key takeaway: Encryption adds 40-60x latency overhead, but with optimizations, we keep search under 300ms for 100 documents. For sensitive data use cases, this is acceptable.

### Scalability Considerations

For large-scale deployments:

- Horizontal scaling: Shard encrypted vectors across multiple PostgreSQL instances
- Approximate search: Use locality-sensitive hashing (LSH) on encrypted vectors to skip similarity computation for unlikely matches (requires careful cryptographic analysis)
- Caching: Cache decrypted similarity scores (with TTL) for frequently accessed queries
- Hardware: Use GPUs for embedding generation, CPUs for encryption (embarrassingly parallel)

## Security Model: What's Protected and What's Not

Let's be honest about the security guarantees.

### What's Protected ✅

- Embeddings at rest: Database compromise doesn't expose vector semantics
- Embedding inversion attacks: Encrypted ciphertexts leak no information about original text
- Passive database observers: Even with read access, attackers see only encrypted blobs

### What's NOT Protected ❌

- Query privacy: Query embeddings are plaintext during search (required for homomorphic dot product)
- Access patterns: Which documents are retrieved is visible to the database
- Timing attacks: Computation time might leak information about similarity scores
- Key compromise: If the private key is stolen, all encrypted vectors can be decrypted

### Production Hardening

For real-world deployments:

Key Management:

- Store private keys in Hardware Security Modules (HSM) or cloud KMS
- Implement key rotation (re-encrypt all vectors periodically)
- Never log or transmit private keys

Access Control:

- Separate encryption keys per tenant in multi-tenant systems
- Implement row-level security in PostgreSQL
- Audit all decryption operations

Operational Security:

- Use constant-time operations to prevent timing attacks
- Add obfuscation (dummy queries) to hide access patterns
- Monitor for anomalous query patterns

Compliance:

- Document threat model for compliance audits (GDPR, HIPAA)
- Implement data retention policies with encrypted backups
- Provide cryptographic proof of data protection

## Getting Started: Run It Yourself

Want to try it? Here's how to get the system running in under 10 minutes.

### Prerequisites

- Python 3.8+
- Docker & Docker Compose
- Ollama (for LLM answer generation)

### Quick Setup

1. Clone and install dependencies:

```bash
git clone https://github.com/subhashdasyam/encrypted-rag
cd encrypted-rag
pip install -r requirements.txt

```

2. Start PostgreSQL:

```
docker compose up -d

```

This spins up PostgreSQL 17 with pgvector extension (unused but available for future hybrid approaches).

3. Configure embeddings (in`config.py`):

```
# Use local BGE-M3 (recommended)
EMBEDDING_TYPE = "local"
# EMBEDDING_TYPE = "ollama"OLLAMA_HOST = "http://localhost:11434"EMBEDDING_MODEL = "qwen3-embedding:0.6b"
```

4. Ingest documents:

```
# Add PDFs to documents/
cp your-sensitive-data.pdf documents/

python ingest.py
```

This extracts text, generates embeddings, encrypts vectors, and stores in PostgreSQL. Progress bars show each stage.

5. Search:

```
# Interactive mode
python search.py

python search.py "What is homomorphic encryption?"
```

Search computes encrypted similarities and generates LLM answers using Ollama.

### Configuration Options

Embedding model:

- `local`: BGE-M3, 1024-dim, offline, GPU-accelerated
- `ollama`: Flexible models via Ollama API

Encryption parameters:

- `KEY_SIZE = 1024`: Fast for development
- `KEY_SIZE = 2048`: Recommended for production
- `KEY_SIZE = 3072`: Maximum security (slower)

Database:

- Connection via`.env` file (port, credentials, host)
- Automatic schema initialization via`init.sql`
- Metadata tracking for embedding model compatibility

## Use Cases and Future Directions

### When to Use Encrypted RAG

This system makes sense when you're in one of these situations:

- Healthcare and Medical Research: Patient data is highly regulated and sensitive. A hospital deploying RAG for clinical decision support can't risk exposing patient embeddings in a database breach. The performance overhead is acceptable when weighed against HIPAA violations and patient privacy.
- Legal and Compliance: Law firms handling privileged attorney-client communications need absolute confidentiality. Encrypting case document embeddings ensures that even cloud database administrators can't access case details. Many jurisdictions require demonstrable encryption for sensitive legal data.
- Financial Services: Transaction narratives, fraud investigation notes, and customer interactions contain PII and financial details. Banks and fintech companies need both searchability and encryption to comply with PCI-DSS and financial privacy regulations.
- Enterprise Confidential Data: M&A discussions, trade secrets, unreleased product specs companies have plenty of highly confidential documents that would cause competitive harm if leaked. Encrypted RAG lets employees search this data without exposing it to infrastructure teams or cloud providers.

This approach makes less sense when:

- Data is public or low-sensitivity: Open-source documentation, marketing content don't need the overhead
- Sub-10ms latency is critical: Real-time recommendation engines can't tolerate encryption overhead
- Infrastructure is physically secured: If you control hardware and trust your ops team, the threat model may not justify complexity

### Real-World Deployment Considerations

If you're planning production deployment:

Cost Analysis: Encrypted search is 40-60x slower, requiring more compute:

- 3-5x more CPU cores for parallel encryption
- 50-70x more storage for encrypted vectors
- Additional infrastructure for key management (HSM/KMS)

At scale, infrastructure costs could jump from $500/month to $2000/month. But compare that to the average data breach cost ($4.5M according to IBM's 2024 report), and the ROI is clear.

Operational Complexity: Key management requires:

- Key rotation policies
- Backup and disaster recovery
- Monitoring decryption operations
- Specialized security expertise

User Experience: 200ms search latency is imperceptible for most applications, but won't work for real-time autocomplete or high-frequency systems. Know your latency requirements first.

### Future Research Directions

- Query Encryption: Use Functional Encryption or multi-key Paillier to encrypt query embeddings. Challenge: FE schemes are still research-grade. Potential: Inner Product FE could enable fully encrypted search with only scores decrypted.
- Approximate Encrypted Search: Combine LSH, tree-based indexing, or hierarchical clustering to prune search space before computing similarities. Current research in Searchable Encryption shows promise.
- Secure Multi-Party Computation: Split private keys across multiple parties (database provider, app server, client). Decryption requires cooperation, preventing any single entity from accessing embeddings.
- Hardware Acceleration: FPGAs or ASICs for Paillier operations could provide 10-100x speedups, dropping overhead from 40-60x to 2-5x.
- Hybrid Plaintext/Encrypted: Store both formats use pgvector for fast approximate search (top-100), then refine with encrypted similarity. Reduces security but gains 10-100x speedup.
- Differential Privacy: Add calibrated noise to embeddings before encryption, providing statistical privacy even if encryption breaks. Defense-in-depth against future cryptographic vulnerabilities.

## Conclusion: Privacy-Preserving AI is Here

Building this system taught me something important: privacy-preserving machine learning isn't a research curiosity anymore it's practical.

Yes, encrypted RAG is slower than plaintext. Yes, it's more complex. But for sensitive data, the math is undeniable: you can compute on encrypted embeddings without ever exposing them. That's a powerful guarantee.

The performance overhead (40-60x) sounds scary, but context matters. If plaintext search takes 5ms and encrypted search takes 200ms, both are fast enough for most applications. And that 200ms buys you cryptographic guarantees that no amount of access control or audit logs can provide.

As AI systems handle increasingly sensitive data medical records, financial transactions, personal communications we need architectures that protect privacy by default. Homomorphic encryption offers a path forward.

The code is open source. The techniques are proven. The infrastructure is production-ready. If you're building RAG systems for sensitive data, consider giving encrypted search a try.

Your embeddings will thank you.

---

## Resources
