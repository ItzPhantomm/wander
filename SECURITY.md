# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Architecture & Threat Model

Wander is designed to safely retrieve and process web data for both interactive human users and autonomous AI agents:

1. **SSRF Mitigation**:
   - Strict IP range filtering blocks internal network probing (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, loopback `127.0.0.0/8`, link-local `169.254.0.0/16`, and carrier CGNAT `100.64.0.0/10`).
   - Cloud metadata IP ranges (`169.254.169.254`, `metadata.google.internal`) are blocked.
   - Redirect chains are validated at every hop to prevent redirect-based bypasses.
   - Protocol whitelisting strictly permits `http:` and `https:`.

2. **Terminal Injection Protection**:
   - All external snippets, titles, and URLs are stripped of hazardous ANSI escape sequences (`\x1b[...]`) and unprintable control characters before rendering in terminal emulators.

3. **Prompt Injection Hardening**:
   - When serving tools over the Model Context Protocol (MCP), untrusted search and webpage content is fenced inside isolated XML tags (`<untrusted_web_content source="..."> ... </untrusted_web_content>`).
   - Any malicious embedded closing tags (`</untrusted_web_content>`) are sanitized to neutralize instruction boundary escapes.

## Reporting a Vulnerability

If you discover a security vulnerability in Wander:
1. Please do **NOT** disclose it in public issues.
2. Email the maintainer or submit a Private Vulnerability Advisory on GitHub:
   `https://github.com/ItzPhantomm/wander/security/advisories`
3. We acknowledge receipts within 48 hours and work with you to verify and patch issues.
