---
title: "One Cable, 200 Gbit/s: Connecting Two GB10 Systems with ConnectX-7"
date: 2026-07-18T19:56:44.778+04:00
lastmod: 2026-07-18T20:30:04.747+04:00
slug: "one-cable-200-gbits-connecting-two-gb10"
tags:
  - "Asus Ascent GX10"
  - "ConnectX-7"
  - "DGX-SPARK"
  - "GB10"
  - "Gigabyte AI TOP Atom"
  - "QSFP112"
system: "Asus Ascent GX10"
sourceURL: "https://www.subhashdasyam.com/2026/07/one-cable-200-gbits-connecting-two-gb10.html"
---
What looks like a simple Ethernet cable is one of the most interesting parts of a two-node GB10 setup. A single QSFP112 cable can provide a dedicated 200 Gbit/s path for distributed inference, model training, MPI, and NCCL traffic.

There is one surprise: Linux exposes the connected physical port as two network interfaces. A normal one-interface configuration leaves half of the host path unused. This guide configures both halves correctly, gives each one its own subnet, enables jumbo frames, and proves the result with a real RoCE benchmark.

This setup was validated between a Gigabyte AI TOP ATOM and an ASUS Ascent GX10, but the same layout applies to compatible DGX Spark and GB10 systems.

## What you will build

```
Gigabyte AI TOP ATOM                      ASUS Ascent GX10

enp1s0f1np1   192.168.200.13/24  <---->  192.168.200.12/24   enp1s0f1np1
enP2p1s0f1np1 192.168.201.13/24  <---->  192.168.201.12/24   enP2p1s0f1np1
                         one QSFP112 cable

```

Both rails use MTU 9000. Management access and Internet traffic stay on the existing LAN, which is intentionally not shown or changed in this guide.

At the end, you should have:

- Two active ConnectX-7 Ethernet interfaces on each system
- Two independent point-to-point subnets
- Working 9000-byte jumbo frames
- Active IPv4 RoCE v2 on both paths
- Close to 200 Gbit/s aggregate RDMA throughput
- Normal management networking that remains untouched

## The surprising part: one port, two Linux interfaces

The GB10 design connects one physical 200 Gbit/s QSFP port to the SoC through two PCIe 5.0 x4 paths. Linux therefore exposes the connected physical port as two Ethernet interfaces and two RoCE devices.

For this connection, the mapping is:

| Linux interface | RoCE device | Subnet |
| --- | --- | --- |
| `enp1s0f1np1` | `rocep1s0f1` | `192.168.200.0/24` |
| `enP2p1s0f1np1` | `roceP2p1s0f1` | `192.168.201.0/24` |

The two interfaces must use separate subnets. Do not interpret two`200000` speed reports as a 400 Gbit/s physical link. Together they provide the single physical port's 200 Gbit/s connection.

## Before you start

You need:

- Two compatible GB10 systems
- One supported Ethernet-mode QSFP112 DAC cable
- SSH access to both systems through their normal management network
- A user with sudo access on both systems
- Ubuntu 24.04 or a compatible DGX OS release

Most GB10 images already include the required networking tools. Check before continuing:

```
for tool in ibdev2netdev rdma show_gids ibv_devinfo ib_write_bw ethtool; do
  command -v "$tool" || printf 'Missing tool: %s\n' "$tool"
done

```

If a tool is missing, install the relevant Ubuntu packages:

```
sudo apt update
sudo apt install -y rdma-core ibverbs-utils perftest ethtool

```

## Step 1: Connect the cable

1. Power on both systems.
2. Use one supported QSFP112 DAC cable.
3. Connect the cable to the same rear ConnectX-7 port on both systems.
4. Insert each connector with the pull tab facing the top of the system.
5. Do not force a connector that does not slide in smoothly.

NVIDIA currently lists the Amphenol`NJAAKK-N911` and Luxshare`LMTQF022-SD-R` as supported cable examples.

## Step 2: Confirm management access and sudo

On your administration computer, define placeholders for your own username and management addresses. These values are examples only and are not used for ConnectX traffic:

```
export ADMIN_USER="<your-admin-user>"
export GIGABYTE_MGMT="<gigabyte-management-ip>"
export ASUS_MGMT="<asus-management-ip>"

```

Confirm that both systems are reachable and that sudo works:

```
ssh -t "${ADMIN_USER}@${GIGABYTE_MGMT}" 'hostname; sudo -v'
ssh -t "${ADMIN_USER}@${ASUS_MGMT}" 'hostname; sudo -v'

```

Enter the sudo password if prompted. Record the hostname returned by each command. Both commands must complete successfully before changing the network configuration.

## Step 3: Identify the active ConnectX interfaces

Run this on both systems:

```
ibdev2netdev
ip -br link
rdma link show

```

For the current cable position, the important output is:

```
rocep1s0f1 port 1 ==> enp1s0f1np1 (Up)
roceP2p1s0f1 port 1 ==> enP2p1s0f1np1 (Up)

```

