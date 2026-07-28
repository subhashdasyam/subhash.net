---
title: "Container Images: Building the Blueprints of DigiLand - PART 4"
date: 2025-05-21T22:18:00.004+04:00
lastmod: 2025-05-21T22:23:41.905+04:00
slug: "container-images-building-blueprints-of"
tags:
  - "container image"
  - "container-series"
  - "docker"
  - "Dockerfile"
system: "container image"
sourceURL: "https://www.subhashdasyam.com/2025/05/container-images-building-blueprints-of.html"
---
Before moving forward make sure you covered PART 3

Two weeks after her deep dive into container runtimes, Maya found herself in DigiLand's operations center once again, staring at a deployment pipeline that had slowed to a crawl.

Our container deployments are taking forever, Maya sighed as Connie walked in. We've optimized our runtimes, but it still takes almost 15 minutes to build and deploy a simple update to our ticket scanning application.

Connie nodded knowingly. "Now you're discovering one of the most critical parts of the container ecosystem - the images themselves. Understanding how container images are built, stored, and distributed is just as important as understanding how they run."

"I know the basics," Maya said, pointing to her monitor. "We define a Dockerfile, build it, push it to our registry, and then pull it to our nodes. But why is it so slow, and why are our images so large? Some of our NodeJS applications end up as 1GB images!"

"It's time for another tour," Connie suggested. "Let's visit DigiLand's Blueprint Workshop - our container image factory - and see how container images are really built and managed."

### The Container Image Blueprint Workshop

The next morning, Connie led Maya to a wing of DigiLand's technical operations that Maya hadn't visited before - a large space filled with workstations where developers were creating and refining container images.

"Welcome to our Blueprint Workshop," Connie said. "This is where all the container images that power DigiLand are designed, built, and maintained."

Container Image Layer Composition

"Before we dive deeper, let's make sure we're clear on what a container image actually is," Connie said, leading Maya to a large diagram on the wall.

### Container Images: Layered Blueprints

Connie pointed to a detailed illustration showing the internal structure of a container image.

"A container image is essentially a blueprint for creating containers," she explained. "It contains everything needed to run an application: the code, runtime, libraries, environment variables, and configuration files. But what makes container images special is their layered architecture."

Container Image Layer Composition

### Understanding Image Layers

"Container images are composed of multiple read-only layers," Connie explained. "Each layer represents a set of filesystem changes resulting from an instruction in the Dockerfile."

She pointed to a sample image composition on a nearby screen:

```
Image: digiland/ticketing:latest
├── Layer 1: Base OS (ubuntu:20.04) [72MB]
│   └── SHA256:7c9c7fed23def3653a0da5bc9ecb651ad5109b33a5aeaec56cccbf25c8b3c3df
├── Layer 2: System packages (apt-get install) [145MB]
│   └── SHA256:ad8cd4bd2c46a131baac952a1fb186e67c6b9fc3f8c22efcbe65f913023403d6
├── Layer 3: Python installation [85MB]
│   └── SHA256:ff82b5fcb19a70cfc60872e7c01ae4b28ea4750f507763b10ca93e21f301de62
├── Layer 4: Application dependencies (pip install) [47MB]
│   └── SHA256:c283eb8079f626d5470b53a1b85059b51f306246ea60974ee19f6c372027d89d
└── Layer 5: Application code (COPY app/) [2MB]
    └── SHA256:09b56f6fae2d9f2832f744fbdc447a7f82eae3004c670b4af418967a4e45a5d6

```

"Notice how each layer has a unique SHA256 hash," Connie pointed out. "This hash is calculated based on the layer's contents, which means identical layers always have the same hash, regardless of which image they're in."

"So if two different applications use Ubuntu 20.04, they share that base layer?" Maya asked.

"Exactly!" Connie nodded. "When you pull multiple images with the same base layer, that layer is only stored once on your system. This sharing of layers is what makes containers efficient in terms of storage and distribution."

### The Container Filesystem View

