---
title: Licence specimen
name: Licence specimen
type: kit
description: 'A planted resource entry that declares a license while no licence text ships, so the build must refuse it.'
publishDate: 2026-10-25
updatedDate: 2026-10-25
version: '0.1'
license: Specimen-1.0
status: Specimen only. It never ships.
whatInside:
  - One line, because the schema needs at least one entry.
howToUse: Nothing to use. The mutation smoke plants this file and expects the build to fail.
sources:
  - title: AI Risk Management Framework
    url: https://www.nist.gov/itl/ai-risk-management-framework
    publisher: NIST
    retrieved: '2026-10-25'
---

Specimen body. The mutation smoke drops this file into `src/data/resource/` and asserts `astro build`
exits non-zero naming the `license` field.
