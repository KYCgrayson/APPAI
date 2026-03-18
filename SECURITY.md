# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AppAI, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub's private vulnerability reporting](https://github.com/KYCgrayson/AIGA/security/advisories/new) to submit your report.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Resolution target**: Within 30 days for critical issues

## Scope

The following are in scope:
- AppAI web application (appai.info)
- AppAI API (`/api/v1/*`)
- Authentication flows (OAuth, Device Authorization)

The following are out of scope:
- Third-party services and dependencies
- Social engineering attacks
- Denial of service attacks

## Security Measures

AppAI implements the following security measures:
- API keys stored as SHA-256 hashes only
- AES-256-GCM encryption for temporary auth data
- HSTS with preload
- CSRF protection
- Rate limiting
- Input sanitization (XSS, SSRF prevention)
- Database connections over SSL

Thank you for helping keep AppAI secure.
