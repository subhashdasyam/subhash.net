---
title: "Container Runtime Architecture: The Engine Room of DigiLand - PART 3"
date: 2025-05-21T22:16:00.004+04:00
lastmod: 2025-05-21T22:23:13.796+04:00
slug: "container-runtime-architecture-engine"
tags:
  - "container runtime"
  - "container-series"
  - "crun"
  - "docker"
  - "podman"
  - "runc"
system: "container runtime"
sourceURL: "https://www.subhashdasyam.com/2025/05/container-runtime-architecture-engine.html"
---
Before starting this please cover PART 2

A week after their deep dive into Linux fundamentals, Maya found Connie in DigiLand's operations center, carefully examining logs from their container platform.

"The containers are running much better since we optimized our resource limits," Maya observed. "But I've been wondering about something. When I run docker run, what exactly happens between hitting Enter and seeing the container start? What are these 'runtimes' you mentioned, and what's the difference between Docker, containerd, and runc?"

Connie smiled. "You're asking about the engine room now! Remember how we explored the fundamental technologies behind containers? Now you want to understand how those pieces are coordinated by the runtime architecture."

"Exactly," Maya nodded. "I know Docker makes it easy to use containers, but I keep hearing terms like 'OCI', 'containerd', and 'CRI-O'. Are these alternatives to Docker, or something else entirely?"

"Let's take another tour," Connie suggested. "This time, we'll go to the engine room of our Container Hotel and see how all the machinery works together to create and run containers."

### The Container Runtime Control Center

The next morning, Connie led Maya to a different area of DigiLand's operations facility a room filled with monitors displaying container operations across the park.

"This is our runtime control center," Connie explained. "It's where all the container operations are coordinated. Before we dive in, let's get a high-level view of the container runtime architecture."

Connie pointed to a large diagram on the wall:

The Container Runtime Architecture Layers

"Think of container runtimes as a series of layers, each with specific responsibilities," Connie explained. "At the top, we have the tools like Docker that users interact with. At the bottom, we have components that talk directly to the Linux kernel using those namespace and cgroup features we discussed earlier."

"So Docker isn't the only component involved?" Maya asked.

"Not at all! Docker was the pioneer, but the industry has evolved toward a more modular approach. Let's start by understanding why standards became so important."

### OCI: The Universal Language of Containers

Connie led Maya to an area marked "Standards Division," where several screens displayed specifications and documentation.

"Before we look at the specific runtimes, we need to understand the standards they follow," Connie said. "The Open Container Initiative, or OCI, is the foundation of the modern container ecosystem."

The OCI Standards Room

### The Need for Standards: Avoiding Proprietary Lock-in

"When containers first became popular through Docker, everything was integrated into a single tool," Connie explained. "But as containers became critical infrastructure, the industry realized the danger of having container formats and execution controlled by a single company."

"Like how we wouldn't want DigiLand's roller coaster safety systems to only work with one vendor's proprietary parts," Maya suggested.

"Exactly! In 2015, the Open Container Initiative was formed to create open standards that everyone could implement. This ensured containers would work consistently across different platforms and vendors."

### The Runtime Specification: How Containers Should Run

Connie pointed to the first specification document on the screen.

"The OCI Runtime Specification defines exactly how a container runtime should execute containers. It specifies:

The container's filesystem bundle structure

The configuration schema (in JSON format)

The runtime environment for the containerized application

The lifecycle operations (create, start, stop, delete)

"It's like standardizing how all hotel room keys work, so any guest can unlock their assigned room regardless of who manufactured the lock," Connie added.

She showed Maya a snippet of an OCI runtime configuration:

```
{
  "ociVersion": "1.0.2",
  "process": {
    "terminal": true,
    "user": {
      "uid": 0,
      "gid": 0
    },
    "args": [
      "sh"
    ],
    "env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "TERM=xterm"
    ],
    "cwd": "/",
    "capabilities": {
      "bounding": [
        "CAP_AUDIT_WRITE",
        "CAP_KILL",
        "CAP_NET_BIND_SERVICE"
      ]
    }
  },
  "root": {
    "path": "rootfs",
    "readonly": false
  },
  "hostname": "container",
  "mounts": [
    {
      "destination": "/proc",
      "type": "proc",
      "source": "proc"
    }
  ],
  "linux": {
    "namespaces": [
      {
        "type": "pid"
      },
      {
        "type": "network"
      },
      {
        "type": "mount"
      }
    ]
  }
}

```

