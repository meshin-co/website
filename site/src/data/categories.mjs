export const categoryPillars = {
  governance: {
    title: 'AI governance',
    archiveTitle: 'AI governance articles',
    description:
      'Articles on AI governance for companies of 30 to 300 people: the register, acceptable-use policy, data classification and a named owner.',
    body: [
      'Governance has a bad name in small companies because most of what is sold under that name is written for a bank. A three hundred person company does not need a committee, a maturity model or a consultant to run a workshop. It needs four things that fit on a shared drive and get updated when something changes.',
      'The first is a register: every AI system in use, who owns it, what data reaches it. It also records whether a person checks its output before a customer sees it. Companies usually find more AI in the building than they expected, because someone signed up for a tool with a credit card and nobody wrote it down.',
      'The second is an acceptable-use policy short enough that people read it. One page. What you may paste into a chat window, what you may not, and who to ask when the answer is unclear. A policy that requires a training course to understand is a policy that gets ignored by the people whose behaviour it was written to change.',
      'The third is a data classification table. Three or four tiers, each with a rule about which vendors may see that tier. This is the document that answers most of a customer security questionnaire. It is also the one companies most often skip, because it requires a decision rather than a description.',
      'The fourth is a named owner: one person whose job description says they own AI risk and who has the authority to stop a launch. Frameworks like ISO/IEC 42001 and the NIST AI Risk Management Framework both assume this person exists. Without them, every answer in a questionnaire is a guess, and every incident becomes a search for who should have been watching.',
      'That is the whole set. It takes about two weeks to produce honestly, and the honest version is worth more than a thorough version that describes a company you are not. A customer may ask who owns AI risk. A board may ask what happens if a model leaks a document. Either way, you want to answer from a document that was true last week, not one that was impressive last year.',
    ],
  },
  'agentic-architecture': {
    title: 'Agentic architecture',
    archiveTitle: 'Agentic architecture articles',
    description:
      'Articles on agentic architecture for production: evals in CI, tracing, cost ceilings and a rollback path for agent systems.',
    body: [
      'An agent demo is easy and an agent in production is not, and the gap between them is almost never about the model. It is about the same engineering discipline any other system needs, applied to a component whose output is not deterministic.',
      'Start with evaluation, before the prompt. You need to say what a good answer looks like on a set of real cases. Otherwise you cannot tell whether a change made the system better or simply different. Build the eval set from work people have already done, so there is a known-good answer to compare against. Sample it across a window long enough that seasonality does not flatter you.',
      'Put that eval run in continuous integration. This is the single change that most often turns a prototype into something a team will let near a customer. It moves the question from an argument about vibes to a number that blocks a merge. A regression should fail the build, in the same job, with the same authority as a broken unit test.',
      'Instrument every call. When an answer is wrong you want to see which retrieval returned which document and what the model was given, not reconstruct it from memory. Tracing turns a support escalation into a quick check instead of a day of guessing.',
      'Set a cost ceiling per outcome and check it in the same job as the evals. A loop that retries three times on a bad tool response is fine in a demo and ruinous at volume. If you cannot state the cost of one completed task, you do not yet know whether the system makes sense.',
      'Then design the boundary. Tool interfaces are where agents actually break. That is why an explicit protocol between the model and your systems is worth adopting, rather than one improvised inside a prompt. Keep the tools narrow, validate their inputs, and make every destructive action reversible.',
      'Finally, keep a rollback path. A prompt is a deployment. Version it, ship it behind the same controls as code, and be able to put yesterday back quickly.',
    ],
  },
  'operating-model': {
    title: 'AI operating model',
    description:
      'An AI operating model is the decision structure that moves AI work from a pilot nobody owns to a process a team runs.',
    body: [
      'Most stalled AI programmes are not blocked on technology. They are blocked because nobody can say who decides whether a system is allowed to touch customer data. Nobody owns the outcome once the pilot team moves on, either.',
      'An operating model answers three questions. Who chooses which processes get automated. Who reviews a system before it reaches a customer. Who runs it afterwards. If the answer to any of those is a team name rather than a person, the work will drift until someone senior gets nervous and stops it.',
      'Choice comes first, and it is mostly a filter. A candidate process needs volume, a measurable outcome, and a tolerable failure mode. Volume, because a system used twice a week never accumulates enough signal to improve. A measurable outcome, because a metric you have to survey for cannot gate a release. A tolerable failure mode, because the first version will be wrong sometimes and you need to know what that costs.',
      'Review comes second. It should be boring and written down: what evidence a launch needs, who signs, and what evidence would stop it. In practice this is a short checklist attached to the register entry, not a governance ceremony. The point is that the answer exists before someone needs it at eleven at night.',
      'Ownership comes third and is the one that gets skipped. A pilot that reaches production without a named internal owner becomes shadow infrastructure: nobody updates it, nobody watches its cost, and its failure surprises everyone. Handover is a deliverable, not a formality, and it only counts once someone is actually watching the dashboard.',
      'This is also why fractional works for companies of this size. You need the decisions made properly once, written down, and handed to someone inside the company. You do not need a permanent executive to maintain four documents and a review checklist. An engagement that does not end has usually replaced an operating model rather than built one.',
    ],
  },
  executive: {
    title: 'AI for boards',
    description:
      'AI for boards is accountability, not literacy: what you are on the hook for, what to ask for in writing, and what not to ask for.',
    body: [
      'A board does not need a member who can explain how a model works. It needs to know who inside the company is answerable when one gets something wrong in front of a customer. It also needs to know whether that answer would survive being read back in a dispute. Ask that question at every review, not just the first one.',
      'Ask for three things, by name rather than by department. Who owns AI risk, specifically, not which team owns it. A register of every AI system in use, kept current rather than produced once for an audit. And the last time a customer or a regulator asked a question about this, with the answer that was actually given. Anything less than a name is not an answer.',
      'Do not ask for a demo. A demo proves a model can perform once, in front of people who want it to succeed, which is the least useful thing a board can learn. Do not ask for a token count, a model name, or a list of pilots. Those measure activity, not risk, and a company can produce an impressive slide about all three without anyone being accountable for one of them.',
      'The exposure that actually matters shows up after something goes wrong, not before. A regulator or an insurer will not ask whether the model was good. They will ask whether someone reviewed the system before it reached a customer. They will also ask whether that review is written down, and whether the questionnaire answer was still true afterwards. A board that has not asked those questions is the one that gets asked them first.',
      'A company of 30 to 300 people needs one named owner, one page of decisions, and the discipline to update both when something changes. A board does this well by asking the same few questions until the answers stop moving.',
    ],
  },
};

export const archiveTitleOf = (pillar) => pillar.archiveTitle ?? pillar.title;
