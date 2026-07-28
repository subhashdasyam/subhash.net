---
title: "Securing Claude Code for Windows Enterprise Deployments: A Comprehensive Security Framework"
date: 2025-10-07T01:46:00.004+04:00
lastmod: 2025-10-08T01:32:01.931+04:00
slug: "securing-claude-code-for-windows"
sourceURL: "https://www.subhashdasyam.com/2025/10/securing-claude-code-for-windows.html"
---
A Complete Guide to Enterprise-Grade Security Controls, Managed Policies, and Zero-Trust Architecture for Claude Code on Windows

## Executive Summary

As enterprises increasingly adopt AI-powered development tools like Claude Code, the security implications of granting AI assistants access to codebases, credentials, and corporate infrastructure have become critical concerns. This guide provides a comprehensive security framework specifically designed for Windows enterprise environments, covering installation hardening, configuration management, hook-based access controls, and compliance monitoring.

Key Security Challenges Addressed:

- Preventing AI access to sensitive files (.env, credentials, certificates)
- Blocking modifications to Windows system directories
- Deploying immutable, centrally-managed security policies
- Implementing zero-trust access controls via hooks
- Ensuring compliance with SOC2, GDPR, and industry regulations
- Protecting against prompt injection and data exfiltration

Target Audience: Enterprise Security Architects, IT Administrators, DevSecOps Engineers, Compliance Officers

## 1. Threat Model & Risk Assessment

### 1.1 Understanding the Attack Surface

Claude Code operates as an AI-powered CLI tool with significant system access:

Read Permissions (Default):

- Can read any file accessible to the user account
- Accesses system libraries and dependencies outside project scope
- Reads configuration files across the filesystem

Write Permissions (Configurable):

- By default, limited to project starting folder and subfolders
- Can be configured to write to additional directories
- Executes bash commands with user privileges

Network Access:

- Communicates with Anthropic API endpoints
- Can fetch web content (with restrictions)
- Supports proxy configurations for corporate networks

### 1.2 Key Threat Vectors

1. Credential Exfiltration

- Risk: AI reads`.env`,`.aws/credentials`, SSH keys, certificates
- Impact: Unauthorized access to cloud resources, databases, APIs
- Likelihood: HIGH without proper controls

2. Sensitive Data Leakage

- Risk: AI includes proprietary code, trade secrets in prompts sent to Anthropic
- Impact: Intellectual property theft, competitive disadvantage
- Likelihood: MEDIUM (Anthropic has data usage policies, but risk remains)

3. System Modification

- Risk: AI modifies system files, registry, critical configurations
- Impact: System instability, privilege escalation, persistence mechanisms
- Likelihood: LOW with default settings, HIGH if permissions loosened

4. Prompt Injection Attacks

- Risk: Malicious code in repository tricks AI into executing harmful commands
- Impact: Arbitrary code execution, data destruction, lateral movement
- Likelihood: MEDIUM (Claude has built-in protections, but not foolproof)

5. Supply Chain Attacks

- Risk: AI modifies dependencies, package files, build scripts
- Impact: Backdoored software, compromised builds
- Likelihood: MEDIUM without proper hooks validation

### 1.3 Compliance Requirements

SOC 2 Type II:

- Audit trails for all AI operations
- Access controls and permission reviews
- Data encryption in transit and at rest
- Incident response procedures

GDPR/CCPA:

- Personal data handling restrictions
- Data minimization in AI prompts
- Right to deletion compliance
- Cross-border data transfer controls

HIPAA (Healthcare):

- PHI protection mechanisms
- Business Associate Agreements (BAAs)
- Encryption and audit logging
- De-identification requirements

Industry-Specific:

- PCI-DSS for payment card data
- FINRA/SEC for financial services
- FedRAMP for government contractors
- ISO 27001 for international operations

### 1.4 Risk Severity Matrix

| Threat Vector | Likelihood | Impact | Risk Level | Mitigation Priority |
| --- | --- | --- | --- | --- |
| Credential Exfiltration | High | Critical | CRITICAL | IMMEDIATE |
| System File Modification | Low | Critical | HIGH | HIGH |
| Sensitive Data Leakage | Medium | High | HIGH | HIGH |
| Prompt Injection | Medium | High | HIGH | MEDIUM |
| Supply Chain Compromise | Medium | High | HIGH | MEDIUM |
| Network Data Exfiltration | Low | Medium | MEDIUM | MEDIUM |

---

## 2. Secure Installation Strategy

### 2.1 The npm Installation Challenge on Windows

Problem: In enterprise Windows environments, default npm global installation paths create security conflicts:

Default npm Global Path:

```
C:\Users\<username>\AppData\Roaming\npm

```

Enterprise Security Issues:

1. AppData Execution Blocking: Many enterprises block code execution from`AppData` to prevent ransomware
2. User-Specific Installation: Not truly "global" - each user gets separate installation
3. Folder Redirection: Domain environments redirect`AppData` to network shares, causing performance issues
4. Permission Conflicts: UAC and folder virtualization interfere with installation

### 2.2 Solution: Enterprise-Controlled Installation Path

Recommended Approach: Install Claude Code in a centrally-managed, non-writable location.

#### Option 1: ProgramData Installation (Recommended)

```powershell
# Step 1: Configure npm to use ProgramData for global packages
npm config set prefix "C:\ProgramData\ClaudeCode\npm-global" --global

# Step 2: Create directory structure with proper permissions
New-Item -ItemType Directory -Force -Path "C:\ProgramData\ClaudeCode\npm-global"
New-Item -ItemType Directory -Force -Path "C:\ProgramData\ClaudeCode\managed-policies"

# Step 3: Set NTFS permissions (Admins write, Users read+execute)
icacls "C:\ProgramData\ClaudeCode" /grant "Administrators:(OI)(CI)F" /grant "Users:(OI)(CI)RX" /T

# Step 4: Add to system PATH (requires admin)
[Environment]::SetEnvironmentVariable(
    "Path",
    $env:Path + ";C:\ProgramData\ClaudeCode\npm-global",
    "Machine"
)

# Step 5: Install Claude Code
npm install -g @anthropic-ai/claude-code

```

Benefits:

- ✅ Centralized installation (single source of truth)
- ✅ Not blocked by AppData execution policies
- ✅ Works with domain folder redirection
- ✅ Users can execute but not modify installation
- ✅ Compatible with AppLocker/WDAC policies

#### Option 2: Program Files Installation

```powershell
# Configure npm prefix to Program Files
npm config set prefix "C:\Program Files\ClaudeCode" --global

# Install with elevated permissions
Start-Process powershell -Verb RunAs -ArgumentList "-Command npm install -g @anthropic-ai/claude-code"

# Note: UAC virtualization may interfere - ProgramData preferred

```

#### Option 3: Native Binary Installation (Beta)

```powershell
# Download and execute install script with controlled path
$installPath = "C:\ProgramData\ClaudeCode\bin"
$env:CLAUDE_INSTALL_DIR = $installPath

# Run installer (adapt for Windows)
# Note: As of 2025, native installer primarily targets Unix-like systems
# For Windows, npm installation remains primary method

```

### 2.3 AppLocker/WDAC Integration

For environments using Microsoft Defender Application Control (WDAC) or AppLocker:

Step 1: Create AppLocker Rule

```
<RuleCollection Type="Exe">
  <FilePathRule Id="claude-code-allow" Name="Claude Code Allowed Path"
                Description="Allow Claude Code from ProgramData"
                UserOrGroupSid="S-1-1-0" Action="Allow">
    <Conditions>
      <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\claude.cmd"/>
    </Conditions>
  </FilePathRule>
</RuleCollection>

```

Step 2: WDAC Policy XML

```
<FileRules>
  <Allow ID="ID_ALLOW_CLAUDE"
         FriendlyName="Claude Code Executable"
         FileName="node.exe"
         FilePath="C:\ProgramData\ClaudeCode\npm-global\*"/>
</FileRules>

```

Step 3: Deploy via Group Policy

```
# Export WDAC policy to binary
ConvertFrom-CIPolicy -XmlFilePath .\ClaudeCodePolicy.xml -BinaryFilePath .\ClaudeCodePolicy.bin

# Deploy via GPO
Copy-Item .\ClaudeCodePolicy.bin -Destination "\\domain\SYSVOL\domain\Policies\{GPO-ID}\Machine\AppLocker\"

```

### 2.4 Deployment Script for Enterprise Rollout

```powershell
<#
.SYNOPSIS
    Enterprise deployment script for Claude Code on Windows
.DESCRIPTION
    Installs Claude Code in ProgramData with proper permissions and managed policies
.NOTES
    Requires: Administrator privileges, npm installed
#>

[CmdletBinding()]
param(
    [string]$InstallPath = "C:\ProgramData\ClaudeCode",
    [string]$ManagedPolicySource = "\\fileserver\IT\ClaudeCode\managed-settings.json"
)

# Check admin privileges
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires Administrator privileges"
    exit 1
}

Write-Host "Installing Claude Code for Enterprise..." -ForegroundColor Green

# Step 1: Create directory structure
$paths = @(
    "$InstallPath\npm-global",
    "$InstallPath\managed-policies"
)

foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
        Write-Host "Created: $path" -ForegroundColor Cyan
    }
}

# Step 2: Configure npm prefix
npm config set prefix "$InstallPath\npm-global" --global
Write-Host "Configured npm global prefix" -ForegroundColor Cyan

# Step 3: Set NTFS permissions
# Admins: Full Control (recursive)
# Users: Read & Execute (recursive)
icacls $InstallPath /grant "BUILTIN\Administrators:(OI)(CI)F" /T | Out-Null
icacls $InstallPath /grant "BUILTIN\Users:(OI)(CI)RX" /T | Out-Null
Write-Host "Configured NTFS permissions" -ForegroundColor Cyan

# Step 4: Add to system PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$InstallPath\npm-global*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$currentPath;$InstallPath\npm-global",
        "Machine"
    )
    Write-Host "Added to system PATH" -ForegroundColor Cyan
}

# Step 5: Install Claude Code
Write-Host "Installing @anthropic-ai/claude-code..." -ForegroundColor Cyan
npm install -g @anthropic-ai/claude-code --quiet

# Step 6: Deploy managed policies
if (Test-Path $ManagedPolicySource) {
    Copy-Item $ManagedPolicySource -Destination "$InstallPath\managed-policies\managed-settings.json" -Force

    # Make managed policies read-only
    $policyFile = "$InstallPath\managed-policies\managed-settings.json"
    Set-ItemProperty -Path $policyFile -Name IsReadOnly -Value $true
    icacls $policyFile /inheritance:r /grant "BUILTIN\Administrators:(F)" /grant "BUILTIN\Users:(R)" | Out-Null

    Write-Host "Deployed managed security policies" -ForegroundColor Cyan
}

# Step 7: Verify installation
$claudeVersion = claude --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nInstallation successful!" -ForegroundColor Green
    Write-Host "Claude Code version: $claudeVersion" -ForegroundColor Cyan
    Write-Host "Installation path: $InstallPath" -ForegroundColor Cyan
} else {
    Write-Error "Installation verification failed"
    exit 1
}

# Step 8: Display next steps
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Review managed policies at: $InstallPath\managed-policies\managed-settings.json"
Write-Host "2. Configure project-specific settings in .claude/settings.json"
Write-Host "3. Implement security hooks for sensitive file protection"
Write-Host "4. Test with: claude --help"

```

### 2.5 Avoiding Common Pitfalls

| Issue | Problem | Solution |
| --- | --- | --- |
| AppData Blocked | Enterprise security blocks AppData execution | Use ProgramData path instead |
| Network AppData | Folder redirection causes slow performance | Install locally in ProgramData |
| UAC Virtualization | Program Files writes get virtualized | Use ProgramData, not Program Files |
| Per-User Install | Each user gets separate installation | Use system-wide ProgramData installation |
| Path Issues | claude.cmd not found | Add to system PATH, not user PATH |
| npm Prefix Conflicts | Global npmrc vs user npmrc | Set at system level with`--global` flag |

---

## 3. Configuration Hierarchy & Managed Policies

### 3.1 Understanding Settings Precedence

Claude Code uses a hierarchical configuration system with higher priority overriding lower priority:

```
1. HIGHEST: Enterprise Managed Policies (C:\ProgramData\ClaudeCode\managed-settings.json)
   ↓
2. Command-line arguments (--permissions, --model, etc.)
   ↓
3. Local project settings (.claude/settings.local.json)
   ↓
4. Shared project settings (.claude/settings.json)
   ↓
5. LOWEST: User settings (~/.config/claude/settings.json or %APPDATA%)

```

Key Principle: Managed policies CANNOT be overridden by users or project configurations.

### 3.2 Deploying Managed Policies

Location on Windows:

```
C:\ProgramData\ClaudeCode\managed-settings.json  (Settings)
C:\ProgramData\ClaudeCode\managed-mcp.json       (MCP Servers)

```

Enterprise Managed Settings Example:

```json
{
  "$schema": "https://api.claude.com/schemas/settings-v1.json",
  "model": "claude-sonnet-4-5",

  "permissions": {
    "defaultMode": "plan",

    "deny": [
      {
        "tool": "Edit",
        "matcher": "**/.env*"
      },
      {
        "tool": "Edit",
        "matcher": "**/*.key"
      },
      {
        "tool": "Edit",
        "matcher": "**/*.pem"
      },
      {
        "tool": "Edit",
        "matcher": "**/credentials*"
      },
      {
        "tool": "Read",
        "matcher": "C:/Windows/**"
      },
      {
        "tool": "Read",
        "matcher": "C:/Program Files/**"
      },
      {
        "tool": "Read",
        "matcher": "**/node_modules/**"
      },
      {
        "tool": "Bash",
        "matcher": "**/rm *"
      },
      {
        "tool": "Bash",
        "matcher": "**/del *"
      },
      {
        "tool": "Bash",
        "matcher": "**/format *"
      }
    ],

    "ask": [
      {
        "tool": "Edit",
        "matcher": "**/*.json"
      },
      {
        "tool": "Edit",
        "matcher": "**/*.yaml"
      },
      {
        "tool": "Bash",
        "matcher": "**"
      }
    ],

    "allow": [
      {
        "tool": "Read",
        "matcher": "**/*.md"
      },
      {
        "tool": "Read",
        "matcher": "**/*.js"
      },
      {
        "tool": "Read",
        "matcher": "**/*.ts"
      }
    ],

    "additionalDirectories": []
  },

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-edit.ps1"
          }
        ]
      },
      {
        "matcher": "Bash:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-bash.ps1"
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -File C:\\ProgramData\\ClaudeCode\\hooks\\audit-log.ps1"
          }
        ]
      }
    ]
  },

  "envVars": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true",
    "NODE_EXTRA_CA_CERTS": "C:\\ProgramData\\ClaudeCode\\certs\\corporate-ca.crt",
    "HTTP_PROXY": "http://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com"
  }
}

```

### 3.3 Making Managed Policies Immutable

PowerShell Script to Deploy and Lock:

```powershell
# Deploy managed policies with read-only protection
$managedPolicyPath = "C:\ProgramData\ClaudeCode\managed-settings.json"
$policyContent = Get-Content "\\fileserver\IT\ClaudeCode\managed-settings.json" -Raw

# Write policy file
Set-Content -Path $managedPolicyPath -Value $policyContent -Force

# Set read-only attribute
Set-ItemProperty -Path $managedPolicyPath -Name IsReadOnly -Value $true

# Remove inheritance and set explicit permissions
icacls $managedPolicyPath /inheritance:r
icacls $managedPolicyPath /grant "BUILTIN\Administrators:(F)"  # Full control for admins
icacls $managedPolicyPath /grant "BUILTIN\Users:(R)"            # Read-only for users
icacls $managedPolicyPath /deny "BUILTIN\Users:(W,D,WD)"       # Explicitly deny write/delete

Write-Host "Managed policy deployed and locked" -ForegroundColor Green

```

### 3.4 Group Policy Deployment

Option 1: GPO File Deployment

```
# Create GPO for Claude Code settings distribution
$gpoName = "Claude Code Enterprise Settings"
$gpo = New-GPO -Name $gpoName

# Configure file deployment via GPP (Group Policy Preferences)
# Path: Computer Configuration > Preferences > Windows Settings > Files

# Set source file
$sourceFile = "\\domain\SYSVOL\domain\ClaudeCode\managed-settings.json"
$targetPath = "C:\ProgramData\ClaudeCode\managed-settings.json"

# Apply: Replace if exists, Run once

```

Option 2: Logon Script Deployment

```powershell
# In GPO > Computer Configuration > Windows Settings > Scripts > Startup

# deploy-claude-settings.ps1
$source = "\\fileserver\IT\ClaudeCode\managed-settings.json"
$dest = "C:\ProgramData\ClaudeCode\managed-settings.json"

if (Test-Path $source) {
    Copy-Item $source $dest -Force
    Set-ItemProperty -Path $dest -Name IsReadOnly -Value $true
}

```

### 3.5 Managed MCP Server Configuration

C:\ProgramData\ClaudeCode\managed-mcp.json:

```json
{
  "mcpServers": {
    "corporate-knowledge": {
      "command": "node",
      "args": ["C:\\ProgramData\\ClaudeCode\\mcp-servers\\corporate-kb\\index.js"],
      "env": {
        "KB_DATABASE_URL": "https://kb.corp.example.com/api",
        "KB_API_KEY": "${CORPORATE_KB_API_KEY}"
      },
      "disabled": false
    },

    "compliance-checker": {
      "command": "python",
      "args": ["C:\\ProgramData\\ClaudeCode\\mcp-servers\\compliance\\server.py"],
      "env": {
        "COMPLIANCE_RULES": "C:\\ProgramData\\ClaudeCode\\compliance\\rules.json"
      },
      "disabled": false
    }
  }
}

```

Security Considerations for MCP Servers:

- ✅ Store MCP server code in protected ProgramData directory
- ✅ Use environment variables for sensitive credentials (not hardcoded)
- ✅ Validate MCP server inputs to prevent injection attacks
- ✅ Log all MCP server interactions for audit trails
- ✅ Restrict MCP server network access via firewall rules

### 3.6 Configuration Validation Script