The`f0` interfaces show`Down` because the other physical QSFP port is unused. If the cable is moved to the other physical port, identify the new pair with`ibdev2netdev` before editing Netplan.

## Step 4: Back up the existing Netplan file

Run on both systems:

```
BACKUP_FILE="/etc/netplan/40-cx7.yaml.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp -a /etc/netplan/40-cx7.yaml "$BACKUP_FILE"
printf 'Saved backup: %s\n' "$BACKUP_FILE"

```

Save the printed path. You will need it if you use the rollback section later.

## Step 5: Configure the ASUS Ascent GX10

SSH to the ASUS system:

```
ssh "${ADMIN_USER}@${ASUS_MGMT}"

```

Create its persistent Netplan configuration:

```
sudo tee /etc/netplan/40-cx7.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    enp1s0f1np1:
      addresses:
        - 192.168.200.12/24
      dhcp4: false
      mtu: 9000
    enP2p1s0f1np1:
      addresses:
        - 192.168.201.12/24
      dhcp4: false
      mtu: 9000
EOF

sudo chmod 600 /etc/netplan/40-cx7.yaml
sudo netplan generate
sudo netplan apply

```

Keep this SSH session open until the management connection is confirmed from another terminal.

## Step 6: Configure the Gigabyte AI TOP ATOM

SSH to the Gigabyte system:

```
ssh "${ADMIN_USER}@${GIGABYTE_MGMT}"

```

Create its persistent Netplan configuration:

```
sudo tee /etc/netplan/40-cx7.yaml > /dev/null <<'EOF'
network:
  version: 2
  ethernets:
    enp1s0f1np1:
      addresses:
        - 192.168.200.13/24
      dhcp4: false
      mtu: 9000
    enP2p1s0f1np1:
      addresses:
        - 192.168.201.13/24
      dhcp4: false
      mtu: 9000
EOF

sudo chmod 600 /etc/netplan/40-cx7.yaml
sudo netplan generate
sudo netplan apply

```

## Step 7: Verify addresses, routes, carrier, speed, and MTU

Run on both systems:

```
ip -br addr show enp1s0f1np1
ip -br addr show enP2p1s0f1np1
ip route show

for nic in enp1s0f1np1 enP2p1s0f1np1; do
  printf '%s carrier=%s speed=%s mtu=%s\n' \
    "$nic" \
    "$(cat /sys/class/net/$nic/carrier)" \
    "$(cat /sys/class/net/$nic/speed)" \
    "$(cat /sys/class/net/$nic/mtu)"
done

```

Expected values for both interfaces on both systems:

```
carrier=1
speed=200000
mtu=9000

```

Check that peer traffic uses the intended rail.

On the Gigabyte system:

```
ip route get 192.168.200.12
ip route get 192.168.201.12

```

Expected devices are`enp1s0f1np1` for`192.168.200.12` and`enP2p1s0f1np1` for`192.168.201.12`.

## Step 8: Test normal and jumbo packets

From the Gigabyte system to the ASUS system:

```
ping -I enp1s0f1np1 -c 5 192.168.200.12
ping -I enP2p1s0f1np1 -c 5 192.168.201.12

ping -I enp1s0f1np1 -M do -s 8972 -c 5 192.168.200.12
ping -I enP2p1s0f1np1 -M do -s 8972 -c 5 192.168.201.12

```

From the ASUS system to the Gigabyte system:

```
ping -I enp1s0f1np1 -c 5 192.168.200.13
ping -I enP2p1s0f1np1 -c 5 192.168.201.13

ping -I enp1s0f1np1 -M do -s 8972 -c 5 192.168.200.13
ping -I enP2p1s0f1np1 -M do -s 8972 -c 5 192.168.201.13

```

All eight tests should report zero packet loss. The`8972` byte payload plus ICMP and IPv4 headers produces a 9000 byte packet.

## Step 9: Verify RoCE

Run on both systems:

```
rdma link show rocep1s0f1/1
rdma link show roceP2p1s0f1/1
show_gids
ibv_devinfo -d rocep1s0f1
ibv_devinfo -d roceP2p1s0f1

```

Expected state:

```
state ACTIVE physical_state LINK_UP
link_layer: Ethernet
active_mtu: 4096

```

`show_gids` should list IPv4 RoCE v2 entries at GID index 3 for both configured addresses.

## Step 10: Test one RoCE rail

On the ASUS system, start the server:

```
ib_write_bw -d rocep1s0f1 -x 3 -F --report_gbits -D 10

```

On the Gigabyte system, start the client:

```
ib_write_bw -d rocep1s0f1 -x 3 -F --report_gbits -D 10 \
  192.168.200.12

```

Repeat with`roceP2p1s0f1` and`192.168.201.12` to test the second rail.

## Step 11: Test aggregate 200 Gbit/s RoCE throughput

Open two terminals on the ASUS system and start one server per rail.

ASUS terminal 1:

```
ib_write_bw -d rocep1s0f1 -x 3 -p 18515 -F --report_gbits -D 10

```

