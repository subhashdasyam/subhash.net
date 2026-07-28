---
title: "Container Networking: The Invisible Connections of DigiLand - PART 5"
date: 2025-05-21T22:19:00.008+04:00
lastmod: 2025-05-21T22:24:18.238+04:00
slug: "container-networking-invisible"
tags:
  - "CNI"
  - "container network"
  - "Container Networking"
  - "container-series"
system: "CNI"
sourceURL: "https://www.subhashdasyam.com/2025/05/container-networking-invisible.html"
---
Before reading this article please cover the previous part here

A month after optimizing DigiLand's container images, Maya found herself studying a network diagram in the operations center, puzzled by the complexity of connections between the park's containerized services.

"Our ticket scanning application works fine in testing, but when we deploy to production, it can't reliably connect to the customer database," Maya explained to Connie. "And our pricing service containers sometimes can't discover each other after scaling up."

Connie nodded thoughtfully. "Containers may be isolated by default, but they need to communicate to be useful. I think it's time we explore how containers actually talk to each other."

"I understand the basics of networking," Maya said, gesturing to her diagram. "But how does it work when everything is in containers that can start, stop, and move around the cluster at any moment?"

"That's a perfect question," Connie replied. "Let's visit DigiLand's Network Operations Center - our NOC - and see how container networking really works in a distributed system."

### The Container Network Operations Center

The next morning, Connie led Maya to a section of DigiLand's technical operations she hadn't seen before - a room filled with large network topology displays, traffic visualization screens, and workstations where engineers were configuring and monitoring the invisible connections between containers.

"Welcome to our Network Operations Center," Connie said. "This is where we ensure all those isolated containers can communicate efficiently and securely."

The Container Network Operations Center

"Before we dive deeper, let's understand the fundamental problem of container networking," Connie said, leading Maya to a demonstration area with several server racks.

### Container Isolation: Network Namespaces

Connie gestured to a workstation running a visualization of container internals.

"Containers are isolated by Linux namespaces, including network namespaces," she explained. "A network namespace is essentially a copy of the network stack with its own interfaces, routing tables, and firewall rules."

Container Network Namespaces

"Let me demonstrate how network namespaces work," Connie said, typing commands into a terminal:

```console
# Create two network namespaces
$ sudo ip netns add container1
$ sudo ip netns add container2

# Each namespace has its own isolated network stack
$ sudo ip netns exec container1 ip link list
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN mode DEFAULT group default
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00

# Create a virtual ethernet pair to connect them
$ sudo ip link add veth1 type veth peer name veth2

# Move each end into a different namespace
$ sudo ip link set veth1 netns container1
$ sudo ip link set veth2 netns container2

# Configure IP addresses in each namespace
$ sudo ip netns exec container1 ip addr add 192.168.1.1/24 dev veth1
$ sudo ip netns exec container2 ip addr add 192.168.1.2/24 dev veth2

# Bring up the interfaces
$ sudo ip netns exec container1 ip link set veth1 up
$ sudo ip netns exec container2 ip link set veth2 up

# Now they can communicate
$ sudo ip netns exec container1 ping 192.168.1.2
PING 192.168.1.2 (192.168.1.2) 56(84) bytes of data.
64 bytes from 192.168.1.2: icmp_seq=1 ttl=64 time=0.045 ms

```

"This is the fundamental mechanism behind container networking," Connie explained. "Container runtimes create network namespaces for isolation, then connect them using virtual ethernet pairs, bridges, and other network constructs."

"But that looks like a lot of manual configuration," Maya noted. "How do we automate all of this for thousands of containers?"

"That's where the Container Network Interface comes in," Connie replied, leading Maya to another section.

### Container Network Interface (CNI): Standardizing Network Setup

Connie pointed to a large display showing a modular networking architecture.

"The Container Network Interface, or CNI, is a specification that standardizes how container runtimes interact with network plugins," she explained.