"This configuration defines everything about how the container should be executed from the namespaces it uses to the capabilities it's granted," Connie explained.

### The Image Specification: Standard Container Packaging

"The second critical standard is the OCI Image Specification," Connie continued, pointing to another document. "It defines exactly how container images should be structured, including:

The image manifest (metadata about the image)

The layer format (those filesystem layers we talked about)

The content-addressable storage approach

"It's like standardizing how luggage is packed and labeled, so it can be handled by any airline or hotel," Connie explained.

She showed Maya an example image manifest:

```
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:1234567890abcdef...",
    "size": 7023
  },
  "layers": [
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:abcdef1234567890...",
      "size": 32654
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:fedcba0987654321...",
      "size": 16724
    }
  ]
}

```

"The manifest lists each layer by its content hash, which ensures integrity and enables de-duplication," Connie noted.

### The Distribution Specification: Moving Images Around

"The third key standard is the OCI Distribution Specification," Connie said, showing the final document. "It defines the API for distributing container images between registries and clients."

"So this is how images get from Docker Hub to our systems?" Maya asked.

"Exactly! It standardizes operations like:

Pulling and pushing images

Listing available tags

Checking if an image exists

Content verification through digests

"It's like standardizing how parcels are shipped between hotels in a chain, so any delivery service can transport them," Connie explained.

"These three specifications ensure that containers work the same way regardless of which tools you use to build, store, or run them. Now let's see how these standards are implemented in actual runtimes."

### Low-Level Runtimes: The Container Execution Engine

Connie guided Maya to another section of the control room, filled with monitors showing detailed system calls and container lifecycle events.

"This is where the rubber meets the road," Connie said. "Low-level container runtimes like runc and crun are responsible for actually creating and running containers using the Linux kernel features we explored last time."

The Low-Level Runtime Control Station

### OCI Runtime Implementation: runc

"The reference implementation of the OCI Runtime Specification is called runc," Connie explained. "It's a relatively small tool with a focused purpose: take an OCI bundle (a config.json file plus a root filesystem) and use the Linux kernel features to run it as a container."

She demonstrated with a command:

```
# Create a bundle directory
$ mkdir -p my-container/rootfs

# Extract a root filesystem into it
$ tar -xf alpine-rootfs.tar -C my-container/rootfs

# Create a config.json file
$ cd my-container
$ runc spec

# Run the container
$ sudo runc run my-alpine-container

```

"When we call runc, it reads the config.json file, sets up the namespaces, configures the cgroups, prepares the filesystem according to the OCI spec, and then executes the process inside the container," Connie explained. "It's the component that directly interfaces with the Linux kernel."

### Alternative Implementations: crun and others

"While runc is the reference implementation, there are others," Connie continued. "For example, crun is written in C instead of Go, making it faster and more lightweight. It's particularly popular in systems focused on efficiency, like Podman."

She showed Maya a performance comparison graph showing crun starting containers slightly faster than runc.

"There are also specialized runtimes for different use cases," Connie added. "Kata Containers uses lightweight VMs for stronger isolation, gVisor provides additional security layers, and there are even low-level runtimes for Windows and other platforms."

"So runc and its alternatives are the components that actually create the containers using the Linux features we learned about," Maya summarized.

"Exactly! But they're designed to be simple, focused tools. That's why we need higher-level runtimes to manage the broader container lifecycle."

### High-Level Runtimes: Container Lifecycle Management

Next, Connie led Maya to a different section with broader monitoring systems showing multiple containers across different hosts.

"Low-level runtimes like runc are powerful but limited," Connie explained. "They handle one container at a time and don't manage images, networking, or higher-level features. That's where high-level runtimes come in."

The High-Level Runtime Management System

### containerd: The Container Supervisor

"The most widely used high-level runtime is containerd," Connie said, pointing to a central display. "It was originally part of Docker but was extracted as a separate project to provide a stable, minimal container runtime that could be used by multiple container engines."

"What exactly does containerd do that runc doesn't?" Maya asked.