```powershell
<#
.SYNOPSIS
    Validates Claude Code configuration security
#>

function Test-ClaudeCodeSecurity {
    $issues = @()

    # Check 1: Managed policy exists and is read-only
    $managedPolicy = "C:\ProgramData\ClaudeCode\managed-settings.json"
    if (-not (Test-Path $managedPolicy)) {
        $issues += "ERROR: Managed policy not found at $managedPolicy"
    } else {
        $isReadOnly = (Get-ItemProperty $managedPolicy).IsReadOnly
        if (-not $isReadOnly) {
            $issues += "WARNING: Managed policy is not read-only"
        }
    }

    # Check 2: Installation path is not in AppData
    $npmPrefix = npm config get prefix --global
    if ($npmPrefix -like "*AppData*") {
        $issues += "ERROR: npm prefix is in AppData ($npmPrefix) - should be in ProgramData"
    }

    # Check 3: Hooks directory exists
    $hooksDir = "C:\ProgramData\ClaudeCode\hooks"
    if (-not (Test-Path $hooksDir)) {
        $issues += "WARNING: Hooks directory not found at $hooksDir"
    }

    # Check 4: Sensitive file protections in place
    $managedConfig = Get-Content $managedPolicy -Raw | ConvertFrom-Json
    $hasSensitiveFileDeny = $managedConfig.permissions.deny | Where-Object {
        $_.matcher -like "*/.env*" -or $_.matcher -like "**/*.key"
    }
    if (-not $hasSensitiveFileDeny) {
        $issues += "ERROR: No sensitive file deny rules found in managed policy"
    }

    # Check 5: Verify NTFS permissions
    $acl = Get-Acl "C:\ProgramData\ClaudeCode"
    $usersCanWrite = $acl.Access | Where-Object {
        $_.IdentityReference -like "*Users*" -and $_.FileSystemRights -like "*Write*"
    }
    if ($usersCanWrite) {
        $issues += "ERROR: Users have write access to ClaudeCode directory"
    }

    # Report results
    if ($issues.Count -eq 0) {
        Write-Host "✓ All security checks passed" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Security issues found:" -ForegroundColor Red
        $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        return $false
    }
}

# Run validation
Test-ClaudeCodeSecurity

```

---

## 4. Hooks-Based Security Framework

### 4.1 Understanding Claude Code Hooks

Hooks are the primary enforcement mechanism for custom security policies. They execute shell commands at specific points in Claude's workflow:

Hook Types:

- PreToolUse: Executes BEFORE a tool is used (can block operations)
- PostToolUse: Executes AFTER a tool completes (for logging/notification)
- UserPromptSubmit: Executes when user submits a prompt
- SessionStart: Executes when Claude session begins
- SessionEnd: Executes when Claude session ends
- Notification: Executes when Claude needs user input

Control Mechanisms:

Exit Code Method (Simple):

- Exit code`0`: Allow operation
- Exit code`2`: BLOCK operation (critical for security)
- Other codes: Log error but allow

JSON Output Method (Advanced):

```json
{
  "continue": false,
  "stopReason": "Blocked: Attempting to access sensitive file",
  "suppressOutput": true,
  "systemMessage": "Security policy violation detected"
}

```

### 4.2 Core Security Hooks Architecture

Directory Structure:

```text
C:\ProgramData\ClaudeCode\hooks\
├── validate-edit.ps1         # Pre-edit validation
├── validate-bash.ps1         # Bash command validation
├── validate-read.ps1         # Read operation validation
├── audit-log.ps1             # Post-operation audit logging
├── sensitive-files.json      # Sensitive file patterns database
└── blocked-directories.json  # Blocked directory list

```

### 4.3 Sensitive File Protection Hook

validate-edit.ps1:

```powershell
<#
.SYNOPSIS
    PreToolUse hook to block edits to sensitive files
.DESCRIPTION
    Validates Edit tool usage against sensitive file patterns
    Exits with code 2 to BLOCK the operation if sensitive file detected
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

# Parse hook input JSON
$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json

# Extract file path from tool parameters
$filePath = $input.parameters.file_path

if (-not $filePath) {
    # No file path provided, allow operation
    exit 0
}

# Normalize path for comparison
$normalizedPath = $filePath -replace '/', '\'
$fileName = Split-Path $filePath -Leaf

# Load sensitive file patterns
$patternsFile = "C:\ProgramData\ClaudeCode\hooks\sensitive-files.json"
if (Test-Path $patternsFile) {
    $patterns = Get-Content $patternsFile -Raw | ConvertFrom-Json
} else {
    # Fallback patterns if file not found
    $patterns = @{
        "extensions" = @("*.env", "*.key", "*.pem", "*.pfx", "*.p12", "*.jks", "*.keystore", "*.credentials")
        "filenames" = @("credentials.json", "secrets.json", ".env", ".env.local", ".env.production", "id_rsa", "id_dsa")
        "paths" = @("**/.ssh/*", "**/.aws/*", "**/.gcp/*", "**/credentials/*")
    }
}

# Check file extensions
foreach ($ext in $patterns.extensions) {
    if ($fileName -like $ext) {
        # BLOCK: Sensitive file extension detected
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Cannot edit sensitive file with extension: $ext"
            suppressOutput = $false
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2  # Exit code 2 = BLOCK
    }
}

# Check exact filenames
if ($patterns.filenames -contains $fileName) {
    $blockMessage = @{
        continue = $false
        stopReason = "SECURITY BLOCK: Cannot edit protected file: $fileName"
        suppressOutput = $false
    } | ConvertTo-Json -Compress

    Write-Output $blockMessage
    exit 2
}

# Check path patterns (simplified glob matching)
foreach ($pathPattern in $patterns.paths) {
    # Convert glob pattern to regex
    $regexPattern = $pathPattern -replace '\*\*', '.*' -replace '\*', '[^\\]*' -replace '/', '\\'

    if ($normalizedPath -match $regexPattern) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Path matches protected pattern: $pathPattern"
            suppressOutput = $false
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Additional check: Windows system directories
$systemPaths = @(
    "C:\Windows",
    "C:\Windows\System32",
    "C:\Windows\SysWOW64",
    "C:\Program Files",
    "C:\Program Files (x86)",
    "C:\ProgramData\ClaudeCode"  # Protect our own installation
)

foreach ($sysPath in $systemPaths) {
    if ($normalizedPath -like "$sysPath\*") {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Cannot edit Windows system directory: $sysPath"
            suppressOutput = $false
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Passed all checks - allow operation
exit 0

```

### 4.4 Bash Command Validation Hook

validate-bash.ps1:

```powershell
<#
.SYNOPSIS
    PreToolUse hook to validate Bash commands
.DESCRIPTION
    Blocks dangerous bash commands and validates against security policy
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

# Parse hook input
$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json
$command = $input.parameters.command

if (-not $command) {
    exit 0
}

# Dangerous command patterns (case-insensitive)
$dangerousPatterns = @(
    # Destructive commands
    'rm\s+-rf',
    'del\s+/[fqs]',
    'format\s+',
    'diskpart',

    # System modification
    'reg\s+(add|delete)',
    'sc\s+(config|delete)',
    'net\s+user',
    'net\s+localgroup',

    # Credential access
    'cmdkey',
    'vaultcmd',
    'Get-Credential',

    # Network exfiltration
    'curl\s+.*\s+-d',
    'wget\s+.*--post',
    'Invoke-WebRequest.*-Method\s+Post',

    # Encoding/obfuscation
    '[System.Convert]::FromBase64String',
    'iex\s+\(',
    'Invoke-Expression',

    # File operations on sensitive paths
    'copy.*credentials',
    'copy.*\.env',
    'type.*\.key',
    'cat.*id_rsa'
)

foreach ($pattern in $dangerousPatterns) {
    if ($command -match $pattern) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Dangerous command pattern detected: $pattern"
            suppressOutput = $false
            systemMessage = "Command blocked by security policy. Contact IT security if this is a legitimate operation."
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Check for access to Windows system directories
$systemDirPatterns = @(
    'C:\\Windows',
    'C:\\Program Files',
    'System32',
    'SysWOW64'
)

foreach ($dirPattern in $systemDirPatterns) {
    if ($command -match $dirPattern) {
        # Log warning but allow (may be legitimate)
        Write-Warning "Bash command accesses system directory: $dirPattern"
        # Could be changed to exit 2 to block system access entirely
    }
}

# Passed validation
exit 0

```

### 4.5 Comprehensive Audit Logging Hook

audit-log.ps1:

```powershell
<#
.SYNOPSIS
    PostToolUse hook for comprehensive audit logging
.DESCRIPTION
    Logs all Claude operations to centralized audit trail
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

# Parse input
$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json

# Audit log configuration
$auditLogPath = "C:\ProgramData\ClaudeCode\logs\audit.jsonl"  # JSON Lines format
$maxLogSizeMB = 100

# Create log directory if not exists
$logDir = Split-Path $auditLogPath -Parent
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

# Rotate log if too large
if (Test-Path $auditLogPath) {
    $logSize = (Get-Item $auditLogPath).Length / 1MB
    if ($logSize -gt $maxLogSizeMB) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $archivePath = "$logDir\audit_$timestamp.jsonl"
        Move-Item $auditLogPath $archivePath

        # Optionally compress old logs
        Compress-Archive -Path $archivePath -DestinationPath "$archivePath.zip"
        Remove-Item $archivePath
    }
}

# Build audit entry
$auditEntry = @{
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    user = $env:USERNAME
    computer = $env:COMPUTERNAME
    project_dir = $env:CLAUDE_PROJECT_DIR
    tool = $input.tool
    parameters = $input.parameters
    result = $input.result  # Available in PostToolUse hooks
    session_id = $env:CLAUDE_SESSION_ID  # If available
}

# Add to audit log (JSON Lines format - one JSON object per line)
$auditJson = $auditEntry | ConvertTo-Json -Compress
Add-Content -Path $auditLogPath -Value $auditJson

# Optionally forward to SIEM
$siemEnabled = $true
$siemEndpoint = "https://siem.corp.example.com/api/events"

if ($siemEnabled) {
    try {
        Invoke-RestMethod -Uri $siemEndpoint -Method Post -Body $auditJson -ContentType "application/json" -TimeoutSec 5
    } catch {
        # Log SIEM forwarding failure but don't block operation
        Write-Warning "Failed to forward audit log to SIEM: $_"
    }
}

# Always allow (PostToolUse hook for logging only)
exit 0

```

### 4.6 Sensitive Files Database

sensitive-files.json:

```json
{
  "extensions": [
    "*.env",
    "*.env.*",
    "*.key",
    "*.pem",
    "*.pfx",
    "*.p12",
    "*.p7b",
    "*.p7s",
    "*.der",
    "*.crt",
    "*.cer",
    "*.jks",
    "*.keystore",
    "*.pkcs12",
    "*.credentials",
    "*.secrets",
    "*.ppk",
    "*.asc",
    "*.gpg",
    "*.kdbx",
    "*.wallet",
    "*.dat"
  ],

  "filenames": [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.staging",
    ".env.test",
    "credentials.json",
    "secrets.json",
    "secrets.yaml",
    "secrets.yml",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "known_hosts",
    "authorized_keys",
    ".pgpass",
    ".my.cnf",
    "web.config",
    "appsettings.Production.json",
    "appsettings.Secrets.json",
    "ServiceConfiguration.Cloud.cscfg",
    "shadow",
    "passwd",
    "master.key",
    "encryption.key",
    "private.key",
    "privatekey.pem"
  ],

  "paths": [
    "**/.ssh/*",
    "**/.aws/*",
    "**/.azure/*",
    "**/.gcp/*",
    "**/.config/gcloud/*",
    "**/credentials/*",
    "**/secrets/*",
    "**/.gnupg/*",
    "**/.docker/config.json",
    "**/AppData/Roaming/Microsoft/Crypto/*",
    "**/AppData/Local/Microsoft/Credentials/*",
    "C:/Users/*/AppData/Roaming/Microsoft/Protect/*",
    "C:/ProgramData/Microsoft/Crypto/*",
    "**/.kube/config",
    "**/terraform.tfstate",
    "**/terraform.tfvars",
    "**/*.tfvars.json"
  ],

  "content_patterns": [
    {
      "name": "AWS Access Key",
      "regex": "AKIA[0-9A-Z]{16}",
      "description": "AWS access key pattern"
    },
    {
      "name": "Private Key Header",
      "regex": "-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----",
      "description": "Private key file header"
    },
    {
      "name": "Generic API Key",
      "regex": "api[_-]?key['\"]?\\s*[:=]\\s*['\"]?[a-zA-Z0-9]{32,}",
      "description": "Generic API key assignment"
    }
  ]
}

```

### 4.7 Hook Configuration in Managed Settings

Integration with managed-settings.json:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-edit.ps1",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Bash:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-bash.ps1",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Read:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-read.ps1",
            "timeout": 5000
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\audit-log.ps1",
            "timeout": 5000
          }
        ]
      }
    ],

    "SessionStart": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\session-start.ps1"
          }
        ]
      }
    ],

    "SessionEnd": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\session-end.ps1"
          }
        ]
      }
    ]
  }
}

```

### 4.8 Testing Hooks

test-hooks.ps1:

```powershell
<#
.SYNOPSIS
    Test suite for Claude Code security hooks
#>

Write-Host "Testing Claude Code Security Hooks..." -ForegroundColor Cyan

# Test 1: Sensitive file edit should be blocked
Write-Host "`n[TEST 1] Attempting to edit .env file (should BLOCK)..." -ForegroundColor Yellow
$env:CLAUDE_HOOK_INPUT = @{
    tool = "Edit"
    parameters = @{
        file_path = "C:\projects\myapp\.env"
    }
} | ConvertTo-Json -Compress

$result = powershell -File "C:\ProgramData\ClaudeCode\hooks\validate-edit.ps1"
if ($LASTEXITCODE -eq 2) {
    Write-Host "✓ PASS: .env edit blocked as expected" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: .env edit was not blocked (exit code: $LASTEXITCODE)" -ForegroundColor Red
}

# Test 2: Normal file edit should be allowed
Write-Host "`n[TEST 2] Attempting to edit regular file (should ALLOW)..." -ForegroundColor Yellow
$env:CLAUDE_HOOK_INPUT = @{
    tool = "Edit"
    parameters = @{
        file_path = "C:\projects\myapp\src\index.js"
    }
} | ConvertTo-Json -Compress

$result = powershell -File "C:\ProgramData\ClaudeCode\hooks\validate-edit.ps1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ PASS: Regular file edit allowed" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Regular file edit was blocked (exit code: $LASTEXITCODE)" -ForegroundColor Red
}

# Test 3: Dangerous bash command should be blocked
Write-Host "`n[TEST 3] Attempting dangerous bash command (should BLOCK)..." -ForegroundColor Yellow
$env:CLAUDE_HOOK_INPUT = @{
    tool = "Bash"
    parameters = @{
        command = "rm -rf /important/data"
    }
} | ConvertTo-Json -Compress

$result = powershell -File "C:\ProgramData\ClaudeCode\hooks\validate-bash.ps1"
if ($LASTEXITCODE -eq 2) {
    Write-Host "✓ PASS: Dangerous command blocked" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Dangerous command was not blocked" -ForegroundColor Red
}

# Test 4: Audit logging should work
Write-Host "`n[TEST 4] Testing audit logging..." -ForegroundColor Yellow
$auditLog = "C:\ProgramData\ClaudeCode\logs\audit.jsonl"
$beforeCount = if (Test-Path $auditLog) { (Get-Content $auditLog).Count } else { 0 }

$env:CLAUDE_HOOK_INPUT = @{
    tool = "Read"
    parameters = @{
        file_path = "C:\projects\test.txt"
    }
    result = @{
        success = $true
    }
} | ConvertTo-Json -Compress

powershell -File "C:\ProgramData\ClaudeCode\hooks\audit-log.ps1"

$afterCount = if (Test-Path $auditLog) { (Get-Content $auditLog).Count } else { 0 }
if ($afterCount -gt $beforeCount) {
    Write-Host "✓ PASS: Audit log entry created" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Audit log entry not created" -ForegroundColor Red
}

Write-Host "`nHook testing complete!" -ForegroundColor Cyan

```

---

## 5. Sensitive File Protection Patterns

### 5.1 Comprehensive File Pattern Database

Categories of Sensitive Files:

#### 5.1.1 Environment and Configuration Files

```
{
  "environment_files": [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.staging",
    ".env.test",
    ".env.*.local",
    "env",
    "env.sh",
    ".envrc",
    ".env.example"  // Even examples may contain patterns
  ]
}

```

#### 5.1.2 Cryptographic Keys and Certificates

```json
{
  "crypto_files": {
    "private_keys": [
      "*.key",
      "*.pem",
      "privatekey.pem",
      "private.pem",
      "private-key.pem",
      "*.private.key",
      "id_rsa",
      "id_dsa",
      "id_ecdsa",
      "id_ed25519"
    ],
    "certificates": [
      "*.pfx",
      "*.p12",
      "*.p7b",
      "*.p7s",
      "*.der",
      "*.crt",
      "*.cer",
      "*.cert",
      "*.cacert"
    ],
    "keystores": [
      "*.jks",
      "*.keystore",
      "*.pkcs12",
      "keystore.jks",
      "truststore.jks",
      "*.kdb",
      "*.sth"
    ],
    "pgp_gpg": [
      "*.asc",
      "*.gpg",
      "*.pgp",
      "pubring.gpg",
      "secring.gpg",
      "trustdb.gpg"
    ]
  }
}

```

#### 5.1.3 Cloud Provider Credentials

```
{
  "cloud_credentials": {
    "aws": [
      ".aws/credentials",
      ".aws/config",
      "aws_access_key_id",
      "credentials.csv",
      "*_accessKeys.csv",
      "*.aws_credentials"
    ],
    "azure": [
      ".azure/credentials",
      "azureProfile.json",
      "*.publishsettings",
      "*.azurePubxml",
      "ServiceConfiguration.*.cscfg"
    ],
    "gcp": [
      ".config/gcloud/*",
      "*-service-account.json",
      "*-credentials.json",
      "*.json" // If in .gcp or credentials directories
    ],
    "general": [
      "credentials.json",
      "credentials.yml",
      "credentials.yaml",
      "*.credentials",
      "secrets.json",
      "secrets.yml",
      "secrets.yaml",
      "*.secrets"
    ]
  }
}

```

#### 5.1.4 SSH and Remote Access

```
{
  "ssh_remote": [
    ".ssh/id_rsa",
    ".ssh/id_dsa",
    ".ssh/id_ecdsa",
    ".ssh/id_ed25519",
    ".ssh/identity",
    ".ssh/config",
    ".ssh/known_hosts",
    ".ssh/authorized_keys",
    "*.ppk",       // PuTTY private key
    "*.pem",       // SSH private key in PEM format
    ".putty/sessions/*"
  ]
}

```

#### 5.1.5 Database Credentials

```
{
  "database": [
    ".my.cnf",
    ".pgpass",
    "*.sql" // If contains passwords
    "database.yml",
    "database.json",
    "connection.config",
    "connectionStrings.config",
    "*.mdf",       // SQL Server database files
    "*.ldf",       // SQL Server log files
    "*.sqlite",
    "*.sqlite3",
    "*.db"
  ]
}

