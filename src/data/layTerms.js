/* ===================================================================
   PLAIN LANGUAGE
   -------------------------------------------------------------------
   Every label in this application is written for a surgeon. In front of
   a patient that is actively unhelpful: "Diaphyseal fixation through
   two cortices" and "FMA24475" communicate nothing, and jargon in a
   consultation reliably makes people nod rather than understand.

   This module is the translation layer. Two rules shaped it:

   1. KEEP THE MEDICAL WORD, don't hide it. Patients are told their
      diagnosis by name and will hear it again from everyone else in the
      hospital, so the format is "thigh bone (femur)", not "thigh bone".
      Hiding the real term leaves them unable to follow the next
      conversation or look anything up.

   2. SAY WHAT IT DOES, not what it is. "Locking compression plate"
      becomes "a metal plate that holds the pieces of bone together
      while they heal" — the function is the part that answers the
      question the patient is actually asking.

   Ordered rules, first match wins, same as the tissue classifier.
   =================================================================== */

const NAME_RULES = [
  // --- Long bones ---
  [/^(left|right) femur$/i, (m) => `${m[1]} thigh bone`],
  [/^(left|right) tibia$/i, (m) => `${m[1]} shin bone`],
  [/^(left|right) fibula$/i, (m) => `${m[1]} calf bone`],
  [/^(left|right) humerus$/i, (m) => `${m[1]} upper arm bone`],
  [/^(left|right) radius$/i, (m) => `${m[1]} forearm bone (thumb side)`],
  [/^(left|right) ulna$/i, (m) => `${m[1]} forearm bone (little-finger side)`],
  [/^(left|right) clavicle$/i, (m) => `${m[1]} collarbone`],
  [/^(left|right) scapula$/i, (m) => `${m[1]} shoulder blade`],
  [/^(left|right) patella$/i, (m) => `${m[1]} kneecap`],
  [/^(left|right) hip bone$/i, (m) => `${m[1]} hip bone`],
  [/^(left|right) calcaneus$/i, (m) => `${m[1]} heel bone`],
  [/^(left|right) talus$/i, (m) => `${m[1]} ankle bone`],
  [/^mandible$/i, () => 'lower jaw'],
  [/^(left|right) maxilla$/i, (m) => `${m[1]} upper jaw`],
  [/^hyoid bone$/i, () => 'throat bone'],
  [/^sacrum$/i, () => 'tailbone base'],
  [/^body of sternum$/i, () => 'breastbone'],

  // --- Spine ---
  [/^(\w+) cervical vertebra$/i, (m) => `${m[1]} neck bone`],
  [/^(\w+) thoracic vertebra$/i, (m) => `${m[1]} upper back bone`],
  [/^(\w+) lumbar vertebra$/i, (m) => `${m[1]} lower back bone`],
  [/^intervertebral disk of (\w+) (cervical|thoracic|lumbar) vertebra$/i,
    (m) => `cushioning disc in the ${m[2] === 'cervical' ? 'neck' : m[2] === 'thoracic' ? 'upper back' : 'lower back'}`],

  // --- Ribs ---
  [/^(left|right) (\w+) rib$/i, (m) => `${m[1]} ${m[2]} rib`],
  [/^(left|right) (\w+) costal cartilage$/i, (m) => `${m[1]} rib cartilage`],

  // --- Heart ---
  [/^wall of (left|right) (atrium|ventricle)$/i,
    (m) => `wall of the ${m[1]} ${m[2] === 'atrium' ? 'upper' : 'lower'} heart chamber`],
  [/^wall of ventricle$/i, () => 'heart muscle wall'],
  [/^cavity of (left|right) (atrium|ventricle)$/i,
    (m) => `inside of the ${m[1]} ${m[2] === 'atrium' ? 'upper' : 'lower'} heart chamber`],
  [/mitral valve/i, () => 'mitral valve (between the left heart chambers)'],
  [/tricuspid valve/i, () => 'tricuspid valve (between the right heart chambers)'],
  [/aortic valve/i, () => 'aortic valve (the heart’s main outlet)'],
  [/pulmonary valve/i, () => 'pulmonary valve (outlet to the lungs)'],
  [/coronary artery/i, () => 'artery supplying the heart muscle'],

  // --- Airway & chest ---
  [/^trachea$/i, () => 'windpipe'],
  [/^(left|right) main bronchus/i, (m) => `${m[1]} main airway`],
  [/bronchial tree/i, () => 'smaller airway branch in the lung'],
  [/^epiglottis$/i, () => 'flap that closes the windpipe when swallowing'],

  // --- Abdomen ---
  [/^stomach$/i, () => 'stomach'],
  [/^esophagus$/i, () => 'food pipe'],
  [/^duodenum$/i, () => 'first part of the small bowel'],
  [/part of ileum/i, () => 'small bowel'],
  [/^(ascending|descending|transverse) colon$/i, (m) => `${m[1]} large bowel`],
  [/^rectum$/i, () => 'back passage'],
  [/^appendix$/i, () => 'appendix'],
  [/^pancreas$/i, () => 'pancreas'],
  [/^spleen$/i, () => 'spleen'],
  [/^gallbladder$/i, () => 'gallbladder'],
  [/biliary tree|bile duct/i, () => 'bile drainage channel'],
  [/caudate lobe of liver/i, () => 'part of the liver'],

  // --- Urinary ---
  [/^(left|right) kidney$/i, (m) => `${m[1]} kidney`],
  [/^(left|right) ureter$/i, (m) => `${m[1]} tube from kidney to bladder`],
  [/^urinary bladder$/i, () => 'bladder'],
  [/^urethra$/i, () => 'urine outlet tube'],
  [/^(left|right) adrenal gland$/i, (m) => `${m[1]} adrenal gland`],
  [/^prostate$/i, () => 'prostate'],

  // --- Brain ---
  [/^(left|right) (frontal|parietal|occipital|temporal) lobe$/i,
    (m) => `${m[1]} ${m[2]} lobe of the brain`],
  [/gyrus/i, () => 'fold on the surface of the brain'],
  [/cerebell/i, () => 'balance and coordination centre of the brain'],
  [/ventricle$/i, () => 'fluid space inside the brain'],

  // --- Generic vessels: thousands of these, so one rule covers them ---
  [/\bartery\b|\barterial\b|^aorta$/i, () => 'artery (carries blood away from the heart)'],
  [/\bvein\b|vena cava/i, () => 'vein (carries blood back to the heart)'],
  [/\bnerve\b/i, () => 'nerve'],
  [/^skin$/i, () => 'skin'],
];

