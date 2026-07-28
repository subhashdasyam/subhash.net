---
title: "Linux Fundamentals Behind Containers: The Hidden Magic of DigiLand - PART-2"
date: 2025-05-21T22:14:00.006+04:00
lastmod: 2025-05-21T22:22:25.299+04:00
slug: "linux-fundamentals-behind-containers"
tags:
  - "container-series"
  - "Kernel Namespaces"
  - "Kubernetes Namespaces"
  - "linux namespaces"
system: "container-series"
sourceURL: "https://www.subhashdasyam.com/2025/05/linux-fundamentals-behind-containers.html"
---
Before you continue this story, please make sure you covered PART-1

After successfully implementing both virtual machines and containers at DigiLand theme park, Maya was ready to celebrate. The park was running more efficiently than ever, with better resource utilization and faster development cycles.

However, during a late-night conversation with Connie (their container expert), Maya realized something was bothering her.

"Connie, I understand what containers do now, but I don't really understand how they do it. You mentioned namespaces, cgroups, and other technologies, but those are just words to me. How does all this actually work?"

Connie smiled. "You're asking about the magic behind the curtain! Ready for a deeper tour of our container hotel?"

### Exploring the Hidden Machinery of Container Hotel

The next morning, Connie led Maya to a service corridor behind the Container Hotel that guests never see.

"When we talked about containers being like rooms in a shared hotel, that was just the guest perspective," Connie explained. "But how do we create the illusion that each guest has their own private space when they're actually sharing the same building? That's the real magic, and in Linux, it's built on four fundamental technologies."

Connie pointed to a diagram on the wall:

The Four Pillars of Container Technology

"These are the technologies that make our Container Hotel possible," Connie said. "Let's explore each one and see how they work together."

### Namespaces: Creating Different Views of the Same World

Connie led Maya to a special control room filled with what looked like one-way mirrors and periscopes looking out into different parts of the hotel.

"Namespaces are like special glasses that give each guest a different view of the same hotel," Connie explained. "Linux has several types of namespaces, each controlling what a container can see."

The Namespace Control Room

"Let's look at what each namespace does," Connie said, guiding Maya through the control room:

### The Process ID (PID) Namespace: Your Own Staff Directory

Connie pointed to the first station. "Remember how in a hotel, each department has its own staff? In the PID namespace, each container gets its own process list. Container A might see its application as process #1, while Container B also sees its application as process #1, even though they're completely different processes on the host."

Maya watched as Connie demonstrated with a command:

```console
# Host system showing all processes
$ ps aux | wc -l
263 processes

# Inside container showing only its processes
$ docker exec my-container ps aux | wc -l
12 processes
```

"It's like each room has its own staff directory that only lists the staff assigned to that room, even though there's a master directory for the entire hotel," Maya realized.

### The Network Namespace: Private Communication Channels

At the next station, screens showed network diagrams with separate IP addresses and routing tables.

"The network namespace gives each container its own network stack its own IP addresses, routing tables, and network devices," Connie explained. "It's like each room has its own private phone network that can't directly call the phones in other rooms unless we specifically connect them."

She showed Maya a diagram of containers with their own network interfaces, all connected through a virtual bridge.

"We can even assign different bandwidth limits to different containers, just like we might give premium rooms better internet access."

### The Mount Namespace: Different Views of the Filesystem

The next station showed different views of the same hotel amenities.

"The mount namespace controls what files and directories each container can see," Connie said. "It's like how we might have a standard hotel room, but for one guest we make the gym visible and hide the pool, while for another guest we show the pool but hide the gym."

She demonstrated with a command:

```console
# Host system mount points
$ mount | wc -l
42 mounts

# Container mount points
$ docker exec my-container mount | wc -l
12 mounts
```

"Each container only sees the mounts we want it to see, creating the illusion of a separate filesystem."

### The User Namespace: Different Identity Cards

Connie moved to a station showing security badges with different access levels.

"The user namespace maps user IDs between the container and the host," she explained. "A user might be 'root' (all-powerful) inside their container, but actually mapped to a regular unprivileged user on the host system."

