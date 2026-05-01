export type Locale = "en" | "zh";

export const locales: Locale[] = ["en", "zh"];

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  zh: "\u4e2d\u6587",
};

type FeatureSection = {
  label: string;
  title: string;
  description: string;
  cards: { title: string; description: string }[];
};

type FooterGroup = {
  label: string;
  links: { label: string; href: string }[];
};

export type LandingDict = {
  header: { github: string; login: string; dashboard: string };
  hero: {
    headlineLine1: string;
    headlineLine2: string;
    subheading: string;
    cta: string;
    downloadDesktop: string;
    worksWith: string;
    imageAlt: string;
  };
  features: {
    teammates: FeatureSection;
    autonomous: FeatureSection;
    skills: FeatureSection;
    runtimes: FeatureSection;
  };
  howItWorks: {
    label: string;
    headlineMain: string;
    headlineFaded: string;
    steps: { title: string; description: string }[];
    cta: string;
    ctaGithub: string;
    ctaDocs: string;
  };
  openSource: {
    label: string;
    headlineLine1: string;
    headlineLine2: string;
    description: string;
    cta: string;
    highlights: { title: string; description: string }[];
  };
  faq: {
    label: string;
    headline: string;
    items: { question: string; answer: string }[];
  };
  footer: {
    tagline: string;
    cta: string;
    groups: {
      product: FooterGroup;
      resources: FooterGroup;
      company: FooterGroup;
    };
    copyright: string;
  };
  about: {
    title: string;
    intro: string;
    paragraphs: string[];
    cta: string;
  };
  changelog: {
    title: string;
    subtitle: string;
    toc: string;
    categories: {
      features: string;
      improvements: string;
      fixes: string;
    };
    entries: {
      version: string;
      date: string;
      title: string;
      changes: string[];
      features?: string[];
      improvements?: string[];
      fixes?: string[];
    }[];
  };
  download: {
    hero: {
      macArm64: {
        title: string;
        sub: string;
        primary: string;
        altZip: string;
      };
      macIntel: {
        title: string;
        sub: string;
        disabledCta: string;
        intelHint: string;
      };
      winX64: { title: string; sub: string; primary: string };
      winArm64: { title: string; sub: string; primary: string };
      linux: {
        title: string;
        sub: string;
        primary: string;
        altFormats: string;
      };
      unknown: { title: string; sub: string };
      safariMacHint: string;
      archFallbackHint: string;
    };
    allPlatforms: {
      title: string;
      macLabel: string;
      winX64Label: string;
      winArm64Label: string;
      linuxX64Label: string;
      linuxArm64Label: string;
      formatDmg: string;
      formatZip: string;
      formatExe: string;
      formatAppImage: string;
      formatDeb: string;
      formatRpm: string;
      intelNote: string;
      unavailable: string;
    };
    cli: {
      title: string;
      sub: string;
      installLabel: string;
      startLabel: string;
      sshNote: string;
      copyLabel: string;
      copiedLabel: string;
    };
    cloud: { title: string; sub: string };
    footer: {
      releaseNotes: string;
      allReleases: string;
      currentVersion: string;
      versionUnavailable: string;
    };
  };
  ops: OpsDict;
};

export type OpsAvatarTone = "bot1" | "bot2" | "bot3" | "human";
export type OpsBoardStatus = "RUN" | "REV" | "DONE" | "OPEN";
export type OpsCompareKind = "yes" | "no" | "partial";

export type OpsDict = {
  nav: {
    product: string;
    workflow: string;
    compare: string;
    pricing: string;
    docs: string;
    changelog: string;
    statusOnline: string;
    statusRuntimes: string;
    cta: string;
    menuLabel: string;
  };
  hero: {
    eyebrow: { build: string; version: string; date: string };
    headlineLine1: string;
    headlineLine2Pre: string;
    headlineLine2Connector: string;
    headlineLine3Open: string;
    headlineLine3Inner: string;
    headlineLine3Close: string;
    ledeIntro: string;
    ledeBold: string;
    ledeMid: string;
    ledeHighlight: string;
    ledeTail: string;
    ctaPrimary: string;
    ctaSecondary: string;
    ctaMeta: string;
    worksWith: {
      label: string;
      members: { name: string; title: string }[];
      more: string;
      enterprise: string;
    };
    meta: {
      codingClis: { k: string; v: string; vSuffix: string; n: string };
      firstPr: { k: string; v: string; vSuffix: string; n: string };
      automated: { k: string; v: string; vSuffix: string; n: string };
      deploy: { k: string; v: string; n: string };
    };
    sprintHeader: string;
    sprintCount: string;
    sprintRows: {
      id: string;
      title: string;
      avatar: string;
      avatarTone: OpsAvatarTone;
      status: OpsBoardStatus;
    }[];
    streamHeader: string;
  };
  proposition: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    without: {
      ptitle: string;
      h: string;
      items: { b: string; s: string }[];
    };
    with: {
      ptitle: string;
      h: string;
      items: { b: string; s: string }[];
    };
  };
  pillars: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    cards: { num: string; title: string; body: string; tag: string }[];
  };
  workflow: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    steps: { stepnum: string; h: string; p: string }[];
    asciiDiagram: string;
  };
  stats: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    cells: { k: string; v: string; vSuffix?: string; n: string }[];
  };
  compare: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    head: { trackers: string; ides: string; us: string };
    rows: {
      feature: string;
      trackers: { kind: OpsCompareKind; label: string };
      ides: { kind: OpsCompareKind; label: string };
      us: { kind: OpsCompareKind; label: string };
    }[];
  };
  quote: {
    bodyPre: string;
    bodyHighlight: string;
    bodyPost: string;
    by: { name: string; role: string; lines: string[] };
  };
  pricing: {
    label: string;
    num: string;
    headlineParts: string[];
    sub: string;
    tiers: {
      name: string;
      amount: string;
      amountSuffix: string;
      isFeatured?: boolean;
      featuredBadge?: string;
      desc: string;
      features: string[];
      cta: string;
      href: string;
    }[];
  };
  cta: {
    headlineParts: string[];
    body: string;
    primary: string;
    secondary: string;
    tertiary: string;
    meta: {
      build: string;
      license: string;
      runtime: string;
      status: string;
      contact: string;
      repo: string;
    };
  };
  footer: {
    tagline: string;
    groups: { label: string; links: { label: string; href: string }[] }[];
    copyright: string;
    buildString: string;
  };
};