"But when a container runs, it sees a unified filesystem, not separate layers," Connie continued, moving to another diagram. "This is accomplished through a union filesystem that merges all the layers into a single view."

She showed Maya a technical illustration of how this works:

Container Union Filesystem

"When a container runs, a thin, writable layer is added on top of the read-only image layers," Connie explained. "This container layer captures any changes made while the container is running using a copy-on-write mechanism."

She demonstrated with a running container:

```
# Start a container
$ docker run -d --name ticketing-demo digiland/ticketing:latest

# Examine the layers inside the container
$ docker exec ticketing-demo ls -la /app
total 24
drwxr-xr-x 5 root root 4096 Apr 10 14:23 .
drwxr-xr-x 1 root root 4096 Apr 10 14:25 ..
-rw-r--r-- 1 root root 2048 Apr 10 14:23 app.py
-rw-r--r-- 1 root root 1024 Apr 10 14:23 requirements.txt
drwxr-xr-x 2 root root 4096 Apr 10 14:23 templates

# Create a new file in the container
$ docker exec ticketing-demo touch /app/new-file.txt

# This new file exists only in the container layer

```

"This design has important implications," Connie noted. "Since the image layers are read-only and shared between containers, you can run hundreds of containers from the same image with minimal additional storage overhead."

"But what happens when we update our application?" Maya asked. "How do we modify the image?"

"That's where image building comes in," Connie replied, leading Maya to another part of the workshop.

### Building Container Images: The Creation Process

Connie guided Maya to a section where developers were actively building container images, with screens showing build processes and Dockerfiles.

"Building a container image starts with a Dockerfile - a set of instructions that describe how to create the image," Connie explained.

The Image Building Process

### Understanding Dockerfiles

"A Dockerfile is essentially a recipe for building an image," Connie said, showing Maya a sample file:

```
# Base image - this forms the first layer
FROM ubuntu:20.04

# System updates and dependencies - this forms the second layer
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies - this forms the third layer
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code - this forms the fourth layer
COPY app/ .

# Define environment variables
ENV PORT=8080

# Specify the command to run
CMD ["python3", "app.py"]

```

"Each instruction in the Dockerfile creates a new layer in the image," Connie explained. "The FROM instruction specifies the base image, and subsequent instructions add additional layers on top."

### Build Cache: Accelerating Image Creation

"One of the most powerful features of the image building process is the build cache," Connie continued, pointing to a build in progress. "Docker caches the result of each instruction and reuses those cached layers in future builds when possible."

She demonstrated by making a small change to the application code and rebuilding:

```
# Original build
$ docker build -t digiland/ticketing:latest .
Step 1/7 : FROM ubuntu:20.04
 ---> 1318b700e415
Step 2/7 : RUN apt-get update && ...
 ---> Running in 7cb5d9a79d16
 ---> a8d3a45f7e07
...
Step 5/7 : COPY app/ .
 ---> 8f7b021f59d3
...
Successfully built 8f7b021f59d3

# Modified build after changing only app/app.py
$ docker build -t digiland/ticketing:latest .
Step 1/7 : FROM ubuntu:20.04
 ---> Using cache
 ---> 1318b700e415
Step 2/7 : RUN apt-get update && ...
 ---> Using cache
 ---> a8d3a45f7e07
...
Step 5/7 : COPY app/ .
 ---> 96c9e3b057d1  # New layer hash because app/ contents changed
...
Successfully built 435f9a2d7c31

```

"Notice how Docker reused the cached layers for steps 1-4 because those instructions hadn't changed," Connie pointed out. "But since we modified the application code, the COPY app/ instruction created a new layer, and all subsequent steps also needed to be re-executed."

"That's where build optimization becomes important," Connie added. "The order of instructions in your Dockerfile can significantly impact build performance."

### Build Optimization: Order Matters

"To optimize your builds, you should order your Dockerfile instructions from least frequently changing to most frequently changing," Connie explained. "This maximizes cache utilization."

She showed Maya a comparison of two approaches:

```
# Suboptimal approach - code changes invalidate dependency layer
FROM python:3.9-slim
WORKDIR /app
COPY . .                  # App code changes frequently
RUN pip install -r requirements.txt  # Dependencies change less often

# Optimized approach - dependencies get cached
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .   # Dependencies definition changes rarely
RUN pip install -r requirements.txt  # This layer gets cached
COPY . .                  # Only this layer is rebuilt when code changes

```

"In the optimized version, changing your application code only invalidates the cache for the last COPY instruction, not the dependency installation," Connie noted. "This can save significant time in your build process."

### Multi-stage Builds: Creating Efficient Images

Connie then led Maya to a special section where senior developers were working on advanced Dockerfile patterns.

"One of the most powerful techniques for creating efficient container images is multi-stage builds," Connie explained. "This pattern allows you to use one image for building your application and another, smaller image for running it."

Multi-stage Build Process

### Separating Build and Runtime Environments

"Multi-stage builds separate your build environment from your runtime environment," Connie said, showing Maya an example:

```
# Stage 1: Build stage
FROM node:16 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime stage
FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
RUN npm install --only=production
CMD ["node", "dist/server.js"]

```

"In this example, we use a full Node.js image to build the application, then copy only the necessary files to a smaller Alpine-based image for runtime," Connie explained. "The final image doesn't include the development dependencies, source code, or build tools."

She showed Maya a size comparison:

```
Single-stage build: 1.2GB
Multi-stage build: 178MB (85% smaller)

```

"The benefits go beyond just size," Connie added. "Smaller images deploy faster, start faster, and have a smaller attack surface from a security perspective."

### Advanced Multi-stage Patterns

"You can get even more creative with multi-stage builds," Connie continued, showing Maya a more complex example:

```
# Stage 1: Development dependencies
FROM python:3.9 AS dev-deps
WORKDIR /app
COPY requirements-dev.txt .
RUN pip install -r requirements-dev.txt

# Stage 2: Test stage
FROM dev-deps AS test
COPY . .
RUN pytest

# Stage 3: Build stage
FROM dev-deps AS builder
COPY . .
RUN python setup.py bdist_wheel

# Stage 4: Production image
FROM python:3.9-slim
WORKDIR /app
COPY --from=builder /app/dist/*.whl .
RUN pip install *.whl && rm *.whl
CMD ["python", "-m", "digiland.app"]

```

"This pattern allows you to include testing in your build process and ensures that only tested code makes it into your final image," Connie explained. "Yet the final image still remains small and focused on just what's needed at runtime."

### Image Registries: Storing and Distributing Blueprints

For the next part of the tour, Connie took Maya to an area focused on image storage and distribution.

"Once you've built your container images, you need a place to store and distribute them," Connie said. "That's where container registries come in."

Container Registry Architecture

### Registry Basics: Repositories, Tags, and Digests

"A container registry is a specialized storage system for container images," Connie explained. "Images are organized into repositories, each containing multiple tagged versions of an image."

She showed Maya their registry's web interface:

```
Registry: registry.digiland.internal
└── Repository: digiland/ticketing
    ├── Tag: latest → sha256:435f9a2d7c31...
    ├── Tag: v1.5.2 → sha256:435f9a2d7c31...
    ├── Tag: v1.5.1 → sha256:8f7b021f59d3...
    └── Tag: v1.5.0 → sha256:76cf2c2a98e3...

```

"Each image is identified by both tags (human-readable names) and digests (content-based SHA256 hashes)," Connie explained. "Tags like 'latest' can be moved to point to different images, while digests are immutable and uniquely identify a specific image version."

She demonstrated this concept:

```
# Pull by tag (mutable reference)
$ docker pull digiland/ticketing:latest

# Pull by digest (immutable reference)
$ docker pull digiland/ticketing@sha256:435f9a2d7c31e98c537428a05b33da4e6c27285241a3f8481282467a5c43f326

```

"Using digests in production environments ensures you're always running exactly the version you expect, even if someone updates the 'latest' tag," Connie noted.

### Registry Distribution and Caching

