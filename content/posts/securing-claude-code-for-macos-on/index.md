---
title: "Securing Claude Code for macOS on Enterprise Environments"
date: 2025-10-07T15:13:00.008+04:00
lastmod: 2026-01-06T12:48:29.234+04:00
slug: "securing-claude-code-for-macos-on"
tags:
  - "Claude code"
  - "Mac OS"
system: "Claude code"
sourceURL: "https://www.subhashdasyam.com/2025/10/securing-claude-code-for-macos-on.html"
---
## 1. Executive Summary

### 1.1 Document Purpose

This guide provides enterprise security teams with comprehensive strategies for deploying and securing Claude Code in macOS environments. Unlike consumer deployments, enterprise installations require defense-in-depth approaches that leverage macOS-specific security features including System Integrity Protection (SIP), Gatekeeper, Configuration Profiles, and Mobile Device Management (MDM) integration.

### 1.2 Key Security Objectives

Primary Goals:

- Prevent unauthorized access to sensitive files and directories
- Block shadow installations in user directories
- Enforce read-only managed configurations
- Integrate with macOS security frameworks (TCC, Gatekeeper, SIP)
- Enable comprehensive audit logging and compliance reporting
- Support zero-trust architecture principles

Security Boundaries:

- System-level installation at`/Library/Application Support/ClaudeCode/`
- Non-writable configuration hierarchy with managed policies
- Hook-based access controls for file operations
- Integration with Unified Logging System and SIEM
- MDM-enforced security profiles

### 1.3 Target Environment

Supported Systems:

- macOS 12 (Monterey) or later
- Apple Silicon (M1/M2/M3) and Intel-based Macs
- Managed via MDM (Jamf Pro, Kandji, Intune, or similar)
- Enterprise networks with centralized logging (Splunk, ELK, etc.)

Prerequisites:

- MDM enrollment required for managed deployments
- Administrative access for initial setup
- Node.js 18+ with npm (managed installation)
- FileVault disk encryption enabled
- Gatekeeper and SIP enabled (default)

### 1.4 Deployment Models

| Model | Description | Use Case |
| --- | --- | --- |
| MDM-Managed | Full MDM deployment with Configuration Profiles | 500+ devices, strict compliance |
| Scripted Installation | Bash/zsh script with manual setup | 50-500 devices, moderate control |
| Hybrid | Script + selective MDM profiles | Mixed environments |
| Developer Workstation | Enhanced security for dev machines | High-risk teams (finance, security) |

### 1.5 Document Structure

This guide follows a layered security approach:

1. Foundation (Sections 1-3): Understanding the security landscape
2. Installation (Section 4): Secure npm and system-level setup
3. Configuration (Section 5): Managed policy hierarchy
4. Protection (Sections 6-9): Hooks, shadow prevention, monitoring
5. Integration (Sections 10-11): Logging, audit, MDM deployment
6. Operations (Sections 12-15): Testing, compliance, maintenance

## 2. Threat Model & Risk Assessment

### 2.1 macOS-Specific Threat Landscape

Primary Threats:

User Directory Shadow Installations

- Risk Level: HIGH
- Vector: Developers install Claude Code in`~/` or`~/.local/` to bypass system controls
- Impact: Policy circumvention, unauthorized file access
- macOS Specifics: Homebrew, nvm, nodenv create alternate installation paths

Sensitive File Exfiltration

- Risk Level: CRITICAL
- Vector: Claude Code's file read capabilities access secrets
- Targets:`.env`,`id_rsa`, Keychain exports, AWS credentials,`.npmrc` with tokens
- macOS Specifics: Keychain-stored SSH keys, iCloud Drive synced files

Configuration Override

- Risk Level: MEDIUM
- Vector: Local`~/.config/claude-code/` configs override managed settings
- Impact: Hook bypass, policy evasion
- macOS Specifics: Plist files,`~/Library/Application Support/` overrides

Homebrew Package Manager Bypass

- Risk Level: HIGH
- Vector:`brew install @anthropic/claude-code` installs to`/usr/local/` or`/opt/homebrew/`
- Impact: Unmanaged installation outside IT control
- macOS Specifics: Homebrew is default package manager on macOS

TCC (Transparency, Consent, and Control) Abuse

- Risk Level: MEDIUM
- Vector: Claude Code requests Full Disk Access permission
- Impact: Bypass TCC protections for sensitive directories
- macOS Specifics: User can grant FDA, overriding admin intent

nvm/nodenv Version Switching

- Risk Level: MEDIUM
- Vector: Developers use node version managers to install alternate npm globals
- Impact: Shadow installation in`~/.nvm/` or`~/.nodenv/`
- macOS Specifics: Common development practice on macOS

### 2.2 Attack Chain Analysis

Scenario 1: Shadow Installation Attack

```
1. Developer installs nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
2. nvm uses user-writable Node.js: nvm install 20
3. Developer installs Claude Code: npm install -g @anthropic/claude-code
4. Installation goes to ~/.nvm/versions/node/v20.0.0/lib/node_modules/
5. Developer bypasses all system-level controls ✗
```

Scenario 2: Homebrew Bypass

```
1. Developer has Homebrew (common on macOS)
2. Installs Claude Code: brew install @anthropic/claude-code
3. Installation goes to /usr/local/bin/ or /opt/homebrew/bin/
4. System hooks not enforced ✗
5. Managed configuration ignored ✗
```

Scenario 3: TCC Full Disk Access Grant

```
1. Claude Code requests Full Disk Access (FDA)
2. User grants FDA via System Preferences
3. Claude Code can now read TCC-protected directories:
   - ~/Library/Mail/
   - ~/Library/Messages/
   - ~/Library/Safari/
   - ~/Library/Calendars/
4. Sensitive data exposure ✗
```

### 2.3 Risk Scoring Matrix

| Threat | Likelihood | Impact | Risk Score | Mitigation Priority |
| --- | --- | --- | --- | --- |
| Shadow Installation (Homebrew) | High | Critical | 9.0 | P0 - Immediate |
| Sensitive File Access (.env, keys) | High | Critical | 9.0 | P0 - Immediate |
| nvm/nodenv Bypass | Medium | High | 7.5 | P1 - High |
| Configuration Override | Medium | Medium | 6.0 | P2 - Medium |
| TCC Full Disk Access | Low | High | 5.5 | P2 - Medium |
| Keychain Credential Theft | Low | Critical | 7.0 | P1 - High |

### 2.4 Compliance Requirements

Common Frameworks:

SOC 2 Type II

- Access control to customer data
- Audit logging of file operations
- Configuration management and change control

PCI-DSS (for payment card environments)

- Requirement 7: Restrict access to cardholder data
- Requirement 10: Track and monitor all access to network resources
- Requirement 8: Identify and authenticate access

HIPAA (for healthcare)

- Access controls for ePHI
- Audit logs for data access
- Integrity controls for configurations

ISO 27001

- A.9.4: System and application access control
- A.12.4: Logging and monitoring
- A.14.2: Security in development processes

macOS-Specific Compliance Considerations:

- FileVault encryption required for data at rest (PCI-DSS 3.4)
- TCC database integrity for access controls
- Unified Logging for tamper-proof audit trails
- MDM configuration profiles for policy enforcement

### 2.5 Security Architecture Principles

Zero Trust Model:

1. Never Trust, Always Verify: Every Claude Code operation validated via hooks
2. Least Privilege: Minimal file system access, no Full Disk Access
3. Assume Breach: Monitor for shadow installations and policy violations
4. Explicit Authorization: Whitelist approach for file patterns

Defense in Depth:

```
Layer 1: MDM Configuration Profiles (enforce system settings)
Layer 2: System-level installation (prevent user modifications)
Layer 3: Managed policy hierarchy (read-only configs)
Layer 4: Security hooks (runtime access control)
Layer 5: File system permissions (POSIX + ACLs)
Layer 6: macOS Security (TCC, Gatekeeper, SIP)
Layer 7: Detection & Response (launchd monitoring, EDR)
```

## 3. The macOS Installation Challenge

### 3.1 npm Global Installation Behavior on macOS

Default npm Behavior:

When you run`npm install -g @anthropic/claude-code` on macOS:

```console
# Check current npm prefix
$ npm config get prefix
/usr/local # Intel Macs, Homebrew default
# OR
/opt/homebrew # Apple Silicon Macs, Homebrew default
# OR
/Users/username/.nvm/versions/node/v20.0.0 # If using nvm
```

Problem: These paths are either:

1. User-writable (nvm, local installations)
2. Writable by Homebrew (admin users in`admin` group)
3. Not centrally managed by IT

Enterprise Requirement: Claude Code must be installed at a system-level, non-writable path that IT controls.

### 3.2 macOS Directory Structure

Standard Locations:

| Path | Ownership | Writable By | Enterprise Use |
| --- | --- | --- | --- |
| `/usr/local/` | root:admin | Homebrew (admin group) | ✗ Too permissive |
| `/opt/homebrew/` | Homebrew:admin | Homebrew (admin group) | ✗ Too permissive |
| `~/.nvm/` | user:staff | User | ✗ User-controlled |
| `~/.nodenv/` | user:staff | User | ✗ User-controlled |
| `~/Library/Application Support/` | user:staff | User | ✗ User-controlled |
| `/Library/Application Support/` | root:wheel | root only | ✓ Enterprise path |
| `/Library/LaunchDaemons/` | root:wheel | root only | ✓ System services |
| `/Library/LaunchAgents/` | root:wheel | root only | ✓ User agents |

Recommended Enterprise Structure:

```text
/Library/Application Support/ClaudeCode/
├── bin/ # Executables (root:wheel, 755)
│ └── claude-code -> node_modules/.bin/claude-code
├── npm-global/ # npm global packages (root:wheel, 755)
│ ├── bin/
│ ├── lib/
│ │ └── node_modules/
│ │ └── @anthropic/
│ │ └── claude-code/
│ └── etc/
│ └── npmrc # System npmrc (root:wheel, 444 - read-only)
├── config/ # Managed configurations (root:wheel, 755)
│ ├── managed-settings.json # (root:wheel, 444 - read-only)
│ └── security-hooks/ # (root:wheel, 755)
│ ├── pre-tool-use-validator.sh # (root:wheel, 555 - read-only + exec)
│ ├── post-tool-use-audit.sh
│ └── file-access-validator.sh
├── logs/ # Audit logs (root:wheel, 755)
│ ├── claude-code-audit.log
│ └── shadow-detection.log
└── detection/ # Shadow installation detection (root:wheel, 755)
    └── detect-shadow-installations.sh
```

### 3.3 Configuration Hierarchy on macOS

Claude Code uses the following configuration precedence (highest to lowest):

```
1. Command-line flags: claude-code --config /path/to/config.json
2. Environment variable: CLAUDE_CODE_CONFIG=/path/to/config.json
3. Managed settings: /Library/Application Support/ClaudeCode/config/managed-settings.json ← ENTERPRISE
4. System settings: /Library/Application Support/ClaudeCode/config/settings.json
5. User settings: ~/Library/Application Support/claude-code/settings.json ← BLOCK
6. Project settings: $(pwd)/.claude/settings.json
7. Default settings: Built into claude-code binary
```

Enterprise Strategy:

- Use Level 3 (managed-settings.json) at system level
- Make it read-only (chmod 444, chown root:wheel)
- Block Level 5 (user settings) with file system permissions or MDM profile

### 3.4 Homebrew Challenges

Homebrew Default Behavior:

```console
# On Apple Silicon
$ which brew
/opt/homebrew/bin/brew
$ brew --prefix
/opt/homebrew
# Homebrew changes ownership to user's group
$ ls -ld /opt/homebrew
drwxrwxr-x 23 username admin 736 Oct 7 10:00 /opt/homebrew
```

Problem: Admin users can install packages to`/opt/homebrew/` without`sudo`.

Enterprise Mitigation:

1. Lock down Homebrew with restricted permissions
2. Detect Homebrew-installed Claude Code
3. Redirect developers to managed installation
4. Use MDM to prevent Homebrew execution (advanced)

### 3.5 nvm and nodenv Challenges

nvm Installation:

```console
# nvm installs to user home directory
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# Creates ~/.nvm/ directory
$ ls -ld ~/.nvm
drwxr-xr-x 7 username staff 224 Oct 7 09:00 /Users/username/.nvm
# Each Node.js version has its own npm
$ nvm install 20
$ which npm
/Users/username/.nvm/versions/node/v20.0.0/bin/npm
# npm installs globals to user directory
$ npm install -g @anthropic/claude-code
/Users/username/.nvm/versions/node/v20.0.0/bin/claude-code
```

nodenv Installation:

```console
# nodenv similar pattern
$ brew install nodenv
$ nodenv install 20.0.0
$ nodenv global 20.0.0
# npm globals go to ~/.nodenv/
$ npm install -g @anthropic/claude-code
/Users/username/.nodenv/versions/20.0.0/bin/claude-code
```

Detection Challenge: These installations are fully functional and bypass all system controls.

### 3.6 macOS Security Features (Allies and Obstacles)

System Integrity Protection (SIP):

- Protects system directories like`/System/`,`/usr/`(excluding`/usr/local/`)
- Ally: Prevents tampering with system files
- Obstacle: Does not protect`/usr/local/`(Homebrew territory)

Gatekeeper:

- Enforces code signing and notarization for downloaded apps
- Ally: Prevents execution of unsigned code (if strict)
- Obstacle: Does not apply to npm-installed CLI tools

Transparency, Consent, and Control (TCC):

- Requires user consent for accessing protected resources
- Protected: Full Disk Access, Documents, Downloads, Desktop, iCloud Drive
- Ally: Can restrict Claude Code from protected directories
- Obstacle: User can grant Full Disk Access, bypassing protection

FileVault:

- Full disk encryption
- Ally: Protects data at rest
- Neutral: Does not affect runtime access controls

Secure Enclave:

- Hardware-backed key storage (Touch ID, Apple Watch unlock)
- Ally: Can require biometric authentication for sensitive operations
- Obstacle: Requires application integration

### 3.7 MDM Integration Requirements

Configuration Profile Capabilities:

- Set system preferences (can lock down Homebrew permissions)
- Deploy LaunchDaemons and LaunchAgents
- Restrict application execution (requires third-party solutions)
- Configure TCC whitelist/blacklist (requires TCC MDM payload)
- Deploy files and scripts to managed Macs

Jamf Pro Features:

- Policies for software installation
- Extension Attributes for inventory reporting
- Smart Computer Groups for targeting
- Self Service for user-initiated workflows
- Scripts for detection and remediation

Kandji Features:

- Auto Apps for automated installations
- Custom Scripts library
- Audit & Enforcement rules
- Parameter support for scripts

Microsoft Intune for macOS:

- Shell scripts deployment
- Custom attributes
- Configuration policies
- Compliance policies

## 4. Secure Claude Code Installation on macOS

### 4.1 Prerequisites

System Requirements:

```console
# macOS version
$ sw_vers
ProductName: macOS
ProductVersion: 14.0
BuildVersion: 23A344
# Architecture
$ uname -m
arm64 # Apple Silicon
# OR
x86_64 # Intel
# Available disk space (need 500MB)
$ df -h /Library/Application\ Support/
Filesystem Size Used Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1 228Gi 100Gi 127Gi 45% 1000000 10000000 10% /
```

Required Software:

```console
# Xcode Command Line Tools (for compilation)
$ xcode-select --install
# Node.js 18+ (enterprise managed installation)
$ node --version
v20.10.0
$ npm --version
10.2.3
# Verify not using nvm or nodenv
$ which node
/usr/local/bin/node # ✓ System installation
# NOT ~/.nvm/... or ~/.nodenv/...
```

Verify MDM Enrollment:

```console
# Check MDM profile installed
$ profiles show -type enrollment
# Expected output:
Device Enrollment configuration:
    Enrolled via: User Approved
    MDM server: jamf.yourcompany.com
```

### 4.2 Installation Script

Create`/tmp/install-claudecode-enterprise.sh`:

```text
#!/bin/bash
#
# Claude Code Enterprise Installation Script for macOS
# Version: 2.0
# Purpose: Install Claude Code at system level with security controls
#
set -euo pipefail # Exit on error, undefined variables, pipe failures
# Configuration
INSTALL_DIR="/Library/Application Support/ClaudeCode"
NPM_PREFIX="$INSTALL_DIR/npm-global"
CONFIG_DIR="$INSTALL_DIR/config"
HOOKS_DIR="$CONFIG_DIR/security-hooks"
LOGS_DIR="$INSTALL_DIR/logs"
DETECTION_DIR="$INSTALL_DIR/detection"
BIN_DIR="$INSTALL_DIR/bin"
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}
# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}
# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    # Check macOS version
    local os_version
    os_version=$(sw_vers -productVersion | cut -d '.' -f 1)
    if [[ $os_version -lt 12 ]]; then
        log_error "macOS 12 (Monterey) or later required. Found: $(sw_vers -productVersion)"
        exit 1
    fi
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Install Node.js 18+ first."
        exit 1
    fi
    local node_version
    node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [[ $node_version -lt 18 ]]; then
        log_error "Node.js 18+ required. Found: $(node -v)"
        exit 1
    fi
    # Check for npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        exit 1
    fi
    # Verify not using nvm or nodenv
    local node_path
    node_path=$(which node)
    if [[ $node_path == *".nvm"* ]] || [[ $node_path == *".nodenv"* ]]; then
        log_error "Detected nvm/nodenv installation. Use system Node.js instead."
        log_error "Node.js path: $node_path"
        exit 1
    fi
    # Check for Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        log_error "Xcode Command Line Tools not found. Install with: xcode-select --install"
        exit 1
    fi
    log_info "Prerequisites check passed ✓"
}
# Create directory structure
create_directories() {
    log_info "Creating directory structure..."
    # Main directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$NPM_PREFIX"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$HOOKS_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "$DETECTION_DIR"
    mkdir -p "$BIN_DIR"
    # Set ownership to root:wheel
    chown -R root:wheel "$INSTALL_DIR"
    # Set permissions
    chmod 755 "$INSTALL_DIR"
    chmod 755 "$NPM_PREFIX"
    chmod 755 "$CONFIG_DIR"
    chmod 755 "$HOOKS_DIR"
    chmod 755 "$LOGS_DIR"
    chmod 755 "$DETECTION_DIR"
    chmod 755 "$BIN_DIR"
    log_info "Directory structure created ✓"
}
# Configure npm for system-level installation
configure_npm() {
    log_info "Configuring npm for system-level installation..."
    # Create system npmrc
    local npmrc="$NPM_PREFIX/etc/npmrc"
    mkdir -p "$(dirname "$npmrc")"
    cat > "$npmrc" <<EOF
# Enterprise npm configuration
# Managed by IT - DO NOT MODIFY
# Global installation path (system-level, non-writable)
prefix=$NPM_PREFIX
# Cache and logs
cache=$INSTALL_DIR/npm-cache
logs-dir=$LOGS_DIR/npm-logs
# Security
audit=true
audit-level=moderate
# Performance
fetch-retries=3
fetch-timeout=60000
# Disable automatic updates
update-notifier=false
EOF
    # Make npmrc read-only
    chown root:wheel "$npmrc"
    chmod 444 "$npmrc"
    # Create user npmrc to redirect to system config
    # This will be deployed to all users via MDM
    local user_npmrc_template="$CONFIG_DIR/user-npmrc-template"
    cat > "$user_npmrc_template" <<EOF
# User npm configuration
# Redirects to enterprise npm installation
# Use system npm prefix
prefix=$NPM_PREFIX
# Ignore local configurations
globalconfig=$npmrc
userconfig=/dev/null
EOF
    chmod 444 "$user_npmrc_template"
    chown root:wheel "$user_npmrc_template"
    log_info "npm configured ✓"
}
# Install Claude Code
install_claude_code() {
    log_info "Installing Claude Code..."
    # Set npm prefix for this installation
    export NPM_CONFIG_PREFIX="$NPM_PREFIX"
    export NPM_CONFIG_GLOBALCONFIG="$NPM_PREFIX/etc/npmrc"
    # Install Claude Code globally
    if npm install -g @anthropic/claude-code; then
        log_info "Claude Code installed successfully ✓"
    else
        log_error "Failed to install Claude Code"
        exit 1
    fi
    # Verify installation
    local claude_path="$NPM_PREFIX/bin/claude-code"
    if [[ ! -f "$claude_path" ]]; then
        log_error "Claude Code binary not found at: $claude_path"
        exit 1
    fi
    # Create symlink in /Library/Application Support/ClaudeCode/bin/
    ln -sf "$claude_path" "$BIN_DIR/claude-code"
    # Set permissions
    chmod 755 "$NPM_PREFIX/bin/claude-code"
    chown root:wheel "$NPM_PREFIX/bin/claude-code"
    # Get installed version
    local version
    version=$("$claude_path" --version 2>/dev/null || echo "unknown")
    log_info "Installed version: $version"
}
# Deploy managed configuration
deploy_managed_config() {
    log_info "Deploying managed configuration..."
    local managed_settings="$CONFIG_DIR/managed-settings.json"
    cat > "$managed_settings" <<'EOF'
{
  "version": "2.0",
  "managedBy": "Enterprise IT Security",
  "lastUpdated": "2025-10-07",
  "security": {
    "hooks": {
      "preToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh",
      "postToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh"
    },
    "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    "blockedTools": [],
    "maxFileSize": 10485760,
    "timeoutSeconds": 300
  },
  "fileAccess": {
    "blockedPatterns": [
      ".env",
      ".env.*",
      "*.key",
      "*.pem",
      "*.p12",
      "*.pfx",
      "id_rsa",
      "id_dsa",
      "id_ecdsa",
      "id_ed25519",
      "*.ppk",
      "credentials",
      "credentials.*",
      ".aws/credentials",
      ".aws/config",
      ".npmrc",
      ".pypirc",
      ".docker/config.json",
      ".netrc",
      "*.kdb",
      "*.kdbx",
      "*.cer",
      "*.crt",
      "wallet.dat",
      "*.keystore",
      "*.jks",
      "*.p12",
      "master.key",
      "*.ovpn"
    ],
    "blockedDirectories": [
      "/Users/*/Library/Keychains/",
      "/Users/*/Library/Mail/",
      "/Users/*/Library/Messages/",
      "/Users/*/Library/Safari/",
      "/Users/*/Library/Calendars/",
      "/Users/*/Library/Cookies/",
      "/Users/*/.ssh/",
      "/Users/*/.gnupg/",
      "/Users/*/.aws/",
      "/Users/*/.docker/",
      "/Users/*/.kube/",
      "/Library/Keychains/",
      "/private/var/db/",
      "/private/etc/",
      "/System/",
      "/usr/bin/",
      "/usr/sbin/",
      "/sbin/",
      "/bin/"
    ],
    "allowedDirectories": [
      "/Users/*/Projects/",
      "/Users/*/Development/",
      "/Users/*/Documents/",
      "/tmp/"
    ]
  },
  "audit": {
    "enabled": true,
    "logDirectory": "/Library/Application Support/ClaudeCode/logs",
    "logLevel": "INFO",
    "logRotation": {
      "enabled": true,
      "maxSizeMB": 100,
      "maxFiles": 10
    },
    "syslogIntegration": true,
    "remoteLogging": {
      "enabled": false,
      "endpoint": "https://siem.yourcompany.com/api/logs",
      "apiKey": "REPLACE_WITH_ACTUAL_KEY"
    }
  },
  "compliance": {
    "framework": "SOC2",
    "dataClassification": "CONFIDENTIAL",
    "retentionDays": 90,
    "encryption": true
  },
  "updates": {
    "autoUpdate": false,
    "updateChannel": "enterprise",
    "notifyOnly": true
  }
}
EOF
    # Make managed settings read-only
    chown root:wheel "$managed_settings"
    chmod 444 "$managed_settings"
    log_info "Managed configuration deployed ✓"
}
# Print installation summary
print_summary() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Claude Code Enterprise Installation Complete ✓"
    log_info "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Installation Details:"
    echo " • Installation Path: $INSTALL_DIR"
    echo " • npm Prefix: $NPM_PREFIX"
    echo " • Configuration: $CONFIG_DIR/managed-settings.json"
    echo " • Hooks Directory: $HOOKS_DIR"
    echo " • Logs Directory: $LOGS_DIR"
    echo ""
    echo "Next Steps:"
    echo " 1. Deploy security hooks (Section 6)"
    echo " 2. Configure shadow installation detection (Section 8)"
    echo " 3. Setup monitoring and audit logging (Section 10)"
    echo " 4. Test the deployment (Section 12)"
    echo " 5. Deploy via MDM (Section 11)"
    echo ""
    echo "Users can access Claude Code via:"
    echo " \$ $BIN_DIR/claude-code"
    echo ""
    echo "Add to user PATH (deploy via MDM or shell profiles):"
    echo " export PATH=\"$BIN_DIR:\$PATH\""
    echo ""
    log_info "═══════════════════════════════════════════════════════════"
}
# Main installation flow
main() {
    echo "════════════════════════════════════════════════════════════════"
    echo " Claude Code Enterprise Installation Script for macOS"
    echo " Version: 2.0"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    check_root
    check_prerequisites
    create_directories
    configure_npm
    install_claude_code
    deploy_managed_config
    echo ""
    print_summary
}
# Run main function
main "$@"
```

