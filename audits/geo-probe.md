# GEO probe — measured answers from live engines

Generated-from: 0534b44 (the commit that recorded this probe, before its generator stamped a revision)

Each row is one buyer prompt sent to one engine with retrieval enabled. `cited` means the
engine returned a `meshin.co` URL among its sources. `mentioned` means the answer named the
site or the owner without citing it. `absent` means neither.

| Engine | | | | |
|---|---|---|---|---|
| anthropic | cited: 0 | mentioned: 0 | absent: 30 | searched the web: 22 of 30 |
| gemini | cited: 0 | mentioned: 0 | absent: 30 | searched the web: 7 of 30 |
| openai | cited: 0 | mentioned: 0 | absent: 30 | searched the web: 3 of 30 |
| sonar | cited: 0 | mentioned: 0 | absent: 30 | searched the web: 30 of 30 |

## Who wins the prompts we lose

| # | Prompt | Engine | Retrieved | Cited instead |
|---|---|---|---|---|
| 1 | who is a fractional chief AI officer for a 100-person SaaS company | anthropic | no, answered from memory | nothing |
| 1 | who is a fractional chief AI officer for a 100-person SaaS company | gemini | no, answered from memory | nothing |
| 1 | who is a fractional chief AI officer for a 100-person SaaS company | openai | no, answered from memory | nothing |
| 1 | who is a fractional chief AI officer for a 100-person SaaS company | sonar | yes | umbrex.com, 0260.ai, hartzai.com, linkedin.com |
| 2 | fractional CAIO vs full-time CAIO cost | anthropic | yes | fsagency.co, theaihat.com, aiassemblylines.com, primeai.solutions |
| 2 | fractional CAIO vs full-time CAIO cost | gemini | yes | epcgroup.net, justinmckelvey.com, thehovi.com, fsagency.co |
| 2 | fractional CAIO vs full-time CAIO cost | openai | yes | appliedaileadership.org, heidrick.com, gofractional.com, bls.gov |
| 2 | fractional CAIO vs full-time CAIO cost | sonar | yes | iternal.ai, avihayzanetti.ai, theaihat.com, arqmetrica.com |
| 3 | AI readiness assessment template for SMB | anthropic | no, answered from memory | nothing |
| 3 | AI readiness assessment template for SMB | gemini | no, answered from memory | nothing |
| 3 | AI readiness assessment template for SMB | openai | no, answered from memory | nothing |
| 3 | AI readiness assessment template for SMB | sonar | yes | techsevenpartners.com, surveymonkey.com, acumatica.com, layer3labs.io |
| 4 | AI governance consultant ISO 42001 small company | anthropic | yes | advisera.com, kpmg.com, cloudsecurityalliance.org, hyperproof.io |
| 4 | AI governance consultant ISO 42001 small company | gemini | no, answered from memory | nothing |
| 4 | AI governance consultant ISO 42001 small company | openai | no, answered from memory | nothing |
| 4 | AI governance consultant ISO 42001 small company | sonar | yes | bdemerson.com, aimsready.com, dionach.com, grcsolutions.io |
| 5 | named person responsible for AI risk in vendor procurement | anthropic | yes | eisneramper.com, onetrust.com, pwc.com, isms.online |
| 5 | named person responsible for AI risk in vendor procurement | gemini | yes | optro.ai, isms.online, aigovernancecore.com, mcallistercompliancegroup.com |
| 5 | named person responsible for AI risk in vendor procurement | openai | no, answered from memory | nothing |
| 5 | named person responsible for AI risk in vendor procurement | sonar | yes | ibm.com, isms.online, boardcloud.us, pwc.com |
| 6 | how to build an AI system register | anthropic | yes | medium.com, elevateconsult.com, mlflow.org, 2021.ai |
| 6 | how to build an AI system register | gemini | no, answered from memory | nothing |
| 6 | how to build an AI system register | openai | no, answered from memory | nothing |
| 6 | how to build an AI system register | sonar | yes | linkedin.com, aitrustcert.com, pranoti.thesciencetalk.com, agility-at-scale.com |
| 7 | AI acceptable use policy template | anthropic | yes | isaca.org, frsecure.com, tenable.com, purplesec.us |
| 7 | AI acceptable use policy template | gemini | no, answered from memory | nothing |
| 7 | AI acceptable use policy template | openai | no, answered from memory | nothing |
| 7 | AI acceptable use policy template | sonar | yes | shadowaipolicy.com, aigovguide.org, aona.ai, frsecure.com |
| 8 | EU AI Act obligations for deployers small business | anthropic | yes | knowledge.dlapiper.com, artificialintelligenceact.eu, iapp.org, sentra.io |
| 8 | EU AI Act obligations for deployers small business | gemini | yes | wpseoai.com, taylorwessing.com, regumatrix.eu, digital4business.eu |
| 8 | EU AI Act obligations for deployers small business | openai | yes | eur-lex.europa.eu, ai-act-service-desk.ec.europa.eu, digital-strategy.ec.europa.eu |
| 8 | EU AI Act obligations for deployers small business | sonar | yes | regulation-ai.eu, aiactbase.eu, artificialintelligenceact.eu, regumatrix.eu |
| 9 | why do AI pilots fail to reach production | anthropic | yes | witness.ai, firstlinesoftware.com, digitaldividedata.com, zbrain.ai |
| 9 | why do AI pilots fail to reach production | gemini | no, answered from memory | nothing |
| 9 | why do AI pilots fail to reach production | openai | no, answered from memory | nothing |
| 9 | why do AI pilots fail to reach production | sonar | yes | unifyapps.com, forbes.com, mindstudio.ai, fountaincity.tech |
| 10 | LLM gateway for governance and audit | anthropic | yes | langchain.com, braintrust.dev, github.com, solo.io |
| 10 | LLM gateway for governance and audit | gemini | no, answered from memory | nothing |
| 10 | LLM gateway for governance and audit | openai | no, answered from memory | nothing |
| 10 | LLM gateway for governance and audit | sonar | yes | truefoundry.com, cequence.ai, getmaxim.ai, openrouter.ai |
| 11 | how to put evals for AI agents into CI | anthropic | yes | galileo.ai, kinde.com, arize.com, mabl.com |
| 11 | how to put evals for AI agents into CI | gemini | no, answered from memory | nothing |
| 11 | how to put evals for AI agents into CI | openai | no, answered from memory | nothing |
| 11 | how to put evals for AI agents into CI | sonar | yes | agentcenter.cloud, tessary.ai, agenticwire.news, agent-ci.com |
| 12 | AI vendor assessment questionnaire template | anthropic | no, answered from memory | nothing |
| 12 | AI vendor assessment questionnaire template | gemini | no, answered from memory | nothing |
| 12 | AI vendor assessment questionnaire template | openai | no, answered from memory | nothing |
| 12 | AI vendor assessment questionnaire template | sonar | yes | airuntimesecurity.io, aigovernance.com, learntprm.com, aona.ai |
| 13 | build vs buy AI 3-year TCO | anthropic | yes | atlan.com, cmarix.com, hp.com, fastgpt.io |
| 13 | build vs buy AI 3-year TCO | gemini | no, answered from memory | nothing |
| 13 | build vs buy AI 3-year TCO | openai | no, answered from memory | nothing |
| 13 | build vs buy AI 3-year TCO | sonar | yes | linkedin.com, slavin.ai, expertaiprompts.blog, neomanex.com |
| 14 | AI operating model for mid-size company | anthropic | yes | technijian.com, govirtualoffice.com, nmsconsulting.com, prometheusagency.co |
| 14 | AI operating model for mid-size company | gemini | no, answered from memory | nothing |
| 14 | AI operating model for mid-size company | openai | no, answered from memory | nothing |
| 14 | AI operating model for mid-size company | sonar | yes | escalategroup.com, gtframe.io, pertamapartners.com, agrahri.com |
| 15 | how to hand over AI leadership to internal team | anthropic | no, answered from memory | nothing |
| 15 | how to hand over AI leadership to internal team | gemini | no, answered from memory | nothing |
| 15 | how to hand over AI leadership to internal team | openai | no, answered from memory | nothing |
| 15 | how to hand over AI leadership to internal team | sonar | yes | agathon.ai, sherwen.com, launch-ai.io, 51d.co |
| 16 | fractional AI officer Israel | anthropic | yes | gofractional.com, fayedigital.com, chiefaiofficer.com, iffelinternational.com |
| 16 | fractional AI officer Israel | gemini | yes | cywayz.co.il, elevateagents.ai, fractionalcaio.org, intellivise.ai |
| 16 | fractional AI officer Israel | openai | no, answered from memory | nothing |
| 16 | fractional AI officer Israel | sonar | yes | avihayzanetti.ai, linkedin.com, trifoldtechnologies.com, ctodirectory.com |
| 17 | fractional AI leader Europe remote | anthropic | yes | gofractional.com, kore1.com, fractionaljobs.io, pearltalent.com |
| 17 | fractional AI leader Europe remote | gemini | no, answered from memory | nothing |
| 17 | fractional AI leader Europe remote | openai | no, answered from memory | nothing |
| 17 | fractional AI leader Europe remote | sonar | yes | unplexed.com, fractional-csuite.com, gofractional.com, join.com |
| 18 | agentic automation consultant for B2B | anthropic | yes | simon-kucher.com, commercetools.com, cdomagazine.tech, abmagency.com |
| 18 | agentic automation consultant for B2B | gemini | no, answered from memory | nothing |
| 18 | agentic automation consultant for B2B | openai | no, answered from memory | nothing |
| 18 | agentic automation consultant for B2B | sonar | yes | stackconsulting.pro, techaheadcorp.com, etumos.com, smartaiworkspace.tech |
| 19 | MCP security best practices | anthropic | yes | truefoundry.com, labs.cloudsecurityalliance.org, socprime.com, cycognito.com |
| 19 | MCP security best practices | gemini | no, answered from memory | nothing |
| 19 | MCP security best practices | openai | no, answered from memory | nothing |
| 19 | MCP security best practices | sonar | yes | obot.ai, cheatsheetseries.owasp.org, modelcontextprotocol.io, labs.cloudsecurityalliance.org |
| 20 | multi-agent reference architecture production | anthropic | yes | microsoft.github.io, github.com, docs.cloud.google.com, aws.amazon.com |
| 20 | multi-agent reference architecture production | gemini | no, answered from memory | nothing |
| 20 | multi-agent reference architecture production | openai | no, answered from memory | nothing |
| 20 | multi-agent reference architecture production | sonar | yes | microsoft.github.io, arxiv.org, markaicode.com, linkedin.com |
| 21 | adoption telemetry for AI tools | anthropic | yes | netguru.com, getpanto.ai, ventionteams.com, walkme.com |
| 21 | adoption telemetry for AI tools | gemini | no, answered from memory | nothing |
| 21 | adoption telemetry for AI tools | openai | no, answered from memory | nothing |
| 21 | adoption telemetry for AI tools | sonar | yes | arxiv.org, apploretechnologies.com, hivel.ai, honeycomb.io |
| 22 | AI incident response plan template | anthropic | no, answered from memory | nothing |
| 22 | AI incident response plan template | gemini | no, answered from memory | nothing |
| 22 | AI incident response plan template | openai | no, answered from memory | nothing |
| 22 | AI incident response plan template | sonar | yes | areebi.com, purplesec.us, pertamapartners.com, theworldofai.org |
| 23 | data classification for LLM usage | anthropic | no, answered from memory | nothing |
| 23 | data classification for LLM usage | gemini | no, answered from memory | nothing |
| 23 | data classification for LLM usage | openai | no, answered from memory | nothing |
| 23 | data classification for LLM usage | sonar | yes | engineering.grab.com, rainz.ai, ethyca.com, varonis.com |
| 24 | ISO 42001 gap assessment | anthropic | yes | schellman.com, isms.online, ispartnersllc.com, uk.grcsolutions.io |
| 24 | ISO 42001 gap assessment | gemini | no, answered from memory | nothing |
| 24 | ISO 42001 gap assessment | openai | no, answered from memory | nothing |
| 24 | ISO 42001 gap assessment | sonar | yes | aiactindex.eu, isms.online, der-ki-auditor.de, viritux.com |
| 25 | NIST AI RMF for small companies | anthropic | yes | securiti.ai, netsolutions.com, paloaltonetworks.com, orca.security |
| 25 | NIST AI RMF for small companies | gemini | no, answered from memory | nothing |
| 25 | NIST AI RMF for small companies | openai | no, answered from memory | nothing |
| 25 | NIST AI RMF for small companies | sonar | yes | nist.gov, diligent.com, airc.nist.gov, nvlpubs.nist.gov |
| 26 | fractional CAIO pricing | anthropic | yes | kore1.com, uvik.net, hireafractionalexec.com, paul-okhrem.com |
| 26 | fractional CAIO pricing | gemini | yes | iternal.ai, precisionlogic.ai, avihayzanetti.ai, automationtransformationconsulting.com |
| 26 | fractional CAIO pricing | openai | no, answered from memory | nothing |
| 26 | fractional CAIO pricing | sonar | yes | fractionalcaio.org, iternal.ai, paul-okhrem.com, agrahri.com |
| 27 | what does a chief AI officer do in a 50 person company | anthropic | no, answered from memory | nothing |
| 27 | what does a chief AI officer do in a 50 person company | gemini | no, answered from memory | nothing |
| 27 | what does a chief AI officer do in a 50 person company | openai | no, answered from memory | nothing |
| 27 | what does a chief AI officer do in a 50 person company | sonar | yes | searchsvc.com, bluemetrics.ai, justinmckelvey.com, him-business-school.com |
| 28 | AI governance starter kit open source | anthropic | yes | helpnetsecurity.com, github.com, opensource.microsoft.com, dev.to |
| 28 | AI governance starter kit open source | gemini | yes | aigovernancestack.com, verifywise.ai, github.com, flowtivity.ai |
| 28 | AI governance starter kit open source | openai | yes | github.com, nist.gov, opensource.microsoft.com |
| 28 | AI governance starter kit open source | sonar | yes | github.com, opensource.microsoft.com, ithub.global.ssl.fastly.net, sovaihub.com |
| 29 | AI readiness scorecard five drivers | anthropic | yes | intuz.com, data-sleek.com, adoption.microsoft.com, matthewkruczek.ai |
| 29 | AI readiness scorecard five drivers | gemini | yes | teamvoy.com, adoption.microsoft.com, forbes.com, scribd.com |
| 29 | AI readiness scorecard five drivers | openai | no, answered from memory | nothing |
| 29 | AI readiness scorecard five drivers | sonar | yes | pwc.com, data-sleek.com, n-ix.com, leadtheshift.org |
| 30 | board memo AI strategy one page | anthropic | no, answered from memory | nothing |
| 30 | board memo AI strategy one page | gemini | no, answered from memory | nothing |
| 30 | board memo AI strategy one page | openai | no, answered from memory | nothing |
| 30 | board memo AI strategy one page | sonar | yes | getdatatruth.com, askajay.ai, clarityarc.com, phosailabs.com |

## Method

Engines queried: openai (gpt-5, web_search tool); anthropic (claude-sonnet-4-5-20250929, web_search tool); gemini (gemini-flash-latest, google_search grounding); sonar (perplexity/sonar, native search). No engine was skipped. Keys are read from the environment at run time. This artifact records variable names only, never a value.
