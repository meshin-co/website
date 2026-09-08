export const categoryPillars = {
  governance: {
    title: 'AI governance',
    description:
      'What AI governance means in a company of 30 to 300 people, and the smallest set of documents that survives a security review.',
    body: [
      'Governance has a bad name in small companies because most of what is sold under that name is written for a bank. A three hundred person company does not need a committee, a maturity model or a consultant to run a workshop. It needs four things that fit on a shared drive and get updated when something changes.',
      'The first is a register: every AI system in use, who owns it, what data reaches it, and whether a person checks its output before a customer sees it. Most companies discover during this exercise that they have twice as many AI systems as they thought, because someone in marketing signed up for a tool with a credit card and nobody wrote it down.',
      'The second is an acceptable-use policy short enough that people read it. One page. What you may paste into a chat window, what you may not, and who to ask when the answer is unclear. A policy that requires a training course to understand is a policy that gets ignored by the people whose behaviour it was written to change.',
      'The third is a data classification table. Three or four tiers, each with a rule about which vendors may see that tier. This is the document that answers most of a customer security questionnaire, and it is the one companies most often skip because it requires a decision rather than a description.',
      'The fourth is a named owner. Not a committee, not a working group, one person whose job description says they own AI risk and who has the authority to stop a launch. Frameworks like ISO/IEC 42001 and the NIST AI Risk Management Framework both assume this person exists. Without them, every answer in a questionnaire is a guess, and every incident becomes a search for who should have been watching.',
      'That is the whole set. It takes about two weeks to produce honestly, and the honest version is worth more than a thorough version that describes a company you are not. When a customer asks who owns AI risk, or a board asks what happens if a model leaks a document, you want to answer from a document that was true last week, not from one that was impressive last year.',
    ],
  },
  'agentic-architecture': {
    title: 'Agentic architecture',
    description:
      'How to build agent systems that survive contact with production: evals in CI, tracing, cost ceilings and a rollback path.',
    body: [
      'An agent demo is easy and an agent in production is not, and the gap between them is almost never about the model. It is about the same engineering discipline any other system needs, applied to a component whose output is not deterministic.',
      'Start with evaluation, before the prompt. If you cannot say what a good answer looks like on a set of real cases, you cannot tell whether a change made the system better or simply different. Build the eval set from work that has already been done by people, so there is a known-good answer to compare against, and sample it across a long enough window that seasonality does not flatter you.',
      'Put that eval run in continuous integration. This is the single change that most often turns a prototype into something a team will let near a customer, because it moves the question from an argument about vibes to a number that blocks a merge. A regression should fail the build, in the same job, with the same authority as a broken unit test.',
      'Instrument every call. When an answer is wrong you want to see which retrieval returned which document and what the model was given, not reconstruct it from memory. Tracing turns a support escalation into a fifteen minute investigation instead of a day of guessing.',
      'Set a cost ceiling per outcome and check it in the same job as the evals. Agent systems fail commercially long before they fail technically: a loop that retries three times on a bad tool response is fine in a demo and ruinous at volume. If you cannot state the cost of one completed task, you do not yet know whether the system makes sense.',
      'Then design the boundary. Tool interfaces are where agents actually break, which is why protocols such as the Model Context Protocol are useful: they make the contract between the model and your systems explicit rather than improvised inside a prompt. Keep the tools narrow, validate their inputs, and make every destructive action reversible.',
      'Finally, keep a rollback path. A prompt is a deployment. Version it, ship it behind the same controls as code, and be able to put yesterday back in five minutes.',
    ],
  },
  'operating-model': {
    title: 'AI operating model',
    description:
      'Who decides what, who reviews it, and how AI work moves from a pilot nobody owns to a process a team runs.',
    body: [
      'Most stalled AI programmes are not blocked on technology. They are blocked because nobody can say who decides whether a system is allowed to touch customer data, and nobody owns the outcome once the pilot team moves on.',
      'An operating model answers three questions. Who chooses which processes get automated. Who reviews a system before it reaches a customer. Who runs it afterwards. If the answer to any of those is a team name rather than a person, the work will drift until someone senior gets nervous and stops it.',
      'Choice comes first, and it is mostly a filter. A candidate process needs volume, a measurable outcome, and a tolerable failure mode. Volume, because a system used twice a week never accumulates enough signal to improve. A measurable outcome, because a metric you have to survey for cannot gate a release. A tolerable failure mode, because the first version will be wrong sometimes and you need to know what that costs.',
      'Review comes second. It should be boring and written down: what evidence a launch needs, who signs, and what evidence would stop it. In practice this is a short checklist attached to the register entry, not a governance ceremony. The point is that the answer exists before someone needs it at eleven at night.',
      'Ownership comes third and is the one that gets skipped. A pilot that reaches production without a named internal owner becomes shadow infrastructure: nobody updates it, nobody watches its cost, and its failure surprises everyone. Handover is a deliverable. It needs a runbook, a dashboard someone actually looks at, and a person whose job includes looking at it.',
      'This is also why fractional works for companies of this size. You need the decisions made properly once, written down, and handed to someone inside the company. You do not need a permanent executive to maintain four documents and a review checklist. An engagement that does not end has usually replaced an operating model rather than built one.',
    ],
  },
  executive: {
    title: 'For boards and executives',
    description:
      'What a board should ask about AI, what an honest answer looks like, and which numbers are worth putting in a pack.',
    body: [
      'Boards are being asked to sign statements about AI risk that nobody in the company has the evidence to support. The gap is rarely dishonesty. It is that the questions arriving from customers and insurers are specific, and the material available internally is a slide about opportunity.',
      'There are four questions worth asking, and each has a short honest answer or a gap. Who owns AI risk here, by name. Which AI systems are in use and what data reaches them. What happens if a model produces something harmful and a customer sees it. And what we have told customers in questionnaires that we cannot currently prove.',
      'The last one causes the most trouble. Sales teams answer security questionnaires under deadline, and the answers become commitments. When a customer later audits against them, the company discovers it has promised a review process that exists only in the answer. Reconciling the questionnaire answers against reality is usually a week of work and always uncomfortable.',
      'For the pack itself, three numbers travel well. The share of AI systems in the register with a named owner and a data classification. The number of processes running in production with automated evaluation, as opposed to pilots. And cost per completed outcome for anything at volume, because that is the number that tells you whether the programme is a business or a science project.',
      'What does not belong in a pack: model counts, tokens processed, pilots launched. They measure activity, and activity is what a stalled programme produces most of.',
      'The uncomfortable part is that the honest version of this material is short and shows gaps. That is the version worth having. A board that knows about three gaps can decide which two to fund. A board holding an impressive summary of a company that does not exist cannot decide anything, and finds out when a customer or a regulator asks a question the summary was never built to answer.',
    ],
  },
};