Container Network Interface Architecture

"CNI provides a common interface for container runtimes to request network setup and teardown," Connie continued. "It's like a universal adapter between containers and networks."

She showed Maya a CNI configuration file:

```json
{
  "cniVersion": "1.0.0",
  "name": "digiland-network",
  "type": "bridge",
  "bridge": "cni0",
  "isGateway": true,
  "ipMasq": true,
  "ipam": {
    "type": "host-local",
    "ranges": [
      [{"subnet": "10.22.0.0/16"}]
    ],
    "routes": [{"dst": "0.0.0.0/0"}]
  }
}

```

"When a container runtime like containerd or CRI-O needs to set up networking for a new container, it identifies the correct CNI configuration, then calls the specified plugin with the right parameters," Connie explained.

She demonstrated the process:

```console
# Simulating what a container runtime does when creating a container
$ cat > /tmp/netconf.json << EOF
{
  "cniVersion": "1.0.0",
  "name": "demo-network",
  "type": "bridge",
  "bridge": "cni-demo",
  "isGateway": true,
  "ipMasq": true,
  "ipam": {
    "type": "host-local",
    "subnet": "172.16.0.0/24"
  }
}
EOF

# Create network namespace for the container
$ sudo ip netns add demo-container

# Call CNI plugin to set up networking (what the runtime would do)
$ sudo CNI_COMMAND=ADD \
       CNI_CONTAINERID=demo123 \
       CNI_NETNS=/var/run/netns/demo-container \
       CNI_IFNAME=eth0 \
       CNI_PATH=/opt/cni/bin \
       /opt/cni/bin/bridge < /tmp/netconf.json

# The container now has networking configured automatically
$ sudo ip netns exec demo-container ip addr show
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN group default
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0@if8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 0a:58:0a:16:00:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.16.0.2/24 scope global eth0
       valid_lft forever preferred_lft forever

```

"The beauty of CNI is its simplicity and flexibility," Connie noted. "It allows us to swap different network implementations without changing our container runtime."

"So what kind of network implementations do we use at DigiLand?" Maya asked.

"That's a great question," Connie replied. "Let's explore the different network models we use in different scenarios."

### Container Network Models: Connecting in Different Ways

Connie led Maya to a section with various network topology diagrams.

"Different applications have different networking requirements," Connie explained. "CNI allows us to choose the right network model for each use case."

### Bridge Networks: Single-Host Communication

"The simplest model is a bridge network, which connects containers on the same host," Connie said, pointing to a diagram.

Bridge Network Architecture

"In a bridge network, containers on the same host are connected to a virtual switch," Connie explained. "They can communicate directly with each other and access external networks through Network Address Translation (NAT)."

She demonstrated a bridge network in action:

```console
# Create a bridge network
$ docker network create --driver bridge digiland-local

# Run containers on this network
$ docker run -d --name web --network digiland-local nginx
$ docker run -d --name db --network digiland-local postgres

# Containers can communicate by name
$ docker exec web ping db
PING db (172.18.0.3) 56(84) bytes of data.
64 bytes from db (172.18.0.3): icmp_seq=1 ttl=64 time=0.123 ms

# Inspect the network
$ docker network inspect digiland-local
[
    {
        "Name": "digiland-local",
        "Id": "7d86d31b73891a1d3775c39f35d5229d0ecdb9dc82636a1ce2a5e585f7ebdb39",
        "Created": "2023-05-10T10:15:04.998Z",
        "Scope": "local",
        "Driver": "bridge",
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": {},
            "Config": [
                {
                    "Subnet": "172.18.0.0/16",
                    "Gateway": "172.18.0.1"
                }
            ]
        },
        "Internal": false,
        "Containers": {
            "2a8b27d9e8a1": {
                "Name": "web",
                "EndpointID": "12ab3c45d6e7...",
                "MacAddress": "02:42:ac:12:00:02",
                "IPv4Address": "172.18.0.2/16",
                "IPv6Address": ""
            },
            "3b9c38e0f9b2": {
                "Name": "db",
                "EndpointID": "78ef9g01h2i3...",
                "MacAddress": "02:42:ac:12:00:03",
                "IPv4Address": "172.18.0.3/16",
                "IPv6Address": ""
            }
        },
        "Options": {
            "com.docker.network.bridge.name": "docker1"
        }
    }
]

# Look at the Linux bridge created on the host
$ ip addr show docker1
5: docker1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:b0:5d:36:3c brd ff:ff:ff:ff:ff:ff
    inet 172.18.0.1/16 brd 172.18.255.255 scope global docker1
       valid_lft forever preferred_lft forever

```

