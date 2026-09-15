import { yearsShipping } from '~/utils/experience.mjs';

export const hero = {
  title: 'A Fractional Chief AI Officer',
  titleAccent: 'you can name on the org chart.',
  sub: "I'm the fractional chief AI officer your org chart can point at when a customer asks who owns AI risk. I set up the governance an enterprise security review asks for, then get one process live for real users, with evals, tracing, a rollback path and a cost per outcome.",
  proof: ['Open-source AI Governance Starter Kit', 'ISO/IEC 42001 Lead Implementer course in progress'],
  ctaLabel: 'Book a 30-min fit call',
  ctaHref: 'https://cal.com/meshin',
};

export const signals = {
  items: [
    "You've run several AI pilots and none is in production.",
    'Your board or investors are asking for an AI strategy and nobody owns it.',
    'Nobody can say which company data employees are pasting into public models.',
    "A customer's procurement team asked who is accountable for your AI risks, and the deal stalled.",
    'AI budget is being spent, but no process has actually changed.',
  ],
  verdict: "Three or more of these five signs? You're exactly who this is for.",
};

export const services = [
  {
    name: 'AI Readiness & Risk Assessment',
    feeShape: 'Fixed fee',
    duration: '2 weeks',
    outcome:
      'Two weeks of interviews and reading your systems, ending in a memo your board can act on. You learn exactly where you stand, what a customer audit would find, and which three processes are worth automating first.',
    deliverables: [
      'Readiness score across strategy, data, delivery, people and governance',
      'Gap list against NIST AI RMF, ISO/IEC 42001 and the EU AI Act',
      'Inventory of the AI tools and data flows already in the building',
      'Fee credited if you go on to a Sprint',
    ],
  },
  {
    name: '90-Day Production Sprint',
    feeShape: 'Fixed scope, quoted once',
    duration: '90 days',
    outcome:
      'Ninety days to get one process running in production and keep it there. I build it with your engineers rather than beside them, so your team can change it after I leave.',
    deliverables: [
      'One agentic workflow live, with rollback and a named owner',
      'Evals in CI, so a prompt or model change cannot ship unnoticed',
      'Tracing and cost per outcome on a dashboard your CFO can read',
      'A success number written into the SOW before I start',
    ],
  },
  {
    name: 'Fractional CAIO Retainer',
    feeShape: 'Monthly fee',
    duration: '1–2 days a week',
    outcome:
      'One or two days a week as the AI officer your customers can ask for by name. The week is procurement answers, design reviews and a board update, in that order of urgency.',
    deliverables: [
      'Named officer for security questionnaires, contracts and audits',
      'Quarterly roadmap with a budget next to each item',
      'Review of every AI initiative, including the shadow tools nobody approved',
      'Handover plan, so an internal owner can run this without me',
    ],
  },
];

export const drivers = [
  {
    name: 'Data readiness',
    detail: 'What you hold, who owns it, and what may reach a model.',
  },
  {
    name: 'Process fit',
    detail: 'Enough volume and a number worth automating.',
  },
  {
    name: 'Governance',
    detail: 'The paperwork procurement will actually ask to see.',
  },
  {
    name: 'Engineering capability',
    detail: 'Evals, tracing and a rollback your team can run.',
  },
  {
    name: 'Adoption',
    detail: 'Telemetry, not a launch email, says if it lasted.',
  },
  {
    name: 'Handover',
    detail: 'A named owner and a fixed end date.',
  },
];

export const artifacts = [
  {
    name: 'AI Governance Starter Kit',
    summary:
      'The paperwork that gets an AI system past a corporate security review: register, acceptable-use policy, data classification, and a vendor questionnaire you can fill in.',
    format: 'Repo · templates',
    status: 'Written out in full on its own page',
  },
  {
    name: 'AI Readiness Scorecard',
    summary:
      'The five-driver model from the Assessment, with the questions behind each score, so you can run a first pass without me.',
    format: 'Repo · spreadsheet',
    status: 'Written out in full on its own page',
  },
  {
    name: 'Agent Evals CI Starter',
    summary:
      'A small harness that runs evals on an agentic system inside CI and records cost and latency for every run.',
    format: 'Repo · CI workflow',
    status: 'Written out in full on its own page',
  },
];

export const cta = {
  title: 'Start with a 30-minute fit call.',
  body: 'No slides. I go through where you actually stand, and I tell you whether an Assessment is worth your money. If it is not, I say so.',
  label: 'Book a 30-min fit call',
  href: 'https://cal.com/meshin',
  note: 'Or email hello@meshin.co',
};

export const figures = [
  { value: `${yearsShipping(Date.now())}+`, label: 'years building and shipping software' },
  { value: '1,000+', label: 'person fraud-detection company, my day job as a platform engineer' },
  { value: '3', label: 'frameworks I map you against: NIST AI RMF, ISO 42001, EU AI Act' },
  { value: '2 wks', label: 'from kickoff to a memo you can hand to your board' },
];

export const shift = {
  title: 'Where you are, and where you land.',
  before: {
    label: 'Today',
    items: [
      'Pilots stall somewhere before production.',
      'Nobody is accountable for AI risk by name.',
      'Security questionnaires stall deals for weeks.',
      'AI budget is spent and no process has changed.',
    ],
  },
  after: {
    label: 'After the Sprint',
    items: [
      'One process is live, with evals watching every change.',
      'A named officer owns AI risk and reports to the board.',
      'Questionnaires get answered from a register, in a day.',
      'Cost per outcome is visible against the price you agreed.',
    ],
  },
};

export const nudge = {
  text: 'Not sure which one fits? Start with the two-week Assessment.',
  label: 'Book a 30-min fit call',
  href: 'https://cal.com/meshin',
};

export const heroOffers = [
  {
    label: 'Start here',
    figure: '2 weeks',
    name: 'AI Readiness & Risk Assessment',
    note: 'Where you stand, what a customer audit would find, and what to do first.',
  },
  {
    label: 'Then',
    figure: '90 days',
    name: '90-Day Production Sprint',
    note: 'One process live for real users, with evals, tracing and a rollback path.',
  },
  {
    label: 'Or ongoing',
    figure: '1–2 days/wk',
    name: 'Fractional CAIO Retainer',
    note: 'A named officer, from procurement answers to the board update.',
  },
];
