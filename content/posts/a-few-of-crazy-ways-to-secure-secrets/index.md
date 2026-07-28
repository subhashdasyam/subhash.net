---
title: "A Few of the Crazy Ways to Secure Secrets on Kubernetes / OpenShift"
date: 2025-06-18T20:36:00.003+04:00
lastmod: 2025-06-18T20:36:39.581+04:00
slug: "a-few-of-crazy-ways-to-secure-secrets"
tags:
  - "Container"
  - "Container Secrets"
  - "Kubernetes"
  - "Kubernetes Security"
  - "Openshift"
system: "Container"
sourceURL: "https://www.subhashdasyam.com/2025/06/a-few-of-crazy-ways-to-secure-secrets.html"
---
Injecting sensitive secrets like API keys, credentials, and tokens into running containers presents significant security challenges that go far beyond the basic Kubernetes Secret mechanisms. While standard approaches like environment variables and mounted files work functionally, they often expose secrets too broadly, making them visible to any process in the container or even to operators who exec into pods.

The goal of advanced secret injection is ambitious: deliver a secret only to a specific target process and its child processes, without exposing it to other processes or containers, never writing it to disk, achieving this without elevated privileges, and supporting secret rotation at runtime without pod restarts. This article explores the creative, sometimes "crazy" techniques that security-conscious organizations use to meet these stringent requirements.

## The Problem with Standard Secret Injection

Before diving into advanced techniques, it's crucial to understand why the standard Kubernetes approaches fall short for high-security environments.

### Environment Variables: The Obvious Target

Environment variable secrets are convenient but fundamentally insecure for our use case. When you set a secret as an environment variable, it becomes visible to:

- Any process running in the container via simple commands like`env` or`export`
- Child processes that inherit the parent's environment
- Attackers who gain shell access and can read`/proc/ /environ`
- Debugging sessions where environment variables might be logged

Even worse, environment variables can inadvertently appear in application logs, crash dumps, or debugging output. The broad visibility violates the principle of least privilege we're trying to achieve.

### Secret Volumes: Better but Not Bulletproof

Mounting Kubernetes Secrets as files improves the situation by avoiding process environment pollution. The secrets live in memory (when using tmpfs) and can have restricted file permissions. However, they still present challenges:

- Any process in the same container running as the authorized user can read the file
- Root users can override file permissions
- The secret exists as a discoverable file in the filesystem
- Multiple containers in a pod can potentially access shared volumes

While Secret volumes are the recommended Kubernetes practice and support automatic rotation when the Secret object updates, they don't achieve true process-level isolation.

## Advanced Secret Injection Techniques

### 1. Custom Init Process with Memory Injection

One of the most elegant approaches involves replacing the container's normal entrypoint with a custom init process that securely fetches and injects secrets directly into the target application's memory space.

How it works: The init program runs as PID 1 when the container starts. It retrieves the secret from an external source (like HashiCorp Vault, AWS Secrets Manager, or the Kubernetes API) and then spawns the actual application process with the secret delivered through controlled channels.

Secret Delivery Methods:

Environment Variable with Cleanup: The init sets the secret as an environment variable for the child process only, then immediately execs the application. The secret was never present in the container's initial environment and can be programmatically wiped from memory after the application reads it.

File Descriptor Passing: A more sophisticated approach involves creating an anonymous in-memory file using`memfd_create` or`O_TMPFILE`, writing the secret to this file descriptor, and passing it to the child process. The file is never linked to the filesystem, making it invisible to other processes. The application reads from the known file descriptor number and immediately closes it, causing the secret to evaporate from memory.

In-Memory IPC Channels: The init can create a pipe, fork the child process, send the secret through the pipe, and close it. This creates a transient communication channel that exists only during the handoff.

Real-World Implementation: The open-source tool`secrets-init` by DoiT International exemplifies this approach. It acts as a minimal init system that can retrieve secrets from cloud secret managers and launch applications with those secrets injected into their environment. The tool intercepts placeholder environment variables (like AWS Secrets Manager ARNs), fetches the actual secret values at runtime, and replaces the placeholders when spawning the child process.

Advantages:

- Secrets are fetched at the last possible moment
- No privileged operations required
- Works with any programming language
- Secrets don't appear in standard inspection paths
- Prevents casual exposure through`kubectl exec`

Limitations:

- Implementation complexity increases
- Secret rotation requires additional mechanisms
- Applications may need modification to handle memory cleanup

### 2. Process Supervisors with Secret Injection