"So it's like giving a guest a 'VIP' card that works only in their room, but not in the rest of the hotel?" Maya asked.

"Exactly! They feel special in their own space, but can't access restricted areas of the actual hotel."

### Other Namespaces: More Isolation Dimensions

"There are more namespaces too," Connie continued. "The UTS namespace lets containers have their own hostname, the IPC namespace controls inter-process communication, and the Time namespace can even give containers their own system time."

Maya was impressed. "So namespaces create the illusion of separation. But how do we prevent one container from hogging all the hotel's resources?"

### Control Groups (cgroups): Resource Limits and Fair Sharing

Connie led Maya to another room filled with gauges, dials, and meters - like a power plant control room.

"This is where Control Groups (cgroups) come in," Connie said. "While namespaces control what a container can see, cgroups control what it can use."

The Resource Control Room

### CPU Controls: Fair Scheduling and Limits

"These CPU gauges control how much processing power each container gets," Connie explained. "We can set hard limits, like 'Container A can never use more than 30% of the CPU,' or relative shares, like 'Container A gets twice as much CPU as Container B when they're both busy.'"

She adjusted some dials, and Maya watched as the processing power redistributed between containers.

"It's like making sure one guest can't ride the roller coaster 100 times while others wait in line," Maya said.

"Exactly! And we can even set real-time priorities for containers that need guaranteed response times, like ride control systems."

### Memory Controls: Preventing Resource Hogging

Next, Connie showed Maya the memory allocation controls.

"These limit how much RAM each container can use. Without these, one container with a memory leak could bring down the entire system by consuming all available memory."

She pointed to various settings:

Memory limit: Maximum RAM a container can use

Memory reservation: Guaranteed minimum RAM for a container

Memory swappiness: How aggressively to move container memory to disk when RAM is tight

"It's like making sure one guest can't take all the food from the buffet," Maya noted.

### I/O Controls: Fair Access to Disk and Network

"These meters control how much disk and network I/O each container can use," Connie continued. "We can prevent one chatty container from hogging all the network bandwidth or one disk-heavy container from slowing down others."

She demonstrated by throttling a container's disk I/O, showing how it affected performance while keeping other containers responsive.

"In our park analogy, it's like making sure one attraction can't use all the water pressure, leaving other water rides with just a trickle."

### Device Access Controls: Security Boundaries

"Finally, cgroups can control which devices a container can access," Connie said, pointing to a panel of switches. "We can allow or deny access to specific hardware like cameras, microphones, or USB devices."

"So containers are isolated not just in what they see, but in what resources they can consume," Maya summarized. "But where do they store their data?"

### Union Filesystems: The Magic of Layers

Connie led Maya to a room with what looked like transparent sheets stacked on top of each other, each with different markings.

"This is my favorite part," Connie said. "Union filesystems are what make containers so efficient with storage and so quick to start."

### The Base Image: Standard Hotel Rooms

"Think of the base image as our standard hotel room template," Connie explained. "It has the basic furniture, standard bathroom fixtures, and essential amenities that every room starts with."

She pointed to the bottom layer in their diagram:

"This base layer contains the core files needed for the container to run like the operating system binaries, libraries, and essential tools. Since every container of the same type starts with identical base files, we only store this layer once, no matter how many containers we run."

### Adding Layers: Customizing the Room

"On top of that, we add more layers," Connie continued, pointing to the transparent sheets stacked above the base. "Each layer represents changes made to the filesystem, like adding the application code, configuration files, or other customizations."

"So it's like starting with a standard room, then adding specific decorations for different guests?" Maya asked.

"Precisely! And the best part is, these layers are read-only and shared between containers. If we have 100 containers based on the same image, we don't make 100 copies of that image they all share the same underlying layers."

### The Container Layer: Guest Modifications

"The top layer is the only writable layer, unique to each container," Connie explained. "When a container modifies a file, the change is written only to this top layer, leaving the underlying image untouched."

She demonstrated with a simple example:

```console
# Create a file in a container
$ docker exec my-container touch /new-file.txt
```

"That new file exists only in that container's writable layer. If we create another container from the same image, it won't have that file."