```

#### 5.1.6 Application-Specific Secrets

```
{
  "app_secrets": {
    "dotnet": [
      "appsettings.Production.json",
      "appsettings.Secrets.json",
      "appsettings.*.json", // If production/sensitive
      "web.config",
      "app.config",
      "secrets.xml",
      "*.exe.config"
    ],
    "java": [
      "*.properties" // If contains passwords
      "application-prod.properties",
      "application-secret.properties",
      "hibernate.cfg.xml"
    ],
    "nodejs": [
      ".npmrc" // If contains auth tokens
      ".yarnrc.yml",
      "package-lock.json", // Only if contains private registry credentials
      "npm-shrinkwrap.json"
    ],
    "python": [
      ".pypirc",
      "*.cfg" // If contains credentials
      "settings_local.py",
      "secrets.py"
    ],
    "ruby": [
      "database.yml",
      "secrets.yml",
      ".bundle/config" // If contains credentials
    ],
    "docker": [
      ".docker/config.json",
      "docker-compose.override.yml", // May contain production secrets
      "*.dockercfg"
    ],
    "kubernetes": [
      ".kube/config",
      "kubeconfig",
      "*.kubeconfig",
      "*-kubeconfig.yaml"
    ],
    "terraform": [
      "terraform.tfstate",
      "terraform.tfstate.backup",
      "terraform.tfvars",
      "*.tfvars",
      "*.tfvars.json",
      "*.auto.tfvars"
    ]
  }
}

```

#### 5.1.7 Windows-Specific Sensitive Files

```
{
  "windows_sensitive": [
    "ntuser.dat",
    "SAM",
    "SYSTEM",
    "SECURITY",
    "SOFTWARE",
    "*.reg", // Registry exports may contain credentials
    "Unattend.xml",
    "Autounattend.xml",
    "sysprep.inf",
    "sysprep.xml",
    "AppData/Roaming/Microsoft/Crypto/*",
    "AppData/Local/Microsoft/Credentials/*",
    "AppData/Roaming/Microsoft/Protect/*",
    "ProgramData/Microsoft/Crypto/RSA/MachineKeys/*",
    "*.rdp" // Remote Desktop settings may contain saved credentials
  ]
}

```

#### 5.1.8 Cryptocurrency Wallets

```
{
  "crypto_wallets": [
    "wallet.dat",
    "*.wallet",
    "*.keystore", // Ethereum keystores
    "UTC--*", // Ethereum keystore format
    "*.kdbx", // KeePass database
    "*.dat" // Generic wallet files
  ]
}

```

#### 5.1.9 Browser and Email Credentials

```
{
  "browser_email": [
    "AppData/Local/Google/Chrome/User Data/*/Login Data",
    "AppData/Local/Microsoft/Edge/User Data/*/Login Data",
    "AppData/Roaming/Mozilla/Firefox/Profiles/**/logins.json",
    "AppData/Roaming/Mozilla/Firefox/Profiles/**/key4.db",
    "AppData/Roaming/Thunderbird/Profiles/**/logins.json",
    "*.pst", // Outlook data files
    "*.ost"
  ]
}

```

### 5.2 Content-Based Detection Patterns

validate-read-content.ps1 (Advanced hook for content scanning):

```powershell
<#
.SYNOPSIS
    Content-based sensitive data detection
.DESCRIPTION
    Scans file contents for sensitive patterns like API keys, passwords
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

# Parse input
$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json
$filePath = $input.parameters.file_path

if (-not $filePath -or -not (Test-Path $filePath)) {
    exit 0
}

# Only scan text files (skip binaries)
$textExtensions = @('.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.config', '.properties', '.env', '.ini', '.conf', '.toml', '.js', '.ts', '.py', '.java', '.cs', '.rb', '.go', '.php', '.sh', '.ps1', '.bat', '.cmd')
$extension = [System.IO.Path]::GetExtension($filePath).ToLower()

if ($textExtensions -notcontains $extension) {
    # Binary file, skip content scanning
    exit 0
}

# Read file content (max 1MB for performance)
$maxSize = 1MB
$fileSize = (Get-Item $filePath).Length

if ($fileSize -gt $maxSize) {
    # File too large, skip content scanning
    exit 0
}

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue

if (-not $content) {
    exit 0
}

# Sensitive patterns (regex)
$patterns = @(
    @{
        name = "AWS Access Key"
        regex = 'AKIA[0-9A-Z]{16}'
        severity = "CRITICAL"
    },
    @{
        name = "AWS Secret Key"
        regex = '[''"][0-9a-zA-Z/+]{40}[''"]'
        severity = "CRITICAL"
    },
    @{
        name = "Private Key"
        regex = '-----BEGIN (RSA|DSA|EC|OPENSSH|ENCRYPTED|PGP) PRIVATE KEY-----'
        severity = "CRITICAL"
    },
    @{
        name = "Generic API Key"
        regex = '(?i)(api[_-]?key|apikey)[''"]?\s*[:=]\s*[''"]?[a-zA-Z0-9]{32,}[''"]?'
        severity = "HIGH"
    },
    @{
        name = "Generic Password"
        regex = '(?i)(password|passwd|pwd)[''"]?\s*[:=]\s*[''"][^''"]{8,}[''"]'
        severity = "HIGH"
    },
    @{
        name = "Database Connection String"
        regex = '(?i)(Server|Data Source|Initial Catalog|User ID|Password)=[^;]+;'
        severity = "HIGH"
    },
    @{
        name = "JWT Token"
        regex = 'eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'
        severity = "MEDIUM"
    },
    @{
        name = "GitHub Token"
        regex = 'ghp_[a-zA-Z0-9]{36}'
        severity = "CRITICAL"
    },
    @{
        name = "Slack Token"
        regex = 'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}'
        severity = "HIGH"
    },
    @{
        name = "Stripe API Key"
        regex = 'sk_live_[0-9a-zA-Z]{24,}'
        severity = "CRITICAL"
    }
)

# Scan for patterns
$detectedPatterns = @()

foreach ($pattern in $patterns) {
    if ($content -match $pattern.regex) {
        $detectedPatterns += $pattern
    }
}

if ($detectedPatterns.Count -gt 0) {
    # Sort by severity
    $criticalPatterns = $detectedPatterns | Where-Object { $_.severity -eq "CRITICAL" }

    if ($criticalPatterns.Count -gt 0) {
        # CRITICAL severity = BLOCK
        $patternNames = ($criticalPatterns | ForEach-Object { $_.name }) -join ", "
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: File contains sensitive data patterns: $patternNames"
            suppressOutput = $false
            systemMessage = "This file contains potentially sensitive credentials or keys. Access denied by security policy."
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    } else {
        # HIGH/MEDIUM severity = WARN but allow
        $patternNames = ($detectedPatterns | ForEach-Object { $_.name }) -join ", "
        Write-Warning "File contains potentially sensitive patterns: $patternNames"

        # Log to audit trail
        $auditEntry = @{
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            user = $env:USERNAME
            file = $filePath
            detected_patterns = $patternNames
            action = "ALLOWED_WITH_WARNING"
        } | ConvertTo-Json -Compress

        Add-Content -Path "C:\ProgramData\ClaudeCode\logs\content-scan.jsonl" -Value $auditEntry

        # Allow but warn
        exit 0
    }
}

# No sensitive patterns detected
exit 0

```

### 5.3 Directory-Based Protection

blocked-directories.json:

```json
{
  "windows_system": [
    "C:\\Windows",
    "C:\\Windows\\System32",
    "C:\\Windows\\SysWOW64",
    "C:\\Windows\\WinSxS",
    "C:\\Windows\\Boot",
    "C:\\Windows\\Fonts",
    "C:\\Windows\\inf",
    "C:\\Windows\\PolicyDefinitions",
    "C:\\Windows\\Registration",
    "C:\\Windows\\rescache",
    "C:\\Windows\\Resources",
    "C:\\Windows\\schemas",
    "C:\\Windows\\security",
    "C:\\Windows\\servicing",
    "C:\\Windows\\System",
    "C:\\Windows\\SystemApps",
    "C:\\Windows\\SystemResources",
    "C:\\Windows\\WaaS"
  ],

  "program_files": [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu",
    "C:\\ProgramData\\Microsoft\\Windows\\AppRepository",
    "C:\\ProgramData\\WindowsHolographicDevices"
  ],

  "security_sensitive": [
    "C:\\ProgramData\\Microsoft\\Crypto",
    "C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Crypto",
    "C:\\Users\\*\\AppData\\Local\\Microsoft\\Credentials",
    "C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Protect",
    "C:\\Users\\*\\AppData\\Roaming\\Microsoft\\SystemCertificates",
    "C:\\Windows\\System32\\config",
    "C:\\Windows\\System32\\config\\SAM",
    "C:\\Windows\\System32\\config\\SECURITY",
    "C:\\Windows\\System32\\config\\SYSTEM",
    "C:\\Windows\\System32\\config\\SOFTWARE"
  ],

  "user_sensitive": [
    "C:\\Users\\*\\.ssh",
    "C:\\Users\\*\\.aws",
    "C:\\Users\\*\\.azure",
    "C:\\Users\\*\\.gcp",
    "C:\\Users\\*\\.gnupg",
    "C:\\Users\\*\\.docker",
    "C:\\Users\\*\\.kube",
    "C:\\Users\\*\\AppData\\Local\\Google\\Chrome\\User Data\\*\\Login Data",
    "C:\\Users\\*\\AppData\\Local\\Microsoft\\Edge\\User Data\\*\\Login Data",
    "C:\\Users\\*\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles"
  ],

  "claude_installation": [
    "C:\\ProgramData\\ClaudeCode",
    "C:\\ProgramData\\ClaudeCode\\managed-policies",
    "C:\\ProgramData\\ClaudeCode\\hooks",
    "C:\\ProgramData\\ClaudeCode\\npm-global"
  ]
}

```

### 5.4 Integration into Managed Settings

Complete permission deny rules:

```
{
  "permissions": {
    "deny": [
      // Environment files
      {"tool": "Edit", "matcher": "**/.env*"},
      {"tool": "Edit", "matcher": "**/env"},
      {"tool": "Edit", "matcher": "**/env.sh"},
      {"tool": "Edit", "matcher": "**/.envrc"},
      {"tool": "Read", "matcher": "**/.env.production"},
      {"tool": "Read", "matcher": "**/.env.staging"},

      // Cryptographic keys
      {"tool": "Edit", "matcher": "**/*.key"},
      {"tool": "Edit", "matcher": "**/*.pem"},
      {"tool": "Edit", "matcher": "**/*.pfx"},
      {"tool": "Edit", "matcher": "**/*.p12"},
      {"tool": "Edit", "matcher": "**/*.jks"},
      {"tool": "Edit", "matcher": "**/*.keystore"},
      {"tool": "Read", "matcher": "**/id_rsa"},
      {"tool": "Read", "matcher": "**/id_dsa"},
      {"tool": "Read", "matcher": "**/id_ecdsa"},
      {"tool": "Read", "matcher": "**/id_ed25519"},

      // Credentials
      {"tool": "Edit", "matcher": "**/credentials.json"},
      {"tool": "Edit", "matcher": "**/credentials.yml"},
      {"tool": "Edit", "matcher": "**/secrets.json"},
      {"tool": "Edit", "matcher": "**/secrets.yml"},
      {"tool": "Read", "matcher": "**/.aws/credentials"},
      {"tool": "Read", "matcher": "**/.azure/credentials"},
      {"tool": "Read", "matcher": "**/*-service-account.json"},

      // Windows system directories
      {"tool": "Edit", "matcher": "C:/Windows/**"},
      {"tool": "Edit", "matcher": "C:/Program Files/**"},
      {"tool": "Edit", "matcher": "C:/Program Files (x86)/**"},
      {"tool": "Read", "matcher": "C:/Windows/System32/config/**"},
      {"tool": "Read", "matcher": "**/AppData/Roaming/Microsoft/Crypto/**"},
      {"tool": "Read", "matcher": "**/AppData/Local/Microsoft/Credentials/**"},

      // Dangerous bash operations
      {"tool": "Bash", "matcher": "**/rm -rf*"},
      {"tool": "Bash", "matcher": "**/del /f*"},
      {"tool": "Bash", "matcher": "**/format*"},
      {"tool": "Bash", "matcher": "**/reg delete*"},
      {"tool": "Bash", "matcher": "**/net user*"},

      // Protected installation
      {"tool": "Edit", "matcher": "C:/ProgramData/ClaudeCode/**"}
    ]
  }
}

```

---

## 6. Windows System Directory Protection

### 6.1 Critical Windows Directories

Tier 1: Absolute No Access (BLOCK ALL OPERATIONS)

| Directory | Purpose | Risk Level | Protection |
| --- | --- | --- | --- |
| `C:\Windows\System32` | Core system files (64-bit) | CRITICAL | BLOCK Read/Write |
| `C:\Windows\SysWOW64` | Core system files (32-bit) | CRITICAL | BLOCK Read/Write |
| `C:\Windows\System32\config` | Registry hives (SAM, SYSTEM) | CRITICAL | BLOCK Read/Write |
| `C:\Program Files` | Installed applications | HIGH | BLOCK Write |
| `C:\Program Files (x86)` | 32-bit applications | HIGH | BLOCK Write |
| `C:\ProgramData\Microsoft\Crypto` | Encryption keys | CRITICAL | BLOCK Read/Write |

Tier 2: Read-Only (Allow Read, Block Write)

| Directory | Purpose | Risk Level | Protection |
| --- | --- | --- | --- |
| `C:\Windows` | General Windows files | HIGH | Allow Read, Block Write |
| `C:\Windows\Fonts` | System fonts | MEDIUM | Allow Read, Block Write |
| `C:\Windows\inf` | Driver information files | MEDIUM | Allow Read, Block Write |

Tier 3: Credential Stores (BLOCK ALL)

| Directory | Purpose | Risk Level | Protection |
| --- | --- | --- | --- |
| `%APPDATA%\Microsoft\Crypto` | User crypto keys | CRITICAL | BLOCK Read/Write |
| `%LOCALAPPDATA%\Microsoft\Credentials` | Stored credentials | CRITICAL | BLOCK Read/Write |
| `%APPDATA%\Microsoft\Protect` | DPAPI master keys | CRITICAL | BLOCK Read/Write |
| `%APPDATA%\Microsoft\SystemCertificates` | User certificates | HIGH | BLOCK Read/Write |

### 6.2 Windows System Protection Hook

validate-windows-paths.ps1:

```powershell
<#
.SYNOPSIS
    Validates operations against Windows system directories
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

# Parse input
$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json
$tool = $input.tool
$filePath = $input.parameters.file_path -or $input.parameters.path

if (-not $filePath) {
    exit 0
}

# Normalize path
$normalizedPath = $filePath -replace '/', '\' | Resolve-Path -ErrorAction SilentlyContinue

# Critical directories (BLOCK ALL)
$criticalDirs = @(
    "$env:SystemRoot\System32\config",
    "$env:SystemRoot\System32",
    "$env:SystemRoot\SysWOW64",
    "$env:ProgramData\Microsoft\Crypto",
    "$env:APPDATA\Microsoft\Crypto",
    "$env:LOCALAPPDATA\Microsoft\Credentials",
    "$env:APPDATA\Microsoft\Protect",
    "C:\ProgramData\ClaudeCode"  # Protect our installation
)

foreach ($criticalDir in $criticalDirs) {
    if ($normalizedPath -like "$criticalDir\*") {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Access to critical Windows directory denied: $criticalDir"
            suppressOutput = $false
            systemMessage = "This directory contains critical system files or credentials. Access is prohibited by security policy."
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Write-protected directories (BLOCK Write, Allow Read)
if ($tool -eq "Edit" -or $tool -eq "Write") {
    $writeProtectedDirs = @(
        "$env:SystemRoot",
        "${env:ProgramFiles}",
        "${env:ProgramFiles(x86)}"
    )

    foreach ($protectedDir in $writeProtectedDirs) {
        if ($normalizedPath -like "$protectedDir\*") {
            $blockMessage = @{
                continue = $false
                stopReason = "SECURITY BLOCK: Write access to Windows directory denied: $protectedDir"
                suppressOutput = $false
            } | ConvertTo-Json -Compress

            Write-Output $blockMessage
            exit 2
        }
    }
}

# Allow operation
exit 0

```

### 6.3 Registry Protection

Block registry modifications via Bash hook:

```
# In validate-bash.ps1, add registry protection

# Dangerous registry operations
$registryPatterns = @(
    'reg\s+(add|delete|import)',
    'regedit\s+',
    'New-ItemProperty.*HKLM',
    'Set-ItemProperty.*HKLM',
    'Remove-ItemProperty.*HKLM',
    'HKEY_LOCAL_MACHINE',
    'HKLM:'
)

foreach ($pattern in $registryPatterns) {
    if ($command -match $pattern) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Registry modification attempts are prohibited"
            suppressOutput = $false
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

```

### 6.4 Windows Service Protection

Block service manipulation:

```
# Service manipulation patterns
$servicePatterns = @(
    'sc\s+(create|delete|config|stop|start)',
    'New-Service',
    'Set-Service',
    'Stop-Service',
    'Start-Service',
    'Remove-Service',
    'net\s+stop',
    'net\s+start'
)

foreach ($pattern in $servicePatterns) {
    if ($command -match $pattern) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Windows service manipulation is prohibited"
            suppressOutput = $false
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

```

### 6.5 Complete Windows Protection Configuration

managed-settings.json (Windows system protection section):

```
{
  "permissions": {
    "deny": [
      // Windows System32
      {"tool": "Read", "matcher": "C:/Windows/System32/config/**"},
      {"tool": "Read", "matcher": "C:/Windows/System32/SAM"},
      {"tool": "Read", "matcher": "C:/Windows/System32/SECURITY"},
      {"tool": "Read", "matcher": "C:/Windows/System32/SYSTEM"},
      {"tool": "Edit", "matcher": "C:/Windows/System32/**"},
      {"tool": "Write", "matcher": "C:/Windows/System32/**"},

      // Windows SysWOW64
      {"tool": "Edit", "matcher": "C:/Windows/SysWOW64/**"},
      {"tool": "Write", "matcher": "C:/Windows/SysWOW64/**"},

      // Windows root
      {"tool": "Edit", "matcher": "C:/Windows/**"},
      {"tool": "Write", "matcher": "C:/Windows/**"},

      // Program Files
      {"tool": "Edit", "matcher": "C:/Program Files/**"},
      {"tool": "Write", "matcher": "C:/Program Files/**"},
      {"tool": "Edit", "matcher": "C:/Program Files (x86)/**"},
      {"tool": "Write", "matcher": "C:/Program Files (x86)/**"},

      // Crypto and credentials
      {"tool": "Read", "matcher": "**/AppData/Roaming/Microsoft/Crypto/**"},
      {"tool": "Read", "matcher": "**/AppData/Local/Microsoft/Credentials/**"},
      {"tool": "Read", "matcher": "**/AppData/Roaming/Microsoft/Protect/**"},
      {"tool": "Read", "matcher": "**/AppData/Roaming/Microsoft/SystemCertificates/**"},
      {"tool": "Read", "matcher": "C:/ProgramData/Microsoft/Crypto/**"},

      // System operations via Bash
      {"tool": "Bash", "matcher": "**/reg add*"},
      {"tool": "Bash", "matcher": "**/reg delete*"},
      {"tool": "Bash", "matcher": "**/regedit*"},
      {"tool": "Bash", "matcher": "**/sc create*"},
      {"tool": "Bash", "matcher": "**/sc delete*"},
      {"tool": "Bash", "matcher": "**/net user*"},
      {"tool": "Bash", "matcher": "**/net localgroup*"},

      // Protect Claude installation
      {"tool": "Edit", "matcher": "C:/ProgramData/ClaudeCode/**"},
      {"tool": "Write", "matcher": "C:/ProgramData/ClaudeCode/**"}
    ]
  },

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-windows-paths.ps1"
          }
        ]
      },
      {
        "matcher": "Read:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-windows-paths.ps1"
          }
        ]
      }
    ]
  }
}