"containerd handles the complete container lifecycle," Connie explained. "It:

Manages the container throughout its lifecycle (create, start, stop, pause, resume, delete)

Pulls images from registries and unpacks them locally

Manages storage of images and container data

Sets up networking (with plugins)

Provides a gRPC API for clients

"If runc is like a single room attendant who prepares one specific hotel room, containerd is like the housekeeping manager who coordinates all room preparation, maintenance, and cleanup across the hotel," Connie explained.

She showed Maya a diagram of containerd's architecture:

### containerd's Core Components

"containerd has several key components:

Content Store: Content-addressable storage for image layers and other data

Metadata Store: Database of images, containers, and other metadata

Snapshot Service: Manages filesystem snapshots for containers

Runtime Service: Interfaces with the low-level runtime (runc)

Image Service: Pulls, unpacks, and manages container images

Metrics: Collects and exposes performance metrics

"When you start a container with containerd, it prepares the rootfs using the snapshot service, creates an OCI bundle, and then calls runc to actually run the container," Connie explained.

### CRI-O: Kubernetes-Focused Runtime

"Another important high-level runtime is CRI-O," Connie continued, pointing to a different display. "It was designed specifically for Kubernetes, implementing its Container Runtime Interface (CRI)."

"So CRI-O is like containerd, but just for Kubernetes?" Maya asked.

"That's a good way to think about it," Connie nodded. "While containerd aims to be a general-purpose container runtime, CRI-O is focused specifically on being the best runtime for Kubernetes. It still uses the same OCI standards and calls runc (or another OCI-compatible runtime) to execute containers."

Connie showed Maya a comparison:

```
Feature                 | containerd         | CRI-O
------------------------|--------------------|-----------------
Primary focus           | General purpose    | Kubernetes only
Image format            | OCI and Docker     | OCI and Docker
Low-level runtime       | runc (default)     | runc (default)
Designed for            | Multiple clients   | Kubernetes CRI
History                 | Extracted from     | Built from scratch
                        | Docker             | for Kubernetes

```

"Both containerd and CRI-O follow the same OCI standards, so containers run the same way regardless of which one you use," Connie noted. "The differences are more about scope, API design, and integration with other systems."

### Container Engines: The User Interface Layer

For the final part of the tour, Connie took Maya to a section where operators were actively managing containers through various command-line interfaces.

"We've seen the low-level runtimes that execute containers and the high-level runtimes that manage their lifecycle," Connie said. "Now let's look at the top layer: the container engines that users actually interact with."

The Container Engine Control Room

### Docker Engine: The Original Container Platform

"Most people interact with containers through Docker," Connie explained. "The Docker Engine includes:

The Docker CLI that users interact with

The Docker daemon (dockerd) that processes commands

APIs for remote control and automation

Tools for building, sharing, and running containers

"When you run 'docker run', the Docker daemon processes your command, uses containerd to prepare and manage the container, which in turn calls runc to create the actual container using Linux kernel features," Connie explained.

She showed Maya the flow of a typical Docker command:

```
docker run nginx
  ↓
dockerd (Docker daemon)
  ↓
containerd (High-level runtime)
  ↓
runc (Low-level runtime)
  ↓
Linux kernel (namespaces, cgroups, etc.)

```

"The great thing about this layered approach is that each component has a clear, focused responsibility," Connie noted. "Docker handles the user experience, containerd manages the container lifecycle, and runc executes the containers according to the OCI standard."

### Alternative Engines: Podman and Others

"While Docker is the most popular container engine, there are alternatives," Connie continued. "Podman is particularly interesting because it uses a different architecture it doesn't require a daemon running as root."

"How does that work?" Maya asked.

"Podman uses the same OCI standards but operates in a daemonless model," Connie explained. "It communicates directly with the container runtime and can run containers as a regular user through user namespaces."

She showed Maya a simplified Podman command flow:

```
podman run nginx
  ↓
libpod (Podman's library)
  ↓
conmon (Container monitor process)
  ↓
runc or crun (Low-level runtime)
  ↓
Linux kernel

```

"Podman's commands are even compatible with Docker's, so users can often switch between them without changing their workflows," Connie added.

### Container Images: The Blueprint for Containers

For the final stop, Connie took Maya to a section focused on container images and registries.