"Bridge networks are simple and effective for single-host deployments," Connie noted. "But what about containers that need to communicate across multiple hosts?"

### Overlay Networks: Multi-Host Communication

"For multi-host communication, we use overlay networks," Connie said, moving to another diagram.

Overlay Network Architecture

"Overlay networks create a virtual layer 2 network that spans across multiple hosts," Connie explained. "Containers can communicate as if they're on the same local network, even when they're physically distributed."

She demonstrated with a Kubernetes cluster:

```yaml
# Create an overlay network in Kubernetes
$ kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: ticketing
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ticketing-db
  namespace: ticketing
spec:
  podSelector:
    matchLabels:
      app: ticketing-api
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: ticketing-db
    ports:
    - protocol: TCP
      port: 5432
EOF

# Inspect the overlay network
$ kubectl get pods -n kube-system -l k8s-app=calico-node
NAME                READY   STATUS    RESTARTS   AGE
calico-node-5t7zq   1/1     Running   0          15d
calico-node-m9pfz   1/1     Running   0          15d
calico-node-rwf8l   1/1     Running   0          15d

# Look at the overlay interfaces on a host
$ ip link show | grep cali
12: cali8a7e8fd@if3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default
14: calif345a8b@if3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default

# Trace a packet through the overlay
$ kubectl exec -n ticketing deploy/ticketing-api -- curl -v ticketing-db.ticketing.svc.cluster.local:5432

```

"Under the hood, overlay networks use encapsulation protocols like VXLAN or GENEVE to wrap container packets inside packets that can be routed between hosts," Connie explained. "It's like creating virtual tunnels between all your hosts."

"But what if containers need to appear directly on the physical network?" Maya asked.

### Macvlan Networks: Direct Physical Network Integration

"For cases where containers need to look like physical devices on your network, we use macvlan," Connie said, moving to a third diagram.

Macvlan Network Architecture

"With macvlan, each container gets its own MAC address and appears as a distinct device on your physical network," Connie explained. "This is useful for network-intensive applications and for migrating traditional VM workloads to containers."

She demonstrated a macvlan configuration:

```console
# Create a macvlan network
$ docker network create -d macvlan \
  --subnet=192.168.50.0/24 \
  --gateway=192.168.50.1 \
  -o parent=eth0 digiland-direct

# Run a container on the macvlan network
$ docker run -d --name direct-access --network digiland-direct nginx

# The container now has an address directly on the physical network
$ docker exec direct-access ip addr show eth0
eth0@if3: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:c0:a8:32:02 brd ff:ff:ff:ff:ff:ff
    inet 192.168.50.2/24 brd 192.168.50.255 scope global eth0
       valid_lft forever preferred_lft forever

```

"Macvlan networks provide near-native performance since packets don't need to be processed by a bridge or encapsulated," Connie noted. "But they also require more coordination with your physical network infrastructure."

"These options are impressive," Maya said, "but how do containers find each other? With containers starting and stopping dynamically, how do they know where to connect?"

### Service Discovery: Finding Services in a Dynamic World

Connie smiled. "That's the million-dollar question in container networking. Let's look at service discovery."