```

---

## 7. Permission Models & Deny Rules

### 7.1 Understanding Permission Modes

Claude Code supports multiple permission modes for controlling tool access:

| Mode | Behavior | Use Case | Security Level |
| --- | --- | --- | --- |
| `plan` | Analysis only, no modifications | Initial codebase exploration | HIGHEST |
| `default` | Prompt for first tool use | Standard development | HIGH |
| `ask` | Confirm each tool use | Sensitive operations | HIGH |
| `acceptEdits` | Auto-accept file edits | Trusted projects | MEDIUM |
| `bypassPermissions` | Skip all prompts | NEVER use in enterprise | NONE |

Enterprise Recommendation: Use`plan` mode by default in managed policies.

### 7.2 Permission Rule Types

1. Deny Rules (Highest Priority - Always Block)

```json
{
  "deny": [
    {"tool": "Edit", "matcher": "**/.env*"},
    {"tool": "Bash", "matcher": "**/rm -rf*"}
  ]
}

```

2. Ask Rules (Require Confirmation)

```json
{
  "ask": [
    {"tool": "Edit", "matcher": "**/*.json"},
    {"tool": "Bash", "matcher": "**"}
  ]
}

```

3. Allow Rules (Permit Without Prompt)

```json
{
  "allow": [
    {"tool": "Read", "matcher": "**/*.md"},
    {"tool": "Read", "matcher": "**/*.js"}
  ]
}

```

### 7.3 Enterprise Permission Matrix

Recommended Enterprise Configuration:

```
{
  "permissions": {
    "defaultMode": "plan",

    "deny": [
      // === CRITICAL: Credentials & Keys ===
      {"tool": "Edit", "matcher": "**/.env*"},
      {"tool": "Edit", "matcher": "**/*.key"},
      {"tool": "Edit", "matcher": "**/*.pem"},
      {"tool": "Edit", "matcher": "**/*.pfx"},
      {"tool": "Edit", "matcher": "**/*.p12"},
      {"tool": "Edit", "matcher": "**/credentials*"},
      {"tool": "Edit", "matcher": "**/secrets*"},
      {"tool": "Read", "matcher": "**/id_rsa"},
      {"tool": "Read", "matcher": "**/id_dsa"},
      {"tool": "Read", "matcher": "**/.aws/credentials"},
      {"tool": "Read", "matcher": "**/.ssh/id_*"},

      // === CRITICAL: Windows System ===
      {"tool": "Edit", "matcher": "C:/Windows/**"},
      {"tool": "Edit", "matcher": "C:/Program Files/**"},
      {"tool": "Edit", "matcher": "C:/Program Files (x86)/**"},
      {"tool": "Read", "matcher": "C:/Windows/System32/config/**"},
      {"tool": "Read", "matcher": "**/AppData/**/Crypto/**"},
      {"tool": "Read", "matcher": "**/AppData/**/Credentials/**"},

      // === CRITICAL: Dangerous Commands ===
      {"tool": "Bash", "matcher": "**/rm -rf*"},
      {"tool": "Bash", "matcher": "**/del /f*"},
      {"tool": "Bash", "matcher": "**/format*"},
      {"tool": "Bash", "matcher": "**/diskpart*"},
      {"tool": "Bash", "matcher": "**/reg delete*"},
      {"tool": "Bash", "matcher": "**/net user*"},
      {"tool": "Bash", "matcher": "**/sc delete*"},

      // === HIGH: Build & Dependency Files ===
      {"tool": "Edit", "matcher": "**/package-lock.json"},
      {"tool": "Edit", "matcher": "**/yarn.lock"},
      {"tool": "Edit", "matcher": "**/Gemfile.lock"},
      {"tool": "Edit", "matcher": "**/Pipfile.lock"},
      {"tool": "Edit", "matcher": "**/composer.lock"},
      {"tool": "Edit", "matcher": "**/.git/**"},

      // === HIGH: Infrastructure as Code ===
      {"tool": "Edit", "matcher": "**/terraform.tfstate"},
      {"tool": "Edit", "matcher": "**/terraform.tfvars"},
      {"tool": "Edit", "matcher": "**/*.tfvars"},

      // === MEDIUM: Configuration Files (Require Review) ===
      {"tool": "Edit", "matcher": "**/web.config"},
      {"tool": "Edit", "matcher": "**/app.config"},
      {"tool": "Edit", "matcher": "**/appsettings.*.json"},

      // === Protect Claude Installation ===
      {"tool": "Edit", "matcher": "C:/ProgramData/ClaudeCode/**"},
      {"tool": "Write", "matcher": "C:/ProgramData/ClaudeCode/**"}
    ],

    "ask": [
      // Configuration files
      {"tool": "Edit", "matcher": "**/*.json"},
      {"tool": "Edit", "matcher": "**/*.yaml"},
      {"tool": "Edit", "matcher": "**/*.yml"},
      {"tool": "Edit", "matcher": "**/*.toml"},
      {"tool": "Edit", "matcher": "**/*.ini"},
      {"tool": "Edit", "matcher": "**/*.conf"},

      // All bash commands require confirmation
      {"tool": "Bash", "matcher": "**"},

      // Critical code files
      {"tool": "Edit", "matcher": "**/Dockerfile"},
      {"tool": "Edit", "matcher": "**/*.Dockerfile"},
      {"tool": "Edit", "matcher": "**/docker-compose*.yml"},

      // CI/CD files
      {"tool": "Edit", "matcher": "**/.github/workflows/**"},
      {"tool": "Edit", "matcher": "**/.gitlab-ci.yml"},
      {"tool": "Edit", "matcher": "**/Jenkinsfile"},
      {"tool": "Edit", "matcher": "**/.circleci/**"}
    ],

    "allow": [
      // Documentation
      {"tool": "Read", "matcher": "**/*.md"},
      {"tool": "Read", "matcher": "**/*.txt"},
      {"tool": "Read", "matcher": "**/README*"},
      {"tool": "Read", "matcher": "**/CHANGELOG*"},
      {"tool": "Read", "matcher": "**/LICENSE*"},

      // Source code (read-only)
      {"tool": "Read", "matcher": "**/*.js"},
      {"tool": "Read", "matcher": "**/*.ts"},
      {"tool": "Read", "matcher": "**/*.jsx"},
      {"tool": "Read", "matcher": "**/*.tsx"},
      {"tool": "Read", "matcher": "**/*.py"},
      {"tool": "Read", "matcher": "**/*.java"},
      {"tool": "Read", "matcher": "**/*.cs"},
      {"tool": "Read", "matcher": "**/*.go"},
      {"tool": "Read", "matcher": "**/*.rb"},
      {"tool": "Read", "matcher": "**/*.php"},
      {"tool": "Read", "matcher": "**/*.c"},
      {"tool": "Read", "matcher": "**/*.cpp"},
      {"tool": "Read", "matcher": "**/*.h"},
      {"tool": "Read", "matcher": "**/*.rs"},

      // Markup & styles
      {"tool": "Read", "matcher": "**/*.html"},
      {"tool": "Read", "matcher": "**/*.css"},
      {"tool": "Read", "matcher": "**/*.scss"},
      {"tool": "Read", "matcher": "**/*.less"},
      {"tool": "Read", "matcher": "**/*.xml"},

      // Non-sensitive edits (with user in control)
      {"tool": "Edit", "matcher": "**/*.md"},
      {"tool": "Edit", "matcher": "**/docs/**/*.md"},
      {"tool": "Edit", "matcher": "**/README.md"}
    ],

    "additionalDirectories": []
  }
}

```

### 7.4 Matcher Pattern Syntax

Claude Code uses gitignore-style glob patterns:

| Pattern | Matches | Example |
| --- | --- | --- |
| `*` | Any characters except`/` | `*.js` matches`file.js` |
| `**` | Any characters including`/` | `**/*.env` matches`.env` at any depth |
| `?` | Single character | `file?.js` matches`file1.js`,`fileA.js` |
| `[abc]` | Character class | `file[123].js` matches`file1.js`,`file2.js` |
| `{a,b}` | Alternatives | `*.{js,ts}` matches`file.js` or`file.ts` |
| `!pattern` | Negation | `!**/test/**` excludes test directories |

Path Normalization:

- Forward slashes`/` are converted to backslashes`\` on Windows
- Paths are case-insensitive on Windows
- Use`**` to match across directory boundaries

### 7.5 Tool-Specific Deny Strategies

#### 7.5.1 Edit Tool Restrictions

```
{
  "deny": [
    // Prevent editing of files with sensitive extensions
    {"tool": "Edit", "matcher": "**/*.{env,key,pem,pfx,p12,jks,credentials}"},

    // Prevent editing of specific filenames
    {"tool": "Edit", "matcher": "**/credentials.json"},
    {"tool": "Edit", "matcher": "**/secrets.{json,yaml,yml}"},

    // Prevent editing in sensitive directories
    {"tool": "Edit", "matcher": "**/.ssh/**"},
    {"tool": "Edit", "matcher": "**/.aws/**"},

    // Prevent editing of lock files
    {"tool": "Edit", "matcher": "**/*-lock.{json,yaml}"},
    {"tool": "Edit", "matcher": "**/package-lock.json"},

    // Prevent editing of git internals
    {"tool": "Edit", "matcher": "**/.git/**"}
  ]
}

```

#### 7.5.2 Bash Tool Restrictions

```
{
  "deny": [
    // Destructive file operations
    {"tool": "Bash", "matcher": "**/rm -rf /**"},
    {"tool": "Bash", "matcher": "**/del /f /**"},
    {"tool": "Bash", "matcher": "**/rmdir /s /**"},

    // System modifications
    {"tool": "Bash", "matcher": "**/reg add**"},
    {"tool": "Bash", "matcher": "**/reg delete**"},
    {"tool": "Bash", "matcher": "**/sc delete**"},
    {"tool": "Bash", "matcher": "**/net user**"},

    // Network exfiltration
    {"tool": "Bash", "matcher": "**/curl** -d **"},
    {"tool": "Bash", "matcher": "**/wget** --post**"},
    {"tool": "Bash", "matcher": "**/nc -l**"},

    // Process injection
    {"tool": "Bash", "matcher": "**/powershell** -enc**"},
    {"tool": "Bash", "matcher": "**/cmd /c**"}
  ]
}

```

#### 7.5.3 Read Tool Restrictions

```
{
  "deny": [
    // Credential files
    {"tool": "Read", "matcher": "**/.env.production"},
    {"tool": "Read", "matcher": "**/id_rsa"},
    {"tool": "Read", "matcher": "**/.aws/credentials"},

    // Windows credential stores
    {"tool": "Read", "matcher": "**/AppData/Roaming/Microsoft/Crypto/**"},
    {"tool": "Read", "matcher": "**/AppData/Local/Microsoft/Credentials/**"},

    // System files
    {"tool": "Read", "matcher": "C:/Windows/System32/config/SAM"},
    {"tool": "Read", "matcher": "C:/Windows/System32/config/SECURITY"}
  ]
}

```

### 7.6 Dynamic Permission Evaluation

Advanced: Context-Aware Permissions via Hooks

```powershell
# validate-permission.ps1
# Dynamic permission evaluation based on file content, user role, time of day, etc.

param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json

# Example: Block operations during maintenance window
$maintenanceHours = 2..5  # 2 AM - 5 AM
$currentHour = (Get-Date).Hour

if ($currentHour -in $maintenanceHours) {
    $blockMessage = @{
        continue = $false
        stopReason = "SECURITY BLOCK: Operations not permitted during maintenance window (2 AM - 5 AM)"
    } | ConvertTo-Json -Compress

    Write-Output $blockMessage
    exit 2
}

