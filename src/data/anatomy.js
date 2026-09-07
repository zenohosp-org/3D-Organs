/* ===================================================================
   ANATOMY CLASSIFICATION
   -------------------------------------------------------------------
   The BodyParts3D repack ships a `system` tag per part, but it was
   derived heuristically upstream and is wrong often enough to be
   unusable as the sole source of truth — teeth and several muscle
   groups are filed under "skeletal", and the brain ventricles are
   filed under "cardiac". Colouring straight off that tag paints the
   third ventricle myocardium red.

   So classification here is NAME-FIRST, system-second: an ordered rule
   list matched against the anatomical name (which comes from the FMA
   and is reliable), falling back to the system tag only when no rule
   matches. Order matters — the first match wins, so specific rules
   sit above general ones.
   =================================================================== */

/** Ordered [regex, tissuePreset] rules. First match wins. */
const TISSUE_RULES = [
  // --- Cartilage & discs: MUST precede the bone rules, because a disc is
  //     named "Intervertebral disk of third lumbar vertebra" and would
  //     otherwise be caught by the /vertebra/ bone rule and painted bone. ---
  [/\b(intervertebral disk|costal cartilage|cartilage|meniscus|labrum)\b/i, 'cartilage'],

  // --- Skeletal: the load-bearing structures hardware attaches to ---
  [/\b(femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|patella|talus|calcaneus|hip bone|sacrum|coccyx|mandible|maxilla|hyoid bone|sternum|rib)\b/i, 'cortical'],
  [/\bvertebra\b/i, 'cortical'],
  [/\b(tooth|teeth|molar|premolar|incisor|canine)\b/i, 'cortical'],
  [/\bgingiva\b/i, 'gastric'],

  // --- Vasculature: arteries run brighter than veins, as in a specimen ---
  [/\b(artery|arterial|aorta|arteriole|trunk of.*artery)\b/i, 'vessel'],
  [/\b(vein|venous|vena cava|venule|sinus of dura)\b/i, 'vessel'],

  // --- Heart ---
  [/\b(myocardium|wall of (left |right )?(atrium|ventricle)|cusp of .*valve|leaflet of .*valve|cavity of (left|right) (atrium|ventricle)|chordae|papillary muscle)\b/i, 'myocardium'],

  // --- Respiratory ---
  [/\b(bronchial tree|bronchus|trachea|alveol|lung|pleura)\b/i, 'lung'],
  [/\b(larynx|epiglottis|pharyngeal|pharyngeus|nasal concha|nasal cartilage)\b/i, 'cartilage'],

  // --- Hepatobiliary ---
  [/\b(liver|hepatic|biliary|gallbladder|bile)\b/i, 'hepatic'],
  [/\bspleen\b/i, 'hepatic'],

  // --- Urinary ---
  [/\b(kidney|renal|ureter|urethra|urinary bladder|adrenal)\b/i, 'renal'],

  // --- Gastrointestinal ---
  [/\b(stomach|gastric|duodenum|jejunum|ileum|colon|caecum|cecum|appendix|rectum|esophagus|oesophagus|pancrea|taenia|omentum|mesentery)\b/i, 'gastric'],

  // --- Nervous ---
  [/\b(gyrus|lobule|lobe of (cerebrum|brain)|occipital lobe|parietal lobe|frontal lobe|temporal lobe|cerebell|thalamus|pons|medulla oblongata|nerve|ganglion|plexus|spinal cord|ventricle)\b/i, 'neural'],

  // --- Ocular ---
  [/\b(cornea|lens|eyeball|sclera|retina|vitreous)\b/i, 'cartilage'],

  // --- Muscle (broad, so it sits low in the list) ---
  [/\b(muscle|tract|tendon|ligament|aponeurosis|fascia|rectus|oblique|lumbrical|interosseous|tibialis|fibularis|constrictor|levator|flexor|extensor|adductor|abductor|pronator|supinator|sternothyroid|cricothyroid|palatopharyngeus|salpingopharyngeus|stylopharyngeus)\b/i, 'myocardium'],

  // --- Integument ---
  [/\bskin\b/i, 'gastric'],
];

/** Fallback by the upstream system tag when no name rule matches. */
const SYSTEM_FALLBACK = {
  skeletal: 'cortical',
  arterial: 'vessel',
  venous: 'vessel',
  cardiac: 'myocardium',
  respiratory: 'lung',
  digestive: 'gastric',
  urinary: 'renal',
  nervous: 'neural',
  muscular: 'myocardium',
  connective: 'cartilage',
  endocrine: 'renal',
  lymphatic: 'hepatic',
  sensory: 'neural',
  reproductive: 'gastric',
  integumentary: 'gastric',
};

export function classifyTissue(part) {
  for (const [re, preset] of TISSUE_RULES) {
    if (re.test(part.name)) return preset;
  }
  return SYSTEM_FALLBACK[part.system] ?? 'gastric';
}