"One of the key features of modern registries is their distribution efficiency," Connie continued, showing Maya a network diagram. "When you pull an image, the registry only sends the layers you don't already have locally."

She demonstrated with a pull command:

```
$ docker pull digiland/ticketing:v1.5.3
v1.5.3: Pulling from digiland/ticketing
Digest: sha256:6a92cd1fcdc8d8cdec60f33dda4db2cb1fcdcacf3410a8e05b3741f44a9b5998
Status: Downloaded newer image for digiland/ticketing:v1.5.3
# Only the changed layers were downloaded, shared layers were reused

```

"In large-scale environments like DigiLand, we also use registry mirrors and caching proxies to improve performance," Connie added, pointing to another diagram. "This reduces bandwidth usage and speeds up container deployments, especially for our edge locations."

### Security in the Registry

"As the central repository for all our application blueprints, registry security is critical," Connie said, moving to a security station. "Modern registries provide several security features."

She showed Maya their security controls:

Authentication and Authorization: Controlling who can push and pull images

Image Signing: Cryptographically verifying image authenticity

Vulnerability Scanning: Automatically checking images for known security issues

Content Trust: Ensuring images haven't been tampered with

"We've configured our registry to automatically scan all images for vulnerabilities," Connie explained, showing Maya a scan report:

```
Image: digiland/ticketing:latest
Scan completed: April 12, 2023 08:45 UTC
└── Vulnerabilities found: 3
    ├── CVE-2023-1234: High severity in python-crypto 2.6.1
    ├── CVE-2023-5678: Medium severity in openssl 1.1.1k
    └── CVE-2023-9101: Low severity in base-libs 2.33.1

```

"Our CI/CD pipeline is configured to block deployments of images with high-severity vulnerabilities," Connie added. "This ensures that security issues are addressed before images reach production."

### Maya Applies Her Knowledge at DigiLand

The following week, Maya put her new understanding of container images to work, implementing several improvements to DigiLand's container workflow.

### Optimizing Dockerfiles for Build Speed

First, Maya restructured their Dockerfiles to maximize build cache efficiency:

```
# Before: Frequent cache invalidation
FROM python:3.9-alpine
WORKDIR /app
COPY . .                   # Entire codebase copied, cache breaks on any change
RUN pip install -r requirements.txt

# After: Improved cache utilization
FROM python:3.9-alpine
WORKDIR /app
COPY requirements.txt .    # Dependencies copied first
RUN pip install -r requirements.txt  # Cached unless requirements change
COPY . .                   # Application code copied last

```

This simple change reduced their average build time from 5 minutes to just over 1 minute for most incremental builds.

### Implementing Multi-stage Builds

Next, Maya converted their largest applications to use multi-stage builds:

```
# Stage 1: Build the React frontend
FROM node:16 AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build the Python backend
FROM python:3.9 AS backend-builder
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .

# Stage 3: Production image
FROM python:3.9-slim
WORKDIR /app
# Copy only built assets from frontend
COPY --from=frontend-builder /app/build ./static
# Copy backend files
COPY --from=backend-builder /app .
# Install only production dependencies
RUN pip install --no-cache-dir -r requirements.txt
CMD ["gunicorn", "app:app"]

```

The results were dramatic:

```
Before: 1.42GB image size, 15 minute build time
After: 278MB image size, 7 minute build time (and only 2 minutes for incremental builds)

```

### Implementing a Registry Caching Strategy

Maya also improved their registry setup to optimize for their distributed environment:

She set up a central registry with mirror caches at each edge location:

```
# Docker registry configuration
version: 0.1
storage:
  filesystem:
    rootdirectory: /var/lib/registry
  maintenance:
    uploadpurging:
      enabled: true
      age: 168h
      interval: 24h
proxy:
  remoteurl: https://central-registry.digiland.internal

```

She implemented a tag lifecycle policy to manage image retention:

```
{
  "rules": [
    {
      "repository": "digiland/ticketing",
      "action": "keep",
      "match": {
        "tags": ["latest", "v*.*.*"]
      },
      "conditions": {
        "age": "<= 90d"
      }
    }
  ]
}

```

This ensured that only actively used images remained in the registry, automatically cleaning up older versions to save storage space.

### Implementing Artifact Registry for Build Dependencies

Finally, Maya set up an artifact registry alongside their container registry to manage build dependencies:

```
# Configure pip to use private registry
$ cat > ~/.pip/pip.conf << EOF
[global]
index-url = https://artifacts.digiland.internal/python/simple
EOF

# Configure npm to use private registry
$ npm config set registry https://artifacts.digiland.internal/npm/

```

Combined with their optimized Dockerfiles, this improved build times by another 30% by eliminating external network dependencies during builds.

### The Results: A More Efficient Container Ecosystem

Three months after implementing these improvements:

Container image sizes decreased by an average of 68%

Build times decreased by 75% for incremental builds

Deployment times decreased by 60%

Network bandwidth usage decreased by 82%

Storage usage for the registry decreased by 45%

"I never realized how much impact the image building and distribution process could have," Maya told Connie as they reviewed the improvements. "Understanding the layered nature of images and how to work with it has transformed our entire deployment pipeline."

"That's the beauty of container images," Connie replied. "They're not just packages - they're carefully constructed blueprints with properties that can be optimized at every stage."

### Your Turn to Explore Container Images

Ready to dive deeper into container images yourself? Here are some beginner-friendly experiments to try:

Examine image layers:

```
# Install dive tool for exploring images
$ wget https://github.com/wagoodman/dive/releases/download/v0.9.2/dive_0.9.2_linux_amd64.deb
$ sudo apt install ./dive_0.9.2_linux_amd64.deb

# Explore an image's layers
$ dive nginx:latest
```

Experiment with build cache:

```
# Create a simple Dockerfile
$ echo 'FROM alpine:latest' > Dockerfile
$ echo 'RUN apk add --no-cache python3' >> Dockerfile
$ echo 'COPY app/ /app' >> Dockerfile
$ mkdir app && echo 'print("Hello")' > app/hello.py

# Build it once
$ time docker build -t test:v1 .

# Build again (should use cache)
$ time docker build -t test:v2 .

# Modify app and build again (partial cache use)
$ echo 'print("Updated")' > app/hello.py
$ time docker build -t test:v3 .
```

Create a multi-stage build:

```
# Create a multi-stage Dockerfile
$ cat > Dockerfile.multi << EOF
FROM golang:1.19 AS builder
WORKDIR /app
COPY main.go .
RUN go build -o app main.go

FROM alpine:latest
COPY --from=builder /app/app /app
CMD ["/app"]
EOF

# Create a simple Go app
$ echo 'package main; import "fmt"; func main() { fmt.Println("Hello") }' > main.go

# Build with multi-stage
$ docker build -f Dockerfile.multi -t app:multi .

# Compare with single-stage
$ echo 'FROM golang:1.19' > Dockerfile.single
$ echo 'WORKDIR /app' >> Dockerfile.single
$ echo 'COPY main.go .' >> Dockerfile.single
$ echo 'RUN go build -o app main.go' >> Dockerfile.single
$ echo 'CMD ["/app"]' >> Dockerfile.single
$ docker build -f Dockerfile.single -t app:single .

# Compare sizes
$ docker images app
```

Push to and pull from a registry:

```
# Start a local registry
$ docker run -d -p 5000:5000 --name registry registry:2

# Tag and push an image
$ docker tag nginx:latest localhost:5000/my-nginx:latest
$ docker push localhost:5000/my-nginx:latest

# Pull the image
$ docker pull localhost:5000/my-nginx:latest
```

By mastering container images, you'll be able to create more efficient, secure, and maintainable containerized applications, just as Maya did at DigiLand.

Just like physical blueprints need to be carefully designed for efficient construction, container images benefit from thoughtful design, layering, and optimization. With these principles in mind, you can create container images that are not only functional but also efficient to build, distribute, and run.
