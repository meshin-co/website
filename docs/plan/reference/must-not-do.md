# What each phase must not do

Rejected as overengineering after the ADHD passes. Written down so they do not creep back in:

- No dependency-DAG replacement for the phase order. Phases stay linear.
- No calibration gate on every file write, and no pre-push hook running Lighthouse.
- No automated rollback infrastructure or signed build manifests.
- No content-hash honesty check on `updatedDate`, no filler-word density metric.
- No full-page HTML snapshot tests, no OCR of OG images (compare satori's text nodes instead).
- No third-party service beyond Plausible. No cookies. No client framework.

---