/* -------------------------------------------------------------------
   Regions
   -------------------------------------------------------------------
   A region is a named, clinically meaningful subset. Loading a region
   rather than the whole body is what keeps the viewer responsive: the
   full atlas is 2.29 M triangles across 15 chunks, while "Spine &
   pelvis" is a few tens of thousands out of two.

   `match` is evaluated against every part in the atlas.
   ------------------------------------------------------------------- */

const isBone = /\b(femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|patella|talus|calcaneus|hip bone|sacrum|coccyx|mandible|maxilla|hyoid bone|sternum|rib|vertebra)\b/i;
const notVessel = (n) => !/\b(artery|vein|branch|nerve|tibialis|fibularis|tract|plexus)\b/i.test(n);

export const REGIONS = [
  {
    id: 'skeleton',
    label: 'Skeleton',
    hint: 'Bones, discs and costal cartilage — the implant workspace',
    match: (p) => (isBone.test(p.name) || /costal cartilage|intervertebral disk/i.test(p.name)) && notVessel(p.name),
  },
  {
    id: 'spine',
    label: 'Spine & pelvis',
    hint: 'Vertebral column, discs, sacrum and hip bones',
    match: (p) => /\b(vertebra|intervertebral disk|sacrum|coccyx|hip bone)\b/i.test(p.name) && notVessel(p.name),
  },
  {
    id: 'lowerLimb',
    label: 'Lower limb',
    hint: 'Femur, tibia, fibula, patella, hindfoot',
    match: (p) => /\b(femur|tibia|fibula|patella|talus|calcaneus|hip bone)\b/i.test(p.name) && notVessel(p.name),
  },
  {
    id: 'upperLimb',
    label: 'Upper limb',
    hint: 'Humerus, radius, ulna, scapula, clavicle',
    match: (p) => /\b(humerus|radius|ulna|scapula|clavicle)\b/i.test(p.name) && notVessel(p.name),
  },
  {
    id: 'thorax',
    label: 'Thorax',
    hint: 'Rib cage, sternum, thoracic spine and airway',
    match: (p) =>
      (/\b(rib|sternum|costal cartilage|thoracic vertebra)\b/i.test(p.name) && notVessel(p.name)) ||
      /\b(trachea|bronch)/i.test(p.name),
  },
  {
    id: 'heart',
    label: 'Heart',
    hint: 'Chambers, walls and valve apparatus',
    // NB: a bare /interventricular/ also matches "Interventricular
    // foramen" — the foramen of Monro, which is in the BRAIN and sits
    // 30 cm above the heart. Requiring a following cardiac noun keeps
    // the coronary arteries ("anterior interventricular branch of left
    // coronary artery") while dropping the stray neural structure.
    match: (p) =>
      /\b(wall of (left |right )?(atrium|ventricle)|cavity of (left|right) (atrium|ventricle)|cusp of .*valve|leaflet of .*valve|coronary|interventricular (branch|septum|sulcus|groove)|chordae|papillary muscle)\b/i.test(p.name),
  },
  {
    id: 'airway',
    label: 'Airway',
    hint: 'Trachea, main bronchi and the segmental bronchial tree',
    match: (p) => /\b(trachea|bronch|larynx|epiglottis)/i.test(p.name),
  },
  {
    id: 'abdominal',
    label: 'Abdominal viscera',
    hint: 'Stomach, bowel, pancreas, spleen, biliary tree',
    match: (p) =>
      /\b(stomach|duodenum|jejunum|ileum|colon|caecum|cecum|appendix|rectum|esophagus|pancrea|spleen|gallbladder|biliary|liver|taenia)\b/i.test(p.name),
  },
  {
    id: 'urinary',
    label: 'Urinary tract',
    hint: 'Kidneys, ureters, bladder, adrenals',
    match: (p) => /\b(kidney|ureter|urethra|urinary bladder|adrenal|prostate)\b/i.test(p.name),
  },
  {
    id: 'arterial',
    label: 'Arterial tree',
    hint: 'Systemic arterial anatomy',
    match: (p) => p.system === 'arterial',
  },
  {
    id: 'venous',
    label: 'Venous tree',
    hint: 'Systemic venous anatomy',
    match: (p) => p.system === 'venous',
  },
  {
    id: 'nervous',
    label: 'Nervous system',
    hint: 'Cortical surface, cerebellum, peripheral nerves',
    match: (p) => p.system === 'nervous' || /\b(gyrus|lobule|cerebell|nerve|ganglion|spinal cord)\b/i.test(p.name),
  },
  {
    id: 'muscular',
    label: 'Musculature',
    hint: 'Skeletal muscle envelope',
    match: (p) => p.system === 'muscular' || /\b(tibialis|fibularis|lumbrical|interosseous|rectus|oblique)\b/i.test(p.name),
  },
  {
    id: 'full',
    label: 'Whole body',
    hint: 'All 2,234 structures — heaviest load',
    match: () => true,
  },
];

export function partsForRegion(atlas, regionId) {
  const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];
  return atlas.parts.filter(region.match);
}