# Example: Require additional authentication for production files
if ($input.parameters.file_path -like "*production*") {
    # Check if user has production access (could query AD, database, etc.)
    $userHasProductionAccess = Test-UserAccess -User $env:USERNAME -Resource "Production"

    if (-not $userHasProductionAccess) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: User does not have production file access"
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Example: Rate limiting - block if too many operations in short time
$rateLimitFile = "C:\ProgramData\ClaudeCode\logs\rate-limit.json"
$maxOpsPerMinute = 50

if (Test-Path $rateLimitFile) {
    $rateData = Get-Content $rateLimitFile -Raw | ConvertFrom-Json
    $recentOps = $rateData.operations | Where-Object {
        (Get-Date $_.timestamp) -gt (Get-Date).AddMinutes(-1)
    }

    if ($recentOps.Count -ge $maxOpsPerMinute) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: Rate limit exceeded ($maxOpsPerMinute operations/minute)"
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Allow operation
exit 0

```

### 7.7 Permission Testing & Validation

Test script for permission configuration:

```powershell
<#
.SYNOPSIS
    Validates permission configuration
#>

function Test-ClaudePermissions {
    $managedSettings = "C:\ProgramData\ClaudeCode\managed-settings.json"

    if (-not (Test-Path $managedSettings)) {
        Write-Error "Managed settings not found"
        return $false
    }

    $settings = Get-Content $managedSettings -Raw | ConvertFrom-Json
    $issues = @()

    # Test 1: Verify sensitive file protections
    $requiredDenies = @(
        "**/.env*",
        "**/*.key",
        "**/*.pem",
        "**/credentials*"
    )

    foreach ($required in $requiredDenies) {
        $found = $settings.permissions.deny | Where-Object {
            $_.matcher -eq $required -and $_.tool -eq "Edit"
        }

        if (-not $found) {
            $issues += "Missing deny rule for: $required"
        }
    }

    # Test 2: Verify dangerous bash commands blocked
    $dangerousBash = @(
        "**/rm -rf*",
        "**/del /f*",
        "**/format*"
    )

    foreach ($dangerous in $dangerousBash) {
        $found = $settings.permissions.deny | Where-Object {
            $_.matcher -eq $dangerous -and $_.tool -eq "Bash"
        }

        if (-not $found) {
            $issues += "Missing bash deny rule for: $dangerous"
        }
    }

    # Test 3: Verify Windows system directories protected
    $systemDirs = @(
        "C:/Windows/**",
        "C:/Program Files/**"
    )

    foreach ($dir in $systemDirs) {
        $found = $settings.permissions.deny | Where-Object {
            $_.matcher -eq $dir -and $_.tool -eq "Edit"
        }

        if (-not $found) {
            $issues += "Missing system directory protection for: $dir"
        }
    }

    # Test 4: Verify default mode is secure
    if ($settings.permissions.defaultMode -notin @("plan", "default", "ask")) {
        $issues += "Insecure default mode: $($settings.permissions.defaultMode)"
    }

    # Report results
    if ($issues.Count -eq 0) {
        Write-Host "✓ All permission checks passed" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Permission configuration issues:" -ForegroundColor Red
        $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        return $false
    }
}

Test-ClaudePermissions

```

---

## 8. Network Security Controls

### 8.1 Network Access Requirements

Claude Code requires connectivity to specific endpoints:

| Endpoint | Purpose | Required | Alternative |
| --- | --- | --- | --- |
| `api.anthropic.com` | Claude API | YES | AWS Bedrock, GCP Vertex AI |
| `claude.ai` | Authentication, updates | YES | N/A |
| `statsig.anthropic.com` | Telemetry (optional) | NO | Can disable |
| `sentry.io` | Error reporting (optional) | NO | Can disable |

### 8.2 Corporate Proxy Configuration

Managed Settings with Proxy:

```json
{
  "envVars": {
    "HTTP_PROXY": "http://proxy.corp.example.com:8080",
    "HTTPS_PROXY": "https://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com,*.internal"
  }
}

```

Proxy with Authentication:

```json
{
  "envVars": {
    "HTTP_PROXY": "http://username:password@proxy.corp.example.com:8080",
    "HTTPS_PROXY": "https://username:password@proxy.corp.example.com:8080"
  }
}

```

Security Warning: Avoid hardcoding credentials in managed settings. Use Windows Credential Manager or environment variables set via Group Policy.

### 8.3 Firewall Rules for Claude Code

Windows Firewall Configuration:

```powershell
# Allow outbound HTTPS to Anthropic API
New-NetFirewallRule -DisplayName "Claude Code - Anthropic API" `
    -Direction Outbound `
    -Program "C:\ProgramData\ClaudeCode\npm-global\node_modules\@anthropic-ai\claude-code\*" `
    -RemoteAddress "api.anthropic.com" `
    -Protocol TCP `
    -RemotePort 443 `
    -Action Allow

# Allow outbound to Claude.ai
New-NetFirewallRule -DisplayName "Claude Code - Claude.ai" `
    -Direction Outbound `
    -Program "C:\ProgramData\ClaudeCode\npm-global\node_modules\@anthropic-ai\claude-code\*" `
    -RemoteAddress "claude.ai" `
    -Protocol TCP `
    -RemotePort 443 `
    -Action Allow

# Block all other outbound connections from Claude Code
New-NetFirewallRule -DisplayName "Claude Code - Block Others" `
    -Direction Outbound `
    -Program "C:\ProgramData\ClaudeCode\npm-global\node_modules\@anthropic-ai\claude-code\*" `
    -Action Block `
    -Priority 2

```

### 8.4 TLS/SSL Configuration

Custom CA Certificate (Corporate MITM Proxies):

```json
{
  "envVars": {
    "NODE_EXTRA_CA_CERTS": "C:\\ProgramData\\ClaudeCode\\certs\\corporate-ca.crt"
  }
}

```

Deploy Corporate CA Certificate:

```powershell
# Copy corporate CA cert
Copy-Item "\\fileserver\IT\certs\corporate-ca.crt" `
    -Destination "C:\ProgramData\ClaudeCode\certs\corporate-ca.crt"

# Verify certificate
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("C:\ProgramData\ClaudeCode\certs\corporate-ca.crt")
Write-Host "CA Certificate: $($cert.Subject)"
Write-Host "Valid Until: $($cert.NotAfter)"

```

### 8.5 Mutual TLS (mTLS) Authentication

For environments requiring client certificates:

```json
{
  "envVars": {
    "NODE_EXTRA_CA_CERTS": "C:\\ProgramData\\ClaudeCode\\certs\\ca.crt",
    "NODE_TLS_CLIENT_CERT": "C:\\ProgramData\\ClaudeCode\\certs\\client.crt",
    "NODE_TLS_CLIENT_KEY": "C:\\ProgramData\\ClaudeCode\\certs\\client.key"
  }
}

```

Note: Anthropic's API doesn't currently require mTLS, but this configuration supports future enterprise requirements or custom LLM gateways.

### 8.6 Disabling Non-Essential Network Traffic

Minimal Network Configuration:

```json
{
  "envVars": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true",
    "HTTP_PROXY": "http://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1"
  }
}

```

What This Disables:

- Telemetry to`statsig.anthropic.com`
- Error reporting to`sentry.io`
- Update checks (rely on managed deployment instead)
- Optional analytics

### 8.7 LLM Gateway Integration

Enterprise Pattern: Route Through Internal Gateway

```
Claude Code → Corporate LLM Gateway → Anthropic API
                     ↓
         - Rate limiting
         - Content filtering
         - Audit logging
         - Cost tracking

```

Configure Gateway Proxy:

```json
{
  "envVars": {
    "ANTHROPIC_API_BASE_URL": "https://llm-gateway.corp.example.com/v1",
    "ANTHROPIC_API_KEY": "${GATEWAY_API_KEY}",
    "HTTP_PROXY": "http://llm-gateway.corp.example.com:8080"
  }
}

```

Benefits of LLM Gateway:

- Centralized API key management
- Cross-team cost allocation
- Content policy enforcement (PII redaction, etc.)
- Request/response logging for compliance
- Rate limiting and quota management
- Failover to alternative providers

### 8.8 URL Allowlist Hook

Network request validation hook:

```powershell
# validate-network.ps1
param(
    [Parameter(Mandatory=$false)]
    [string]$CLAUDE_HOOK_INPUT
)

$input = $CLAUDE_HOOK_INPUT | ConvertFrom-Json

# Check for WebFetch tool
if ($input.tool -eq "WebFetch") {
    $url = $input.parameters.url

    # Allowlist of permitted domains
    $allowedDomains = @(
        "docs.anthropic.com",
        "github.com",
        "stackoverflow.com",
        "developer.mozilla.org",
        "*.microsoft.com",
        "*.corp.example.com"  # Internal domains
    )

    $urlHost = ([System.Uri]$url).Host

    $isAllowed = $false
    foreach ($allowedDomain in $allowedDomains) {
        if ($allowedDomain -like "*.*") {
            # Wildcard domain
            $pattern = $allowedDomain -replace '\*', '.*'
            if ($urlHost -match $pattern) {
                $isAllowed = $true
                break
            }
        } elseif ($urlHost -eq $allowedDomain) {
            $isAllowed = $true
            break
        }
    }

    if (-not $isAllowed) {
        $blockMessage = @{
            continue = $false
            stopReason = "SECURITY BLOCK: URL not in allowlist: $url"
            systemMessage = "Only approved domains can be accessed. Contact IT to request access."
        } | ConvertTo-Json -Compress

        Write-Output $blockMessage
        exit 2
    }
}

# Allow operation
exit 0

```

### 8.9 Network Monitoring & Logging

Monitor Claude Code network connections:

```powershell
# Monitor outbound connections from Claude Code
Get-NetTCPConnection | Where-Object {
    $_.OwningProcess -eq (Get-Process -Name "node" | Where-Object {
        $_.Path -like "*ClaudeCode*"
    }).Id
} | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State | Format-Table

# Log to file
Get-NetTCPConnection | Where-Object {
    $_.OwningProcess -eq (Get-Process -Name "node" | Where-Object {
        $_.Path -like "*ClaudeCode*"
    }).Id
} | ConvertTo-Json | Out-File "C:\ProgramData\ClaudeCode\logs\network-$(Get-Date -Format 'yyyyMMdd').json"

```

---

## 9. DevContainer Isolation Strategy

### 9.1 Why DevContainers for Claude Code Security

Security Benefits:

- Process Isolation: Claude runs in container, not host OS
- Network Isolation: Firewall rules limit container connectivity
- Filesystem Isolation: Restricted access to host filesystem
- Credential Isolation: Separate credential stores per project
- Reproducibility: Consistent, auditable environments

Use Cases:

- Working with untrusted repositories
- Client project isolation (consulting firms)
- Sandbox for testing Claude Code capabilities
- Preventing cross-contamination of credentials

### 9.2 Secure DevContainer Configuration

.devcontainer/devcontainer.json:

```json
{
  "name": "Secure Claude Code Environment",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",

  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "lts"
    }
  },

  "customizations": {
    "vscode": {
      "extensions": [
        "anthropics.claude-code"
      ]
    }
  },

  "postCreateCommand": "npm install -g @anthropic-ai/claude-code",

  "mounts": [
    "source=${localWorkspaceFolder},target=/workspace,type=bind,consistency=cached",
    "source=claude-npm-cache,target=/root/.npm,type=volume"
  ],

  "runArgs": [
    "--cap-drop=ALL",
    "--cap-add=NET_BIND_SERVICE",
    "--security-opt=no-new-privileges",
    "--read-only",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=1g"
  ],

  "containerEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true"
  },

  "remoteUser": "vscode"
}

```

### 9.3 Network Firewall for DevContainer

Dockerfile with Network Restrictions:

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install iptables and configure firewall
RUN apt-get update && apt-get install -y iptables iptables-persistent

# Configure firewall rules
RUN iptables -P INPUT DROP && \
    iptables -P FORWARD DROP && \
    iptables -P OUTPUT DROP && \
    iptables -A OUTPUT -o lo -j ACCEPT && \
    iptables -A INPUT -i lo -j ACCEPT && \
    iptables -A OUTPUT -p tcp --dport 443 -d api.anthropic.com -j ACCEPT && \
    iptables -A OUTPUT -p tcp --dport 443 -d claude.ai -j ACCEPT && \
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT && \
    iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT && \
    netfilter-persistent save

# Install Node.js and Claude Code
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m -s /bin/bash vscode && \
    mkdir -p /workspace && \
    chown -R vscode:vscode /workspace

USER vscode
WORKDIR /workspace

CMD ["/bin/bash"]

```

### 9.4 Read-Only Root Filesystem

Enhanced security with read-only container:

```json
{
  "runArgs": [
    "--read-only",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=512m",
    "--tmpfs=/home/vscode/.claude:rw,nosuid,size=100m",
    "--tmpfs=/home/vscode/.npm:rw,nosuid,size=500m"
  ]
}

```

Benefits:

- Prevents malware persistence
- Blocks unauthorized file modifications
- Forces ephemeral changes (container restart clears tampering)

### 9.5 Credential Management in DevContainers

Option 1: Environment Variable Injection (Recommended)

```json
{
  "containerEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  }
}

```

Host sets environment variable, devcontainer inherits it without storing in files.

Option 2: Secrets via Docker Secrets

```bash
# On host
echo "sk-ant-api03-..." | docker secret create anthropic_api_key -

# In devcontainer
docker run --secret anthropic_api_key ...

```

Option 3: Volume Mount from Secure Location

```json
{
  "mounts": [
    "source=C:\\ProgramData\\ClaudeCode\\secrets,target=/secrets,type=bind,readonly"
  ],
  "containerEnv": {
    "ANTHROPIC_API_KEY": "$(cat /secrets/api_key)"
  }
}

```

### 9.6 Multi-Project Isolation Pattern

Scenario: Consulting firm working on projects for multiple clients, ensuring credential separation.

Directory Structure:

```text
C:\Projects\
├── ClientA\
│   └── .devcontainer\
│       ├── devcontainer.json
│       └── Dockerfile
├── ClientB\
│   └── .devcontainer\
│       ├── devcontainer.json
│       └── Dockerfile
└── ClientC\
    └── .devcontainer\
        ├── devcontainer.json
        └── Dockerfile

```

ClientA devcontainer.json:

```json
{
  "name": "Client A - Isolated Environment",
  "build": {"dockerfile": "Dockerfile"},
  "containerEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:CLIENTA_ANTHROPIC_KEY}",
    "AWS_PROFILE": "clienta",
    "PROJECT_NAME": "ClientA"
  },
  "mounts": [
    "source=${localWorkspaceFolder},target=/workspace,type=bind",
    "source=clienta-npm-cache,target=/root/.npm,type=volume"
  ]
}

```

Result: Each client project runs in isolated container with separate:

- API keys
- Cloud credentials
- npm caches
- Network policies

### 9.7 DevContainer Security Checklist

- Use official base images from Microsoft or verified sources
- Run container as non-root user
- Drop all capabilities except required ones
- Enable read-only root filesystem
- Configure network firewall (allow only required endpoints)
- Use tmpfs for writable directories
- Inject secrets via environment variables (not files)
- Enable security options (`no-new-privileges`,`seccomp`)
- Regularly update base images
- Scan images for vulnerabilities (Trivy, Snyk)
- Limit resource usage (CPU, memory, disk)
- Implement logging and monitoring

---

## 10. Enterprise Deployment Checklist

### 10.1 Pre-Deployment Preparation

Phase 1: Requirements Gathering (Week 1)

- Identify all teams/users who will use Claude Code
- Document compliance requirements (GDPR, HIPAA, SOC2, etc.)
- List sensitive file types specific to your organization
- Map Windows system directories requiring protection
- Define permission levels by user role
- Identify network proxy/firewall requirements
- Determine authentication method (Claude API, AWS Bedrock, GCP Vertex)

Phase 2: Infrastructure Setup (Week 2)

- Choose installation path (`C:\ProgramData\ClaudeCode` recommended)
- Configure npm global prefix
- Set up Group Policy infrastructure for deployment
- Prepare managed policy JSON files
- Configure corporate proxy settings
- Set up audit log centralization (SIEM integration)
- Create service account for Claude Code (if needed)

Phase 3: Security Configuration (Week 2-3)

- Create`managed-settings.json` with enterprise policies
- Develop security hooks (edit, bash, read validation)
- Create`sensitive-files.json` pattern database
- Create`blocked-directories.json` Windows paths
- Configure network firewall rules
- Set up TLS/SSL certificates (if using MITM proxy)
- Implement content scanning hook (optional)
- Configure rate limiting hooks (optional)

Phase 4: Testing (Week 3-4)

- Deploy to pilot group (5-10 users)
- Test sensitive file protection (attempt to edit`.env`)
- Test dangerous command blocking (attempt`rm -rf /`)
- Test Windows system directory protection
- Verify audit logging works
- Test proxy connectivity
- Validate permission rules
- Conduct security penetration testing
- Review audit logs for anomalies

Phase 5: Documentation (Week 4)

- Create user onboarding guide
- Document approved use cases
- Write incident response procedures
- Create troubleshooting runbook
- Prepare security policy documentation
- Document escalation procedures

Phase 6: Rollout (Week 5+)

- Deploy to production via Group Policy
- Conduct user training sessions
- Set up helpdesk support procedures
- Monitor audit logs daily (first week)
- Gather user feedback
- Iterate on permission policies as needed

### 10.2 Complete Managed Settings Template

C:\ProgramData\ClaudeCode\managed-settings.json:

```json
{
  "$schema": "https://api.claude.com/schemas/settings-v1.json",

  "model": "claude-sonnet-4-5",

  "permissions": {
    "defaultMode": "plan",

    "deny": [
      {"tool": "Edit", "matcher": "**/.env*"},
      {"tool": "Edit", "matcher": "**/*.key"},
      {"tool": "Edit", "matcher": "**/*.pem"},
      {"tool": "Edit", "matcher": "**/*.pfx"},
      {"tool": "Edit", "matcher": "**/*.p12"},
      {"tool": "Edit", "matcher": "**/credentials*"},
      {"tool": "Edit", "matcher": "**/secrets*"},
      {"tool": "Edit", "matcher": "**/*.jks"},
      {"tool": "Edit", "matcher": "**/*.keystore"},
      {"tool": "Read", "matcher": "**/id_rsa"},
      {"tool": "Read", "matcher": "**/id_dsa"},
      {"tool": "Read", "matcher": "**/.aws/credentials"},
      {"tool": "Read", "matcher": "**/.ssh/id_*"},
      {"tool": "Edit", "matcher": "C:/Windows/**"},
      {"tool": "Edit", "matcher": "C:/Program Files/**"},
      {"tool": "Edit", "matcher": "C:/Program Files (x86)/**"},
      {"tool": "Read", "matcher": "C:/Windows/System32/config/**"},
      {"tool": "Read", "matcher": "**/AppData/**/Crypto/**"},
      {"tool": "Read", "matcher": "**/AppData/**/Credentials/**"},
      {"tool": "Bash", "matcher": "**/rm -rf*"},
      {"tool": "Bash", "matcher": "**/del /f*"},
      {"tool": "Bash", "matcher": "**/format*"},
      {"tool": "Bash", "matcher": "**/reg delete*"},
      {"tool": "Bash", "matcher": "**/net user*"},
      {"tool": "Edit", "matcher": "**/package-lock.json"},
      {"tool": "Edit", "matcher": "**/.git/**"},
      {"tool": "Edit", "matcher": "**/terraform.tfstate"},
      {"tool": "Edit", "matcher": "C:/ProgramData/ClaudeCode/**"}
    ],

    "ask": [
      {"tool": "Edit", "matcher": "**/*.json"},
      {"tool": "Edit", "matcher": "**/*.yaml"},
      {"tool": "Edit", "matcher": "**/*.yml"},
      {"tool": "Bash", "matcher": "**"},
      {"tool": "Edit", "matcher": "**/Dockerfile"},
      {"tool": "Edit", "matcher": "**/.github/workflows/**"}
    ],

    "allow": [
      {"tool": "Read", "matcher": "**/*.md"},
      {"tool": "Read", "matcher": "**/*.js"},
      {"tool": "Read", "matcher": "**/*.ts"},
      {"tool": "Read", "matcher": "**/*.py"},
      {"tool": "Edit", "matcher": "**/*.md"}
    ],

    "additionalDirectories": []
  },

  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-edit.ps1",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Bash:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-bash.ps1",
            "timeout": 10000
          }
        ]
      },
      {
        "matcher": "Read:**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\validate-read.ps1",
            "timeout": 5000
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\audit-log.ps1",
            "timeout": 5000
          }
        ]
      }
    ],

    "SessionStart": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\session-start.ps1"
          }
        ]
      }
    ],

    "SessionEnd": [
      {
        "matcher": "**",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File C:\\ProgramData\\ClaudeCode\\hooks\\session-end.ps1"
          }
        ]
      }
    ]
  },

  "envVars": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true",
    "NODE_EXTRA_CA_CERTS": "C:\\ProgramData\\ClaudeCode\\certs\\corporate-ca.crt",
    "HTTP_PROXY": "http://proxy.corp.example.com:8080",
    "HTTPS_PROXY": "https://proxy.corp.example.com:8080",
    "NO_PROXY": "localhost,127.0.0.1,.corp.example.com"
  }
}

```

### 10.3 Deployment Automation Script

deploy-claude-enterprise.ps1:

```powershell
<#
.SYNOPSIS
    Enterprise deployment automation for Claude Code
.DESCRIPTION
    Installs Claude Code, deploys managed policies, configures hooks, sets permissions
.PARAMETER SourcePath
    Network path to Claude Code deployment package
.EXAMPLE
    .\deploy-claude-enterprise.ps1 -SourcePath "\\fileserver\IT\ClaudeCode"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$SourcePath,

    [string]$InstallPath = "C:\ProgramData\ClaudeCode",
    [switch]$SkipInstall,
    [switch]$SkipPolicies,
    [switch]$SkipHooks
)

# Requires admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script requires Administrator privileges"
    exit 1
}

Write-Host "=== Claude Code Enterprise Deployment ===" -ForegroundColor Cyan
Write-Host "Source: $SourcePath" -ForegroundColor Cyan
Write-Host "Install Path: $InstallPath" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create directory structure
if (-not $SkipInstall) {
    Write-Host "[1/6] Creating directory structure..." -ForegroundColor Yellow

    $directories = @(
        "$InstallPath\npm-global",
        "$InstallPath\managed-policies",
        "$InstallPath\hooks",
        "$InstallPath\logs",
        "$InstallPath\certs"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
    }

    # Set permissions
    icacls $InstallPath /grant "BUILTIN\Administrators:(OI)(CI)F" /T | Out-Null
    icacls $InstallPath /grant "BUILTIN\Users:(OI)(CI)RX" /T | Out-Null

    Write-Host "✓ Directories created" -ForegroundColor Green
}

# Step 2: Install Claude Code
if (-not $SkipInstall) {
    Write-Host "[2/6] Installing Claude Code..." -ForegroundColor Yellow

    # Configure npm
    npm config set prefix "$InstallPath\npm-global" --global

    # Install
    npm install -g @anthropic-ai/claude-code --quiet

    # Add to PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$InstallPath\npm-global*") {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$InstallPath\npm-global",
            "Machine"
        )
    }

    Write-Host "✓ Claude Code installed" -ForegroundColor Green
}

# Step 3: Deploy managed policies
if (-not $SkipPolicies) {
    Write-Host "[3/6] Deploying managed policies..." -ForegroundColor Yellow

    $managedSettingsSource = Join-Path $SourcePath "managed-settings.json"
    $managedSettingsDest = Join-Path $InstallPath "managed-policies\managed-settings.json"

    if (Test-Path $managedSettingsSource) {
        Copy-Item $managedSettingsSource $managedSettingsDest -Force

        # Make read-only
        Set-ItemProperty -Path $managedSettingsDest -Name IsReadOnly -Value $true
        icacls $managedSettingsDest /inheritance:r /grant "BUILTIN\Administrators:(F)" /grant "BUILTIN\Users:(R)" | Out-Null

        Write-Host "✓ Managed policies deployed" -ForegroundColor Green
    } else {
        Write-Warning "Managed settings not found at $managedSettingsSource"
    }
}

# Step 4: Deploy hooks
if (-not $SkipHooks) {
    Write-Host "[4/6] Deploying security hooks..." -ForegroundColor Yellow

    $hooksSource = Join-Path $SourcePath "hooks"
    $hooksDest = Join-Path $InstallPath "hooks"

    if (Test-Path $hooksSource) {
        Copy-Item "$hooksSource\*" $hooksDest -Force -Recurse

        # Make hooks read-only
        Get-ChildItem $hooksDest -File | ForEach-Object {
            Set-ItemProperty -Path $_.FullName -Name IsReadOnly -Value $true
        }

        Write-Host "✓ Security hooks deployed" -ForegroundColor Green
    } else {
        Write-Warning "Hooks directory not found at $hooksSource"
    }
}