Tools like`dumb-init` or`tini` are commonly used as PID 1 in containers for zombie process reaping and signal forwarding. While they don't provide secret handling natively, they can be combined with wrapper scripts to create secure injection patterns.

Implementation Pattern: Use`dumb-init` as PID 1 to launch a wrapper script as the child process. The wrapper script fetches secrets, sets up the injection mechanism (environment, file descriptor, or IPC), and then execs the real application. This approach leverages battle-tested init systems while adding custom secret handling.

Benefits:

- Separates secret handling from process supervision concerns
- Ensures proper signal handling and zombie reaping
- Creates clear separation between secret setup and application execution
- Exec'd debug shells become siblings of the app, not inheriting its environment

### 3. Memory-Backed Volumes with Sidecar Agents

This approach uses Kubernetes`emptyDir` volumes with`medium: Memory` to create tmpfs filesystems that exist only in RAM. A sidecar container or init container writes secrets to files in this memory-backed volume, which the main application reads.

How it works:

- An init container fetches the secret and writes it to a file in the shared tmpfs volume
- The main application container reads the secret from the known file path
- A sidecar can continuously update the file for secret rotation
- The volume is mounted only into containers that need access

HashiCorp Vault Integration: Vault's Agent Injector is a prime example of this pattern. It automatically injects an init container to provide initial secret data and a sidecar agent that updates a shared memory volume with fresh secret values over time. Applications simply read files from`/vault/secrets/` whenever they need credentials.

Security Considerations:

- Secrets never touch persistent storage
- Other containers can be excluded from the volume mount
- File permissions can restrict access within the container
- Supports automatic rotation through sidecar updates

Limitations:

- Any process in the container with appropriate permissions can read the file
- Secrets exist in a discoverable location in the filesystem
- Vulnerable to container compromise scenarios

### 4. Sidecar-Based IPC Secret Delivery

For maximum isolation, sidecars can deliver secrets through private inter-process communication channels like named pipes, Unix domain sockets, or localhost connections.

Named Pipe (FIFO) Pattern: A sidecar creates a named pipe file on a shared tmpfs volume. The application opens the FIFO for reading and blocks until data arrives. The sidecar pushes the secret through the pipe and closes it. Because it's a pipe, the data doesn't persist—once read, it's gone.

```
# Sidecar creates and writes to pipe
mkfifo /tmp/secret-pipe
echo "secret-value" > /tmp/secret-pipe

# Application reads once and pipe data disappears
secret=$(cat /tmp/secret-pipe)

```

Unix Domain Socket Pattern: The sidecar listens on a Unix domain socket placed in a directory with restricted permissions. The application connects to request the secret, receives it over the socket, and closes the connection. Socket file permissions can prevent unauthorized access.

Localhost TCP Pattern: Similar to domain sockets but using 127.0.0.1 networking. The sidecar runs a small HTTP or gRPC server that serves secrets on request. This pattern is used by many secret management tools but requires careful authentication since all containers in a pod share the network namespace.

Advanced IPC Features:

- Socket credential checking using`SO_PEERCRED` to verify the connecting process
- One-time use channels that self-destruct after secret delivery
- Authentication tokens for additional security layers
- Persistent connections for streaming secret updates

Advantages:

- Secrets never exist at rest in the filesystem
- True process-level isolation possible
- Natural support for secret rotation
- Flexible communication patterns

Challenges:

- Higher implementation complexity
- Potential race conditions with multiple processes
- Coordination and orchestration requirements
- Need for authentication mechanisms

### 5. Kernel-Level Isolation Techniques

For the highest levels of security, some organizations turn to kernel-level features like Linux keyrings and namespace isolation.

Linux Kernel Keyrings: The Linux kernel provides a key retention service (`keyctl`) that stores secrets in unswappable kernel memory. Keys can be made available only to processes with appropriate keyring handles or user credentials.

```
# Store secret in process keyring
keyctl add user mysecret "secret-value" @p

# Application retrieves secret
secret=$(keyctl pipe $(keyctl search @p user mysecret))

```

Keyring Security Model:

- Secrets stored in kernel memory, not user-space
- Each container gets its own keyring namespace (in modern systems)
- Keys can have access controls and expiration times
- Root access doesn't automatically grant key access across namespaces

Container Compatibility Issues: Many container runtimes block the`keyctl` system call entirely due to historical security concerns. Docker's default seccomp profile prevents keyctl usage, and similar restrictions exist in Kubernetes environments. Past vulnerabilities allowed malicious containers to brute-force key IDs and extract secrets from other containers.

