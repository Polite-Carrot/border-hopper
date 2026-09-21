/**
 * The set of playable countries.
 *
 * Rule: ISO 3166-1 alpha-2 codes that correspond to a sovereign state, i.e.
 * the 193 UN member states plus the 2 UN observer states (Holy See, Palestine),
 * plus Taiwan (ISO 3166-1 assigns TW and players expect it in a geography game).
 *
 * Everything else in ISO 3166-1 is a dependency, overseas territory or
 * special area. Those are still *drawn* on the map (so the world has no holes)
 * but are not playable and take no part in the adjacency graph.
 */
export const NON_SOVEREIGN_ISO2 = new Set([
  'AI', 'AQ', 'AS', 'AW', 'AX', 'BL', 'BM', 'BQ', 'BV', 'CC', 'CK', 'CW', 'CX',
  'EH', 'FK', 'FO', 'GF', 'GG', 'GI', 'GL', 'GP', 'GS', 'GU', 'HK', 'HM', 'IM',
  'IO', 'JE', 'KY', 'MF', 'MO', 'MP', 'MQ', 'MS', 'NC', 'NF', 'NU', 'PF', 'PM',
  'PN', 'PR', 'RE', 'SH', 'SJ', 'SX', 'TC', 'TF', 'TK', 'UM', 'VG', 'VI', 'WF',
  'YT', 'AN',
]);

/**
 * Territories in the Natural Earth dataset that are drawn separately but whose
 * land is, under the ISO 3166-1 / UN reading used here, part of another state.
 * Merging them keeps borders that run *through* them intact — without this,
 * Somalia would not border Djibouti, and China would not border its own SARs.
 *
 * Keyed by the Natural Earth `properties.name`.
 */
export const MERGE_INTO: Record<string, string> = {
  Somaliland: 'SO',
  'N. Cyprus': 'CY',
  Kosovo: 'RS',
  'Siachen Glacier': 'IN',
  'Hong Kong': 'CN',
  Macao: 'CN',
  'Ashmore and Cartier Is.': 'AU',
  'Indian Ocean Ter.': 'AU',
};

/** Short, canonical display names preferred over the long ISO English names. */
export const DISPLAY_NAME: Record<string, string> = {
  BO: 'Bolivia', BN: 'Brunei', CD: 'DR Congo', CG: 'Republic of the Congo',
  CI: "Côte d'Ivoire", CV: 'Cape Verde', CZ: 'Czechia', FM: 'Micronesia',
  GB: 'United Kingdom', IR: 'Iran', KP: 'North Korea', KR: 'South Korea',
  LA: 'Laos', MD: 'Moldova', MK: 'North Macedonia', PS: 'Palestine',
  RU: 'Russia', SY: 'Syria', SZ: 'Eswatini', TW: 'Taiwan', TZ: 'Tanzania',
  US: 'United States', VA: 'Vatican City', VE: 'Venezuela', VN: 'Vietnam',
  TR: 'Türkiye', NL: 'Netherlands', TL: 'Timor-Leste', GM: 'The Gambia',
  BS: 'The Bahamas', MM: 'Myanmar', ST: 'São Tomé and Príncipe',
  VC: 'Saint Vincent and the Grenadines', KN: 'Saint Kitts and Nevis',
  AE: 'United Arab Emirates', CF: 'Central African Republic',
  DO: 'Dominican Republic', GW: 'Guinea-Bissau', GQ: 'Equatorial Guinea', CN: 'China',
  PG: 'Papua New Guinea', SB: 'Solomon Islands', MH: 'Marshall Islands',
};

/** Common names, abbreviations and former names players are likely to type. */
export const ALIASES: Record<string, string[]> = {
  GB: ['uk', 'u.k.', 'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
  US: ['usa', 'u.s.', 'u.s.a.', 'us', 'america', 'united states of america', 'states'],
  AE: ['uae', 'u.a.e.', 'emirates'],
  CZ: ['czech republic', 'czech'],
  NL: ['holland', 'the netherlands'],
  CD: ['drc', 'democratic republic of the congo', 'democratic republic of congo', 'congo-kinshasa', 'zaire', 'congo kinshasa'],
  CG: ['congo', 'congo-brazzaville', 'congo brazzaville'],
  KR: ['south korea', 'republic of korea', 'korea'],
  KP: ['north korea', 'dprk', "democratic people's republic of korea"],
  MM: ['burma'],
  CI: ['ivory coast', 'cote divoire', 'cote d ivoire'],
  SZ: ['swaziland'],
  MK: ['macedonia', 'fyrom'],
  CV: ['cabo verde'],
  TL: ['east timor'],
  TR: ['turkey'],
  VA: ['vatican', 'holy see'],
  RU: ['russian federation'],
  LA: ["lao people's democratic republic", 'lao'],
  SY: ['syrian arab republic'],
  IR: ['persia', 'islamic republic of iran'],
  VN: ['viet nam'],
  BO: ['plurinational state of bolivia'],
  VE: ['bolivarian republic of venezuela'],
  TZ: ['united republic of tanzania'],
  MD: ['republic of moldova'],
  GM: ['gambia'],
  BS: ['bahamas'],
  PH: ['philippines', 'the philippines'],
  ZA: ['rsa', 'south africa'],
  NZ: ['new zealand', 'aotearoa'],
  PG: ['png'],
  CF: ['car', 'centrafrique'],
  DO: ['dr'],
  ST: ['sao tome and principe', 'sao tome'],
  BA: ['bosnia', 'bosnia and herzegovina'],
  ME: ['montenegro'],
  BF: ['upper volta'],
  IE: ['ireland', 'republic of ireland', 'eire'],
  SS: ['south sudan'],
  GQ: ['equatorial guinea'],
  LI: ['liechtenstein'],
};

/**
 * Land borders that exist only through a country's overseas territory.
 *
 * These are real borders — French Guiana is an integral overseas department of
 * France, so France genuinely borders Brazil and Suriname — but as a game
 * mechanic they are a trapdoor: roughly a quarter of all country pairs would
 * route their shortest path through French Guiana, and no player is going to
 * guess "Brazil" while standing in France. They are excluded from the playable
 * graph, which leaves the Americas and Afro-Eurasia as two separate landmasses.
 *
 * Each entry is an unordered pair of ISO alpha-2 codes.
 */
export const EXCLUDED_BORDERS: [string, string][] = [
  ['FR', 'BR'],
  ['FR', 'SR'],
];