# Step 5: Deploy certificates
Write-Host "[5/6] Deploying certificates..." -ForegroundColor Yellow

$certSource = Join-Path $SourcePath "certs\corporate-ca.crt"
$certDest = Join-Path $InstallPath "certs\corporate-ca.crt"

if (Test-Path $certSource) {
    Copy-Item $certSource $certDest -Force
    Write-Host "✓ Certificates deployed" -ForegroundColor Green
} else {
    Write-Warning "Certificate not found at $certSource"
}

# Step 6: Validate deployment
Write-Host "[6/6] Validating deployment..." -ForegroundColor Yellow

$validationErrors = @()

# Check installation
$claudeVersion = claude --version 2>$null
if ($LASTEXITCODE -ne 0) {
    $validationErrors += "Claude Code installation failed"
}

# Check managed policy
$managedPolicy = "$InstallPath\managed-policies\managed-settings.json"
if (-not (Test-Path $managedPolicy)) {
    $validationErrors += "Managed policy not found"
}

# Check hooks
$requiredHooks = @("validate-edit.ps1", "validate-bash.ps1", "audit-log.ps1")
foreach ($hook in $requiredHooks) {
    if (-not (Test-Path "$InstallPath\hooks\$hook")) {
        $validationErrors += "Hook not found: $hook"
    }
}

if ($validationErrors.Count -eq 0) {
    Write-Host ""
    Write-Host "✓ Deployment completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Claude Code version: $claudeVersion" -ForegroundColor Cyan
    Write-Host "Installation path: $InstallPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Verify managed policies: $managedPolicy"
    Write-Host "2. Test with pilot users"
    Write-Host "3. Monitor audit logs: $InstallPath\logs\"
    Write-Host "4. Run: Test-ClaudeCodeSecurity"
} else {
    Write-Host ""
    Write-Host "✗ Deployment completed with errors:" -ForegroundColor Red
    $validationErrors | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    exit 1
}

```

### 10.4 Post-Deployment Verification

Run comprehensive validation:

```powershell
# Test 1: Verify installation
claude --version

# Test 2: Check managed policy is enforced
Get-Content "C:\ProgramData\ClaudeCode\managed-policies\managed-settings.json" | ConvertFrom-Json | Select-Object -ExpandProperty permissions

# Test 3: Attempt to edit .env file (should BLOCK)
cd C:\TestProject
echo "TEST=value" | Out-File .env
claude "Edit the .env file"
# Expected: Operation blocked by security policy

# Test 4: Attempt dangerous bash command (should BLOCK)
claude "Run: rm -rf /"
# Expected: Command blocked

# Test 5: Verify audit logging
Get-Content "C:\ProgramData\ClaudeCode\logs\audit.jsonl" | Select-Object -Last 10

# Test 6: Verify hooks execute
$env:CLAUDE_HOOK_INPUT = @{tool="Edit"; parameters=@{file_path=".env"}} | ConvertTo-Json -Compress
powershell -File "C:\ProgramData\ClaudeCode\hooks\validate-edit.ps1"
# Expected: Exit code 2 (blocked)

```

---

## 11. Monitoring, Audit & Compliance

### 11.1 Audit Logging Architecture

Centralized Audit Trail:

```
Claude Code → PostToolUse Hook → Local JSON Lines Log → SIEM Integration
                                          ↓
                                  Local Archive (90 days)
                                          ↓
                                  Cold Storage (7 years)

```

### 11.2 Audit Log Schema

Standard audit entry format:

```json
{
  "timestamp": "2025-10-07T14:23:45.123Z",
  "event_type": "tool_use",
  "user": "john.doe",
  "computer": "DESKTOP-ABC123",
  "project_dir": "C:\\Projects\\MyApp",
  "tool": "Edit",
  "parameters": {
    "file_path": "C:\\Projects\\MyApp\\src\\index.js",
    "old_string": "const API_KEY = \"test\"",
    "new_string": "const API_KEY = process.env.API_KEY"
  },
  "result": {
    "success": true,
    "duration_ms": 45
  },
  "security": {
    "hooks_executed": ["validate-edit.ps1", "audit-log.ps1"],
    "blocked": false,
    "reason": null
  },
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}

```

### 11.3 SIEM Integration

Splunk Integration:

```powershell
# In audit-log.ps1, add Splunk forwarding

$splunkHEC = "https://splunk.corp.example.com:8088/services/collector/event"
$splunkToken = $env:SPLUNK_HEC_TOKEN  # Set via GPO

$splunkEvent = @{
    event = $auditEntry
    sourcetype = "claude_code:audit"
    source = "claude_code"
    index = "security"
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri $splunkHEC `
        -Method Post `
        -Headers @{"Authorization"="Splunk $splunkToken"} `
        -Body $splunkEvent `
        -ContentType "application/json" `
        -TimeoutSec 5
} catch {
    Write-Warning "Failed to forward to Splunk: $_"
}

```

Elasticsearch Integration:

```powershell
# Elasticsearch ingestion

$esEndpoint = "https://elasticsearch.corp.example.com:9200/claude-audit/_doc"
$esApiKey = $env:ELASTIC_API_KEY

try {
    Invoke-RestMethod -Uri $esEndpoint `
        -Method Post `
        -Headers @{"Authorization"="ApiKey $esApiKey"} `
        -Body ($auditEntry | ConvertTo-Json -Depth 10) `
        -ContentType "application/json" `
        -TimeoutSec 5
} catch {
    Write-Warning "Failed to index in Elasticsearch: $_"
}

```

### 11.4 Compliance Reporting

GDPR Data Access Request:

```powershell
<#
.SYNOPSIS
    Extract all Claude Code audit logs for specific user (GDPR/CCPA compliance)
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$UserEmail
)

$auditLog = "C:\ProgramData\ClaudeCode\logs\audit.jsonl"
$outputReport = "C:\Temp\claude_audit_${UserEmail}_$(Get-Date -Format 'yyyyMMdd').json"

# Extract user's audit entries
Get-Content $auditLog | ForEach-Object {
    $entry = $_ | ConvertFrom-Json
    if ($entry.user -eq $UserEmail) {
        $entry
    }
} | ConvertTo-Json -Depth 10 | Out-File $outputReport

Write-Host "Audit report generated: $outputReport"
Write-Host "Entries found: $((Get-Content $outputReport | ConvertFrom-Json).Count)"

```

SOC 2 Compliance Report:

```powershell
<#
.SYNOPSIS
    Generate SOC 2 compliance report for Claude Code usage
#>

param(
    [datetime]$StartDate = (Get-Date).AddDays(-30),
    [datetime]$EndDate = (Get-Date)
)

$auditLog = "C:\ProgramData\ClaudeCode\logs\audit.jsonl"

# Parse audit logs
$entries = Get-Content $auditLog | ForEach-Object {
    $entry = $_ | ConvertFrom-Json

    if ((Get-Date $entry.timestamp) -ge $StartDate -and (Get-Date $entry.timestamp) -le $EndDate) {
        $entry
    }
}

# Generate report
$report = @{
    report_period = @{
        start = $StartDate.ToString("o")
        end = $EndDate.ToString("o")
    }

    summary = @{
        total_operations = $entries.Count
        unique_users = ($entries | Select-Object -ExpandProperty user -Unique).Count
        blocked_operations = ($entries | Where-Object { $_.security.blocked -eq $true }).Count
        sensitive_file_access = ($entries | Where-Object {
            $_.parameters.file_path -match '\.(env|key|pem|credentials)'
        }).Count
    }

    security_events = @{
        blocked_operations = $entries | Where-Object { $_.security.blocked -eq $true } | Select-Object timestamp, user, tool, @{N='reason';E={$_.security.reason}}
        sensitive_access = $entries | Where-Object {
            $_.parameters.file_path -match '\.(env|key|pem|credentials)'
        } | Select-Object timestamp, user, tool, @{N='file';E={$_.parameters.file_path}}
    }

    compliance_controls = @{
        managed_policies_enforced = Test-Path "C:\ProgramData\ClaudeCode\managed-policies\managed-settings.json"
        hooks_active = (Get-ChildItem "C:\ProgramData\ClaudeCode\hooks" -Filter "*.ps1").Count -ge 3
        audit_logging_enabled = Test-Path $auditLog
        network_restrictions = $true  # Based on firewall rules
    }
}

$reportFile = "C:\Temp\claude_soc2_report_$(Get-Date -Format 'yyyyMMdd').json"
$report | ConvertTo-Json -Depth 10 | Out-File $reportFile

Write-Host "SOC 2 compliance report generated: $reportFile"

```

### 11.5 Real-Time Alerts

Security alert on suspicious activity:

```powershell
# In audit-log.ps1, add alerting logic

$alertThresholds = @{
    sensitive_file_access_per_hour = 10
    blocked_operations_per_hour = 5
    unusual_hours = 0..5  # 12 AM - 5 AM
}

# Check for sensitive file access spike
$recentSensitiveAccess = Get-Content $auditLog | Select-Object -Last 100 | ForEach-Object {
    $entry = $_ | ConvertFrom-Json
    if ((Get-Date $entry.timestamp) -gt (Get-Date).AddHours(-1) -and
        $entry.parameters.file_path -match '\.(env|key|pem|credentials)') {
        $entry
    }
}

if ($recentSensitiveAccess.Count -gt $alertThresholds.sensitive_file_access_per_hour) {
    # Send alert
    $alertMessage = @{
        severity = "HIGH"
        title = "Claude Code: Suspicious sensitive file access detected"
        description = "User $($env:USERNAME) accessed $($recentSensitiveAccess.Count) sensitive files in the last hour"
        details = $recentSensitiveAccess | Select-Object timestamp, tool, @{N='file';E={$_.parameters.file_path}}
    } | ConvertTo-Json -Depth 10

    # Send to Microsoft Teams, Slack, or email
    Invoke-RestMethod -Uri "https://outlook.office.com/webhook/..." `
        -Method Post `
        -Body $alertMessage `
        -ContentType "application/json"
}

# Check for unusual hours activity
$currentHour = (Get-Date).Hour
if ($currentHour -in $alertThresholds.unusual_hours) {
    $alertMessage = @{
        severity = "MEDIUM"
        title = "Claude Code: Activity detected during unusual hours"
        description = "User $($env:USERNAME) is using Claude Code at $currentHour:00"
        computer = $env:COMPUTERNAME
        project = $env:CLAUDE_PROJECT_DIR
    } | ConvertTo-Json -Depth 10

    # Send alert
    Invoke-RestMethod -Uri "https://outlook.office.com/webhook/..." `
        -Method Post `
        -Body $alertMessage `
        -ContentType "application/json"
}

```

### 11.6 Dashboarding & Metrics

PowerBI / Grafana Dashboard Queries:

Query 1: Daily Active Users

```
// KQL query for Azure Data Explorer / Log Analytics
ClaudeAuditLogs
| where timestamp >= ago(30d)
| summarize UniqueUsers = dcount(user) by bin(timestamp, 1d)
| render timechart

```

Query 2: Top Blocked Operations

```
ClaudeAuditLogs
| where security_blocked == true
| summarize Count = count() by security_reason
| top 10 by Count desc

```

Query 3: Sensitive File Access by User

```
ClaudeAuditLogs
| where parameters_file_path matches regex @"\.(env|key|pem|credentials)"
| summarize AccessCount = count() by user, bin(timestamp, 1h)
| where AccessCount > 5

```

---

## 12. Windows Security Integration

### 12.1 AppLocker Integration

AppLocker Policy for Claude Code:

```xml
<?xml version="1.0" encoding="utf-8"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="Enabled">
    <!-- Allow Claude Code from approved location -->
    <FilePathRule Id="claude-approved-path"
                  Name="Claude Code - Approved Installation"
                  Description="Allow Claude Code from ProgramData"
                  UserOrGroupSid="S-1-1-0"
                  Action="Allow">
      <Conditions>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\*"/>
      </Conditions>
    </FilePathRule>

    <!-- Block Claude Code from other locations -->
    <FilePathRule Id="claude-block-others"
                  Name="Claude Code - Block Unauthorized Locations"
                  Description="Block Claude Code from AppData and other locations"
                  UserOrGroupSid="S-1-1-0"
                  Action="Deny">
      <Conditions>
        <FilePathCondition Path="%APPDATA%\npm\*claude*"/>
      </Conditions>
    </FilePathRule>
  </RuleCollection>

  <RuleCollection Type="Script" EnforcementMode="Enabled">
    <!-- Allow Claude hooks from approved location -->
    <FilePathRule Id="claude-hooks-approved"
                  Name="Claude Hooks - Approved"
                  Description="Allow PowerShell hooks from ProgramData"
                  UserOrGroupSid="S-1-1-0"
                  Action="Allow">
      <Conditions>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\hooks\*.ps1"/>
      </Conditions>
    </FilePathRule>
  </RuleCollection>
</AppLockerPolicy>

```

Deploy via Group Policy:

```powershell
# Export AppLocker policy
Get-AppLockerPolicy -Effective -Xml | Out-File "C:\Temp\ClaudeAppLockerPolicy.xml"

# Import to GPO
Set-AppLockerPolicy -XMLPolicy "C:\Temp\ClaudeAppLockerPolicy.xml" -Merge

```

### 12.2 WDAC (Windows Defender Application Control)

WDAC Policy XML:

```xml
<?xml version="1.0" encoding="utf-8"?>
<SiPolicy xmlns="urn:schemas-microsoft-com:sipolicy">
  <VersionEx>10.0.0.0</VersionEx>
  <PolicyTypeID>{A244370E-44C9-4C06-B551-F6016E563076}</PolicyTypeID>
  <PlatformID>{2E07F7E4-194C-4D20-B7C9-6F44A6C5A234}</PlatformID>

  <Rules>
    <Rule>
      <Option>Enabled:Unsigned System Integrity Policy</Option>
    </Rule>
    <Rule>
      <Option>Enabled:Advanced Boot Options Menu</Option>
    </Rule>
  </Rules>

  <FileRules>
    <Allow ID="ID_ALLOW_CLAUDE_INSTALLATION"
           FriendlyName="Claude Code - Approved Installation"
           FileName="*"
           FilePath="C:\ProgramData\ClaudeCode\npm-global\**"/>

    <Allow ID="ID_ALLOW_NODE_FOR_CLAUDE"
           FriendlyName="Node.js for Claude Code"
           FileName="node.exe"
           MinimumFileVersion="18.0.0.0"/>

    <Deny ID="ID_DENY_CLAUDE_APPDATA"
          FriendlyName="Block Claude from AppData"
          FilePath="%APPDATA%\npm\**\claude*"/>
  </FileRules>

  <Signers />
</SiPolicy>

```

Convert to binary and deploy:

```
# Convert XML to binary
ConvertFrom-CIPolicy -XmlFilePath "C:\Temp\ClaudeWDACPolicy.xml" `
    -BinaryFilePath "C:\Temp\ClaudeWDACPolicy.bin"

# Copy to system directory
Copy-Item "C:\Temp\ClaudeWDACPolicy.bin" `
    -Destination "C:\Windows\System32\CodeIntegrity\SIPolicy.p7b"

# Activate policy (requires reboot)
Invoke-CimMethod -Namespace "root\Microsoft\Windows\CI" `
    -ClassName "PS_UpdateAndCompareCIPolicy" `
    -MethodName "Update" `
    -Arguments @{FilePath="C:\Temp\ClaudeWDACPolicy.bin"}

```

### 12.3 Controlled Folder Access

Protect sensitive folders from Claude Code:

```powershell
# Enable Controlled Folder Access
Set-MpPreference -EnableControlledFolderAccess Enabled

# Add protected folders
Add-MpPreference -ControlledFolderAccessProtectedFolders "C:\SensitiveData"
Add-MpPreference -ControlledFolderAccessProtectedFolders "C:\Projects\ProductionCode"
Add-MpPreference -ControlledFolderAccessProtectedFolders "C:\Users\$env:USERNAME\.ssh"
Add-MpPreference -ControlledFolderAccessProtectedFolders "C:\Users\$env:USERNAME\.aws"

# Verify configuration
Get-MpPreference | Select-Object -ExpandProperty ControlledFolderAccessProtectedFolders

```

Allow Claude Code (if needed for legitimate access):

```
# Add Claude Code to allowed applications (use cautiously)
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\ProgramData\ClaudeCode\npm-global\claude.cmd"

```

### 12.4 Windows Event Log Integration

Log Claude Code security events to Windows Event Log:

```powershell
# Create custom event log source
New-EventLog -LogName "Application" -Source "ClaudeCodeSecurity"

# In hooks, write to Event Log
Write-EventLog -LogName "Application" `
    -Source "ClaudeCodeSecurity" `
    -EventId 1000 `
    -EntryType Warning `
    -Message "Blocked edit operation on sensitive file: $filePath by user $env:USERNAME"

# Query Claude Code events
Get-EventLog -LogName "Application" -Source "ClaudeCodeSecurity" -Newest 100

```

### 12.5 BitLocker Integration

Ensure sensitive data at rest is encrypted:

```powershell
# Check if Claude Code installation drive is encrypted
$drive = "C:"
$bitLockerStatus = Get-BitLockerVolume -MountPoint $drive

if ($bitLockerStatus.ProtectionStatus -ne "On") {
    Write-Warning "Drive $drive is not protected by BitLocker"
    Write-Warning "Claude Code logs and policies contain sensitive data - encryption recommended"

    # Optionally enable BitLocker (requires TPM or password)
    # Enable-BitLocker -MountPoint $drive -EncryptionMethod XtsAes256 -UsedSpaceOnly
}

```

### 12.6 Windows Firewall Advanced Configuration

Create dedicated firewall profile for Claude Code:

```powershell
# Create new firewall rule with application filtering
New-NetFirewallRule -DisplayName "Claude Code - Outbound HTTPS" `
    -Direction Outbound `
    -Program "C:\Program Files\nodejs\node.exe" `
    -Action Allow `
    -Protocol TCP `
    -RemotePort 443 `
    -RemoteAddress "api.anthropic.com","claude.ai" `
    -Profile Domain,Private `
    -Enabled True

# Block all other outbound from Node.js (when used by Claude)
New-NetFirewallRule -DisplayName "Claude Code - Block Unauthorized Outbound" `
    -Direction Outbound `
    -Program "C:\Program Files\nodejs\node.exe" `
    -Action Block `
    -Enabled True

# Log blocked connections
Set-NetFirewallProfile -Profile Domain,Private,Public -LogBlocked True -LogAllowed False
auditpol /set /subcategory:"Filtering Platform Connection" /success:enable /failure:enable

```

### 12.7 Integration Summary Checklist