### Copy-on-Write: Efficient Modifications

"What happens if a container needs to modify a file from a lower layer?" Maya asked.

"Great question!" Connie replied. "That's where Copy-on-Write comes in. The system copies the file to the container's writable layer first, then makes the changes there."

She demonstrated by modifying a configuration file in a container, showing how the original remained untouched in the base image while a modified copy appeared in the container's top layer.

"It's like if a guest wants to rearrange the furniture in their room. We don't actually let them move the real furniture we give them lightweight replicas to arrange however they want, while the original pieces stay secured in place."

### Deletion and Whiteouts: Hiding Without Removing

"What if a container wants to delete a file from a lower layer?" Maya asked.

"Since lower layers are read-only, we can't actually delete the file," Connie explained. "Instead, we place a special marker called a 'whiteout' file in the top layer that essentially says 'pretend this file doesn't exist when looking at the unified view.'"

"So from inside the container, it looks like the file is gone, but we haven't actually modified the underlying shared layers," Maya realized.

"Exactly! This approach keeps our image layers pristine and reusable."

### Chroot and Other Isolation: The Original Container Magic

For the final stop, Connie took Maya to a small room with what looked like old-fashioned security equipment.

"Before all the fancy namespace and cgroup technology, there was a simpler tool called chroot," Connie said. "It's still a fundamental part of container isolation."

The Root Directory Control System

### Chroot: Changing the Root View

"Chroot literally means 'change root,'" Connie explained. "It changes what a process sees as the root (/) directory of the filesystem. After a chroot, the process can't see any files outside its new root directory."

She demonstrated with a simple example:

```console
# Create a minimal filesystem
$ mkdir -p /container-root/{bin,lib,etc}
$ cp /bin/bash /container-root/bin/

# Enter the chroot
$ chroot /container-root /bin/bash

# Now inside the chroot
$ ls /
bin etc lib
```

"Inside the chroot, the process thinks /container-root is actually /. It can't see anything outside that directory."

"So it's like putting blinders on our guests so they can only see their own room and not the rest of the hotel?" Maya asked.

"Exactly! It's a fundamental isolation technique, but not sufficient on its own for full container security."

### Security Capabilities: Limiting Special Powers

"Beyond chroot, containers use Linux capabilities to limit what privileged operations a process can perform," Connie continued. "Instead of giving a container full root powers, we can grant only specific capabilities it needs."

She showed Maya a list of capabilities that might be granted to a container:

CAP_NET_BIND_SERVICE: Ability to bind to privileged ports (below 1024)

CAP_SYS_PTRACE: Ability to use ptrace debugging

CAP_SYS_TIME: Ability to modify the system clock

"It's like giving staff specific keys to only the areas they need access to, rather than a master key to everything."

### Seccomp: Filtering System Calls

"Seccomp adds another layer of security by filtering which system calls a container can make to the kernel," Connie explained. "We can create a whitelist of allowed system calls and block everything else."

She showed Maya a simplified seccomp profile:

```
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "allowedCalls": ["read", "write", "open", "close", "stat", ...]
}
```

"If the container tries to use a system call not on the whitelist, it's blocked. It's like having bouncers that only allow certain requests to reach the hotel management."

### AppArmor and SELinux: Policy Enforcement

"Finally, we have mandatory access control systems like AppArmor and SELinux," Connie said. "These enforce security policies that restrict what files a container can access and what operations it can perform on those files."

She showed Maya a simplified AppArmor profile:

```
profile docker-default {
  # Allow read access to most files
  /usr/lib/** r,
  # Allow read/write access to specific directories
  /var/log/app/** rw,
  # Deny access to sensitive files
  deny /etc/shadow r,
}
```

"These profiles define exactly what each container is allowed to do, providing defense in depth."

### Putting It All Together: Container Magic Revealed

As they returned to the main control center, Connie showed Maya a complete diagram of how all these technologies work together.

The Complete Container Architecture

"So that's the full picture," Connie concluded. "Containers use:

Namespaces to control what processes can see

Cgroups to control what resources processes can use