Other Kernel Isolation:

- Mounting`/proc` with`hidepid=2` to prevent process information disclosure
- SELinux/AppArmor policies for fine-grained access control
- User namespace separation within containers
- Memory encryption technologies like Intel SGX

Practical Limitations: These kernel-level approaches often require privileged containers or modified security policies, which many Kubernetes environments don't allow. They're powerful in theory but complex to implement safely in practice.

## Secret Rotation Strategies

Different injection methods vary significantly in their support for runtime secret rotation:

Custom Init Approaches: Single-shot injection methods struggle with rotation since secrets are fetched once at startup. Applications must implement their own refresh logic or be designed to handle external update signals.

Memory Volume + Sidecar: This approach excels at rotation. Sidecar agents can update files whenever new secret values become available. Vault Agent can send SIGHUP signals to notify applications of changes. Kubernetes Secret volumes automatically update when the Secret object is modified.

Sidecar IPC: Request/response protocols naturally serve the latest secret on each request. Push-based protocols can stream updates over persistent connections. Sidecars can also terminate existing connections to force clients to reconnect and fetch new secrets.

Kernel Keyrings: Keys can be updated in place or replaced with new versions. Applications must actively fetch updated keys, often triggered by expiration timeouts or external signals.

## Comparative Analysis

| Approach | Process Isolation | Disk Writes | Privileges | App Complexity | Rotation Support |
| --- | --- | --- | --- | --- | --- |
| Environment Variables | Poor | No | None | Very Low | Poor |
| Secret Volumes (tmpfs) | Moderate | No | None | Low | Excellent |
| Custom Init | Excellent | No | None | Low-Medium | Poor |
| Process Supervisors | Excellent | No | None | Low-Medium | Poor |
| Memory Volumes + Sidecar | Good | No | None | Low | Excellent |
| Sidecar IPC | Excellent | No | None | Medium | Excellent |
| Kernel Keyrings | Excellent | No | Limited* | High | Good |

*Limited privileges may be needed to enable keyctl in containers

## Real-World Implementation Recommendations

For most organizations, a layered approach provides the best balance of security and practicality:

Baseline Security (Good for most use cases):

- Use Vault Agent Injector or External Secrets Operator with tmpfs volumes
- Run containers as non-root with restricted security contexts
- Implement short-lived credentials with automatic rotation
- Use separate users for applications and debugging processes

High Security (For sensitive environments):

- Combine custom init processes with memory injection techniques
- Implement sidecar IPC for truly isolated secret delivery
- Use one-time communication channels that self-destruct after use
- Add application-level secret scrubbing after initial read

Maximum Security (For zero-trust environments):

- Layer multiple techniques (init + IPC + memory volumes)
- Implement process-level authentication for secret access
- Use hardware security modules or enclaves where possible
- Design applications to minimize secret lifetime in memory

## Practical Considerations

When implementing advanced secret injection, consider these operational factors:

Development Complexity: More sophisticated techniques require additional development and testing effort. Teams must balance security requirements against implementation complexity and maintenance overhead.

Debugging and Troubleshooting: Highly isolated secrets can make debugging more difficult. Consider implementing debug modes or logging capabilities that don't expose the secrets themselves.

Container Image Design: Some techniques require specific tools or libraries in the container image. Plan for image size and dependency management implications.

Kubernetes Cluster Policies: Verify that your chosen techniques work within your cluster's security policies. Some approaches may be blocked by Pod Security Standards or admission controllers.

## Conclusion

Securing secrets in Kubernetes requires moving beyond the basic environment variable and volume mounting approaches. While these "crazy" techniques may seem complex, they address real security requirements in environments where secret exposure could have serious consequences.

The key is matching the technique to your threat model and operational requirements. A financial services application handling customer data might justify the complexity of sidecar IPC with one-time channels, while a development environment might find tmpfs volumes with proper permissions sufficient.

Remember that security is a layered approach. Even the most sophisticated secret injection technique can't protect against a fundamentally compromised application or cluster. Combine these techniques with proper access controls, network policies, monitoring, and incident response procedures for comprehensive security.

The "craziest" part about these approaches isn't their complexity it's how they demonstrate that with creativity and careful engineering, even the most stringent security requirements can be met within the constraints of container orchestration platforms. As secret management continues to evolve, these techniques will likely become more standardized and accessible, making robust secret security the norm rather than the exception.
