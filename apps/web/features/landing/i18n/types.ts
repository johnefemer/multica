import type { SupportedLocale } from "@multica/core/i18n";
export { docsHrefForLocale } from "@/lib/docs-href";

export type Locale = SupportedLocale;
export type LandingDictionaryLocale = "en" | "zh" | "ko" | "ja";

export const locales: Locale[] = ["en", "zh-Hans", "ko", "ja"];

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  "zh-Hans": "\u4e2d\u6587",
  ko: "\ud55c\uad6d\uc5b4",
  ja: "\u65e5\u672c\u8a9e",
  // The landing dictionary has no French variant yet, so `locales` above still
  // offers four languages; this label only satisfies the Record type.
  fr: "FR",
};

export function toLandingDictionaryLocale(
  locale: Locale,
): LandingDictionaryLocale {
  if (locale === "ko") return "ko";
  if (locale === "ja") return "ja";
  return locale === "zh-Hans" ? "zh" : "en";
}

export function isZhLocale(locale: Locale): boolean {
  return locale === "zh-Hans";
}

type FeatureSection = {
  label: string;
  title: string;
  description: string;
  cards: { title: string; description: string }[];
};

// Long-form page copy. Paragraphs and bullets may embed `[label](href)`
// links, rendered by InlineLinks.
export type DocumentSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type FooterGroup = {
  label: string;
  links: { label: string; href: string }[];
};

export type ContactSalesOption = { value: string; label: string };

export type LandingDict = {
  header: {
    github: string;
    login: string;
    cta: string;
    dashboard: string;
    docs: string;
    changelog: string;
    useCases: string;
    navigation: string;
    openMenu: string;
    closeMenu: string;
  };
  hero: {
    headlineLine1: string;
    headlineLine2: string;
    subheading: string;
    cta: string;
    downloadDesktop: string;
    talkToSales: string;
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
    licensingCta: string;
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
    nameLine: {
      prefix: string;
      mult: string;
      iplexed: string;
      i: string;
      nformationAnd: string;
      c: string;
      omputing: string;
      a: string;
      gent: string;
    };
    paragraphs: string[];
    cta: string;
    team: {
      title: string;
      paragraphs: string[];
      contacts: { label: string; linkLabel: string; href: string }[];
    };
  };
  licensing: {
    title: string;
    intro: string[];
    rule: { title: string; text: string };
    scenarios: {
      title: string;
      scenarioColumn: string;
      licenseColumn: string;
      required: string;
      notRequired: string;
      items: { scenario: string; example?: string; required: boolean }[];
    };
    sections: DocumentSection[];
  };
  privacy: {
    title: string;
    lastUpdated: string;
    intro: string[];
    sections: DocumentSection[];
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
        primary: string;
        altZip: string;
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
      macArm64Label: string;
      macX64Label: string;
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
      unavailable: string;
    };
    cli: {
      title: string;
      sub: string;
      installLabel: string;
      platformGroup: string;
      platformMacosLinux: string;
      platformWindows: string;
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
  contactSales: {
    pageTitle: string;
    pageDescription: string;
    eyebrow: string;
    title: string;
    fields: {
      firstName: string;
      lastName: string;
      businessEmail: string;
      businessEmailHint: string;
      companyName: string;
      companySize: string;
      countryRegion: string;
      useCase: string;
      goals: string;
      selectPlaceholder: string;
      submit: string;
      submitting: string;
    };
    companySizes: ContactSalesOption[];
    useCases: ContactSalesOption[];
    countries: string[];
    consent: {
      intro: string;
      outreach: string;
      updates: string;
      unsubscribe: string;
      submitConsent: string;
      privacyLinkLabel: string;
      privacyLinkHref: string;
    };
    success: { title: string; message: string; cta: string };
    errors: {
      generic: string;
      rateLimit: string;
      freeEmail: string;
      invalidEmail: string;
    };
  };
  ops: OpsDict;
  legal: LegalDict;
};

export type LegalDoc = {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: { heading: string; paragraphs: string[] }[];
};

export type LegalDict = {
  lastUpdatedLabel: string;
  contactLine: string;
  terms: LegalDoc;
  privacy: LegalDoc;
  security: LegalDoc;
  dpa: LegalDoc;
  subProcessors: LegalDoc;
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
