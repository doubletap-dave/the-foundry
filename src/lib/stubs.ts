export type ExperimentDraft = {
  name: string;
  hypothesis: string;
  artifact: string;
  buildScope: string;
  dontBuild: string;
  maxHours: number;
  maxCost: number;
  passCriteria: string;
  failCriteria: string;
  learnIfFail: string;
  stack: string;
};

export type ScoutDraft = {
  existing: string[];
  dataAvailable: string[];
  notPossible: string[];
  constraints: string[];
  openings: string[];
  sources: string[];
};

export type ContrarianDraft = {
  obviousVersions: string[];
  whyBad: string[];
  contradictions: string[];
  angles: string[];
  constraintsToExploit: string[];
};

export type JudgeDraft = {
  curiosity: number;
  novelty: number;
  tangibility: number;
  buildability: number;
  usefulness: number;
  rabbitHole: number;
  fuckYes: number;
  recommended: boolean;
  notes: string;
};

export type RunStub = {
  scout: ScoutDraft;
  contrarian: ContrarianDraft;
  experiments: ExperimentDraft[];
  scores: JudgeDraft[];
};

function mentionsTarkov(idea: string): boolean {
  const t = idea.toLowerCase();
  if (/(tarkov|escapefromtarkov|escape from tarkov|\beft\b|battlestate)/.test(t)) {
    return true;
  }
  const raid = /\braid(s|ing)?\b/.test(t);
  const fps = /\bfps\b|first[- ]person|extraction shooter|loot shooter/.test(t);
  return raid && fps;
}