She led Maya to a section focused on container addressing and discovery.

Container Service Discovery Architecture

"Container environments need dynamic service discovery because of their ephemeral nature," Connie explained. "We use several techniques depending on the complexity of the environment."

### DNS-Based Discovery

"The simplest approach is DNS-based discovery," Connie said, showing Maya a terminal:

```console
# Start a service with a name
$ docker run -d --name ticketing-db postgres

# Other containers can find it by name
$ docker run --rm alpine nslookup ticketing-db
Name:      ticketing-db
Address:   172.17.0.2

```

"In Kubernetes, this gets more sophisticated," Connie continued, switching to a Kubernetes example:

```console
# Create a service that selects pods by label
$ kubectl create deployment nginx --image=nginx --replicas=3
$ kubectl expose deployment nginx --port=80

# The service provides stable DNS name and load balancing
$ kubectl run test --rm -it --image=alpine -- sh
/ # nslookup nginx
Name:      nginx
Address:   10.96.43.172  # Cluster IP that load balances to any matching pod

/ # wget -O- nginx
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...

```

"The beauty is that pods can come and go, but the service provides a stable address," Connie noted. "Kubernetes handles updating the endpoints automatically."

### Key-Value Store Registration

"For more complex scenarios, especially spanning multiple environments, we use key-value stores for service registration and discovery," Connie explained, showing a Consul dashboard:

```console
# Register a service manually
$ curl -X PUT -d '{
  "ID": "ticket-api-1",
  "Name": "ticket-api",
  "Address": "10.15.0.5",
  "Port": 8080,
  "Tags": ["v2", "production"],
  "Meta": {
    "version": "2.0.1"
  }
}' http://localhost:8500/v1/agent/service/register

# Query for services
$ curl http://localhost:8500/v1/catalog/service/ticket-api
[
  {
    "ID": "ticket-api-1",
    "Node": "node3",
    "Address": "10.15.0.5",
    "ServiceID": "ticket-api-1",
    "ServiceName": "ticket-api",
    "ServiceAddress": "10.15.0.5",
    "ServicePort": 8080,
    "ServiceTags": ["v2", "production"],
    "ServiceMeta": {
      "version": "2.0.1"
    }
  }
]

```

"Systems like Consul, etcd, or ZooKeeper maintain a distributed registry of services," Connie explained. "Containers register themselves when they start up and deregister when they terminate."

### Service Mesh Proxies

"For our most critical microservices, we use a service mesh," Connie said, showing Maya a complex visualization of service interactions:

Service Mesh Architecture

"A service mesh adds a proxy next to each service container," Connie explained. "These proxies handle all the networking complexity: discovery, load balancing, retries, circuit breaking, and even security."

She showed Maya a configuration example:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ticketing-service
spec:
  hosts:
  - ticketing.digiland.internal
  gateways:
  - digiland-gateway
  http:
  - match:
    - uri:
        prefix: /v1
    route:
    - destination:
        host: ticketing-v1
        port:
          number: 80
      weight: 90
  - match:
    - uri:
        prefix: /v2
    route:
    - destination:
        host: ticketing-v2
        port:
          number: 80
      weight: 10

```

"With a service mesh, we can implement sophisticated traffic routing policies, perform gradual rollouts, and gain deep visibility into service communications," Connie noted. "The service containers themselves don't need to know anything about this - it's all handled transparently by the mesh."

### Maya Applies Her Knowledge at DigiLand

In the weeks following her networking exploration, Maya put her new understanding to work, implementing several improvements to DigiLand's container networking.

### Implementing Network Policies

First, Maya secured their Kubernetes environment with network policies:

```yaml
# Default deny all ingress and egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: ticketing
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Allow ticketing frontend to connect to API
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: ticketing
spec:
  podSelector:
    matchLabels:
      app: ticketing-api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ticketing-frontend
    ports:
    - protocol: TCP
      port: 8080