"We've talked about the runtimes that execute containers, but we haven't discussed the images they run in detail," Connie said. "Container images are the blueprints from which containers are created."

The Container Registry and Image Management System

### OCI Image Structure: Layers, Manifests, and Configuration

"OCI-compliant container images consist of three main components," Connie explained:

Layers: The filesystem layers we explored last time

Manifest: Metadata describing the image's layers and configuration

Configuration: Runtime settings for the container

"When you pull an image, you're actually downloading a manifest and a set of layers," Connie said, showing Maya the structure on screen.

She demonstrated with a command:

```
# Inspect an image's layers
$ docker inspect --format='{{json .RootFS.Layers}}' nginx | jq
[
  "sha256:8cbe4b54181ca350c3674a39a7a56fae47eea05c95af7e7e25d5ac9fdce0985f",
  "sha256:08e9fab9952ff6a17f3f7c9e7cab2d7b4943135935470f6eff149abf0d1a3385",
  "sha256:c0edce958f536c8df30b99b87a55ca8a0dfadc3a0b0dd97b559f228a3713adf0",
  "sha256:3d9f761bf58e957c9c8c868f2d9ba5dd77a125c7f4c0c34de914220b8ef3ac5d",
  "sha256:3f4ca61aafcd4fc5c983c93c5ec26bf3f7bea72a54cec1f4bc7f52427a03919e"
]

```

"Each layer is identified by its content hash, ensuring integrity and enabling deduplication," Connie explained. "If two images share the same base layer, that layer is only stored once on disk."

### Image Configuration: Runtime Instructions

"The image configuration contains instructions for the runtime," Connie continued. "It includes:

Environment variables

Command to run

Working directory

User to run as

Exposed ports

Volume mounts

Health check instructions

"It's like the operating manual for the container," Connie explained. She showed Maya an example image configuration:

```
{
  "architecture": "amd64",
  "config": {
    "Hostname": "",
    "Domainname": "",
    "User": "",
    "ExposedPorts": {
      "80/tcp": {}
    },
    "Env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "NGINX_VERSION=1.21.0"
    ],
    "Cmd": [
      "nginx",
      "-g",
      "daemon off;"
    ],
    "WorkingDir": "",
    "Volumes": {
      "/var/cache/nginx": {}
    }
  },
  "history": [
    {
      "created": "2021-05-25T23:19:51.62526228Z",
      "created_by": "/bin/sh -c #(nop) ADD file:4d35f907ae9b4020c783124de1ea352ecd9608c42e2c6af3be8cf576fed7db71 in / "
    }
  ],
  "rootfs": {
    "type": "layers",
    "diff_ids": [
      "sha256:69692152171afee1fd341febc390747cfca2ff302f4d0b3b879b2821c286161c"
    ]
  }
}

```

"When a container runtime creates a container from this image, it uses this configuration to set up the container environment and determine what command to run," Connie explained.

### Container Registries: Storing and Distributing Images

"The final piece of the puzzle is how container images are stored and distributed," Connie said. "Container registries implement the OCI Distribution Specification to provide a standardized way to push, pull, and store container images."

She showed Maya a diagram of the registry interaction:

Push: Local images are uploaded to the registry, layer by layer

Storage: The registry stores layers, manifests, and configuration

Pull: Clients download images, with layer verification via content hashes

Caching: Layers already present locally are not downloaded again

"Thanks to content-addressable storage, registries can efficiently store and distribute images, with built-in integrity verification and deduplication," Connie noted.

### Maya Applies Her Knowledge at DigiLand

Back at her desk, Maya immediately started applying her new understanding of container runtimes to improve DigiLand's container infrastructure.

### Runtime Optimization for Different Workloads

Maya worked with her team to match runtimes to different workloads:

For the park's critical ticket processing system, she switched to crun for faster container startup times:

```
# Configure containerd to use crun for ticket system containers
cat << EOF > /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.ticket-system]
  runtime_type = "io.containerd.runc.v2"
  pod_annotations = ["ticket-system"]
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.ticket-system.options]
    BinaryName = "/usr/local/bin/crun"
EOF

```

For their security-sensitive payment system, she implemented gVisor for additional isolation:

```
# Configure containerd to use gVisor for payment containers
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.payment-system]
  runtime_type = "io.containerd.runsc.v1"

```

### Image Optimization for Faster Deployments

Maya reviewed their container images and implemented several optimizations:

She established a multi-stage image build process that reduced image sizes by 60%:

```
# Multi-stage build for DigiLand apps
FROM node:14 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:14-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]

```

She implemented proper image layer organization to maximize sharing between applications:

```
# Base image with shared dependencies
FROM ubuntu:20.04 AS digiland-base
RUN apt-get update && apt-get install -y python3 python3-pip
COPY requirements-common.txt .
RUN pip install -r requirements-common.txt

# Application-specific image
FROM digiland-base
COPY requirements-app.txt .
RUN pip install -r requirements-app.txt
COPY app/ /app/
CMD ["python3", "/app/main.py"]

```

### Direct OCI Runtime Usage for Special Cases

For specialized requirements, Maya bypassed Docker and worked directly with the lower-level runtimes:

For custom monitoring containers that needed to start quickly, she created OCI bundles directly:

```
# Create a minimal OCI bundle
mkdir -p monitoring-container/rootfs
cp -r monitoring-app/* monitoring-container/rootfs/
cd monitoring-container
runc spec
# Edit config.json to customize capabilities, mounts, etc.
sed -i 's/"readonly": true/"readonly": false/' config.json

# Run the container directly with runc
sudo runc run monitoring-pod

```

For containers that needed to persist between host reboots, she configured containerd's persistent metadata:

```
# Create a container with persistent configuration
ctr containers create \
  --net-host \
  --mount type=bind,src=/data,dst=/data,options=rbind:rw \
  docker.io/digiland/persistent-service:latest persistent-service

```

### Registry Optimization for Better Performance

Maya also improved their container registry setup:

She implemented a local registry mirror to reduce bandwidth usage and improve pull times:

```
# Docker daemon configuration
{
  "registry-mirrors": ["https://mirror.digiland.internal"],
  "insecure-registries": ["mirror.digiland.internal:5000"]
}

```

She configured layer de-duplication and garbage collection policies to reclaim storage:

```
# Add garbage collection to the registry configuration
cat << EOF > /etc/docker/registry/config.yml
version: 0.1
storage:
  filesystem:
    rootdirectory: /var/lib/registry
  delete:
    enabled: true
  maintenance:
    uploadpurging:
      enabled: true
      age: 168h
      interval: 24h
    readonly:
      enabled: false
EOF

```

### The Results: A More Robust Container Platform

Six months after implementing these optimizations:

Container startup time decreased by 50% through runtime optimization

Image pull times decreased by 70% with proper layer management and local caching

Storage usage for container images decreased by 65% through de-duplication and cleanup

System reliability increased with separated concerns and standards-based components

### Your Turn to Explore Container Runtime Architecture

Ready to understand container runtimes yourself? Here are some beginner-friendly ways to explore these technologies:

Explore containerd directly:

```
# Install containerd client
$ sudo apt install containerd

# Pull and run a container with containerd
$ sudo ctr image pull docker.io/library/alpine:latest
$ sudo ctr run --rm docker.io/library/alpine:latest alpine-test ls
```

Work with OCI bundles and runc:

```
# Create a simple OCI bundle
$ mkdir -p mycontainer/rootfs
$ docker export $(docker create alpine) | tar -C mycontainer/rootfs -xf -
$ cd mycontainer
$ runc spec
$ sudo runc run myalpinemachine
```

Inspect image layers and manifests:

```
# Show image manifest
$ skopeo inspect docker://docker.io/library/ubuntu:latest --raw | jq

# Examine image configuration
$ skopeo inspect docker://docker.io/library/ubuntu:latest --config | jq
```

Try different container engines:

```
# Install and try Podman (daemonless engine)
$ sudo apt install podman
$ podman run --rm alpine echo "Hello from Podman!"
```

By understanding the container runtime architecture, you gain deeper insights into how the container ecosystem functions and how to optimize it for your specific needs.

Just as Maya discovered at DigiLand, container runtimes aren't a monolithic black box, but a well-designed set of components working together according to open standards. This modular architecture provides the flexibility, efficiency, and security that make containers such a powerful technology for modern applications.