- AppLocker policy deployed via GPO
- WDAC policy configured and active
- Controlled Folder Access enabled for sensitive directories
- Windows Event Log source created for Claude Code
- BitLocker encryption verified on installation drive
- Windows Firewall rules applied
- Audit policies configured
- Security baselines applied (CIS, DISA STIG)
- Defender ATP / MDI integration configured
- Conditional Access policies applied (if using Azure AD)

---

## 13. Preventing Shadow Installations and Local Bypasses

### 13.1 The Shadow Installation Threat

Even with comprehensive enterprise controls in place, a sophisticated threat vector remains: developers installing Claude Code locally to bypass centralized security policies.

Attack Scenario:

```
Developer Workstation:
1. Enterprise installation: C:\ProgramData\ClaudeCode (locked down, managed policies)
2. Shadow installation: C:\Users\john.doe\AppData\Roaming\npm\claude (user-controlled)
3. Developer runs: npx @anthropic-ai/claude-code (bypasses all controls)
4. Or installs locally: npm install -g @anthropic-ai/claude-code --prefix=%LOCALAPPDATA%\npm

```

Why This is Critical:

| Enterprise Control | Shadow Install Bypasses |
| --- | --- |
| Managed policies | ✗ Not loaded from ProgramData |
| Security hooks | ✗ Hooks not configured |
| Audit logging | ✗ No PostToolUse hooks active |
| Permission restrictions | ✗ User can set permissive settings |
| File protection | ✗ Can read .env, keys, credentials |
| Network controls | ✗ Direct API access without proxy |
| Compliance | ✗ No audit trail for regulators |

Real-World Risk Examples:

1. Credential Theft: Developer uses local Claude to read`.env` files, extract API keys, exfiltrate to personal account
2. Code Leakage: Proprietary code sent to Anthropic API without corporate proxy/filtering
3. Compliance Violation: HIPAA/PCI data processed by unaudited AI tool
4. Shadow IT Sprawl: Multiple versions with different security postures across organization
5. Incident Response Blind Spot: Security team unaware of tool usage

### 13.2 Multi-Layer Prevention Strategy

Defense-in-depth approach with 7 security layers:

#### Layer 1: npm Configuration Lockdown

Lock npm prefix system-wide (read-only):

```powershell
<#
.SYNOPSIS
    Locks npm configuration to prevent local Claude Code installations
#>

# Step 1: Set system-wide npm prefix
$globalNpmRc = "C:\Program Files\nodejs\npmrc"
$lockedPrefix = "C:\ProgramData\ClaudeCode\npm-global"

# Configure global npmrc
$npmConfig = @"
prefix=$lockedPrefix
cache=C:\ProgramData\ClaudeCode\npm-cache
"@

Set-Content -Path $globalNpmRc -Value $npmConfig -Force

# Step 2: Make npmrc read-only
Set-ItemProperty -Path $globalNpmRc -Name IsReadOnly -Value $true
icacls $globalNpmRc /inheritance:r /grant "BUILTIN\Administrators:(F)" /grant "BUILTIN\Users:(R)" | Out-Null

Write-Host "✓ npm configuration locked to enterprise location" -ForegroundColor Green

# Step 3: Block user-level npmrc creation via registry
$registryPath = "HKLM:\SOFTWARE\Policies\npm"
if (-not (Test-Path $registryPath)) {
    New-Item -Path $registryPath -Force | Out-Null
}

# Prevent npm from reading user .npmrc
Set-ItemProperty -Path $registryPath -Name "DisableUserConfig" -Value 1 -Type DWord

Write-Host "✓ User-level npm configuration blocked" -ForegroundColor Green

```

Deploy via Group Policy:

```powershell
# Create GPO for npm lockdown
$gpoName = "Claude Code - npm Configuration Lockdown"
New-GPO -Name $gpoName

# Add registry policy
# Computer Configuration > Preferences > Windows Settings > Registry
# Key: HKLM\SOFTWARE\Policies\npm
# Value: DisableUserConfig = 1 (REG_DWORD)

# Add file deployment for global npmrc
# Computer Configuration > Preferences > Windows Settings > Files
# Source: \\fileserver\IT\ClaudeCode\npmrc
# Destination: C:\Program Files\nodejs\npmrc
# Action: Replace

```

#### Layer 2: AppLocker Advanced Rules

Block execution from all user-writable locations:

```xml
<?xml version="1.0" encoding="utf-8"?>
<AppLockerPolicy Version="1">
  <!-- Executable Rules -->
  <RuleCollection Type="Exe" EnforcementMode="Enabled">
    <!-- Allow Claude from approved location ONLY -->
    <FilePathRule Id="allow-claude-approved"
                  Name="Allow Claude - Approved Location"
                  Action="Allow"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\*"/>
      </Conditions>
    </FilePathRule>

    <!-- BLOCK AppData npm installations -->
    <FilePathRule Id="block-appdata-roaming-npm"
                  Name="Block Claude - AppData Roaming npm"
                  Action="Deny"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%APPDATA%\npm\*"/>
      </Conditions>
    </FilePathRule>

    <FilePathRule Id="block-appdata-local-npm"
                  Name="Block Claude - AppData Local npm"
                  Action="Deny"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%LOCALAPPDATA%\npm\*"/>
      </Conditions>
    </FilePathRule>

    <!-- Block node_modules in user directories -->
    <FilePathRule Id="block-userprofile-node-modules"
                  Name="Block Claude - User node_modules"
                  Action="Deny"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%USERPROFILE%\*\node_modules\*claude*"/>
      </Conditions>
    </FilePathRule>

    <!-- Block any claude.exe or claude.cmd outside approved path -->
    <FilePublisherRule Id="block-claude-unauthorized"
                       Name="Block Unauthorized Claude Executable"
                       Action="Deny"
                       UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePublisherCondition PublisherName="*" ProductName="*claude*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
      <Exceptions>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\*"/>
      </Exceptions>
    </FilePublisherRule>
  </RuleCollection>

  <!-- Script Rules (for .js, .cmd, .ps1 in npm) -->
  <RuleCollection Type="Script" EnforcementMode="Enabled">
    <!-- Block scripts in AppData npm -->
    <FilePathRule Id="block-appdata-npm-scripts"
                  Name="Block npm Scripts - AppData"
                  Action="Deny"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%APPDATA%\npm\*.cmd"/>
        <FilePathCondition Path="%APPDATA%\npm\*.js"/>
        <FilePathCondition Path="%LOCALAPPDATA%\npm\*.cmd"/>
        <FilePathCondition Path="%LOCALAPPDATA%\npm\*.js"/>
      </Conditions>
    </FilePathRule>

    <!-- Allow only approved Claude scripts -->
    <FilePathRule Id="allow-claude-scripts-approved"
                  Name="Allow Claude Scripts - Approved"
                  Action="Allow"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\*.cmd"/>
        <FilePathCondition Path="C:\ProgramData\ClaudeCode\npm-global\*.js"/>
      </Conditions>
    </FilePathRule>
  </RuleCollection>

  <!-- DLL Rules (prevent loading of Claude modules from unauthorized paths) -->
  <RuleCollection Type="Dll" EnforcementMode="Enabled">
    <FilePathRule Id="block-claude-dlls-appdata"
                  Name="Block Claude DLLs - AppData"
                  Action="Deny"
                  UserOrGroupSid="S-1-1-0">
      <Conditions>
        <FilePathCondition Path="%APPDATA%\npm\*\node_modules\@anthropic*\*.dll"/>
        <FilePathCondition Path="%LOCALAPPDATA%\npm\*\node_modules\@anthropic*\*.dll"/>
      </Conditions>
    </FilePathRule>
  </RuleCollection>
</AppLockerPolicy>

```

Deploy AppLocker Policy:

```powershell
# Import AppLocker policy
Set-AppLockerPolicy -XMLPolicy "C:\Temp\ClaudeAppLockerPolicy.xml" -Merge

# Enable Application Identity service (required for AppLocker)
Set-Service -Name AppIDSvc -StartupType Automatic
Start-Service -Name AppIDSvc

# Verify policy
Get-AppLockerPolicy -Effective | Format-List

```

#### Layer 3: File System Auditing

Enable auditing for shadow installations:

```powershell
<#
.SYNOPSIS
    Configures file system auditing to detect Claude Code installations in user directories
#>

# Enable file auditing via auditpol
auditpol /set /subcategory:"File System" /success:enable /failure:enable

# Configure audit ACLs on common npm install locations
$auditPaths = @(
    "$env:APPDATA\npm",
    "$env:LOCALAPPDATA\npm",
    "$env:USERPROFILE\node_modules",
    "$env:USERPROFILE\.npm"
)

foreach ($path in $auditPaths) {
    if (Test-Path $path) {
        # Add audit rule: Everyone, CreateFiles/Write, Success
        $acl = Get-Acl $path
        $auditRule = New-Object System.Security.AccessControl.FileSystemAuditRule(
            "Everyone",
            "CreateFiles,Write,Delete",
            "ContainerInherit,ObjectInherit",
            "None",
            "Success"
        )
        $acl.AddAuditRule($auditRule)
        Set-Acl $path $acl

        Write-Host "✓ Audit configured for: $path" -ForegroundColor Green
    }
}

# Forward events to centralized log
# Event ID 4663 = File System: Object Access
# Filter for npm-related file operations

```

Automated Detection Script:

```powershell
<#
.SYNOPSIS
    Scans for unauthorized Claude Code installations
.DESCRIPTION
    Detects shadow Claude installations in user directories and reports to security team
#>

function Find-ShadowClaudeInstallations {
    [CmdletBinding()]
    param(
        [switch]$RemoveUnauthorized,
        [switch]$AlertSecurity
    )

    Write-Host "Scanning for shadow Claude Code installations..." -ForegroundColor Yellow

    $shadowInstalls = @()

    # Scan common npm locations
    $scanPaths = @(
        "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code",
        "$env:LOCALAPPDATA\npm\node_modules\@anthropic-ai\claude-code",
        "$env:USERPROFILE\node_modules\@anthropic-ai\claude-code",
        "$env:USERPROFILE\.npm\@anthropic-ai\claude-code"
    )

    # Also scan all user profiles
    $allUsers = Get-ChildItem "C:\Users" -Directory
    foreach ($userProfile in $allUsers) {
        $scanPaths += @(
            "$($userProfile.FullName)\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code",
            "$($userProfile.FullName)\AppData\Local\npm\node_modules\@anthropic-ai\claude-code",
            "$($userProfile.FullName)\node_modules\@anthropic-ai\claude-code"
        )
    }

    foreach ($path in $scanPaths) {
        if (Test-Path $path) {
            $packageJson = Join-Path $path "package.json"
            if (Test-Path $packageJson) {
                $package = Get-Content $packageJson -Raw | ConvertFrom-Json

                $install = @{
                    Path = $path
                    Version = $package.version
                    User = ($path -replace '^C:\\Users\\([^\\]+)\\.*', '$1')
                    Size = (Get-ChildItem $path -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
                    CreatedDate = (Get-Item $path).CreationTime
                }

                $shadowInstalls += $install

                Write-Host "✗ UNAUTHORIZED INSTALLATION DETECTED!" -ForegroundColor Red
                Write-Host "  Path: $($install.Path)" -ForegroundColor Red
                Write-Host "  User: $($install.User)" -ForegroundColor Red
                Write-Host "  Version: $($install.Version)" -ForegroundColor Red
                Write-Host "  Created: $($install.CreatedDate)" -ForegroundColor Red
                Write-Host ""
            }
        }
    }

    # Check for npm configuration overrides
    $userNpmRc = "$env:USERPROFILE\.npmrc"
    if (Test-Path $userNpmRc) {
        $npmConfig = Get-Content $userNpmRc -Raw
        if ($npmConfig -match "prefix\s*=") {
            Write-Host "✗ WARNING: User has custom npm prefix configuration" -ForegroundColor Red
            Write-Host "  File: $userNpmRc" -ForegroundColor Red
            Write-Host "  This may indicate attempt to bypass enterprise controls" -ForegroundColor Red
            Write-Host ""
        }
    }

    # Generate report
    if ($shadowInstalls.Count -gt 0) {
        $reportPath = "C:\ProgramData\ClaudeCode\logs\shadow-installations-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $shadowInstalls | ConvertTo-Json -Depth 10 | Out-File $reportPath

        Write-Host "Found $($shadowInstalls.Count) unauthorized installation(s)" -ForegroundColor Red
        Write-Host "Report saved: $reportPath" -ForegroundColor Cyan

        # Alert security team
        if ($AlertSecurity) {
            $alertMessage = @{
                severity = "HIGH"
                title = "Shadow Claude Code Installations Detected"
                count = $shadowInstalls.Count
                installations = $shadowInstalls
                timestamp = (Get-Date).ToUniversalTime().ToString("o")
                computer = $env:COMPUTERNAME
            } | ConvertTo-Json -Depth 10

            # Send to SIEM/Security Operations
            try {
                Invoke-RestMethod -Uri "https://siem.corp.example.com/api/alerts" `
                    -Method Post `
                    -Body $alertMessage `
                    -ContentType "application/json" `
                    -TimeoutSec 10
            } catch {
                Write-Warning "Failed to send security alert: $_"
            }
        }

        # Remove unauthorized installations
        if ($RemoveUnauthorized) {
            Write-Host "Removing unauthorized installations..." -ForegroundColor Yellow
            foreach ($install in $shadowInstalls) {
                try {
                    Remove-Item $install.Path -Recurse -Force -ErrorAction Stop
                    Write-Host "✓ Removed: $($install.Path)" -ForegroundColor Green

                    # Log remediation action
                    Write-EventLog -LogName "Application" `
                        -Source "ClaudeCodeSecurity" `
                        -EventId 2000 `
                        -EntryType Warning `
                        -Message "Removed unauthorized Claude Code installation: $($install.Path) (User: $($install.User))"
                } catch {
                    Write-Host "✗ Failed to remove: $($install.Path) - $_" -ForegroundColor Red
                }
            }
        }
    } else {
        Write-Host "✓ No shadow installations detected" -ForegroundColor Green
    }

    return $shadowInstalls
}

# Run scan
Find-ShadowClaudeInstallations -AlertSecurity

```

Scheduled Task for Continuous Monitoring:

```powershell
# Create scheduled task to run daily
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\ProgramData\ClaudeCode\scripts\Find-ShadowClaudeInstallations.ps1 -AlertSecurity -RemoveUnauthorized"

$trigger = New-ScheduledTaskTrigger -Daily -At "3:00AM"

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName "Claude Code - Shadow Installation Detection" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Detects and removes unauthorized Claude Code installations"

Write-Host "✓ Scheduled task created for daily shadow installation scans" -ForegroundColor Green

```

#### Layer 4: Process Monitoring

Detect node.exe running Claude from unauthorized paths:

```powershell
<#
.SYNOPSIS
    Monitors for Claude Code processes running from unauthorized locations
#>

function Monitor-ClaudeProcesses {
    [CmdletBinding()]
    param(
        [switch]$KillUnauthorized,
        [int]$MonitorIntervalSeconds = 60
    )

    $approvedPath = "C:\ProgramData\ClaudeCode\npm-global"

    Write-Host "Monitoring Claude Code processes (Interval: $MonitorIntervalSeconds seconds)..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

    while ($true) {
        # Find all node.exe processes
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

        foreach ($proc in $nodeProcesses) {
            try {
                $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine

                # Check if running Claude Code
                if ($commandLine -match "claude-code|@anthropic-ai") {
                    $executablePath = $proc.Path

                    # Check if from approved location
                    if ($executablePath -notlike "$approvedPath\*" -and
                        $commandLine -notlike "*$approvedPath*") {

                        Write-Host "✗ UNAUTHORIZED CLAUDE PROCESS DETECTED!" -ForegroundColor Red
                        Write-Host "  PID: $($proc.Id)" -ForegroundColor Red
                        Write-Host "  User: $($proc.StartInfo.UserName)" -ForegroundColor Red
                        Write-Host "  Path: $executablePath" -ForegroundColor Red
                        Write-Host "  Command: $commandLine" -ForegroundColor Red
                        Write-Host ""

                        # Log to Event Log
                        Write-EventLog -LogName "Application" `
                            -Source "ClaudeCodeSecurity" `
                            -EventId 3000 `
                            -EntryType Warning `
                            -Message "Unauthorized Claude Code process detected: PID $($proc.Id), Path: $executablePath, Command: $commandLine"

                        # Alert security
                        $alertMessage = @{
                            severity = "CRITICAL"
                            title = "Unauthorized Claude Code Process Running"
                            pid = $proc.Id
                            user = $env:USERNAME
                            computer = $env:COMPUTERNAME
                            path = $executablePath
                            command = $commandLine
                            timestamp = (Get-Date).ToUniversalTime().ToString("o")
                        } | ConvertTo-Json -Depth 10

                        try {
                            Invoke-RestMethod -Uri "https://siem.corp.example.com/api/alerts" `
                                -Method Post `
                                -Body $alertMessage `
                                -ContentType "application/json" `
                                -TimeoutSec 5
                        } catch {
                            Write-Warning "Failed to send alert: $_"
                        }

                        # Kill process if requested
                        if ($KillUnauthorized) {
                            Write-Host "  Terminating unauthorized process..." -ForegroundColor Yellow
                            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                            Write-Host "  ✓ Process terminated" -ForegroundColor Green
                        }
                    }
                }
            } catch {
                # Process may have exited, continue
            }
        }

        Start-Sleep -Seconds $MonitorIntervalSeconds
    }
}

# Run in background
Monitor-ClaudeProcesses -KillUnauthorized

```

Sysmon Configuration for Advanced Monitoring:

```
<Sysmon schemaversion="4.90">
  <EventFiltering>
    <!-- Monitor process creation for Claude Code -->
    <ProcessCreate onmatch="include">
      <Rule groupRelation="and">
        <CommandLine condition="contains">claude-code</CommandLine>
        <Image condition="excludes">C:\ProgramData\ClaudeCode\npm-global\</Image>
      </Rule>
      <Rule groupRelation="and">
        <CommandLine condition="contains">@anthropic-ai</CommandLine>
        <Image condition="excludes">C:\ProgramData\ClaudeCode\npm-global\</Image>
      </Rule>
    </ProcessCreate>

    <!-- Monitor file creation in npm directories -->
    <FileCreate onmatch="include">
      <Rule groupRelation="or">
        <TargetFilename condition="contains">\AppData\Roaming\npm\node_modules\@anthropic-ai\</TargetFilename>
        <TargetFilename condition="contains">\AppData\Local\npm\node_modules\@anthropic-ai\</TargetFilename>
      </Rule>
    </FileCreate>

    <!-- Monitor registry changes for npm config -->
    <RegistryEvent onmatch="include">
      <Rule groupRelation="or">
        <TargetObject condition="contains">SOFTWARE\npm</TargetObject>
        <TargetObject condition="contains">SOFTWARE\Node.js</TargetObject>
      </Rule>
    </RegistryEvent>
  </EventFiltering>
</Sysmon>

```