---
# Allow API to connect to database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
  namespace: ticketing
spec:
  podSelector:
    matchLabels:
      app: ticketing-db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ticketing-api
    ports:
    - protocol: TCP
      port: 5432

```

This micro-segmentation approach significantly improved security by enforcing the principle of least privilege in their container communications.

### Optimizing Cross-Zone Communication

Next, Maya addressed their cross-datacenter performance issues:

```yaml
# Configure CoreDNS to keep traffic local when possible
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health
        kubernetes cluster.local in-addr.arpa ip6.arpa {
          pods insecure
          fallthrough in-addr.arpa ip6.arpa
          ttl 30
        }
        loadbalance round_robin
        topology kubernetes_node_topology_key: topology.kubernetes.io/zone
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }

```

This configuration ensured that pod-to-pod communication would prefer local zone endpoints when available, reducing cross-zone traffic by 68%.

### Implementing External Service Integration

For services outside the container environment, Maya implemented a service entry system:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: payment-gateway
spec:
  hosts:
  - payments.external-provider.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: payment-gateway
spec:
  host: payments.external-provider.com
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 1m
      baseEjectionTime: 30m

```

This allowed DigiLand's containerized services to reliably connect to external payment processors while maintaining circuit-breaking capabilities for resiliency.

### Implementing a Service Mesh for Critical Services

Finally, Maya deployed a service mesh for their most critical visitor-facing services:

```yaml
# Deploy the service mesh control plane
$ kubectl apply -f istio-operator.yaml

# Inject proxies into critical services
$ kubectl label namespace visitor-experience istio-injection=enabled

# Configure traffic management for graceful rollouts
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ride-wait-times
spec:
  hosts:
  - wait-times.digiland.internal
  http:
  - route:
    - destination:
        host: wait-times-v1
      weight: 90
    - destination:
        host: wait-times-v2
      weight: 10
  - route:
    - destination:
        host: wait-times-v1
      headers:
        request:
          set:
            x-testing-version: "true"

```

This service mesh implementation provided granular traffic control and deep visibility into service communications, allowing for safer deployments and better debugging capabilities.

### The Results: A More Reliable Container Ecosystem

Six months after implementing these networking improvements:

Cross-zone network traffic decreased by 68%

Service connection errors decreased by 92%

Deployment reliability increased from 94% to 99.7%

Mean time to resolution for network issues decreased by 75%

Security incidents related to container networking dropped to zero

"I never realized how complex container networking could be," Maya told Connie as they reviewed the improvements. "But understanding these fundamentals has transformed how our applications communicate and made everything more reliable."

"That's the beauty of container networking," Connie replied. "When done right, it's flexible enough to support any application architecture while remaining invisible to the applications themselves."

### Your Turn to Explore Container Networking

Ready to dive deeper into container networking yourself? Here are some beginner-friendly experiments to try:

Explore network namespaces:

```console
# Create network namespaces
$ sudo ip netns add container1
$ sudo ip netns add container2

# Create a virtual ethernet pair
$ sudo ip link add veth1 type veth peer name veth2

# Move each end to a namespace
$ sudo ip link set veth1 netns container1
$ sudo ip link set veth2 netns container2

# Configure IP addresses
$ sudo ip netns exec container1 ip addr add 192.168.1.1/24 dev veth1
$ sudo ip netns exec container2 ip addr add 192.168.1.2/24 dev veth2

# Bring up the interfaces
$ sudo ip netns exec container1 ip link set veth1 up
$ sudo ip netns exec container1 ip link set lo up
$ sudo ip netns exec container2 ip link set veth2 up
$ sudo ip netns exec container2 ip link set lo up

# Test connectivity
$ sudo ip netns exec container1 ping 192.168.1.2
```

Experiment with Docker networks:

```console
# Create different network types
$ docker network create --driver bridge bridge-demo
$ docker network create --driver overlay overlay-demo
$ docker network create -d macvlan --subnet=192.168.50.0/24 -o parent=eth0 macvlan-demo

# Run containers on different networks
$ docker run -d --name bridge-container --network bridge-demo nginx
$ docker run -d --name overlay-container --network overlay-demo nginx
$ docker run -d --name macvlan-container --network macvlan-demo nginx

# Inspect the networks
$ docker network inspect bridge-demo
$ docker network inspect overlay-demo
$ docker network inspect macvlan-demo
```

Implement service discovery:

```console
# Simple DNS-based discovery with Docker Compose
$ cat > docker-compose.yml << EOF
version: '3'
services:
  web:
    image: nginx
    depends_on:
      - api
  api:
    image: node:alpine
    command: node -e "require('http').createServer((req, res) => { res.end('Hello from API\\n'); }).listen(3000)"
  db:
    image: postgres
    environment:
      POSTGRES_PASSWORD: example
EOF

$ docker-compose up -d

# Test service discovery
$ docker-compose exec web curl api:3000
Hello from API

$ docker-compose exec api curl db:5432
# Connection established but protocol error expected (curl to Postgres)
```

Explore Kubernetes networking:

```console
# Create a simple application
$ kubectl create deployment nginx --image=nginx --replicas=3
$ kubectl expose deployment nginx --port=80

# Test DNS-based service discovery
$ kubectl run test --rm -it --image=alpine -- sh
/ # nslookup nginx
/ # wget -O- nginx

# Examine the network interfaces
$ kubectl get pod -o wide
$ kubectl exec -it nginx-<pod-id> -- ip addr show
```

Implement network policies:

```yaml
# Create a namespace for testing
$ kubectl create namespace netpolicy-test

# Create test deployments
$ kubectl -n netpolicy-test create deployment web --image=nginx
$ kubectl -n netpolicy-test create deployment api --image=nginx
$ kubectl -n netpolicy-test create deployment db --image=postgres --env="POSTGRES_PASSWORD=test"

# Expose services
$ kubectl -n netpolicy-test expose deployment web --port=80
$ kubectl -n netpolicy-test expose deployment api --port=80
$ kubectl -n netpolicy-test expose deployment db --port=5432

# Apply a default deny policy
$ kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: netpolicy-test
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# Test connections (should fail due to policy)
$ kubectl -n netpolicy-test run test --rm -it --image=alpine -- sh
/ # wget -O- web
wget: download timed out

# Allow specific connections
$ kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web
  namespace: netpolicy-test
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 80
EOF

# Test again (web should work now)
$ kubectl -n netpolicy-test run test --rm -it --image=alpine -- sh
/ # wget -O- web
<!DOCTYPE html>...
```

By mastering container networking, you'll be able to create more secure, efficient, and reliable containerized applications, just as Maya did at DigiLand.

Just as physical theme parks need carefully designed transportation systems to move visitors between attractions, container environments need well-architected networks to connect services in a dynamic, mobile environment. With these networking principles in mind, you can create container environments that provide secure and reliable communication, automatic service discovery, and the flexibility to adapt to changing requirements.

### Networking Best Practices for Container Environments

As Maya discovered throughout her journey, container networking presents unique challenges compared to traditional network architecture. Here are some key lessons she documented for the DigiLand operations team:

Design for ephemerality: Container IP addresses and locations will change frequently. Never hardcode IP addresses; always use service names and DNS discovery.

Implement defense in depth: Apply network segmentation at multiple layers:

Consider cross-node performance: In multi-host environments, be mindful of:

Monitor the invisible layer: Implement comprehensive monitoring for:

Automate network changes: Manual network configuration can't keep up with the speed of container deployment. Automate through:

Through these practices, Maya transformed DigiLand's container communication from a source of outages to a foundation for reliability. As Connie told her during their final review: "Containers may be designed to be isolated, but it's the connections between them that make them truly powerful."