/** Strip the leading side word so rules can match either side cleanly. */
export function layName(anatomicalName) {
  if (!anatomicalName) return '';
  for (const [re, fn] of NAME_RULES) {
    const m = anatomicalName.match(re);
    if (m) {
      const lay = fn(m);
      return lay.charAt(0).toUpperCase() + lay.slice(1);
    }
  }
  return null; // no translation — caller falls back to the medical name
}

/**
 * Label for patient-facing display: plain words with the medical term
 * kept in parentheses, so the patient can follow the next conversation.
 */
export function patientLabel(anatomicalName) {
  const lay = layName(anatomicalName);
  if (!lay) return anatomicalName;
  // Don't say "Left kidney (Left kidney)".
  if (lay.toLowerCase() === anatomicalName.toLowerCase()) return anatomicalName;
  return `${lay} (${anatomicalName.toLowerCase()})`;
}

/* -------------------------------------------------------------------
   Implants, described by what they do
   ------------------------------------------------------------------- */

export const IMPLANT_LAY = {
  'cortical-screw': 'A small metal screw that grips both walls of the bone to hold it steady.',
  'cancellous-screw': 'A screw with a deeper thread, designed to grip the softer bone near a joint.',
  'cannulated-screw': 'A hollow screw placed precisely over a fine guide wire.',
  'pedicle-screw': 'A screw anchored into the solid part of a spine bone. Screws are joined by a rod.',
  'locking-plate': 'A metal plate laid along the bone. Screws lock into it, holding the pieces together while they heal.',
  'recon-plate': 'A metal plate that can be bent to match the shape of the bone before it is fixed on.',
  'im-nail': 'A metal rod placed down the hollow centre of the bone, sharing the load while it heals.',
  'spinal-rod': 'A rod that links the spine screws together to hold that section still.',
  'k-wire': 'A thin metal wire that holds the bone in position, often removed once healing has started.',
  'femoral-stem': 'The metal part of a hip replacement that sits inside the thigh bone, with a smooth ball on top.',
  'interbody-cage': 'A small spacer placed between two spine bones to restore the height and let them fuse.',
  'graft-block': 'A block of bone used to fill a gap and give new bone something to grow into.',
  'graft-strut': 'A strip of bone used to support and reinforce the repair.',
  'graft-wedge': 'A wedge of bone used to open up and correct the angle of a bone.',
  'cmf-mesh': 'A thin, trimmable metal mesh used to rebuild and support the shape of a bone.',
};

export const MATERIAL_LAY = {
  titanium: 'Titanium — light, very strong, and well accepted by the body.',
  titaniumPolished: 'Polished titanium — light, strong, and well accepted by the body.',
  stainless: 'Surgical stainless steel — strong and long established.',
  cobaltChrome: 'Cobalt-chrome — a hard-wearing metal used where strength matters most.',
  peek: 'A medical plastic that flexes a little more like natural bone.',
  zirconia: 'A ceramic with a very smooth, hard-wearing surface.',
  hydroxyapatite: 'Coated with a mineral like natural bone, to encourage bone to grow onto it.',
  corticalGraft: 'Bone graft — solid bone used to bridge and support the repair.',
  cancellousGraft: 'Bone graft — spongy bone that encourages new bone to grow.',
};

/** Lay explanation of a whole region, for the handout intro. */
export const REGION_LAY = {
  skeleton: 'the skeleton',
  spine: 'the spine and pelvis',
  lowerLimb: 'the leg',
  upperLimb: 'the arm',
  thorax: 'the chest',
  heart: 'the heart',
  airway: 'the airways',
  abdominal: 'the digestive organs',
  urinary: 'the kidneys and bladder',
  arterial: 'the arteries',
  venous: 'the veins',
  nervous: 'the nervous system',
  muscular: 'the muscles',
  full: 'the whole body',
};