Union filesystems to efficiently manage layered storage

Chroot and security mechanisms to enforce isolation and limit privileges

All while sharing the same Linux kernel for efficiency."

Maya was amazed. "So Docker and other container tools are really just convenient ways to configure all these Linux features?"

"Exactly! Container runtimes like Docker, containerd, and CRI-O are essentially orchestrating these Linux kernel features to create the container abstraction we use."

### Maya Applies Her Knowledge at DigiLand

Armed with this deeper understanding, Maya returned to DigiLand with new ideas for optimization and security.

### Namespace Customization for Special Attractions

Maya worked with her team to customize namespaces for different attraction containers:

For the virtual reality ride containers, she kept them in the same network namespace but different PID namespaces, allowing for shared network communication while maintaining process isolation.

For payment processing containers, she used user namespaces to ensure they ran with minimal privileges on the host.

```console
# Create container with custom user namespace mapping
$ docker run --user-namespace-mode=host -d payment-processor
```

### Resource Optimization with Cgroups

Maya implemented advanced cgroup configurations to optimize resource usage:

For the ticketing system, she used CPU pinning to dedicate specific CPU cores during peak hours:

```console
# Pin container to specific CPUs
$ docker run --cpuset-cpus=0,1 -d ticketing-system
```

For the water attraction controls, she set memory limits with minimum guarantees:

```console
# Set memory limits and reservations
$ docker run --memory=512m --memory-reservation=256m -d water-controls
```

### Storage Efficiency with Union Filesystems

Maya leveraged her understanding of layered filesystems to optimize container images:

She reorganized their container images to maximize layer sharing, reducing the overall storage footprint by 40%.

She implemented a multi-stage build process that kept development tools in interim layers but excluded them from the final container images, reducing image size by 60%.

```dockerfile
# Multi-stage build example
FROM node:14 as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:14-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/server.js"]
```

### Enhanced Security with Isolation Controls

Maya implemented enhanced security using the isolation mechanisms:

She created custom seccomp profiles for different container types, limiting available system calls based on what each container legitimately needed.

She deployed AppArmor profiles for critical containers handling sensitive data:

```console
# Run container with custom AppArmor profile
$ docker run --security-opt apparmor=payment-processor-profile -d payment-processor
```

### The Results: More Secure and Efficient DigiLand

Six months after implementing these optimizations:

Container startup time decreased by 40% due to more efficient image layering

Memory usage decreased by 35% through proper cgroup configurations

Security team reported zero container escape incidents thanks to proper isolation

Storage costs decreased by 50% through efficient use of union filesystems

### Your Turn to Explore Container Fundamentals

Ready to understand container magic yourself? Here are some beginner-friendly ways to explore these technologies:

Explore namespaces:

```console
# Create a new namespace and run a shell inside it
$ sudo unshare --fork --pid --mount-proc bash
# Inside the namespace, you'll only see your own processes
$ ps aux
```

Experiment with cgroups:

```console
# Create a cgroup and limit its CPU usage
$ sudo cgcreate -g cpu:/mycgroup
$ sudo cgset -r cpu.shares=512 mycgroup
# Run a process in that cgroup
$ sudo cgexec -g cpu:/mycgroup stress --cpu 2
```

See union filesystems in action:

```console
# Inspect layers in a Docker image
$ docker inspect --format='{{.RootFS.Layers}}' nginx
```

Try a basic chroot:

```console
# Create a minimal chroot environment
$ mkdir -p /tmp/chroot/{bin,lib64}
$ cp /bin/bash /tmp/chroot/bin/
# Copy required libraries
$ ldd /bin/bash | grep -o '/lib.*[0-9]' | xargs -I{} cp {} /tmp/chroot{}
# Enter the chroot
$ sudo chroot /tmp/chroot /bin/bash
```

By understanding these Linux fundamentals, you'll gain deeper insight into how containers work their magic and how to optimize and secure them for your own projects.

Just as Maya discovered at DigiLand, containers aren't really magic after all they're clever combinations of Linux kernel features that create the illusion of isolation while maintaining efficiency. And that's even more impressive than magic!