Install Sysmon:

```
# Download Sysmon
# https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon

# Install with configuration
Sysmon64.exe -accepteula -i C:\ProgramData\ClaudeCode\config\sysmon-claude-monitoring.xml

# Verify installation
Get-Service Sysmon64

```

#### Layer 5: Defender ATP Custom Detection Rules

Advanced hunting queries for shadow installations:

```
// Query 1: Detect npm install of Claude Code in user directories
DeviceProcessEvents
| where Timestamp > ago(24h)
| where ProcessCommandLine has "npm install"
    and ProcessCommandLine has_any ("@anthropic-ai/claude-code", "claude-code")
| where FolderPath !startswith "C:\\ProgramData\\ClaudeCode"
| where FolderPath has_any ("AppData\\Roaming", "AppData\\Local", "Users")
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, FolderPath, InitiatingProcessCommandLine
| order by Timestamp desc

```

```
// Query 2: Detect Claude Code execution from unauthorized paths
DeviceProcessEvents
| where Timestamp > ago(1h)
| where ProcessCommandLine has_any ("claude-code", "@anthropic-ai")
| where FolderPath !startswith "C:\\ProgramData\\ClaudeCode"
| extend PathType = case(
    FolderPath contains "AppData\\Roaming", "AppData Roaming",
    FolderPath contains "AppData\\Local", "AppData Local",
    FolderPath contains "\\Users\\", "User Directory",
    "Other"
)
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, FolderPath, PathType
| order by Timestamp desc

```

```
// Query 3: Detect changes to npm configuration files
DeviceFileEvents
| where Timestamp > ago(7d)
| where FileName in~ (".npmrc", "npmrc")
| where FolderPath has_any ("AppData\\Roaming", "Users")
| where ActionType in ("FileCreated", "FileModified")
| project Timestamp, DeviceName, AccountName, FileName, FolderPath, ActionType
| order by Timestamp desc

```

Create Custom Detection Rule in Defender ATP:

```
// Custom Detection: Shadow Claude Code Installation
DeviceProcessEvents
| where Timestamp > ago(1h)
| where ProcessCommandLine has "npm install" and ProcessCommandLine has "@anthropic-ai/claude-code"
| where FolderPath !startswith "C:\\ProgramData\\ClaudeCode"
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, FolderPath

```

Alert Configuration:

- Severity: High
- Category: Unauthorized Software
- Recommended Action: Investigate immediately, terminate process, remove installation
- Notify: Security Operations Center

#### Layer 6: Network-Level Enforcement

Even local installations can be blocked via network controls:

```powershell
<#
.SYNOPSIS
    Network-level enforcement to block Claude API access from unauthorized installations
#>

# Approach 1: Client Certificate Requirement
# Configure corporate proxy to require client certificates for api.anthropic.com
# Only processes running from C:\ProgramData\ClaudeCode have access to certificate

# Certificate deployment script
$certPath = "C:\ProgramData\ClaudeCode\certs\claude-client.pfx"
$certPassword = (Get-Content "C:\ProgramData\ClaudeCode\secrets\cert-password.txt" | ConvertTo-SecureString -AsPlainText -Force)

# Install certificate to Computer store (not User store)
Import-PfxCertificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\My -Password $certPassword

# Bind certificate to approved Claude installation
# Only node.exe from approved path can access certificate

# Approach 2: Host-based Firewall with Path Filtering
# Block outbound connections to api.anthropic.com except from approved path

# Create firewall rule with program path restriction
New-NetFirewallRule -DisplayName "Claude Code - API Access (Approved)" `
    -Direction Outbound `
    -Program "C:\Program Files\nodejs\node.exe" `
    -Action Allow `
    -RemoteAddress "api.anthropic.com" `
    -Protocol TCP `
    -RemotePort 443 `
    -Service "*" `
    -Description "Allow Claude API access only via approved installation"

# Note: This allows ALL node.exe processes, but combined with AppLocker
# preventing node.exe from running Claude except in approved path, provides defense-in-depth

# Approach 3: Proxy Authentication Tied to Installation Path
# Corporate proxy configuration example (pseudo-code)
<#
Proxy Rule:
IF (destination == api.anthropic.com) THEN
    IF (source_process_path == "C:\ProgramData\ClaudeCode\npm-global\*") THEN
        ALLOW with authentication
    ELSE
        DENY with message "Unauthorized Claude Code installation"
    END IF
END IF
#>

```

DNS Filtering:

```
# Block api.anthropic.com at DNS level
# Allow only from approved IP addresses / MAC addresses of managed systems

# Example: Windows DNS Server configuration
Add-DnsServerQueryResolutionPolicy -Name "Block-Claude-Unauthorized" `
    -Action DENY `
    -Fqdn "EQ,*.anthropic.com" `
    -ClientSubnet "NE,192.168.100.0/24"  # Enterprise network

```

#### Layer 7: Controlled Folder Access

Windows Defender protection against AppData writes:

```powershell
# Enable Controlled Folder Access
Set-MpPreference -EnableControlledFolderAccess Enabled

# Protect npm directories from unauthorized writes
Add-MpPreference -ControlledFolderAccessProtectedFolders "$env:APPDATA\npm"
Add-MpPreference -ControlledFolderAccessProtectedFolders "$env:LOCALAPPDATA\npm"
Add-MpPreference -ControlledFolderAccessProtectedFolders "$env:USERPROFILE\.npm"

# Allow only approved installers
# Windows Installer, System processes automatically allowed
# This prevents npm.exe from writing to protected folders unless whitelisted

# Verify configuration
Get-MpPreference | Select-Object EnableControlledFolderAccess, ControlledFolderAccessProtectedFolders

```

### 13.3 Automated Detection & Remediation

Comprehensive Security Script:

```powershell
<#
.SYNOPSIS
    Complete security enforcement for Claude Code shadow installations
.DESCRIPTION
    Combines detection, alerting, remediation, and reporting
.EXAMPLE
    .\Enforce-ClaudeCodeSecurity.ps1 -Remediate -Alert
#>

[CmdletBinding()]
param(
    [switch]$Remediate,
    [switch]$Alert,
    [switch]$GenerateReport
)

# Configuration
$config = @{
    ApprovedPath = "C:\ProgramData\ClaudeCode\npm-global"
    LogPath = "C:\ProgramData\ClaudeCode\logs"
    SiemEndpoint = "https://siem.corp.example.com/api/alerts"
}

function Test-NpmConfiguration {
    Write-Host "[1/5] Checking npm configuration..." -ForegroundColor Cyan

    $issues = @()

    # Check global npmrc
    $globalNpmRc = "C:\Program Files\nodejs\npmrc"
    if (Test-Path $globalNpmRc) {
        $content = Get-Content $globalNpmRc -Raw
        if ($content -notmatch "prefix=.*ClaudeCode") {
            $issues += "Global npmrc does not point to enterprise location"
        }

        $isReadOnly = (Get-ItemProperty $globalNpmRc).IsReadOnly
        if (-not $isReadOnly) {
            $issues += "Global npmrc is not read-only"
        }
    } else {
        $issues += "Global npmrc not found"
    }

    # Check for user npmrc overrides
    if (Test-Path "$env:USERPROFILE\.npmrc") {
        $issues += "User has custom .npmrc (may override global settings)"
    }

    return $issues
}

function Find-ShadowInstallations {
    Write-Host "[2/5] Scanning for shadow installations..." -ForegroundColor Cyan

    $shadowInstalls = @()
    $scanPaths = @(
        "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code",
        "$env:LOCALAPPDATA\npm\node_modules\@anthropic-ai\claude-code"
    )

    foreach ($path in $scanPaths) {
        if (Test-Path $path) {
            $shadowInstalls += @{
                Path = $path
                User = $env:USERNAME
                Computer = $env:COMPUTERNAME
                Detected = (Get-Date).ToUniversalTime()
            }
        }
    }

    return $shadowInstalls
}

function Find-UnauthorizedProcesses {
    Write-Host "[3/5] Checking for unauthorized processes..." -ForegroundColor Cyan

    $unauthorized = @()
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

    foreach ($proc in $nodeProcesses) {
        try {
            $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($commandLine -match "claude-code|@anthropic-ai" -and
                $commandLine -notmatch $config.ApprovedPath) {
                $unauthorized += @{
                    PID = $proc.Id
                    CommandLine = $commandLine
                    Path = $proc.Path
                }
            }
        } catch {
            # Process may have exited
        }
    }

    return $unauthorized
}

function Send-SecurityAlert {
    param($AlertData)

    if (-not $Alert) { return }

    Write-Host "[4/5] Sending security alert..." -ForegroundColor Cyan

    $alertPayload = $AlertData | ConvertTo-Json -Depth 10

    try {
        Invoke-RestMethod -Uri $config.SiemEndpoint `
            -Method Post `
            -Body $alertPayload `
            -ContentType "application/json" `
            -TimeoutSec 10
        Write-Host "✓ Alert sent to SIEM" -ForegroundColor Green
    } catch {
        Write-Warning "Failed to send alert: $_"
    }
}

function Invoke-Remediation {
    param($ShadowInstalls, $UnauthorizedProcesses)

    if (-not $Remediate) { return }

    Write-Host "[5/5] Performing remediation..." -ForegroundColor Cyan

    # Remove shadow installations
    foreach ($install in $ShadowInstalls) {
        try {
            Remove-Item $install.Path -Recurse -Force -ErrorAction Stop
            Write-Host "✓ Removed: $($install.Path)" -ForegroundColor Green
        } catch {
            Write-Host "✗ Failed to remove: $($install.Path)" -ForegroundColor Red
        }
    }

    # Kill unauthorized processes
    foreach ($proc in $UnauthorizedProcesses) {
        try {
            Stop-Process -Id $proc.PID -Force -ErrorAction Stop
            Write-Host "✓ Terminated process: PID $($proc.PID)" -ForegroundColor Green
        } catch {
            Write-Host "✗ Failed to terminate: PID $($proc.PID)" -ForegroundColor Red
        }
    }
}

# Main execution
Write-Host "=== Claude Code Security Enforcement ===" -ForegroundColor Yellow
Write-Host ""

# Run checks
$npmIssues = Test-NpmConfiguration
$shadowInstalls = Find-ShadowInstallations
$unauthorizedProcs = Find-UnauthorizedProcesses

# Generate report
$report = @{
    Timestamp = (Get-Date).ToUniversalTime().ToString("o")
    Computer = $env:COMPUTERNAME
    User = $env:USERNAME
    NpmConfigurationIssues = $npmIssues
    ShadowInstallations = $shadowInstalls
    UnauthorizedProcesses = $unauthorizedProcs
    RemediationPerformed = $Remediate
}

# Display results
Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Yellow
Write-Host "npm Configuration Issues: $($npmIssues.Count)" -ForegroundColor $(if ($npmIssues.Count -eq 0) { "Green" } else { "Red" })
Write-Host "Shadow Installations: $($shadowInstalls.Count)" -ForegroundColor $(if ($shadowInstalls.Count -eq 0) { "Green" } else { "Red" })
Write-Host "Unauthorized Processes: $($unauthorizedProcs.Count)" -ForegroundColor $(if ($unauthorizedProcs.Count -eq 0) { "Green" } else { "Red" })

# Alert if violations found
if ($shadowInstalls.Count -gt 0 -or $unauthorizedProcs.Count -gt 0) {
    Send-SecurityAlert -AlertData $report
}

# Remediate if requested
Invoke-Remediation -ShadowInstalls $shadowInstalls -UnauthorizedProcesses $unauthorizedProcs

# Save report
if ($GenerateReport) {
    $reportPath = "$($config.LogPath)\security-enforcement-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report | ConvertTo-Json -Depth 10 | Out-File $reportPath
    Write-Host ""
    Write-Host "Report saved: $reportPath" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== Enforcement Complete ===" -ForegroundColor Green

```

Training Presentation Outline:

Why Shadow IT is Dangerous

- Real-world breach examples
- Cost of non-compliance (GDPR fines, SOC2 violations)
- Career impact

How Enterprise Controls Protect You

- Audit trails for accountability
- Preventing accidental credential leaks
- Compliance with regulations

How to Use Claude Code Correctly

- Verifying approved installation
- Accessing enterprise support
- Reporting issues

What Happens If You Violate Policy

- Detection mechanisms (they WILL find out)
- HR consequences
- Legal implications

### 13.5 Testing & Validation

Penetration Test Scenarios:

```powershell
<#
.SYNOPSIS
    Penetration test for Claude Code shadow installation controls
.DESCRIPTION
    Simulates attacker trying to bypass enterprise controls
    RUN IN ISOLATED TEST ENVIRONMENT ONLY
#>

function Test-ShadowInstallationControls {
    Write-Host "=== Claude Code Security Penetration Test ===" -ForegroundColor Yellow
    Write-Host "WARNING: This test attempts to bypass security controls" -ForegroundColor Red
    Write-Host "Run only in authorized test environment" -ForegroundColor Red
    Write-Host ""

    $results = @()

    # Test 1: Attempt local npm install
    Write-Host "[Test 1] Attempting npm install in AppData..." -ForegroundColor Cyan
    try {
        $output = npm install -g @anthropic-ai/claude-code --prefix=$env:APPDATA\npm 2>&1
        if ($LASTEXITCODE -eq 0) {
            $results += @{Test="Local npm install"; Result="VULNERABLE"; Details="Installation succeeded"}
        } else {
            $results += @{Test="Local npm install"; Result="PROTECTED"; Details="Installation blocked"}
        }
    } catch {
        $results += @{Test="Local npm install"; Result="PROTECTED"; Details="Installation blocked: $_"}
    }

    # Test 2: Attempt to modify npm config
    Write-Host "[Test 2] Attempting to modify npm prefix..." -ForegroundColor Cyan
    try {
        npm config set prefix "$env:LOCALAPPDATA\npm"
        if ($LASTEXITCODE -eq 0) {
            $results += @{Test="npm config modification"; Result="VULNERABLE"; Details="Config change succeeded"}
        } else {
            $results += @{Test="npm config modification"; Result="PROTECTED"; Details="Config change blocked"}
        }
    } catch {
        $results += @{Test="npm config modification"; Result="PROTECTED"; Details="Config change blocked: $_"}
    }

    # Test 3: Attempt to run from unauthorized location
    Write-Host "[Test 3] Attempting execution from AppData..." -ForegroundColor Cyan
    $testPath = "$env:APPDATA\npm\claude.cmd"
    if (Test-Path $testPath) {
        try {
            & $testPath --version 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $results += @{Test="Unauthorized execution"; Result="VULNERABLE"; Details="Execution succeeded"}
            } else {
                $results += @{Test="Unauthorized execution"; Result="PROTECTED"; Details="Execution blocked by AppLocker"}
            }
        } catch {
            $results += @{Test="Unauthorized execution"; Result="PROTECTED"; Details="Execution blocked: $_"}
        }
    } else {
        $results += @{Test="Unauthorized execution"; Result="N/A"; Details="Test file not found"}
    }

    # Test 4: Detection capability
    Write-Host "[Test 4] Testing detection mechanisms..." -ForegroundColor Cyan
    $detectionWorks = $false
    # Check if security script would detect test artifacts
    # (Implementation depends on detection script)
    $results += @{Test="Detection capability"; Result="CHECK LOGS"; Details="Review SIEM for alerts"}

    # Display results
    Write-Host ""
    Write-Host "=== Test Results ===" -ForegroundColor Yellow
    $results | Format-Table -AutoSize

    # Overall assessment
    $vulnerable = ($results | Where-Object { $_.Result -eq "VULNERABLE" }).Count
    if ($vulnerable -eq 0) {
        Write-Host "✓ All tests passed - Controls are effective" -ForegroundColor Green
    } else {
        Write-Host "✗ $vulnerable vulnerabilities found - Review controls" -ForegroundColor Red
    }
}

# Run test
Test-ShadowInstallationControls

```

### 13.6 Deployment Checklist

npm Configuration Lockdown

- Global npmrc configured and read-only
- Registry policy to disable user npmrc
- Deployed via Group Policy

AppLocker Rules

- Deny rules for AppData\npm
- Deny rules for LocalAppData\npm
- Allow rules only for ProgramData\ClaudeCode
- Application Identity service enabled
- Policy deployed and enforced

File System Auditing

- Audit policies enabled (auditpol)
- Audit ACLs configured on npm directories
- Event log forwarding to SIEM configured

Process Monitoring

- Detection script deployed
- Scheduled task created (daily scan)
- Sysmon installed and configured
- Monitoring service running

Defender ATP

- Custom detection rules created
- Alert notifications configured
- Automated response actions enabled

Network Controls

- Firewall rules deployed
- Proxy authentication configured (if applicable)
- DNS filtering enabled (if applicable)

Controlled Folder Access

- Feature enabled
- Protected folders configured
- Allowed applications verified

User Education

- Acceptable Use Policy distributed
- Training sessions conducted
- Policy acknowledgment collected

Testing

- Penetration test performed
- All controls verified effective
- Detection mechanisms validated
- Remediation tested

---

## Conclusion

This comprehensive guide provides enterprise organizations with a complete security framework for deploying Claude Code on Windows. By implementing:

Secure Installation in non-writable paths (ProgramData) Managed Policies with immutable, centrally-controlled configurations Hooks-Based Controls for runtime security enforcement Sensitive File Protection blocking access to credentials and keys Windows System Protection preventing unauthorized system modifications Network Security via proxy, firewall, and TLS configurations DevContainer Isolation for untrusted code environments Comprehensive Auditing with SIEM integration and compliance reporting Windows Security Integration leveraging AppLocker, WDAC, and Defender Shadow Installation Prevention with 7-layer detection and blocking strategy

Organizations can confidently deploy AI-powered development tools while maintaining zero-trust security posture, regulatory compliance, and full audit visibility.

### Critical Security Achievement

This guide addresses the most sophisticated threat vector: developers attempting to bypass enterprise controls through local installations. The multi-layer prevention strategy ensures that even determined users cannot circumvent security policies through:

- npm configuration lockdown
- AppLocker path-based execution blocking
- File system auditing and monitoring
- Real-time process detection and termination
- Defender ATP behavioral analysis
- Network-level access control
- Controlled Folder Access protection

By implementing these controls, organizations achieve defense-in-depth where bypassing one layer triggers detection and remediation at other layers, creating a comprehensive security mesh that protects against both accidental misuse and intentional policy violations.

---

## Additional Resources

Official Documentation:

- Claude Code Security
- Claude Code Hooks Guide
- Claude Code Settings

Microsoft Security:

- AppLocker Overview
- WDAC Documentation
- Controlled Folder Access

Compliance Frameworks:

- SOC 2 Trust Services Criteria
- GDPR Security Requirements
- NIST Cybersecurity Framework

Enterprise AI Security:

- OWASP LLM Top 10
- NIST AI Risk Management Framework