ASUS terminal 2:

```
ib_write_bw -d roceP2p1s0f1 -x 3 -p 18516 -F --report_gbits -D 10

```

Then open two terminals on the Gigabyte system and start both clients at nearly the same time.

Gigabyte terminal 1:

```
ib_write_bw -d rocep1s0f1 -x 3 -p 18515 -F --report_gbits -D 10 \
  192.168.200.12

```

Gigabyte terminal 2:

```
ib_write_bw -d roceP2p1s0f1 -x 3 -p 18516 -F --report_gbits -D 10 \
  192.168.201.12

```

Add the two`BW average` results to obtain aggregate throughput. To test the opposite direction, run the servers on the Gigabyte system and use`192.168.200.13` and`192.168.201.13` as the client targets from the ASUS system.

## Step 12: Verify SSH over the ConnectX network

Choose the account that exists on both systems:

```
export CLUSTER_USER="<your-cluster-user>"

```

From the Gigabyte system:

```
ssh "${CLUSTER_USER}@192.168.200.12" hostname
ssh "${CLUSTER_USER}@192.168.201.12" hostname

```

From the ASUS system:

```
ssh "${CLUSTER_USER}@192.168.200.13" hostname
ssh "${CLUSTER_USER}@192.168.201.13" hostname

```

If a password is requested, configure SSH keys for your chosen cluster account before running unattended distributed jobs.

## Verified results on 2026-07-18

The completed configuration produced these results:

| Check | Result |
| --- | --- |
| Carrier | Up on both logical interfaces on both systems |
| Negotiated speed | `200000` Mb/s reported on both logical interfaces |
| MTU | 9000 on both logical interfaces on both systems |
| Jumbo ping | Zero packet loss in both directions on both subnets |
| RDMA state | Both RoCE devices active with physical link up |
| Single rail RoCE write | 109.28 Gbit/s on rail 1 and 109.25 Gbit/s on rail 2 |
| Simultaneous RoCE write, Gigabyte to ASUS | 98.02 + 98.02 = 196.04 Gbit/s |
| Simultaneous RoCE write, ASUS to Gigabyte | 98.02 + 98.02 = 196.04 Gbit/s |
| Kernel link errors | Zero RX errors, RX drops, TX errors, and TX drops on all active interfaces |
| Management routes | Existing LAN routes remained unchanged |

TCP`iperf3` can report much lower throughput than RoCE because its CPU and kernel networking path becomes the bottleneck. Use`ib_write_bw` to validate the high-speed RoCE data path.

## Persistence check after a reboot

After a planned reboot, reconnect through the management network and run:

```
sudo netplan get
ip -br addr show enp1s0f1np1
ip -br addr show enP2p1s0f1np1
rdma link show

```

The two static addresses and MTU 9000 should return automatically.

## Rollback

If the new MTU or addressing must be removed, first list the available backups:

```
sudo ls -1t /etc/netplan/40-cx7.yaml.backup.*

```

Choose the backup created before this setup, then restore it on the affected system:

```
export BACKUP_FILE="<path-printed-in-step-4>"
sudo cp -a "$BACKUP_FILE" /etc/netplan/40-cx7.yaml
sudo chmod 600 /etc/netplan/40-cx7.yaml
sudo netplan generate
sudo netplan apply

```

Then verify management access and inspect the restored state with`sudo netplan get`.

## Troubleshooting

### Both interface pairs show no carrier

1. Confirm that one QSFP cable connects the same physical port on both systems.
2. Reseat both connectors with their pull tabs facing up.
3. Confirm that the cable is a supported Ethernet-mode QSFP112 DAC.
4. Reboot both systems with the cable already connected if hot-plug detection does not recover.

### The active interfaces have different names

Run`ibdev2netdev` on each system. Use the two interfaces that correspond to the same connected physical port. Update both Netplan files with those detected names.

### Jumbo ping reports message too long

Check MTU on both logical interfaces at both ends:

```
ip link show enp1s0f1np1
ip link show enP2p1s0f1np1

```

All four endpoints must use the same MTU.

### The IPv4 RoCE GID is missing

1. Confirm the static IP address with`ip -br addr`.
2. Run`sudo netplan generate` and`sudo netplan apply`.
3. Confirm that`rdma link show` reports`ACTIVE`.
4. Run`show_gids` again and use the IPv4 RoCE v2 GID index reported for the interface.

### ib_write_bw cannot connect

1. Match`rocep1s0f1` with the`192.168.200.0/24` subnet.
2. Match`roceP2p1s0f1` with the`192.168.201.0/24` subnet.
3. Use the same control port on the server and client.
4. Confirm that no firewall blocks the selected control port.
5. Confirm that the server is waiting before starting the client.

## References

- NVIDIA DGX Spark Stacking
- NVIDIA Sync Cluster Assistant for ConnectX-7
- NVIDIA ConnectX-7 Cluster Network Inspection
- NVIDIA Connect Two Sparks playbook