### 4.3 Running the Installation

```text
# Download and run installation script
$ sudo bash /tmp/install-claudecode-enterprise.sh
# Expected output:
════════════════════════════════════════════════════════════════
  Claude Code Enterprise Installation Script for macOS
  Version: 2.0
════════════════════════════════════════════════════════════════
[INFO] Checking prerequisites...
[INFO] Prerequisites check passed ✓
[INFO] Creating directory structure...
[INFO] Directory structure created ✓
[INFO] Configuring npm for system-level installation...
[INFO] npm configured ✓
[INFO] Installing Claude Code...
[INFO] Claude Code installed successfully ✓
[INFO] Installed version: 1.2.3
[INFO] Deploying managed configuration...
[INFO] Managed configuration deployed ✓
[INFO] ═══════════════════════════════════════════════════════════
[INFO] Claude Code Enterprise Installation Complete ✓
[INFO] ═══════════════════════════════════════════════════════════
```

### 4.4 Verify Installation

```console
# Check directory structure
$ ls -la "/Library/Application Support/ClaudeCode/"
total 0
drwxr-xr-x 8 root wheel 256 Oct 7 10:00 .
drwxr-xr-x 3 root wheel 96 Oct 7 09:55 ..
drwxr-xr-x 2 root wheel 64 Oct 7 10:00 bin
drwxr-xr-x 3 root wheel 96 Oct 7 10:00 config
drwxr-xr-x 2 root wheel 64 Oct 7 10:00 detection
drwxr-xr-x 2 root wheel 64 Oct 7 10:00 logs
drwxr-xr-x 5 root wheel 160 Oct 7 10:00 npm-global
# Verify managed-settings.json is read-only
$ ls -la "/Library/Application Support/ClaudeCode/config/managed-settings.json"
-r--r--r-- 1 root wheel 2048 Oct 7 10:00 managed-settings.json
# Test Claude Code execution
$ "/Library/Application Support/ClaudeCode/bin/claude-code" --version
claude-code version 1.2.3
# Verify npm configuration
$ cat "/Library/Application Support/ClaudeCode/npm-global/etc/npmrc"
# Enterprise npm configuration
# Managed by IT - DO NOT MODIFY
prefix=/Library/Application Support/ClaudeCode/npm-global
cache=/Library/Application Support/ClaudeCode/npm-cache
...
```

### 4.5 User PATH Configuration

Option 1: System-wide Profile (Recommended for MDM)

Create`/etc/profile.d/claudecode.sh`:

```bash
#!/bin/bash
# Claude Code Enterprise PATH configuration
export PATH="/Library/Application Support/ClaudeCode/bin:$PATH"
```

Set permissions:

```console
$ sudo chmod 644 /etc/profile.d/claudecode.sh
$ sudo chown root:wheel /etc/profile.d/claudecode.sh
```

Option 2: Deploy via MDM to User Shell Profiles

For each user, append to`~/.zshrc`(macOS default shell):

```bash
# Claude Code Enterprise (managed by IT)
export PATH="/Library/Application Support/ClaudeCode/bin:$PATH"
```

Option 3: Symlink to /usr/local/bin (Simplest)

```console
$ sudo ln -sf "/Library/Application Support/ClaudeCode/bin/claude-code" /usr/local/bin/claude-code
# Verify
$ which claude-code
/usr/local/bin/claude-code
$ claude-code --version
claude-code version 1.2.3
```

### 4.6 Preventing User npm Configuration Override

Problem: Users can still run`npm config set prefix ~/.npm-global` and install Claude Code locally.

Solution: Make user npmrc immutable or redirect to system config.

Deploy User npmrc via MDM:

Create file:`~/.npmrc`(for each user):

```
# User npm configuration (managed by IT)
# Redirects to enterprise npm installation
prefix=/Library/Application Support/ClaudeCode/npm-global
globalconfig=/Library/Application Support/ClaudeCode/npm-global/etc/npmrc
userconfig=/dev/null
```

Make it immutable (macOS file flag):

```console
$ sudo chflags uchg ~/.npmrc
$ sudo chown root:wheel ~/.npmrc
$ sudo chmod 444 ~/.npmrc
# Verify - user cannot modify
$ echo "test" >> ~/.npmrc
bash: ~/.npmrc: Operation not permitted
# User cannot delete
$ rm ~/.npmrc
rm: ~/.npmrc: Operation not permitted
```

Note:`chflags uchg` sets the "user immutable" flag. Even root can modify it (use`chflags nouchg` to remove).

## 5. Managed Configuration System

### 5.1 Configuration Hierarchy

Claude Code configuration sources (highest precedence first):

| Priority | Source | Path | Managed? | Strategy |
| --- | --- | --- | --- | --- |
| 1 | Command-line | `--config /path/to/config.json` | ✗ | Can't prevent |
| 2 | Environment var | `CLAUDE_CODE_CONFIG` | ✗ | Monitor via hooks |
| 3 | Managed settings | `/Library/Application Support/ClaudeCode/config/managed-settings.json` | ✓ | Primary control |
| 4 | System settings | `/Library/Application Support/ClaudeCode/config/settings.json` | ✓ | Backup config |
| 5 | User settings | `~/Library/Application Support/claude-code/settings.json` | ✗ | Block creation |
| 6 | Project settings | `$(pwd)/.claude/settings.json` | ✗ | Allow (project-specific OK) |
| 7 | Defaults | Built-in | ✓ | Fallback |

Enterprise Strategy:

Block user settings (Priority 5) by:

- Setting file permissions on`~/Library/Application Support/`
- Using MDM Configuration Profile to prevent creation
- Monitoring for unauthorized configs

### 5.2 Managed Settings Template

Full template at`/Library/Application Support/ClaudeCode/config/managed-settings.json`:

```json
{
  "version": "2.0",
  "managedBy": "Enterprise IT Security",
  "lastUpdated": "2025-10-07",
  "documentationUrl": "https://wiki.yourcompany.com/claude-code-security",
  "_comment_security": "Security hooks and tool controls",
  "security": {
    "hooks": {
      "preToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh",
      "postToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh",
      "onError": "/Library/Application Support/ClaudeCode/config/security-hooks/error-handler.sh"
    },
    "allowedTools": [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Glob",
      "Grep",
      "Task",
      "WebFetch",
      "WebSearch"
    ],
    "blockedTools": [
      "NotebookEdit"
    ],
    "maxFileSize": 10485760,
    "timeoutSeconds": 300,
    "requireApproval": {
      "enabled": false,
      "tools": ["Write", "Edit", "Bash"]
    }
  },
  "_comment_fileAccess": "File and directory access controls",
  "fileAccess": {
    "mode": "whitelist",
    "blockedPatterns": [
      ".env",
      ".env.*",
      "*.key",
      "*.pem",
      "*.p12",
      "*.pfx",
      "id_rsa",
      "id_dsa",
      "id_ecdsa",
      "id_ed25519",
      "*.ppk",
      "credentials",
      "credentials.*",
      ".aws/credentials",
      ".aws/config",
      ".npmrc",
      ".pypirc",
      ".docker/config.json",
      ".netrc",
      "*.kdb",
      "*.kdbx",
      "*.cer",
      "*.crt",
      "wallet.dat",
      "*.keystore",
      "*.jks",
      "master.key",
      "*.ovpn",
      "*.keychain",
      "*.keychain-db",
      "*.sparsebundle",
      "*.dmg",
      "*.pkg"
    ],
    "blockedDirectories": [
      "/Users/*/Library/Keychains/",
      "/Users/*/Library/Mail/",
      "/Users/*/Library/Messages/",
      "/Users/*/Library/Safari/",
      "/Users/*/Library/Calendars/",
      "/Users/*/Library/Cookies/",
      "/Users/*/.ssh/",
      "/Users/*/.gnupg/",
      "/Users/*/.aws/",
      "/Users/*/.docker/",
      "/Users/*/.kube/",
      "/Library/Keychains/",
      "/private/var/db/",
      "/private/etc/",
      "/System/",
      "/usr/bin/",
      "/usr/sbin/",
      "/sbin/",
      "/bin/",
      "/Applications/",
      "/Library/Application Support/"
    ],
    "allowedDirectories": [
      "/Users/*/Projects/",
      "/Users/*/Development/",
      "/Users/*/Documents/Code/",
      "/Users/*/Desktop/",
      "/tmp/"
    ],
    "caseSensitive": true
  },
  "_comment_audit": "Audit logging and SIEM integration",
  "audit": {
    "enabled": true,
    "logDirectory": "/Library/Application Support/ClaudeCode/logs",
    "logLevel": "INFO",
    "logFormat": "json",
    "logRotation": {
      "enabled": true,
      "maxSizeMB": 100,
      "maxFiles": 10,
      "compress": true
    },
    "syslogIntegration": true,
    "syslogFacility": "local3",
    "remoteLogging": {
      "enabled": false,
      "protocol": "https",
      "endpoint": "https://siem.yourcompany.com/api/logs",
      "apiKey": "REPLACE_WITH_ACTUAL_KEY",
      "batchSize": 100,
      "flushIntervalSeconds": 60
    },
    "includeContext": {
      "username": true,
      "hostname": true,
      "pid": true,
      "workingDirectory": true,
      "commandLine": true
    }
  },
  "_comment_compliance": "Compliance and data governance",
  "compliance": {
    "framework": "SOC2",
    "dataClassification": "CONFIDENTIAL",
    "retentionDays": 90,
    "encryption": true,
    "piiDetection": {
      "enabled": true,
      "patterns": [
        "\\b\\d{3}-\\d{2}-\\d{4}\\b",
        "\\b\\d{16}\\b",
        "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
      ],
      "action": "block"
    }
  },
  "_comment_updates": "Update management",
  "updates": {
    "autoUpdate": false,
    "updateChannel": "enterprise",
    "checkIntervalHours": 168,
    "notifyOnly": true,
    "allowedVersions": ["1.2.x", "1.3.x"]
  },
  "_comment_telemetry": "Usage telemetry",
  "telemetry": {
    "enabled": false,
    "endpoint": "https://analytics.yourcompany.com/api/telemetry",
    "anonymize": true,
    "excludeData": ["fileContents", "commandOutputs"]
  },
  "_comment_ui": "User interface preferences",
  "ui": {
    "theme": "auto",
    "editor": "vi",
    "showBanner": true,
    "bannerMessage": "This is an enterprise-managed installation. Contact IT for support."
  }
}
```

### 5.3 Deploy Managed Settings