function clip(idea: string, max = 72): string {
  const cleaned = idea.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function noun(idea: string): string {
  const stripped = idea
    .replace(/^i (might want to|want to|wanna|would like to)\s+/i, "")
    .replace(/^(build|make|do|create|ship)\s+/i, "")
    .replace(/^(something with|something for|a|an|the)\s+/i, "")
    .replace(/[?.!]+$/g, "")
    .trim();
  return clip(stripped || idea, 48);
}

const TARKOV_SCOUT: ScoutDraft = {
  existing: [
    "tarkov.dev / community GraphQL — items, flea, maps, quests, hideout crafts",
    "Tarkov.dev map tools, tarkov-market price charts, wiki ammo/armor tables",
    "Raid-replay and overlay experiments (ToS-gray). Death-cam is in-raid only",
    "Loadout planners and 'best ammo' sheets. Saturated pre-raid category",
  ],
  dataAvailable: [
    "Item IDs, flea medians, trader unlocks, extract lists, quest objectives",
    "Player-owned: screenshots, death recap, stash export, handwritten raid notes",
    "Public clip/VOD of the raid if they recorded. No official combat log",
  ],
  notPossible: [
    "Official raid replay API, live positions, hit-reg, or Battlestate telemetry",
    "In-raid overlay that reads memory or injects — cheat-adjacent, dead on arrival",
    "Authoritative 'what killed you' without the player supplying the death recap",
  ],
  constraints: [
    "Battlestate ToS: no RMT, no automation, no overlay that touches the client",
    "Patch cadence destroys static 'meta' tools. Anything that is a spreadsheet dies",
    "Players already have a ritual: stash, insurance, flea. Do not compete with that",
  ],
  openings: [
    "Post-raid forensics: reconstruct the raid from notes + death recap + loot left",
    "Extract decision review — the argument people actually have after a wipe",
    "Loadout autopsy from a pasted kit, not a live ESP. Stays on the right side of ToS",
  ],
  sources: [
    "https://tarkov.dev",
    "https://escapefromtarkov.fandom.com",
    "https://tarkov-market.com",
    "Community: raid notes, death recaps, VOD comments — not an official log",
  ],
};

const TARKOV_CONTRARIAN: ContrarianDraft = {
  obviousVersions: [
    "Another loot tracker / flea pricer / ammo chart",
    "A live map overlay with extracts and player dots",
    "A 'raid stats' dashboard that wants 40 raids before it is useful",
  ],
  whyBad: [
    "Pre-raid tools are a graveyard. Useful once, ignored after the first wipe week",
    "Live overlay is a ToS and trust killer. One ban screenshot and the product is done",
    "Aggregate dashboards ask for a habit that does not exist yet. Nobody logs 40 raids",
  ],
  contradictions: [
    "Players say they want stats. They actually want to win the argument about the last raid",
    "They say they want to 'get better'. They will not fill a 12-field form after a death",
    "The valuable moment is 90 seconds after extract or wipe — not Sunday-night review",
  ],
  angles: [
    "One raid. One page. A verdict they can screenshot. Forensics, not a platform",
    "Borrow the death recap they already look at. Do not invent a new data entry job",
    "Make the artifact the thing they send in Discord: 'this is why we should have extracted'",
  ],
  constraintsToExploit: [
    "No official API is a moat if the input is human: notes, recap, one screenshot",
    "ToS wall kills overlay competitors. Stay post-raid and you are still shippable",
    "Patch volatility favors a method (autopsy) over a database (meta sheet)",
  ],
};

const TARKOV_EXPERIMENTS: ExperimentDraft[] = [
  {
    name: "Raid Forensics",
    hypothesis:
      "After a raid, a player will spend five minutes reconstructing what actually happened if we turn their own notes and death recap into a structured autopsy.",
    artifact:
      "A single-raid autopsy page: timeline, likely cause of death, extract decision, loot left behind. Screenshot-able.",
    buildScope:
      "One form (map, time alive, extract or death, kit, two notes) and one generated autopsy view. No accounts.",
    dontBuild:
      "Live overlay, multi-raid history, flea integration, squad sync, mobile app.",
    maxHours: 8,
    maxCost: 15,
    passCriteria:
      "Five players complete a full autopsy on a real raid and say they would do it again next session.",
    failCriteria:
      "Nobody finishes the form, or the reaction is 'I would rather watch the death cam'.",
    learnIfFail:
      "Whether post-raid reflection is a real habit or just cope. If they will not type two sentences, no later product exists.",
    stack: "Next.js / TypeScript / local SQLite",
  },
  {
    name: "Extract Decision Card",
    hypothesis:
      "A 30-second post-raid card that answers 'should I have extracted' will get saved or shared because it resolves a specific argument.",
    artifact:
      "One card: time remaining, rough loot value, extract taken vs nearest, go/no-go verdict. Built to be pasted into Discord.",
    buildScope:
      "Four inputs, one verdict card, copy-as-text. Hardcoded extract list for two maps.",
    dontBuild:
      "All maps, live value from flea, party votes, historical extract win-rates.",
    maxHours: 4,
    maxCost: 8,
    passCriteria:
      "Three people paste the card into a chat without being asked, or reuse it on a second raid.",
    failCriteria:
      "They nod and close the tab. No copy, no second use.",
    learnIfFail:
      "If the argument is real but a card is the wrong object — maybe they want a voice take or a clip, not a verdict.",
    stack: "Next.js / TypeScript",
  },
  {
    name: "Loadout Autopsy",
    hypothesis:
      "Players will paste a death loadout to see what actually lost the fight (ammo pen, armor class, unused meds) if the verdict is six lines.",
    artifact:
      "Paste-a-kit → six-line verdict. No charts. Names the weakest link in the kit.",
    buildScope:
      "A paste box, a small hardcoded ammo/armor table, a verdict template. One kit at a time.",
    dontBuild:
      "Full ballistics sim, hideout planner, meta builder, account-linked stash.",
    maxHours: 6,
    maxCost: 10,
    passCriteria:
      "Five pasted kits from real deaths; at least two people change a slot on the next raid because of the verdict.",
    failCriteria:
      "They already know — 'yeah, I brought shit ammo' — and do not paste a second kit.",
    learnIfFail:
      "The knowledge is not the bottleneck. If they already know the answer, autopsy is theater.",
    stack: "Next.js / TypeScript / static ballistics table",
  },
];

const TARKOV_SCORES: JudgeDraft[] = [
  {
    curiosity: 8,
    novelty: 7,
    tangibility: 9,
    buildability: 8,
    usefulness: 7,
    rabbitHole: 3,
    fuckYes: 8,
    recommended: true,
    notes:
      "One raid, one page, stays off the client. Highest chance of a real artifact this week. Recommend BUILD.",
  },
  {
    curiosity: 7,
    novelty: 6,
    tangibility: 8,
    buildability: 9,
    usefulness: 6,
    rabbitHole: 2,
    fuckYes: 6,
    recommended: false,
    notes:
      "Cheapest and cleanest. Risk is it is a party trick — useful once in Discord, then gone. Keep as a fallback if Forensics is too big.",
  },
  {
    curiosity: 6,
    novelty: 5,
    tangibility: 7,
    buildability: 7,
    usefulness: 6,
    rabbitHole: 5,
    fuckYes: 5,
    recommended: false,
    notes:
      "Closest to the ammo-chart graveyard. Only interesting if the verdict is rude and specific. Do not expand the table.",
  },
];

function genericStub(idea: string): RunStub {
  const subject = noun(idea);
  const quoted = clip(idea, 90);

  const experiments: ExperimentDraft[] = [
    {
      name: "Smallest Proof",
      hypothesis: `Someone who said “${quoted}” will complete one concrete action in a single sitting if the artifact is one page and the job is obvious.`,
      artifact: `A single working page that performs the core action for ${subject}. No accounts. No settings.`,
      buildScope: `One happy path. Hardcoded sample data. A result the user can screenshot or copy.`,
      dontBuild: `Auth, dashboards, multiplayer, notifications, a design system, a second surface.`,
      maxHours: 6,
      maxCost: 12,
      passCriteria: `Three people who are not you finish the path and can say what they got back in one sentence.`,
      failCriteria: `They stall on the first screen, or the result is 'neat' and immediately closed.`,
      learnIfFail: `Whether the idea has a verb. If there is no action people will take, later scope will not save it.`,
      stack: "Next.js / TypeScript / local SQLite",
    },
    {
      name: "Decision Card",
      hypothesis: `The real job is a verdict, not a product. A one-screen card that answers the decision inside “${quoted}” will get reused or forwarded.`,
      artifact: `One card: inputs on the left, a go / no-go (or pick A / pick B) on the right. Copy-as-text.`,
      buildScope: `Four inputs max. One scoring rule you can explain out loud. No history.`,
      dontBuild: `A model, a feed, personalization, export to PDF, mobile polish.`,
      maxHours: 4,
      maxCost: 8,
      passCriteria: `Two people use the card on a real decision and keep the output.`,
      failCriteria: `They agree with the card and do nothing. No copy, no second use.`,
      learnIfFail: `If they wanted company, not a verdict. A card cannot fix a loneliness problem.`,
      stack: "Next.js / TypeScript",
    },
    {
      name: "Weird Wedge",
      hypothesis: `The obvious product around ${subject} is already ignored. A stranger, smaller object will get a stronger yes/no than a 'real' v1.`,
      artifact: `An unexpected format — a receipt, a roast, a two-minute timer, a printed slip — still about ${subject}.`,
      buildScope: `One weird object. Ship the joke far enough that someone can hate it honestly.`,
      dontBuild: `The serious version. Feature parity. Anything that apologizes for the wedge.`,
      maxHours: 5,
      maxCost: 10,
      passCriteria: `A clear emotional reaction (save, share, or a specific refusal) from three people.`,
      failCriteria: `Polite confusion. 'I get it' with no feeling.`,
      learnIfFail: `Which part of the idea is actually charged. Confusion means the wedge was cute, not sharp.`,
      stack: "Next.js / TypeScript",
    },
  ];

  return {
    scout: {
      existing: [
        `Searchable incumbents around ${subject}: sheets, Discord bots, a couple of half-built repos`,
        "Generic AI wrappers that take the prompt and return a paragraph. Not an artifact",
        "Note-taking and project tools people already abandon after a week",
      ],
      dataAvailable: [
        "Whatever the user can paste: a paragraph, a URL, a screenshot, a list",
        "Public pages and docs. No private telemetry unless they upload it",
        `Domain language from the idea itself: “${quoted}”`,
      ],
      notPossible: [
        "A live API catalog or official data feed we have not been given",
        "Knowing whether strangers will pay before something exists to show them",
        "Training a custom model for a one-week experiment",
      ],
      constraints: [
        "One sitting. If it needs an account or a week of logging, it is not this run",
        "No scrape-the-world plan. Input is what a person will type today",
        "The output has to be an object, not a chat",
      ],
      openings: [
        `A single artifact that makes “${quoted}” concrete enough to keep or kill`,
        "A decision card that forces a yes/no instead of more research",
        "A weird format that reveals whether anyone cares",
      ],
      sources: [
        "The idea text. That is the brief",
        "Whatever the user already has open — no new research stack on Day 1",
      ],
    },
    contrarian: {
      obviousVersions: [
        `A dashboard for ${subject}`,
        "A chatbot that 'helps you think through it'",
        "A full workspace with projects, tags, and an empty home screen",
      ],
      whyBad: [
        "Dashboards assume a habit. There is no habit yet",
        "Chat is a stall. It feels like progress and produces nothing you can show",
        "A workspace is a tax. People came here to decide, not to organize",
      ],
      contradictions: [
        "They asked for a product. They need a test that can fail this week",
        "They want it to be good. Good is how this stays fictional",
        "They say 'platform' when they mean 'I have not picked a user'",
      ],
      angles: [
        "Build the receipt, not the factory",
        "Make the first object disposable on purpose",
        "Pick a user who will be rude. Polite users lie",
      ],
      constraintsToExploit: [
        "No users yet — so the first users can be three people you can text",
        "No data — so the first version is a form plus a verdict",
        "No brand — so the artifact can be ugly if it is specific",
      ],
    },
    experiments,
    scores: [
      {
        curiosity: 7,
        novelty: 5,
        tangibility: 8,
        buildability: 8,
        usefulness: 7,
        rabbitHole: 3,
        fuckYes: 7,
        recommended: true,
        notes:
          "Smallest Proof is the only one that produces a real object fast enough to learn. Recommend BUILD.",
      },
      {
        curiosity: 6,
        novelty: 6,
        tangibility: 8,
        buildability: 9,
        usefulness: 6,
        rabbitHole: 2,
        fuckYes: 6,
        recommended: false,
        notes:
          "Use if the idea is actually a decision, not a tool. Cheap enough to keep in the pocket.",
      },
      {
        curiosity: 8,
        novelty: 8,
        tangibility: 6,
        buildability: 7,
        usefulness: 4,
        rabbitHole: 4,
        fuckYes: 6,
        recommended: false,
        notes:
          "Highest signal if the obvious version is already dead. Do not lead with it unless Smallest Proof feels like homework.",
      },
    ],
  };
}

export function stubForIdea(idea: string): RunStub {
  if (mentionsTarkov(idea)) {
    return {
      scout: TARKOV_SCOUT,
      contrarian: TARKOV_CONTRARIAN,
      experiments: TARKOV_EXPERIMENTS,
      scores: TARKOV_SCORES,
    };
  }
  return genericStub(idea);
}

export function rewriteExperiment(
  exp: ExperimentDraft,
  kind: "mutate" | "smaller" | "weirder",
): ExperimentDraft {
  if (kind === "smaller") {
    return {
      ...exp,
      name: exp.name.replace(/^(Smaller:\s*)?/i, "Smaller: "),
      artifact: `Half of the original: ${exp.artifact}`,
      buildScope: `Cut again. ${exp.buildScope} One input if possible.`,
      dontBuild: `${exp.dontBuild} Also drop anything that is not the first screen.`,
      maxHours: Math.max(2, Math.ceil(exp.maxHours / 2)),
      maxCost: Math.max(3, Math.round(exp.maxCost / 2)),
      hypothesis: `A smaller cut still teaches: ${exp.hypothesis}`,
    };
  }
  if (kind === "weirder") {
    return {
      ...exp,
      name: exp.name.replace(/^(Weirder:\s*)?/i, "Weirder: "),
      artifact: `Make it uncomfortable. ${exp.artifact} Deliver it as a receipt, a roast, or a printed slip.`,
      hypothesis: `If we make this stranger, the yes/no gets louder. Was: ${exp.hypothesis}`,
      learnIfFail: `Whether the charge was the idea or the politeness. ${exp.learnIfFail}`,
    };
  }
  return {
    ...exp,
    name: exp.name.replace(/^(Mutated:\s*)?/i, "Mutated: "),
    hypothesis: `Sibling angle — same job, different object. ${exp.hypothesis}`,
    artifact: `A different shape of the same bet: ${exp.artifact}`,
    buildScope: `Keep the cap. Change the surface. ${exp.buildScope}`,
  };
}
