---
title: What is data classification?
term: Data classification
description: Data classification is labelling data by sensitivity, such as public, internal or restricted, before deciding what may reach an AI tool.
publishDate: 2026-09-08
updatedDate: 2026-11-10
shortDefinition: Data classification means labelling what is in a dataset, document or prompt by sensitivity. Common tiers are public, internal, confidential and restricted. A company can then decide what may reach a given AI tool. That way nobody pastes something in and finds out too late.
definition: |
  NIST's own method for federal systems ties each category to a real question, not a subjective label. The question is what actually happens to confidentiality, integrity or availability if this breaks. That means naming who could see this data, alter it, or take it offline. A scheme built the same way works for AI. That is what makes classification useful for a real decision, not a compliance exercise nobody consults.

  Every new tool a company adopts multiplies the places a given tier could leak from. That is why the scheme has to live inside the AI register, not beside it. Without a scheme, two employees facing the same document reach different answers. The wrong answer usually only surfaces after the data has already left the building through a chat prompt.
relatedTerms:
  - dpia
  - sub-processor
  - guardrails
sources:
  - title: NIST Special Publication 800-60 Vol. 1 Rev. 1 - Guide for Mapping Types of Information and Information Systems to Security Categories
    url: https://csrc.nist.gov/pubs/sp/800/60/v1/r1/final
  - title: ISO/IEC 27001:2022 - Information security management systems
    url: https://www.iso.org/standard/27001
  - title: FIPS 199 - Standards for Security Categorization of Federal Information and Information Systems
    url: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.199.pdf
    publisher: NIST
    retrieved: '2026-11-10'
  - title: NIST SP 800-53 Rev. 5 - Security and Privacy Controls for Information Systems and Organizations
    url: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
    publisher: NIST
    retrieved: '2026-11-10'
  - title: NIST SP 800-60 Rev. 2 (Initial Working Draft) - Guide for Mapping Types of Information and Systems to Security Categories
    url: https://csrc.nist.gov/pubs/sp/800/60/r2/iwd
    publisher: NIST
    retrieved: '2026-11-10'
  - title: Regulation (EU) 2016/679 (GDPR), Articles 9 and 35
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
    publisher: EUR-Lex
    retrieved: '2026-11-10'
  - title: 'OWASP GenAI LLM Top 10 2026, LLM02:2026 Sensitive Information Disclosure'
    url: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/
    publisher: OWASP Gen AI Security Project
    retrieved: '2026-11-10'
---

## Why it comes up

It is the first practical question underneath any AI acceptable use policy. Can this go into that tool? Nobody can answer that until someone has labelled what this actually is. A security reviewer asks for the classification scheme by name, not as an abstract principle. The scheme is what turns a policy from a statement of intent into something an employee can actually follow on a Tuesday afternoon.

## Data classification policy: what it contains and who signs it

A data classification policy states the tiers a company uses, who assigns each label, and what each label allows, including which AI tools may receive which tier. Write one short section per decision:

- Purpose and scope: why the policy exists, and which data, people and tools it covers, including [shadow AI](/glossary/shadow-ai)
- Roles: who owns each dataset and assigns its label, and who owns the policy
- Tiers: the tier names, the test that puts data in each, and the default for unlabelled data
- Records: where each label is written down, including the highest tier each AI tool may receive in the [AI register](/glossary/ai-register)
- Handling: what each tier allows, which AI tools, vendors and [sub-processors](/glossary/sub-processor) may receive it, and which [guardrails](/glossary/guardrails) enforce the rules
- Exceptions: who may approve one, for how long, and where it is logged
- Review: the review date, and the changes that trigger an earlier review
- Sign-off: who approves the policy, and on what date

[NIST FIPS 199](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.199.pdf), published in February 2004, applies to US federal information and systems. It defines three levels of potential impact from a loss of confidentiality, integrity or availability: low, moderate and high. The tests in the example table borrow its words limited, serious and severe. Adapt the tiers, tests and rules to your own data.

| Tier and test                          | Example data                              | Rule for AI tools                                         |
| -------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Public: a leak does no harm            | Published pages, press releases           | Any tool in the AI register                               |
| Internal: a leak does limited harm     | Meeting notes, internal procedures        | Tools in the register, on company accounts only           |
| Confidential: a leak does serious harm | Customer data, personal data, source code | Tools the register approves for this tier                 |
| Restricted: a leak does severe harm    | Credentials, API keys, health data        | None, unless the AI risk owner approves a tool in writing |

A scheme needs an explicit rule for special categories of personal data, such as health data. [Article 9(1) of the GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) prohibits processing them unless a condition in Article 9(2) applies. Article 35(3)(b) names large-scale processing of these categories as a case that requires a [DPIA](/glossary/dpia).

OWASP's [LLM02:2026 Sensitive Information Disclosure](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) lists credentials, API keys and trade secrets as protected information. It treats tool-call arguments, logs and reasoning traces as disclosure surfaces that need "the same classification and redaction rules". It also says to enforce no-train and no-retain rules technically, "rather than policy text alone". So the policy's scope should cover those channels as well as the prompt.

In the [AI Governance Starter Kit](/resources/ai-governance-starter-kit), the AI risk owner signs the data classification table together with whoever owns the data. Put those two names on the policy's sign-off line. Employees who use AI tools for work sign the separate [acceptable use policy](/blog/ai-acceptable-use-policy-for-a-50-person-company), which points at these tiers.

NIST's federal method also names who takes part. In [NIST SP 800-60 Volume 1 Revision 1](https://csrc.nist.gov/pubs/sp/800/60/v1/r1/final), published in August 2008, a four-step process identifies information types, selects provisional impact levels, reviews and adjusts them, then assigns the system's category. The roadmap table lists information owners in steps one, three and four. NIST's Revision 2 is still an [initial working draft](https://csrc.nist.gov/pubs/sp/800/60/r2/iwd), published in January 2024.

Control RA-2 in [NIST SP 800-53 Revision 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) covers approval. It asks the organisation to document each categorisation with its rationale, and to verify that an authorizing official, or that person's designated representative, reviews and approves the decision. As an example mapping, the signatures on the data classification table stand in for that approval. Keep the rationale for each tier beside them.

NIST SP 800-60 also says to revisit a categorisation at least every three years, or when the system or its supporting business lines change significantly. Set your own interval, and name the changes that trigger an earlier review.

## What to do about it

Keep the scheme small. Three or four tiers is enough for most companies, and a scheme nobody can remember gets ignored the same as none. Map every AI tool in the register to which tiers may reach it. Make the most important rule explicit: customer data and secrets never go into an unclassified tool. The [AI Governance Starter Kit](/resources/ai-governance-starter-kit) already includes this table, mapped to what may reach a vendor.