```bash
#!/bin/bash
# deploy-managed-settings.sh
MANAGED_SETTINGS="/Library/Application Support/ClaudeCode/config/managed-settings.json"
# Write settings (content from template above)
sudo cat > "$MANAGED_SETTINGS" <<'EOF'
{
  "version": "2.0",
  ...
}
EOF
# Set ownership and permissions
sudo chown root:wheel "$MANAGED_SETTINGS"
sudo chmod 444 "$MANAGED_SETTINGS" # Read-only
sudo chflags uchg "$MANAGED_SETTINGS" # Immutable
# Verify
ls -la "$MANAGED_SETTINGS"
# Expected: -r--r--r-- 1 root wheel ... managed-settings.json
# Test immutability
echo "test" >> "$MANAGED_SETTINGS" 2>&1 | grep -q "Operation not permitted" && echo "✓ Immutable"
```

### 5.4 Block User Settings Directory

Strategy 1: File Permissions

```bash
# Create user Library/Application Support/ directory structure
USER_CONFIG_DIR="$HOME/Library/Application Support/claude-code"
# Create directory but deny write access
sudo mkdir -p "$USER_CONFIG_DIR"
sudo chown root:wheel "$USER_CONFIG_DIR"
sudo chmod 555 "$USER_CONFIG_DIR" # Read + execute, no write
sudo chflags uchg "$USER_CONFIG_DIR" # Immutable
# Test - user cannot create settings
touch "$USER_CONFIG_DIR/settings.json"
# Expected: touch: /Users/username/Library/Application Support/claude-code/settings.json: Permission denied
```

Strategy 2: ACLs (Access Control Lists)

```bash
# More granular control with ACLs
sudo chmod +a "user:username deny write,delete,append,writeattr,writeextattr,chown" "$USER_CONFIG_DIR"
# Verify ACLs
ls -lde "$USER_CONFIG_DIR"
# Expected: drwxr-xr-x+ ... claude-code
# 0: user:username deny write,delete,append,writeattr,writeextattr,chown
```

Strategy 3: MDM Configuration Profile

Create a Configuration Profile to restrict file creation (requires third-party MDM solutions like Jamf Protect or custom Launch Daemon monitoring).

### 5.5 Configuration Validation

Create`/Library/Application Support/ClaudeCode/config/validate-config.sh`:

```bash
#!/bin/bash
#
# Validate managed-settings.json integrity
# Run via LaunchDaemon every hour
#
MANAGED_SETTINGS="/Library/Application Support/ClaudeCode/config/managed-settings.json"
EXPECTED_HASH="SHA256_HASH_HERE" # Replace with actual hash
LOG_FILE="/Library/Application Support/ClaudeCode/logs/config-validation.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}
# Check if file exists
if [[ ! -f "$MANAGED_SETTINGS" ]]; then
    log "ERROR: managed-settings.json not found"
    logger -t claudecode-security -p user.error "managed-settings.json missing"
    exit 1
fi
# Compute current hash
current_hash=$(shasum -a 256 "$MANAGED_SETTINGS" | awk '{print $1}')
# Compare with expected hash
if [[ "$current_hash" != "$EXPECTED_HASH" ]]; then
    log "WARNING: managed-settings.json hash mismatch"
    log "Expected: $EXPECTED_HASH"
    log "Current: $current_hash"
    logger -t claudecode-security -p user.warning "managed-settings.json tampered"
    # Optionally restore from backup
    # sudo cp /path/to/backup/managed-settings.json "$MANAGED_SETTINGS"
    exit 1
fi
# Verify permissions
perms=$(stat -f "%Op" "$MANAGED_SETTINGS")
if [[ "$perms" != "100444" ]]; then # 444 in octal
    log "WARNING: managed-settings.json permissions incorrect: $perms"
    sudo chmod 444 "$MANAGED_SETTINGS"
fi
# Verify ownership
owner=$(stat -f "%Su:%Sg" "$MANAGED_SETTINGS")
if [[ "$owner" != "root:wheel" ]]; then
    log "WARNING: managed-settings.json ownership incorrect: $owner"
    sudo chown root:wheel "$MANAGED_SETTINGS"
fi
# Verify immutable flag
flags=$(ls -lO "$MANAGED_SETTINGS" | awk '{print $5}')
if [[ "$flags" != "uchg" ]]; then
    log "WARNING: managed-settings.json not immutable"
    sudo chflags uchg "$MANAGED_SETTINGS"
fi
log "INFO: Configuration validation passed"
exit 0
```

Deploy LaunchDaemon for validation (see Section 9 for LaunchDaemon details).

## 6. Security Hooks Implementation

### 6.1 Hook Architecture

Claude Code supports pre-tool-use and post-tool-use hooks:

pre-tool-use: Runs before any tool execution (validation, access control)

- Exit code 0: Allow tool execution
- Exit code 2: Block tool execution
- Other exit codes: Treated as errors

post-tool-use: Runs after tool execution (auditing, logging)

- Exit code ignored (always runs)
- Used for audit trails, SIEM integration

Hook Configuration:

```json
{
  "security": {
    "hooks": {
      "preToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh",
      "postToolUse": "/Library/Application Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh"
    }
  }
}
```

Hook Input (stdin): JSON object with tool execution details:

```json
{
  "tool": "Read",
  "parameters": {
    "file_path": "/Users/jdoe/Projects/app/config.js"
  },
  "user": "jdoe",
  "timestamp": "2025-10-07T10:30:00Z",
  "workingDirectory": "/Users/jdoe/Projects/app",
  "sessionId": "abc123"
}
```

### 6.2 Pre-Tool-Use Validator

Create`/Library/Application Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh`:

```bash
#!/bin/bash
#
# Claude Code Pre-Tool-Use Security Validator
# Purpose: Validate file access, block sensitive files/directories
# Exit codes: 0 = allow, 2 = block
#
set -eo pipefail
# Configuration
MANAGED_SETTINGS="/Library/Application Support/ClaudeCode/config/managed-settings.json"
LOG_FILE="/Library/Application Support/ClaudeCode/logs/pre-tool-use.log"
BLOCKED_PATTERNS_FILE="/Library/Application Support/ClaudeCode/config/blocked-patterns.txt"
# Read input from stdin (JSON)
INPUT=$(cat)
# Parse JSON using jq (install if needed: brew install jq)
TOOL=$(echo "$INPUT" | jq -r '.tool')
FILE_PATH=$(echo "$INPUT" | jq -r '.parameters.file_path // empty')
USER=$(echo "$INPUT" | jq -r '.user')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp')
WORKING_DIR=$(echo "$INPUT" | jq -r '.workingDirectory')
# Logging function
log() {
    echo "$(date -Iseconds) | $USER | $TOOL | $FILE_PATH | $1" >> "$LOG_FILE"
    logger -t claudecode-hook -p user.info "$USER | $TOOL | $FILE_PATH | $1"
}
# Block function - log and exit with code 2
block() {
    local reason="$1"
    log "BLOCKED: $reason"
    echo "Access denied: $reason" >&2
    exit 2
}
# Allow function - log and exit with code 0
allow() {
    log "ALLOWED"
    exit 0
}
# Check if tool involves file access
if [[ "$TOOL" != "Read" && "$TOOL" != "Write" && "$TOOL" != "Edit" ]]; then
    # For non-file tools, check if bash command is blocked
    if [[ "$TOOL" == "Bash" ]]; then
        COMMAND=$(echo "$INPUT" | jq -r '.parameters.command // empty')
        # Block dangerous commands
        if echo "$COMMAND" | grep -qE '(curl|wget|nc|telnet|ssh|scp|sftp).*\.(env|key|pem|credentials)'; then
            block "Blocked command accessing sensitive files"
        fi
        # Block exfiltration attempts
        if echo "$COMMAND" | grep -qE '(curl|wget|nc).*-d|--data'; then
            block "Blocked potential data exfiltration command"
        fi
    fi
    allow # Allow other non-file tools
fi
# If no file path provided, allow (e.g., Glob tool with pattern only)
if [[ -z "$FILE_PATH" ]]; then
    allow
fi
# Resolve symlinks and get absolute path
REAL_PATH=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
# Load blocked patterns from managed settings
BLOCKED_PATTERNS=$(jq -r '.fileAccess.blockedPatterns[]' "$MANAGED_SETTINGS" 2>/dev/null || echo "")
BLOCKED_DIRS=$(jq -r '.fileAccess.blockedDirectories[]' "$MANAGED_SETTINGS" 2>/dev/null || echo "")
# Check against blocked file patterns
while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # Convert glob pattern to regex
    pattern_regex=$(echo "$pattern" | sed 's/\./\\./g' | sed 's/\*/.*/')
    if echo "$REAL_PATH" | grep -qE "$pattern_regex"; then
        block "Matches blocked pattern: $pattern"
    fi
done <<< "$BLOCKED_PATTERNS"
# Check against blocked directories
while IFS= read -r dir_pattern; do
    [[ -z "$dir_pattern" ]] && continue
    # Expand wildcards (e.g., /Users/*/.ssh/)
    dir_regex=$(echo "$dir_pattern" | sed 's/\*/[^\/]*/g' | sed 's/\./\\./g')
    if echo "$REAL_PATH" | grep -qE "^$dir_regex"; then
        block "Inside blocked directory: $dir_pattern"
    fi
done <<< "$BLOCKED_DIRS"
# Check for macOS-specific sensitive locations
case "$REAL_PATH" in
    /Users/*/Library/Keychains/*)
        block "Keychain access not allowed"
        ;;
    /Users/*/Library/Mail/*)
        block "Mail access not allowed"
        ;;
    /Users/*/Library/Messages/*)
        block "Messages access not allowed"
        ;;
    /Users/*/Library/Safari/*)
        block "Safari data access not allowed"
        ;;
    /Users/*/.ssh/id_*)
        block "SSH private key access not allowed"
        ;;
    /Library/Keychains/*)
        block "System keychain access not allowed"
        ;;
    /private/var/db/*)
        block "System database access not allowed"
        ;;
    /System/*)
        block "System directory access not allowed"
        ;;
esac
# Check for Write/Edit operations on read-only files
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then
    # Block writes to protected directories
    case "$REAL_PATH" in
        /Library/Application\ Support/ClaudeCode/config/*)
            block "Cannot modify managed configuration"
            ;;
        /usr/bin/*|/usr/sbin/*|/bin/*|/sbin/*)
            block "Cannot modify system binaries"
            ;;
    esac
fi
# Check file size limit for Read operations
if [[ "$TOOL" == "Read" && -f "$REAL_PATH" ]]; then
    MAX_SIZE=$(jq -r '.security.maxFileSize // 10485760' "$MANAGED_SETTINGS") # Default 10MB
    FILE_SIZE=$(stat -f%z "$REAL_PATH" 2>/dev/null || echo "0")
    if [[ $FILE_SIZE -gt $MAX_SIZE ]]; then
        block "File size ($FILE_SIZE bytes) exceeds limit ($MAX_SIZE bytes)"
    fi
fi
# All checks passed
allow
```

Set permissions:

```console
$ sudo chmod 555 /Library/Application\ Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh
$ sudo chown root:wheel /Library/Application\ Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh
$ sudo chflags uchg /Library/Application\ Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh
```

### 6.3 Post-Tool-Use Audit Hook

Create`/Library/Application Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh`:

```bash
#!/bin/bash
#
# Claude Code Post-Tool-Use Audit Hook
# Purpose: Log all tool executions for audit trail and SIEM integration
# Exit code: Ignored (always runs)
#
set -eo pipefail
# Configuration
LOG_FILE="/Library/Application Support/ClaudeCode/logs/audit.log"
JSON_LOG="/Library/Application Support/ClaudeCode/logs/audit-json.log"
SIEM_ENABLED=false # Set via managed-settings.json
SIEM_ENDPOINT="https://siem.yourcompany.com/api/logs"
# Read input from stdin (JSON)
INPUT=$(cat)
# Parse JSON
TOOL=$(echo "$INPUT" | jq -r '.tool')
FILE_PATH=$(echo "$INPUT" | jq -r '.parameters.file_path // "N/A"')
USER=$(echo "$INPUT" | jq -r '.user')
TIMESTAMP=$(echo "$INPUT" | jq -r '.timestamp')
WORKING_DIR=$(echo "$INPUT" | jq -r '.workingDirectory')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId')
STATUS=$(echo "$INPUT" | jq -r '.status // "unknown"') # success, failed, blocked
# Get system context
HOSTNAME=$(hostname)
PID=$$
IP_ADDRESS=$(ifconfig en0 | grep 'inet ' | awk '{print $2}' || echo "unknown")
# Create audit log entry
AUDIT_ENTRY=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "user": "$USER",
  "hostname": "$HOSTNAME",
  "ip_address": "$IP_ADDRESS",
  "tool": "$TOOL",
  "file_path": "$FILE_PATH",
  "working_directory": "$WORKING_DIR",
  "session_id": "$SESSION_ID",
  "status": "$STATUS",
  "pid": $PID,
  "compliance_framework": "SOC2",
  "data_classification": "CONFIDENTIAL"
}
EOF
)
# Write to JSON log
echo "$AUDIT_ENTRY" >> "$JSON_LOG"
# Write to human-readable log
echo "$(date -Iseconds) | $USER@$HOSTNAME | $TOOL | $FILE_PATH | $STATUS" >> "$LOG_FILE"
# Send to syslog
logger -t claudecode-audit -p user.info "$USER | $TOOL | $FILE_PATH | $STATUS"
# Send to SIEM (if enabled)
if [[ "$SIEM_ENABLED" == "true" ]]; then
    curl -s -X POST "$SIEM_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $SIEM_API_KEY" \
        -d "$AUDIT_ENTRY" &
fi
# Log rotation check (keep last 10 files, 100MB each)
LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo "0")
MAX_SIZE=$((100 * 1024 * 1024)) # 100MB
if [[ $LOG_SIZE -gt $MAX_SIZE ]]; then
    # Rotate log
    for i in {9..1}; do
        if [[ -f "$LOG_FILE.$i" ]]; then
            mv "$LOG_FILE.$i" "$LOG_FILE.$((i+1))"
        fi
    done
    mv "$LOG_FILE" "$LOG_FILE.1"
    touch "$LOG_FILE"
    chown root:wheel "$LOG_FILE"
    chmod 644 "$LOG_FILE"
fi
exit 0
```

Set permissions:

```console
$ sudo chmod 555 /Library/Application\ Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh
$ sudo chown root:wheel /Library/Application\ Support/ClaudeCode/config/security-hooks/post-tool-use-audit.sh
```

### 6.4 Testing Hooks

```console
# Test pre-tool-use hook with mock input
$ echo '{"tool":"Read","parameters":{"file_path":"/Users/jdoe/.ssh/id_rsa"},"user":"jdoe","timestamp":"2025-10-07T10:00:00Z"}' | \
  sudo /Library/Application\ Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh
# Expected output:
Access denied: SSH private key access not allowed
# Exit code: 2
# Test with allowed file
$ echo '{"tool":"Read","parameters":{"file_path":"/Users/jdoe/Projects/app.js"},"user":"jdoe","timestamp":"2025-10-07T10:00:00Z"}' | \
  sudo /Library/Application\ Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh
# Expected: Exit code 0 (no output)
# Check audit log
$ sudo cat /Library/Application\ Support/ClaudeCode/logs/pre-tool-use.log
2025-10-07T10:00:00 | jdoe | Read | /Users/jdoe/.ssh/id_rsa | BLOCKED: SSH private key access not allowed
2025-10-07T10:00:05 | jdoe | Read | /Users/jdoe/Projects/app.js | ALLOWED
```

### 6.5 Hook Dependency: Install jq

Hooks require`jq` for JSON parsing:

```console
# Install jq via Homebrew (for testing)
$ brew install jq
# Or download binary for enterprise deployment
$ curl -L https://github.com/stedolan/jq/releases/download/jq-1.6/jq-osx-amd64 -o /usr/local/bin/jq
$ sudo chmod +x /usr/local/bin/jq
# Verify
$ jq --version
jq-1.6
```

Enterprise Deployment: Include jq binary in MDM package or install via package manager.

## 7. macOS Security Integration

### 7.1 Transparency, Consent, and Control (TCC)

What is TCC?

- macOS privacy framework requiring user consent for accessing protected resources
- Protects: Full Disk Access, Documents, Downloads, Desktop, Photos, Contacts, etc.
- Database:`/Library/Application Support/com.apple.TCC/TCC.db`(SQLite)

TCC and Claude Code:

Claude Code (Node.js process) requires TCC permissions to access:

- Documents folder:`~/Documents/`
- Downloads folder:`~/Downloads/`
- Desktop:`~/Desktop/`
- Full Disk Access (FDA): All user files

Enterprise Problem: Users can grant FDA, bypassing file access controls.

Mitigation Strategy:

Use TCC Configuration Profile (MDM) to:

- Explicitly deny FDA for Node.js
- Grant only specific folder access (Documents, Downloads)

1. Monitor TCC database for unauthorized grants

TCC Configuration Profile Example:

Create`com.apple.TCC.configuration-profile-policy.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDisplayName</key>
            <string>TCC Configuration Profile Policy</string>
            <key>PayloadIdentifier</key>
            <string>com.yourcompany.tcc.restrictions</string>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>PayloadUUID</key>
            <string>GENERATE-UUID-HERE</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Services</key>
            <dict>
                <!-- Deny Full Disk Access for Node.js -->
                <key>SystemPolicyAllFiles</key>
                <array>
                    <dict>
                        <key>Allowed</key>
                        <false/>
                        <key>CodeRequirement</key>
                        <string>identifier "node" and anchor apple generic</string>
                        <key>Comment</key>
                        <string>Deny Full Disk Access for Node.js</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Identifier</key>
                        <string>node</string>
                    </dict>
                </array>
                <!-- Allow Documents folder access -->
                <key>SystemPolicyDocumentsFolder</key>
                <array>
                    <dict>
                        <key>Allowed</key>
                        <true/>
                        <key>CodeRequirement</key>
                        <string>identifier "node" and anchor apple generic</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Identifier</key>
                        <string>node</string>
                    </dict>
                </array>
                <!-- Allow Downloads folder access -->
                <key>SystemPolicyDownloadsFolder</key>
                <array>
                    <dict>
                        <key>Allowed</key>
                        <true/>
                        <key>CodeRequirement</key>
                        <string>identifier "node" and anchor apple generic</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Identifier</key>
                        <string>node</string>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Claude Code TCC Restrictions</string>
    <key>PayloadIdentifier</key>
    <string>com.yourcompany.claudecode.tcc</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>GENERATE-UUID-HERE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
```

Deploy via MDM:

- Jamf Pro: Upload as Configuration Profile
- Kandji: Add to Library as macOS profile
- Intune: Create Settings Catalog policy

### 7.2 System Integrity Protection (SIP)

What is SIP?

- Kernel-level protection preventing modification of system files
- Protects:`/System/`,`/usr/`(excluding`/usr/local/`),`/bin/`,`/sbin/`
- Cannot be disabled without booting to Recovery Mode

SIP Status:

```console
$ csrutil status
System Integrity Protection status: enabled.
```

Enterprise Benefit:

- Claude Code cannot modify system files (even with sudo)
- Prevents malicious hooks or plugins from tampering with OS

Limitation:

- Does not protect`/usr/local/`(Homebrew territory)
- Does not prevent user directory modifications

### 7.3 Gatekeeper and Code Signing

What is Gatekeeper?

- Enforces code signing and notarization for apps and CLI tools
- Prevents execution of unsigned or untrusted code

Gatekeeper Status:

```console
$ spctl --status
assessments enabled
```

Enterprise Configuration:

```console
# Require signed code for all executables
$ sudo spctl --master-enable
# Check signature of Claude Code (npm package is not signed)
$ codesign -dv /Library/Application\ Support/ClaudeCode/npm-global/bin/claude-code
# Expected: not signed (npm packages typically unsigned)
# Verify Node.js is signed
$ codesign -dv $(which node)
Executable=/usr/local/bin/node
Identifier=node
Format=Mach-O thin (arm64)
...
```

Note: npm-installed CLI tools are typically not code-signed. This is a limitation of npm ecosystem on macOS.

Mitigation: Use hooks and process monitoring to ensure only managed Claude Code installation runs.

### 7.4 FileVault Disk Encryption

Enable FileVault:

```console
# Check FileVault status
$ fdesetup status
FileVault is On.
# Enable FileVault (requires admin)
$ sudo fdesetup enable
```

Enterprise Requirement:

- All managed Macs must have FileVault enabled
- Protects Claude Code logs and configuration at rest
- Essential for compliance (PCI-DSS, HIPAA)

MDM Enforcement:

- Jamf Pro: Disk Encryption Configuration
- Kandji: FileVault Blueprint Item
- Intune: Endpoint Protection policy

### 7.5 Keychain Access Control

Problem: Claude Code could read SSH keys from Keychain if user grants access.

Mitigation:

```console
# Lock down SSH keys in Keychain
$ security set-keychain-settings -l -u -t 3600 login.keychain # Auto-lock after 1 hour
# Require password for keychain access
$ security set-keychain-settings -l ~/Library/Keychains/login.keychain-db
# Export and verify Keychain ACLs
$ security dump-keychain login.keychain-db | grep -A 10 "SSH"
```

Enterprise Best Practice:

- Use SSH agents with Touch ID requirement
- Store SSH keys in Secure Enclave (ECDSA keys only)
- Block`~/.ssh/` directory access via hooks (done in Section 6)

## 8. Shadow Installation Prevention

### 8.1 The Shadow Installation Problem

Definition: "Shadow Installation" occurs when developers install Claude Code in user-controlled directories, bypassing enterprise security controls.

Common Shadow Installation Vectors on macOS:

nvm (Node Version Manager)

- Path:`~/.nvm/versions/node/v20.0.0/lib/node_modules/@anthropic/claude-code`
- Detection: Check for`~/.nvm/` directory and`~/.nvm/versions/*/bin/claude-code`

nodenv

- Path:`~/.nodenv/versions/20.0.0/lib/node_modules/@anthropic/claude-code`
- Detection: Check for`~/.nodenv/` directory and`~/.nodenv/versions/*/bin/claude-code`

Homebrew Global Installation

- Path:`/usr/local/lib/node_modules/@anthropic/claude-code`(Intel)
- Path:`/opt/homebrew/lib/node_modules/@anthropic/claude-code`(Apple Silicon)
- Detection: Check Homebrew prefixes

User npm Global Directory

- Path:`~/.npm-global/lib/node_modules/@anthropic/claude-code`
- Detection: Check`npm config get prefix` output

Local Project Installation

- Path:`/Users/username/Projects/*/node_modules/.bin/claude-code`
- Detection: Find executable in project directories

Manual Binary Download

- Path:`~/bin/claude-code`,`~/Downloads/claude-code`
- Detection: Find binaries named`claude-code` in user directories

### 8.2 Detection Strategy

Multi-Layered Detection:

```
Layer 1: npm Configuration Enforcement (prevent installation)
Layer 2: File System Scanning (detect existing installations)
Layer 3: Process Monitoring (detect runtime execution)
Layer 4: Network Detection (detect update checks from unofficial sources)
Layer 5: LaunchDaemon Scheduled Scans (continuous monitoring)
Layer 6: MDM Extension Attributes (inventory reporting)
Layer 7: EDR Integration (block and alert)
```

### 8.3 Detection Script

Create`/Library/Application Support/ClaudeCode/detection/detect-shadow-installations.sh`:

```text
#!/bin/bash
#
# Shadow Installation Detection Script for macOS
# Purpose: Detect unauthorized Claude Code installations
# Run via: LaunchDaemon (hourly) or manual execution
#
set -euo pipefail
# Configuration
MANAGED_INSTALL="/Library/Application Support/ClaudeCode/npm-global"
LOG_FILE="/Library/Application Support/ClaudeCode/logs/shadow-detection.log"
ALERT_THRESHOLD=1 # Number of violations before alerting
REMEDIATION_MODE="alert" # "alert", "remove", or "block"
# Colors for terminal output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'
# Array to store detected violations
declare -a VIOLATIONS=()
log() {
    local level="$1"
    local message="$2"
    echo "$(date -Iseconds) | $level | $message" | tee -a "$LOG_FILE"
    logger -t claudecode-shadow -p "user.$level" "$message"
}
detect_shadow() {
    local path="$1"
    local method="$2"
    if [[ -f "$path" || -d "$path" ]]; then
        VIOLATIONS+=("$method|$path")
        log "warning" "Shadow installation detected: $path (method: $method)"
        return 0
    fi
    return 1
}
# Detection 1: nvm installations
check_nvm() {
    log "info" "Checking for nvm shadow installations..."
    for user_home in /Users/*; do
        [[ ! -d "$user_home" ]] && continue
        username=$(basename "$user_home")
        # Check for nvm directory
        if [[ -d "$user_home/.nvm" ]]; then
            # Find all claude-code installations under nvm
            while IFS= read -r claude_path; do
                detect_shadow "$claude_path" "nvm-$username"
            done < <(find "$user_home/.nvm/versions" -name "claude-code" -type f 2>/dev/null || true)
        fi
    done
}
# Detection 2: nodenv installations
check_nodenv() {
    log "info" "Checking for nodenv shadow installations..."
    for user_home in /Users/*; do
        [[ ! -d "$user_home" ]] && continue
        username=$(basename "$user_home")
        if [[ -d "$user_home/.nodenv" ]]; then
            while IFS= read -r claude_path; do
                detect_shadow "$claude_path" "nodenv-$username"
            done < <(find "$user_home/.nodenv/versions" -name "claude-code" -type f 2>/dev/null || true)
        fi
    done
}
# Detection 3: Homebrew installations
check_homebrew() {
    log "info" "Checking for Homebrew shadow installations..."
    # Intel Macs
    if [[ -d "/usr/local/lib/node_modules/@anthropic/claude-code" ]]; then
        detect_shadow "/usr/local/lib/node_modules/@anthropic/claude-code" "homebrew-intel"
    fi
    # Apple Silicon Macs
    if [[ -d "/opt/homebrew/lib/node_modules/@anthropic/claude-code" ]]; then
        detect_shadow "/opt/homebrew/lib/node_modules/@anthropic/claude-code" "homebrew-arm64"
    fi
}
# Detection 4: User npm global installations
check_user_npm_global() {
    log "info" "Checking for user npm global shadow installations..."
    for user_home in /Users/*; do
        [[ ! -d "$user_home" ]] && continue
        username=$(basename "$user_home")
        # Common user npm global paths
        local paths=(
            "$user_home/.npm-global"
            "$user_home/.npm"
            "$user_home/.local/lib/node_modules"
            "$user_home/npm-global"
        )
        for npm_path in "${paths[@]}"; do
            if [[ -d "$npm_path/lib/node_modules/@anthropic/claude-code" ]]; then
                detect_shadow "$npm_path/lib/node_modules/@anthropic/claude-code" "user-npm-$username"
            fi
        done
    done
}
# Detection 5: Standalone binaries in user directories
check_standalone_binaries() {
    log "info" "Checking for standalone claude-code binaries..."
    for user_home in /Users/*; do
        [[ ! -d "$user_home" ]] && continue
        username=$(basename "$user_home")
        # Search common user bin directories
        local search_paths=(
            "$user_home/bin"
            "$user_home/.local/bin"
            "$user_home/Downloads"
            "$user_home/Desktop"
        )
        for search_path in "${search_paths[@]}"; do
            [[ ! -d "$search_path" ]] && continue
            while IFS= read -r binary; do
                # Verify it's not a symlink to managed installation
                if [[ -L "$binary" ]]; then
                    local target
                    target=$(readlink "$binary")
                    if [[ "$target" == "$MANAGED_INSTALL"* ]]; then
                        continue # It's pointing to managed install, OK
                    fi
                fi
                detect_shadow "$binary" "standalone-binary-$username"
            done < <(find "$search_path" -maxdepth 1 -name "claude-code" -type f 2>/dev/null || true)
        done
    done
}
# Detection 6: Process-based detection
check_running_processes() {
    log "info" "Checking for running shadow Claude Code processes..."
    # Find all running node processes with claude-code in command line
    while IFS= read -r pid_user_cmd; do
        local pid=$(echo "$pid_user_cmd" | awk '{print $1}')
        local user=$(echo "$pid_user_cmd" | awk '{print $2}')
        local cmd=$(echo "$pid_user_cmd" | cut -d' ' -f3-)
        # Skip if it's from managed installation
        if echo "$cmd" | grep -q "$MANAGED_INSTALL"; then
            continue
        fi
        # Check if it's a shadow installation
        if echo "$cmd" | grep -qE '(\.nvm|\.nodenv|\.npm-global|/usr/local|/opt/homebrew).*claude-code'; then
            VIOLATIONS+=("process|PID=$pid USER=$user CMD=$cmd")
            log "warning" "Shadow Claude Code process detected: PID=$pid USER=$user"
        fi
    done < <(ps aux | grep -i "claude-code" | grep -v grep | awk '{print $2, $1, $11}' || true)
}
# Detection 7: Check npm configuration for users
check_npm_config() {
    log "info" "Checking npm configurations for users..."
    for user_home in /Users/*; do
        [[ ! -d "$user_home" ]] && continue
        username=$(basename "$user_home")
        # Check user's npmrc
        local npmrc="$user_home/.npmrc"
        if [[ -f "$npmrc" ]]; then
            # Check if prefix is set to something other than managed path
            local prefix=$(grep "^prefix=" "$npmrc" 2>/dev/null | cut -d'=' -f2 || echo "")
            if [[ -n "$prefix" && "$prefix" != "$MANAGED_INSTALL" ]]; then
                log "warning" "User $username has custom npm prefix: $prefix"
                VIOLATIONS+=("npm-config|$username has prefix=$prefix")
            fi
        fi
    done
}
# Remediation actions
remediate() {
    if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
        log "info" "No shadow installations detected ✓"
        return 0
    fi
    log "warning" "Found ${#VIOLATIONS[@]} shadow installation(s)"
    case "$REMEDIATION_MODE" in
        "alert")
            send_alert
            ;;
        "remove")
            remove_violations
            ;;
        "block")
            block_executions
            ;;
    esac
}
send_alert() {
    log "info" "Sending alert to SIEM/monitoring system..."
    # Create JSON alert
    local alert_json=$(cat <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "alert_type": "shadow_installation_detected",
  "severity": "high",
  "violation_count": ${#VIOLATIONS[@]},
  "violations": [
EOF
)
    for i in "${!VIOLATIONS[@]}"; do
        local method=$(echo "${VIOLATIONS[$i]}" | cut -d'|' -f1)
        local path=$(echo "${VIOLATIONS[$i]}" | cut -d'|' -f2-)
        alert_json+=$(cat <<EOF
    {
      "method": "$method",
      "path": "$path"
    }
EOF
)
        if [[ $i -lt $((${#VIOLATIONS[@]} - 1)) ]]; then
            alert_json+=","
        fi
    done
    alert_json+=$(cat <<EOF
  ]
}
EOF
)
    # Send to syslog
    logger -t claudecode-alert -p user.warning "$alert_json"
    # Send to SIEM (if configured)
    # curl -X POST https://siem.yourcompany.com/api/alerts -d "$alert_json"
    # Send email (if configured)
    # echo "$alert_json" | mail -s "Claude Code Shadow Installation Alert" security@yourcompany.com
    log "info" "Alert sent"
}
remove_violations() {
    log "warning" "Removing shadow installations (REMEDIATION_MODE=remove)..."
    for violation in "${VIOLATIONS[@]}"; do
        local path=$(echo "$violation" | cut -d'|' -f2-)
        if [[ -f "$path" || -d "$path" ]]; then
            log "warning" "Removing: $path"
            rm -rf "$path" 2>/dev/null || log "error" "Failed to remove: $path"
        fi
    done
}
block_executions() {
    log "warning" "Blocking shadow installation executions (REMEDIATION_MODE=block)..."
    # This would require integration with EDR or custom kernel extension
    # Placeholder for enterprise security tool integration
    for violation in "${VIOLATIONS[@]}"; do
        local path=$(echo "$violation" | cut -d'|' -f2-)
        log "warning" "Would block execution of: $path"
    done
}
# Main execution
main() {
    echo "════════════════════════════════════════════════════════════════"
    echo " Claude Code Shadow Installation Detection"
    echo " $(date)"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    log "info" "Starting shadow installation detection scan..."
    check_nvm
    check_nodenv
    check_homebrew
    check_user_npm_global
    check_standalone_binaries
    check_running_processes
    check_npm_config
    remediate
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
        echo -e "${GREEN}✓ No shadow installations detected${NC}"
    else
        echo -e "${RED}✗ Found ${#VIOLATIONS[@]} shadow installation(s)${NC}"
        echo " See log: $LOG_FILE"
    fi
    echo "════════════════════════════════════════════════════════════════"
    # Exit with error if violations found
    [[ ${#VIOLATIONS[@]} -gt 0 ]] && exit 1 || exit 0
}
main "$@"
```

Set permissions:

```console
$ sudo chmod 555 /Library/Application\ Support/ClaudeCode/detection/detect-shadow-installations.sh
$ sudo chown root:wheel /Library/Application\ Support/ClaudeCode/detection/detect-shadow-installations.sh
```

### 8.4 Automated Detection via LaunchDaemon

Create LaunchDaemon for hourly scans:`/Library/LaunchDaemons/com.yourcompany.claudecode.shadowdetect.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yourcompany.claudecode.shadowdetect</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Library/Application Support/ClaudeCode/detection/detect-shadow-installations.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer> <!-- Run every hour -->
    <key>StandardOutPath</key>
    <string>/Library/Application Support/ClaudeCode/logs/shadow-detection-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Library/Application Support/ClaudeCode/logs/shadow-detection-stderr.log</string>
    <key>RunAtLoad</key>
    <true/>
    <key>UserName</key>
    <string>root</string>
</dict>
</plist>
```

Load LaunchDaemon:

```console
$ sudo launchctl load /Library/LaunchDaemons/com.yourcompany.claudecode.shadowdetect.plist
# Verify it's loaded
$ sudo launchctl list | grep claudecode
- 0 com.yourcompany.claudecode.shadowdetect
# Test manual execution
$ sudo launchctl start com.yourcompany.claudecode.shadowdetect
# Check logs
$ sudo tail -f /Library/Application\ Support/ClaudeCode/logs/shadow-detection.log
```

### 8.5 Prevention via npm Configuration Lock

Lock npm Prefix System-wide:

Create`/etc/npmrc`(global npm config):

```
# Enterprise npm configuration
# All users must use managed Claude Code installation
prefix=/Library/Application Support/ClaudeCode/npm-global
globalconfig=/Library/Application Support/ClaudeCode/npm-global/etc/npmrc
# Lock user-level npm configuration
userconfig=/dev/null
# Prevent local npm configuration overrides
cache=/Library/Application Support/ClaudeCode/npm-cache
```

Make it read-only:

```console
$ sudo chmod 444 /etc/npmrc
$ sudo chown root:wheel /etc/npmrc
$ sudo chflags uchg /etc/npmrc
```

Lock User ~/.npmrc:

Deploy via MDM to each user:

```bash
#!/bin/bash
# Deploy locked user npmrc
for user_home in /Users/*; do
    [[ ! -d "$user_home" ]] && continue
    username=$(basename "$user_home")
    # Create or overwrite .npmrc
    cat > "$user_home/.npmrc" <<'EOF'
# Managed npm configuration - DO NOT MODIFY
prefix=/Library/Application Support/ClaudeCode/npm-global
globalconfig=/Library/Application Support/ClaudeCode/npm-global/etc/npmrc
userconfig=/dev/null
EOF
    # Set ownership and make read-only
    chown "$username:staff" "$user_home/.npmrc"
    chmod 444 "$user_home/.npmrc"
    chflags uchg "$user_home/.npmrc"
    echo "✓ Locked .npmrc for user: $username"
done
```

### 8.6 Block nvm and nodenv Installation

Strategy 1: File System Restrictions

