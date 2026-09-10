# Security Policy

## Supported Versions

Only the latest release/main branch of this project is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Main    | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

As an open-source cybersecurity risk analysis tool, we take security vulnerabilities very seriously. If you believe you have found a security vulnerability in this project, please report it to us responsibly.

**Please DO NOT open a public issue or discuss the vulnerability publicly.**

### How to Report

You can report vulnerabilities using one of the following methods:

1. **GitHub Private Vulnerability Reporting (Preferred):**  
   Go to the **Security** tab of this repository, click on **Advisories**, and submit a private report.
2. **Email:**  
   Send an email with full details to [brice.dudout@gmail.com](mailto:brice.dudout@gmail.com).

### What to Include in Your Report

To help us better understand and resolve the issue, please include:
- A description of the vulnerability and its potential impact.
- Clear step-by-step instructions or a Proof of Concept (PoC) to reproduce the issue.
- Any suggested remediations or patches, if available.

### Response & Disclosure Policy

- **Acknowledgement:** We will acknowledge receipt of your report within 48 hours.
- **Assessment & Patching:** We will assess the risk, work on a fix, and notify you once a release/patch is ready.
- **Public Disclosure:** Once the vulnerability is resolved, a security advisory will be published with credit given to the reporter (unless requested otherwise).

Thank you for helping keep this project and its users safe!

## Dependency advisories & remediations

Dependency advisories that cannot be fixed by a normal upgrade are handled with a
pinned `overrides` entry in `package.json` (the project's standard mechanism, also
used for esbuild, postcss, js-yaml, etc.) and documented here for traceability.

### `image-size` — CVE-2025-71330 / CVE-2025-71329 (High, DoS)

- **Advisories:** GHSA-w3rx-r6r6-pgpr (ICNS parser, CVE-2025-71330) and
  GHSA-5p2g-fcmc-qvqq (JXL/HEIF/JP2 parsers, CVE-2025-71329). Infinite-loop
  denial of service on a crafted image buffer.
- **Path:** transitive only — `image-size` is pulled by `pptxgenjs@4.0.1`; it is
  not a direct dependency and is never imported by our code.
- **Upstream status:** the original `image-size` repository is **archived** and its
  last release (2.0.2) remains affected (no official patch expected). npm's only
  proposed fix is a breaking major downgrade of `pptxgenjs` (4.0.1 → 1.1.5), which
  would regress deck generation.
- **Remediation applied:** `overrides` pins `image-size` to the maintained
  community drop-in **`image-size-next@2.1.1`** (same public API, fixes both CVEs).
  Version pinned exactly so fork updates are never pulled silently. After this,
  `npm audit` reports **0 vulnerabilities** and the vulnerable package is no longer
  in the tree. As a second line of defence, our PPTX generators embed no bitmaps
  (**zero `addImage` calls**), so the parser code path is not reached regardless.
- **Revisit** if/when `pptxgenjs` bumps its own `image-size` dependency to a fixed
  release — the override can then be removed.