```bash
# Create .nvm and .nodenv directories owned by root, read-only
for user_home in /Users/*; do
    [[ ! -d "$user_home" ]] && continue
    username=$(basename "$user_home")
    # Create .nvm directory
    sudo mkdir -p "$user_home/.nvm"
    sudo chown root:wheel "$user_home/.nvm"
    sudo chmod 555 "$user_home/.nvm"
    sudo chflags uchg "$user_home/.nvm"
    # Create .nodenv directory
    sudo mkdir -p "$user_home/.nodenv"
    sudo chown root:wheel "$user_home/.nodenv"
    sudo chmod 555 "$user_home/.nodenv"
    sudo chflags uchg "$user_home/.nodenv"
    echo "✓ Blocked nvm/nodenv for user: $username"
done
```

Strategy 2: Monitor .zshrc and .bash_profile

Block nvm/nodenv initialization in shell profiles:

```bash
#!/bin/bash
# Monitor and remove nvm/nodenv from shell profiles
for user_home in /Users/*; do
    [[ ! -d "$user_home" ]] && continue
    for profile in "$user_home/.zshrc" "$user_home/.bash_profile" "$user_home/.bashrc"; do
        [[ ! -f "$profile" ]] && continue
        # Remove nvm initialization
        sed -i.bak '/NVM_DIR/d' "$profile"
        sed -i.bak '/nvm.sh/d' "$profile"
        # Remove nodenv initialization
        sed -i.bak '/nodenv init/d' "$profile"
        sed -i.bak '/NODENV_ROOT/d' "$profile"
    done
done
```

## 9. Process Monitoring & Detection

### 9.1 Process Monitoring Strategy

Monitoring Objectives:

1. Detect shadow Claude Code process execution
2. Monitor for suspicious file access patterns
3. Detect configuration tampering attempts
4. Alert on policy violations in real-time

Tools:

- launchd - macOS service management
- osquery - SQL-powered system monitoring
- EDR solutions - CrowdStrike, SentinelOne, etc.
- Unified Logging - macOS native logging system

### 9.2 Process Monitoring with osquery

Install osquery:

```console
# Via Homebrew
$ brew install osquery
# Or download PKG from https://osquery.io/downloads
# Verify installation
$ osqueryi --version
osqueryi version 5.10.0
```

Create osquery Configuration:

File:`/var/osquery/osquery.conf`

```json
{
  "options": {
    "config_plugin": "filesystem",
    "logger_plugin": "filesystem",
    "logger_path": "/var/log/osquery",
    "disable_logging": false,
    "log_result_events": true,
    "schedule_splay_percent": 10,
    "events_expiry": 86400,
    "verbose": false,
    "worker_threads": 2
  },
  "schedule": {
    "claude_code_processes": {
      "query": "SELECT pid, uid, username, name, path, cmdline, cwd FROM processes WHERE name LIKE '%claude-code%' OR cmdline LIKE '%claude-code%';",
      "interval": 300,
      "description": "Monitor Claude Code process execution"
    },
    "claude_code_shadow_detection": {
      "query": "SELECT pid, uid, username, path, cmdline FROM processes WHERE (path LIKE '%/.nvm/%claude-code%' OR path LIKE '%/.nodenv/%claude-code%' OR path LIKE '%/usr/local/%claude-code%' OR path LIKE '%/opt/homebrew/%claude-code%') AND path NOT LIKE '%/Library/Application Support/ClaudeCode/%';",
      "interval": 300,
      "description": "Detect shadow Claude Code installations"
    },
    "claude_code_file_events": {
      "query": "SELECT target_path, action, uid, time, eid FROM file_events WHERE target_path LIKE '/Library/Application Support/ClaudeCode/config/%' OR target_path LIKE '/Users/%/.ssh/%' OR target_path LIKE '/Users/%/.aws/%';",
      "interval": 60,
      "description": "Monitor sensitive file access"
    },
    "npm_config_changes": {
      "query": "SELECT target_path, action, uid, username, time FROM file_events WHERE target_path LIKE '%/.npmrc' OR target_path = '/etc/npmrc';",
      "interval": 60,
      "description": "Detect npm configuration changes"
    }
  },
  "file_paths": {
    "claude_code_configs": [
      "/Library/Application Support/ClaudeCode/config/**",
      "/Users/%/.config/claude-code/**"
    ],
    "sensitive_files": [
      "/Users/%/.ssh/**",
      "/Users/%/.aws/**",
      "/Users/%/.gnupg/**",
      "/Users/%/.docker/**"
    ]
  },
  "packs": {
    "incident-response": "/usr/share/osquery/packs/incident-response.conf",
    "osx-attacks": "/usr/share/osquery/packs/osx-attacks.conf"
  }
}
```

Start osquery as LaunchDaemon:

Create`/Library/LaunchDaemons/com.facebook.osqueryd.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.facebook.osqueryd</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/osqueryd</string>
        <string>--flagfile=/var/osquery/osquery.flags</string>
        <string>--config_path=/var/osquery/osquery.conf</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>60</integer>
    <key>StandardOutPath</key>
    <string>/var/log/osquery/osqueryd.stdout</string>
    <key>StandardErrorPath</key>
    <string>/var/log/osquery/osqueryd.stderr</string>
</dict>
</plist>
```

Load osquery:

```console
$ sudo launchctl load /Library/LaunchDaemons/com.facebook.osqueryd.plist
# Query results in real-time
$ osqueryi
osquery> SELECT * FROM processes WHERE name = 'claude-code';
```

### 9.3 Unified Logging Integration

macOS Unified Logging System:

Log from hooks and scripts:

```console
# Log to unified logging
$ logger -t claudecode-security -p user.warning "Shadow installation detected"
# Query logs
$ log show --predicate 'subsystem == "com.apple.system.logger" AND category == "claudecode-security"' --last 1h
# Stream logs in real-time
$ log stream --predicate 'process == "claude-code"' --level debug
```

Create Unified Logging Configuration:

File:`/Library/Preferences/Logging/Subsystems/com.yourcompany.claudecode.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Level</key>
        <dict>
            <key>Enable</key>
            <string>Info</string>
            <key>Persist</key>
            <string>Info</string>
        </dict>
    </dict>
</dict>
</plist>
```

Query Claude Code logs:

```console
# Show all Claude Code logs from last 24 hours
$ log show --predicate 'process == "node" AND eventMessage CONTAINS "claude-code"' --last 24h --info
# Export to JSON for SIEM ingestion
$ log show --predicate 'process == "node" AND eventMessage CONTAINS "claude-code"' --last 1h --style json > /tmp/claudecode-logs.json
```

### 9.4 Real-Time Alert Script

Create`/Library/Application Support/ClaudeCode/detection/realtime-monitor.sh`:

```bash
#!/bin/bash
#
# Real-time Claude Code Process Monitor
# Purpose: Detect shadow executions and alert immediately
#
LOG_FILE="/Library/Application Support/ClaudeCode/logs/realtime-monitor.log"
MANAGED_PATH="/Library/Application Support/ClaudeCode"
log() {
    echo "$(date -Iseconds) | $1" | tee -a "$LOG_FILE"
    logger -t claudecode-monitor -p user.warning "$1"
}
# Monitor process execution using log stream
log "Starting real-time process monitor..."
log stream --predicate 'process == "node" AND eventMessage CONTAINS "claude-code"' | while read -r line; do
    # Extract process details
    if echo "$line" | grep -qE '(\.nvm|\.nodenv|/usr/local|/opt/homebrew)'; then
        # Shadow installation detected
        log "ALERT: Shadow Claude Code execution detected: $line"
        # Extract PID if available
        pid=$(echo "$line" | grep -oE 'pid=[0-9]+' | cut -d'=' -f2)
        if [[ -n "$pid" ]]; then
            # Kill the shadow process
            log "Terminating shadow process PID=$pid"
            kill -9 "$pid" 2>/dev/null || true
        fi
        # Send alert to SIEM
        curl -s -X POST https://siem.yourcompany.com/api/alerts \
            -H "Content-Type: application/json" \
            -d "{\"alert\":\"shadow_claude_code_execution\",\"details\":\"$line\"}" &
    fi
done
```

Deploy as always-running LaunchDaemon (see Section 8.4 for LaunchDaemon pattern).

## 10. Audit & Logging

### 10.1 Audit Logging Architecture

Log Sources:

1. Pre-tool-use hook - Access control decisions (allow/block)
2. Post-tool-use hook - Audit trail of all tool executions
3. Shadow detection - Unauthorized installation attempts
4. Process monitor - Runtime execution monitoring
5. Configuration validation - Tampering detection

Log Destinations:

1. Local file logs -`/Library/Application Support/ClaudeCode/logs/`
2. macOS Unified Logging -`logger` command
3. syslog - For legacy SIEM integration
4. Remote SIEM - Splunk, ELK, QRadar, etc.

Log Format:

- Human-readable - Plain text for administrators
- JSON - Structured logs for SIEM ingestion
- CEF (Common Event Format) - For enterprise SIEMs

### 10.2 Comprehensive Audit Log Schema

JSON Log Format:

```json
{
  "timestamp": "2025-10-07T14:30:00.000Z",
  "log_version": "2.0",
  "event_type": "tool_execution",
  "severity": "INFO",
  "user": {
    "username": "jdoe",
    "uid": 501,
    "primary_group": "staff",
    "home_directory": "/Users/jdoe"
  },
  "system": {
    "hostname": "macbook-pro.local",
    "ip_address": "10.0.1.50",
    "mac_address": "00:11:22:33:44:55",
    "os_version": "macOS 14.0 (23A344)",
    "architecture": "arm64"
  },
  "tool": {
    "name": "Read",
    "parameters": {
      "file_path": "/Users/jdoe/Projects/app/config.js"
    },
    "status": "allowed",
    "execution_time_ms": 45
  },
  "context": {
    "working_directory": "/Users/jdoe/Projects/app",
    "session_id": "abc123-def456-gh7890",
    "parent_pid": 1234,
    "process_pid": 5678,
    "claude_code_version": "1.2.3"
  },
  "security": {
    "hook": "pre-tool-use-validator.sh",
    "decision": "allow",
    "reason": "File within allowed directory",
    "matched_rule": "allowedDirectories: /Users/*/Projects/"
  },
  "compliance": {
    "framework": "SOC2",
    "data_classification": "CONFIDENTIAL",
    "retention_days": 90
  }
}
```

### 10.3 Log Rotation and Management

Rotate Logs with newsyslog:

Create`/etc/newsyslog.d/claudecode.conf`:

```
# logfilename [owner:group] mode count size when flags [/pid_file] [sig_num]
/Library/Application Support/ClaudeCode/logs/audit.log root:wheel 644 10 100M * GZ
/Library/Application Support/ClaudeCode/logs/pre-tool-use.log root:wheel 644 10 100M * GZ
/Library/Application Support/ClaudeCode/logs/shadow-detection.log root:wheel 644 10 50M * GZ
```

Test newsyslog configuration:

```console
$ sudo newsyslog -nvv
# -n: dry run
# -vv: verbose output
# Force rotation
$ sudo newsyslog -F
```

Manual Log Rotation Script:

```bash
#!/bin/bash
# rotate-logs.sh
LOG_DIR="/Library/Application Support/ClaudeCode/logs"
MAX_SIZE=$((100 * 1024 * 1024)) # 100MB
MAX_FILES=10
for logfile in "$LOG_DIR"/*.log; do
    [[ ! -f "$logfile" ]] && continue
    filesize=$(stat -f%z "$logfile")
    if [[ $filesize -gt $MAX_SIZE ]]; then
        # Rotate
        for i in $(seq $((MAX_FILES-1)) -1 1); do
            if [[ -f "$logfile.$i.gz" ]]; then
                mv "$logfile.$i.gz" "$logfile.$((i+1)).gz"
            fi
        done
        # Compress and move current log
        gzip -c "$logfile" > "$logfile.1.gz"
        > "$logfile" # Truncate
        echo "Rotated $logfile"
    fi
done
```

### 10.4 SIEM Integration

Splunk Integration:

Install Splunk Universal Forwarder:

```console
# Download from splunk.com
$ sudo installer -pkg splunkforwarder-9.x.pkg -target /
# Configure inputs
$ sudo /opt/splunkforwarder/bin/splunk add monitor "/Library/Application Support/ClaudeCode/logs/*.log" -sourcetype claudecode:audit
# Set forward server
$ sudo /opt/splunkforwarder/bin/splunk add forward-server splunk.yourcompany.com:9997
# Start forwarder
$ sudo /opt/splunkforwarder/bin/splunk start
```

Elasticsearch/Logstash Integration:

Configure Filebeat (`/etc/filebeat/filebeat.yml`):

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /Library/Application Support/ClaudeCode/logs/*.log
    json.keys_under_root: true
    json.add_error_key: true
    fields:
      source: claudecode
      environment: production
output.logstash:
  hosts: ["logstash.yourcompany.com:5044"]
  ssl.certificate_authorities: ["/etc/pki/tls/certs/ca.crt"]
```

syslog Integration:

Configure rsyslog to forward to SIEM:

```
# /etc/syslog.conf
# Forward claudecode logs to remote syslog
local3.* @siem.yourcompany.com:514
```

### 10.5 Compliance Reporting

Generate SOC 2 Compliance Report:

```text
#!/bin/bash
# generate-compliance-report.sh
REPORT_DIR="/Library/Application Support/ClaudeCode/reports"
REPORT_FILE="$REPORT_DIR/soc2-compliance-$(date +%Y%m%d).txt"
AUDIT_LOG="/Library/Application Support/ClaudeCode/logs/audit-json.log"
mkdir -p "$REPORT_DIR"
cat > "$REPORT_FILE" <<EOF
═══════════════════════════════════════════════════════════════
Claude Code SOC 2 Compliance Report
Generated: $(date -Iseconds)
Period: $(date -v-30d '+%Y-%m-%d') to $(date '+%Y-%m-%d')
═══════════════════════════════════════════════════════════════
1. ACCESS CONTROL (CC6.1)
   - Managed configuration enforced: $(test -f "/Library/Application Support/ClaudeCode/config/managed-settings.json" && echo "✓ YES" || echo "✗ NO")
   - Configuration is read-only: $(test -w "/Library/Application Support/ClaudeCode/config/managed-settings.json" && echo "✗ NO" || echo "✓ YES")
   - Security hooks active: $(test -x "/Library/Application Support/ClaudeCode/config/security-hooks/pre-tool-use-validator.sh" && echo "✓ YES" || echo "✗ NO")
2. LOGICAL AND PHYSICAL ACCESS (CC6.6)
   - Total file access attempts: $(jq -s 'length' "$AUDIT_LOG" 2>/dev/null || echo "0")
   - Blocked access attempts: $(jq -s '[.[] | select(.security.decision == "block")] | length' "$AUDIT_LOG" 2>/dev/null || echo "0")
   - Sensitive file access (blocked): $(jq -s '[.[] | select(.tool.parameters.file_path | test("(\\.ssh|\\.aws|\\.env)"))] | length' "$AUDIT_LOG" 2>/dev/null || echo "0")
3. CHANGE MANAGEMENT (CC8.1)
   - Configuration changes detected: $(grep -c "managed-settings.json" "/Library/Application Support/ClaudeCode/logs/config-validation.log" 2>/dev/null || echo "0")
   - Unauthorized modifications: $(grep -c "hash mismatch" "/Library/Application Support/ClaudeCode/logs/config-validation.log" 2>/dev/null || echo "0")
4. MONITORING (CC7.2)
   - Shadow installations detected: $(grep -c "Shadow installation detected" "/Library/Application Support/ClaudeCode/logs/shadow-detection.log" 2>/dev/null || echo "0")
   - Active monitoring: $(launchctl list | grep -c "claudecode" || echo "0") LaunchDaemons running
5. DATA INTEGRITY (CC7.1)
   - Audit log entries: $(wc -l < "$AUDIT_LOG" 2>/dev/null || echo "0")
   - Log tampering detected: $(grep -c "WARNING" "/Library/Application Support/ClaudeCode/logs/config-validation.log" 2>/dev/null || echo "0")
═══════════════════════════════════════════════════════════════
Compliance Status: $(test $(grep -c "✗" "$REPORT_FILE") -eq 0 && echo "✓ PASS" || echo "✗ FAIL")
═══════════════════════════════════════════════════════════════
EOF
echo "Report generated: $REPORT_FILE"
cat "$REPORT_FILE"
```

## 11. MDM Deployment with Jamf Pro

### 11.1 Jamf Pro Policy for Installation

Create Installation Package:

```bash
#!/bin/bash
# create-pkg.sh - Create installer package for Jamf Pro
PACKAGE_DIR="/tmp/claudecode-enterprise-pkg"
SCRIPTS_DIR="$PACKAGE_DIR/scripts"
PAYLOAD_DIR="$PACKAGE_DIR/payload"
mkdir -p "$SCRIPTS_DIR"
mkdir -p "$PAYLOAD_DIR/Library/Application Support/ClaudeCode"
# Copy installation files to payload
cp -R "/Library/Application Support/ClaudeCode"/* "$PAYLOAD_DIR/Library/Application Support/ClaudeCode/"
# Create postinstall script
cat > "$SCRIPTS_DIR/postinstall" <<'EOF'
#!/bin/bash
# Post-installation script
# Set permissions
chown -R root:wheel "/Library/Application Support/ClaudeCode"
chmod 755 "/Library/Application Support/ClaudeCode"
chmod 444 "/Library/Application Support/ClaudeCode/config/managed-settings.json"
chflags uchg "/Library/Application Support/ClaudeCode/config/managed-settings.json"
# Create symlink
ln -sf "/Library/Application Support/ClaudeCode/bin/claude-code" /usr/local/bin/claude-code
# Load LaunchDaemons
launchctl load "/Library/LaunchDaemons/com.yourcompany.claudecode.shadowdetect.plist"
echo "Claude Code Enterprise installation complete"
exit 0
EOF
chmod +x "$SCRIPTS_DIR/postinstall"
# Build package
pkgbuild --root "$PAYLOAD_DIR" \
         --scripts "$SCRIPTS_DIR" \
         --identifier "com.yourcompany.claudecode-enterprise" \
         --version "2.0" \
         --install-location "/" \
         "/tmp/ClaudeCode-Enterprise-2.0.pkg"
echo "Package created: /tmp/ClaudeCode-Enterprise-2.0.pkg"
```

Upload to Jamf Pro:

1. Navigate to Settings > Computer Management > Packages
2. Click New
3. Upload`ClaudeCode-Enterprise-2.0.pkg`
4. Set Display Name: "Claude Code Enterprise v2.0"
5. Category: "Development Tools"
6. Save

Create Jamf Pro Policy:

Configure:

- General:
- Display Name: "Install Claude Code Enterprise"
- Enabled: ✓
- Category: Development Tools
- Trigger: Recurring Check-In, Enrollment Complete
- Packages:
- Add: ClaudeCode-Enterprise-2.0.pkg
- Action: Install
- Scripts: (if using scripts instead of package)
- Add: install-claudecode-enterprise.sh
- Priority: Before
- Scope:
- Target Computers: All Managed Clients (or specific Smart Group)
- Self Service:
- Make Available in Self Service: ✓
- Button Name: "Install Claude Code Enterprise"

1. Save

### 11.2 Jamf Pro Extension Attributes

Create Extension Attribute for Claude Code Version:

Configure:

- Display Name: "Claude Code Version"
- Description: "Installed version of Claude Code"
- Data Type: String
- Input Type: Script

Script:

```bash
#!/bin/bash
CLAUDE_PATH="/Library/Application Support/ClaudeCode/bin/claude-code"
if [[ -f "$CLAUDE_PATH" ]]; then
    version=$("$CLAUDE_PATH" --version 2>/dev/null || echo "unknown")
    echo "<result>$version</result>"
else
    echo "<result>Not Installed</result>"
fi
```

1. Save

Create Extension Attribute for Shadow Installation Detection:

Script:

```bash
#!/bin/bash
shadow_count=0
# Check nvm
if find /Users -maxdepth 2 -name ".nvm" -type d 2>/dev/null | grep -q ".nvm"; then
    ((shadow_count++))
fi
# Check nodenv
if find /Users -maxdepth 2 -name ".nodenv" -type d 2>/dev/null | grep -q ".nodenv"; then
    ((shadow_count++))
fi
# Check Homebrew
if [[ -d "/usr/local/lib/node_modules/@anthropic/claude-code" ]] || [[ -d "/opt/homebrew/lib/node_modules/@anthropic/claude-code" ]]; then
    ((shadow_count++))
fi
if [[ $shadow_count -gt 0 ]]; then
    echo "<result>$shadow_count shadow installation(s) detected</result>"
else
    echo "<result>None</result>"
fi
```

### 11.3 Jamf Pro Smart Groups

Smart Group: "Claude Code Managed"

Criteria:

- Extension Attribute "Claude Code Version" is not "Not Installed"
- Extension Attribute "Shadow Installation Detection" is "None"

Smart Group: "Claude Code Shadow Detected"

Criteria:

- Extension Attribute "Shadow Installation Detection" is not "None"

Smart Group: "Claude Code Needs Update"

Criteria:

- Extension Attribute "Claude Code Version" is not "1.2.3" (target version)
- Extension Attribute "Claude Code Version" is not "Not Installed"

### 11.4 Configuration Profile Deployment

Deploy User .npmrc via Configuration Profile:

Configure:

- General:
- Name: "Claude Code npm Configuration"
- Level: Computer Level
- Custom Settings:
- Add: Upload custom .npmrc plist

Create custom plist for .npmrc deployment (workaround - Jamf doesn't directly support .npmrc):

Use Files and Processes payload instead:

Options:

- Execute Command:

```bash
for user_home in /Users/*; do
[[ ! -d "$user_home" ]] && continue
cat > "$user_home/.npmrc" <<'EOF'
prefix=/Library/Application Support/ClaudeCode/npm-global
globalconfig=/Library/Application Support/ClaudeCode/npm-global/etc/npmrc
userconfig=/dev/null
EOF
chown $(basename "$user_home"):staff "$user_home/.npmrc"
chmod 444 "$user_home/.npmrc"
done
```

- Execution Frequency: Once per computer

1. Scope: All Computers
2. Save

### 11.5 Jamf Pro Compliance Reporting

Create Advanced Computer Search:

Configure:

- Display Name: "Claude Code Compliance Report"
- Criteria:
- Extension Attribute "Claude Code Version" is like "1.2.*"
- Extension Attribute "Shadow Installation Detection" is "None"
- Display:
- Computer Name
- Username
- Claude Code Version
- Last Check-in
- Shadow Installation Detection

1. Save

Export Report:

- Click View on saved search
- Click Export (CSV, XML, PDF)

Schedule Report Email:

- Configure in Settings > Global Management > Re-enrollment

## Conclusion

This comprehensive guide provides enterprise security teams with the tools and knowledge to deploy Claude Code securely in macOS environments. By implementing the defense-in-depth strategies outlined - including system-level installation, managed configurations, security hooks, shadow installation prevention, and comprehensive monitoring - organizations can maintain control over AI-assisted development tools while meeting compliance requirements.

Key Takeaways:

1. System-Level Installation: Install Claude Code at`/Library/Application Support/ClaudeCode/` with root ownership
2. Managed Configuration: Use read-only`managed-settings.json` with immutable flag
3. Security Hooks: Implement pre-tool-use and post-tool-use hooks for access control and auditing
4. Shadow Prevention: Deploy multi-layered detection for nvm, nodenv, Homebrew installations
5. MDM Integration: Leverage Jamf Pro, Kandji, or Intune for automated deployment and compliance
6. Comprehensive Logging: Integrate with SIEM for audit trails and compliance reporting
7. macOS-Specific Security: Utilize TCC, SIP, Gatekeeper, and FileVault

Maintenance Schedule:

- Hourly: Shadow installation scans, configuration validation
- Daily: Log review, audit log analysis
- Weekly: Compliance reports, MDM inventory checks
- Monthly: Security testing, policy updates
- Quarterly: Comprehensive security audits, penetration testing
