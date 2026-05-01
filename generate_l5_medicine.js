const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'knowledge_map.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const nodeById = {};
data.nodes.forEach(n => nodeById[n.id] = n);

const childrenOf = {};
data.edges.forEach(e => {
  if (!childrenOf[e.source]) childrenOf[e.source] = [];
  childrenOf[e.source].push(e.target);
});

const hasChildren = id => (childrenOf[id] || []).length > 0;

const seenLabels = new Set(data.nodes.map(n => n.label.toLowerCase()));
let nextId = Math.max(...data.nodes.map(n => n.id)) + 1;

// Medicine L4 id -> L5 labels
const additions = {

  // === ANATOMY ===
  // Gross anatomy
  2102: ['Head and neck', 'Thorax and mediastinum', 'Abdominal regions', 'Pelvic anatomy', 'Limb anatomy'],
  2103: ['Anatomical landmarks', 'Surface projections', 'Vascular markings', 'Bony prominences', 'Dermatomes'],
  2104: ['Skeletal system', 'Muscular system', 'Circulatory system', 'Nervous system overview', 'Lymphatic system'],
  2105: ['Fascial planes', 'Anatomical spaces', 'Surgical triangles', 'Neurovascular bundles', 'Layer-by-layer dissection'],

  // Histology
  2106: ['Simple epithelium', 'Stratified epithelium', 'Pseudostratified epithelium', 'Glandular epithelium', 'Epithelial junctions'],
  2107: ['Loose connective tissue', 'Dense connective tissue', 'Cartilage histology', 'Bone histology', 'Blood as connective tissue'],
  2108: ['Skeletal muscle histology', 'Smooth muscle histology', 'Cardiac muscle histology', 'Sarcomere structure', 'Neuromuscular junction'],
  2109: ['Neuron types', 'Glial cells', 'Myelin sheath', 'Synaptic structures', 'Peripheral nerve histology'],

  // Embryology
  2110: ['Spermatogenesis', 'Oogenesis', 'Meiosis in reproduction', 'Gamete maturation', 'Hormonal regulation of gametogenesis'],
  2111: ['Sperm capacitation', 'Acrosome reaction', 'Zona pellucida penetration', 'Cortical reaction', 'Zygote formation'],
  2112: ['Germ layer derivatives', 'Neural tube formation', 'Heart development', 'Gut development', 'Limb development'],
  2113: ['Fetal growth milestones', 'Placental development', 'Fetal circulation', 'Amniotic fluid', 'Fetal organ maturation'],

  // Neuroanatomy
  2114: ['Cerebral cortex', 'Basal ganglia', 'Cerebellum structure', 'Brainstem anatomy', 'Spinal cord anatomy'],
  2115: ['Somatic nervous system', 'Sensory nerves', 'Motor nerves', 'Nerve plexuses', 'Dermatomes and myotomes'],
  2116: ['Sympathetic division', 'Parasympathetic division', 'Enteric nervous system', 'Autonomic ganglia', 'ANS neurotransmitters'],
  2117: ['Olfactory nerve', 'Optic nerve', 'Oculomotor group', 'Trigeminal nerve', 'Vagus nerve'],

  // === PHYSIOLOGY ===
  // Cellular physiology
  2118: ['Passive diffusion', 'Facilitated diffusion', 'Active transport', 'Ion channels', 'Endocytosis and exocytosis'],
  2119: ['Resting membrane potential', 'Depolarisation', 'Repolarisation', 'Refractory periods', 'Propagation velocity'],
  2120: ['Autocrine signalling', 'Paracrine signalling', 'Endocrine signalling', 'Gap junctions', 'Signal transduction pathways'],
  2121: ['Cell cycle phases', 'Mitosis stages', 'Meiosis stages', 'Cytokinesis', 'Cell cycle checkpoints'],

  // Organ systems
  2122: ['Cardiac cycle', 'Blood pressure regulation', 'Cardiac output', 'Vascular resistance', 'Baroreceptor reflex'],
  2123: ['Lung volumes', 'Gas exchange', 'Ventilation-perfusion matching', 'Oxygen transport', 'Carbon dioxide transport'],
  2124: ['Glomerular filtration', 'Tubular reabsorption', 'Tubular secretion', 'Urine concentration', 'Renin-angiotensin system'],
  2125: ['Gastric secretion', 'Intestinal absorption', 'Gut motility', 'Digestive enzymes', 'Gut hormones'],

  // Homeostasis
  2126: ['Heat production', 'Heat dissipation', 'Hypothalamic thermostat', 'Fever mechanisms', 'Thermal acclimatisation'],
  2127: ['Intracellular fluid', 'Extracellular fluid', 'Osmolarity regulation', 'ADH and aldosterone', 'Oedema mechanisms'],
  2128: ['Bicarbonate buffer', 'Respiratory compensation', 'Renal pH compensation', 'Acidosis and alkalosis', 'Blood gas interpretation'],
  2129: ['Insulin secretion', 'Glucagon action', 'Glycogenolysis', 'Gluconeogenesis', 'Insulin resistance'],

  // Neurophysiology
  2130: ['Sensory receptors', 'Sensory transduction', 'Sensory pathways', 'Perception and coding', 'Sensory adaptation'],
  2131: ['Motor cortex', 'Corticospinal tract', 'Cerebellar coordination', 'Basal ganglia circuits', 'Lower motor neurons'],
  2132: ['Neurotransmitter release', 'Postsynaptic potentials', 'Neurotransmitter reuptake', 'Synaptic plasticity', 'Inhibitory synapses'],
  2133: ['Temporal summation', 'Spatial summation', 'Inhibitory interneurons', 'Reflex arcs', 'Central pattern generators'],

  // === PATHOLOGY ===
  // Cellular injury
  2151: ['Ischaemia', 'Anoxia', 'Hypoxaemia', 'Cellular hypoxia adaptation', 'Reperfusion injury'],
  2152: ['Free radicals', 'Reactive oxygen species', 'Antioxidant defences', 'Lipid peroxidation', 'DNA oxidative damage'],
  2153: ['Intrinsic apoptosis pathway', 'Extrinsic apoptosis pathway', 'Caspase activation', 'Bcl-2 family', 'Phagocytic clearance'],
  2154: ['Coagulative necrosis', 'Liquefactive necrosis', 'Caseous necrosis', 'Fat necrosis', 'Gangrenous necrosis'],

  // Inflammation
  2155: ['Vascular changes', 'Cellular exudate', 'Neutrophil recruitment', 'Chemical mediators', 'Inflammation resolution'],
  2156: ['Macrophage activation', 'Lymphocyte involvement', 'Fibrosis', 'Granulation tissue', 'Systemic inflammatory effects'],
  2157: ['Epithelioid cells', 'Giant cells', 'Caseating granuloma', 'Non-caseating granuloma', 'Causes of granulomas'],
  2158: ['Wound healing phases', 'Primary intention', 'Secondary intention', 'Scar formation', 'Factors affecting healing'],

  // Neoplasia
  2159: ['Initiation', 'Promotion', 'Progression', 'Mutagen exposure', 'Hallmarks of cancer'],
  2160: ['Benign tumours', 'Malignant tumours', 'Epithelial tumours', 'Mesenchymal tumours', 'Mixed tumours'],
  2161: ['Local invasion', 'Lymphatic spread', 'Haematogenous spread', 'Transcoelomic spread', 'Metastatic cascade'],
  2162: ['Proto-oncogenes', 'Tumour suppressor genes', 'p53 pathway', 'Rb pathway', 'Growth factor receptors'],

  // Organ pathology
  2163: ['Atherosclerosis', 'Myocardial infarction', 'Heart failure', 'Valvular disease', 'Cardiomyopathies'],
  2164: ['Pneumonia', 'Chronic obstructive pulmonary disease', 'Pulmonary fibrosis', 'Lung carcinoma', 'Pulmonary embolism'],
  2165: ['Hepatitis', 'Cirrhosis', 'Hepatocellular carcinoma', 'Fatty liver disease', 'Cholestasis'],
  2166: ['Glomerulonephritis', 'Nephrotic syndrome', 'Acute kidney injury', 'Chronic kidney disease', 'Renal carcinoma'],

  // === PHARMACOLOGY ===
  // Pharmacokinetics
  2167: ['Volume of distribution', 'Protein binding', 'Blood-brain barrier', 'Tissue accumulation', 'Apparent distribution volume'],
  2168: ['Renal drug excretion', 'Biliary excretion', 'Glomerular filtration rate', 'Tubular drug secretion', 'Enterohepatic circulation'],
  2240: ['Phase I reactions', 'Phase II reactions', 'Cytochrome P450', 'First-pass effect', 'Enzyme induction and inhibition'],
  2241: ['Oral bioavailability', 'Gastrointestinal absorption', 'Transdermal absorption', 'Intravenous administration', 'Sublingual absorption'],

  // Pharmacodynamics
  2169: ['Lock and key model', 'Receptor subtypes', 'Receptor occupancy', 'Receptor signal transduction', 'Receptor regulation'],
  2170: ['ED50', 'Therapeutic index', 'Potency and efficacy', 'Graded response', 'Quantal response'],
  2171: ['Full agonists', 'Partial agonists', 'Competitive antagonism', 'Non-competitive antagonism', 'Inverse agonists'],
  2172: ['Hepatotoxicity', 'Nephrotoxicity', 'Cardiotoxicity', 'Adverse drug reactions', 'Drug interactions'],

  // Drug classes
  2173: ['Beta-lactams', 'Aminoglycosides', 'Fluoroquinolones', 'Macrolides', 'Tetracyclines'],
  2174: ['Antihypertensives', 'Antiarrhythmics', 'Anticoagulants', 'Statins', 'Diuretics'],
  2175: ['Antidepressants', 'Antipsychotics', 'Anxiolytics', 'Anticonvulsants', 'Anaesthetics'],
  2176: ['NSAIDs', 'Corticosteroids', 'DMARDs', 'Biologics', 'COX-2 inhibitors'],

  // === IMMUNOLOGY ===
  // Pathogens
  2177: ['Gram-positive bacteria', 'Gram-negative bacteria', 'Bacterial virulence factors', 'Antibiotic resistance', 'Bacterial toxins'],
  2178: ['Viral replication', 'RNA viruses', 'DNA viruses', 'Viral entry mechanisms', 'Antiviral immunity'],
  2179: ['Pathogenic fungi', 'Fungal cell wall', 'Fungal infections', 'Antifungal targets', 'Dimorphic fungi'],
  2180: ['Protozoa', 'Helminths', 'Ectoparasites', 'Parasitic life cycles', 'Antiparasitic drugs'],

  // Immune response
  2181: ['Pattern recognition receptors', 'Toll-like receptors', 'Complement system', 'Natural killer cells', 'Phagocytosis'],
  2182: ['Antigen presentation', 'T cell activation', 'B cell activation', 'Clonal selection', 'Adaptive immune memory'],
  2183: ['Antibody structure', 'Immunoglobulin classes', 'B cell differentiation', 'Plasma cells', 'Antibody effector functions'],
  2184: ['CD4 T helper cells', 'CD8 cytotoxic T cells', 'T regulatory cells', 'NK cell activation', 'Cytokine signalling'],

  // Vaccines
  2185: ['Live attenuated vaccines', 'Inactivated vaccines', 'Subunit vaccines', 'mRNA vaccines', 'Conjugate vaccines'],
  2186: ['Herd immunity threshold', 'Vaccination coverage', 'Community protection', 'R0 and Rt', 'Population immunity gaps'],
  2187: ['Alum adjuvants', 'Oil emulsions', 'TLR agonist adjuvants', 'Cytokine adjuvants', 'Adjuvant mechanisms'],
  2188: ['Memory B cells', 'Memory T cells', 'Long-lived plasma cells', 'Secondary immune response', 'Immune memory duration'],

  // === GENETICS & GENOMICS ===
  // Inheritance
  2189: ['Autosomal dominant', 'Autosomal recessive', 'X-linked inheritance', 'Hardy-Weinberg equilibrium', 'Pedigree analysis'],
  2190: ['Incomplete dominance', 'Codominance', 'Genomic imprinting', 'Anticipation', 'Variable expressivity'],
  2191: ['DNA methylation', 'Histone modification', 'Chromatin remodelling', 'Non-coding RNA regulation', 'Epigenetic inheritance'],
  2192: ['Meiotic segregation', 'Linkage and recombination', 'Chromosomal crossover', 'Gene mapping', 'Cytogenetics'],

  // Genetic disorders
  2193: ['Cystic fibrosis', 'Sickle cell anaemia', 'Huntington\'s disease', 'Phenylketonuria', 'Marfan syndrome'],
  2194: ['Trisomy 21', 'Monosomy X', 'Klinefelter syndrome', 'Chromosomal deletions', 'Chromosomal translocations'],
  2195: ['Polygenic inheritance', 'Gene-environment interaction', 'Quantitative trait loci', 'Common disease variants', 'GWAS findings'],
  2196: ['Mitochondrial DNA mutations', 'Maternal inheritance pattern', 'MELAS syndrome', 'Leigh syndrome', 'Mitochondrial dysfunction'],

  // Genomic medicine
  2197: ['Whole genome sequencing', 'Exome sequencing', 'Next-generation sequencing', 'Sanger sequencing', 'Sequencing applications'],
  2198: ['Viral vectors', 'CRISPR-Cas9', 'Gene editing', 'Gene replacement', 'RNA interference'],
  2199: ['Drug metabolism genes', 'Genetic polymorphisms', 'Personalised medicine', 'Adverse reaction prediction', 'Pharmacogenomic testing'],
  2200: ['Risk assessment', 'Carrier testing', 'Prenatal diagnosis', 'Genetic risk communication', 'Informed consent'],

  // === EPIDEMIOLOGY ===
  // Disease patterns
  2201: ['Incidence rate', 'Point prevalence', 'Period prevalence', 'Attack rate', 'Cumulative incidence'],
  2202: ['Endemic disease', 'Epidemic curve', 'Pandemic spread', 'Epidemic threshold', 'Sporadic disease'],
  2203: ['Passive surveillance', 'Active surveillance', 'Sentinel surveillance', 'Laboratory surveillance', 'Syndromic surveillance'],
  2204: ['Case definition', 'Descriptive epidemiology', 'Analytical epidemiology', 'Source identification', 'Outbreak control measures'],

  // Risk factors
  2205: ['Bradford Hill criteria', 'Necessary and sufficient causes', 'Counterfactual causation', 'Causal inference', 'Directed acyclic graphs'],
  2206: ['Confounding definition', 'Confounding control', 'Stratification', 'Restriction', 'Propensity score'],
  2207: ['Interaction', 'Heterogeneity of effects', 'Subgroup analysis', 'Additive interaction', 'Multiplicative interaction'],
  2208: ['Attributable risk percent', 'Population attributable risk', 'Excess risk', 'Preventable fraction', 'Risk difference'],

  // Biostatistics
  2209: ['Randomised controlled trial', 'Cohort study', 'Case-control study', 'Cross-sectional study', 'Ecological study'],
  2210: ['Hypothesis testing', 'Confidence intervals', 'P-values', 'Type I and type II errors', 'Statistical power'],
  2211: ['Kaplan-Meier curves', 'Hazard ratio', 'Cox regression', 'Censoring', 'Time-to-event data'],
  2212: ['Systematic review', 'Heterogeneity assessment', 'Forest plot', 'Funnel plot', 'Fixed vs random effects'],

  // === SPORTS SCIENCE ===
  // Biomechanics
  2213: ['Ground reaction forces', 'Joint moments', 'Impulse and momentum', 'Work and power', 'Force-velocity relationship'],
  2214: ['Free body diagrams', 'Muscle force vectors', 'Joint reaction forces', 'Static equilibrium', 'Dynamic force analysis'],
  2215: ['Metabolic cost of locomotion', 'Mechanical efficiency', 'Energy storage in tendons', 'Gait optimisation', 'Elastic energy return'],

  // Exercise physiology
  2216: ['ATP-PCr system', 'Glycolytic system', 'Oxidative phosphorylation', 'Energy system interaction', 'VO2 max'],
  2217: ['Heart rate response', 'Stroke volume adaptation', 'Exercise cardiac output', 'Blood redistribution', 'Exercise blood pressure'],
  2218: ['Peripheral fatigue', 'Central fatigue', 'Metabolic fatigue', 'Muscle acidosis', 'Neuromuscular fatigue'],
  2219: ['Active recovery', 'Passive recovery', 'Excess post-exercise oxygen consumption', 'Sleep and recovery', 'Recovery nutrition'],

  // === NUTRITION ===
  // Macronutrients
  2221: ['Simple sugars', 'Complex carbohydrates', 'Dietary fibre', 'Glycaemic index', 'Carbohydrate digestion'],
  2222: ['Essential amino acids', 'Protein digestion', 'Protein quality', 'Nitrogen balance', 'Protein synthesis'],
  2223: ['Saturated fatty acids', 'Unsaturated fatty acids', 'Trans fats', 'Essential fatty acids', 'Fat digestion'],
  2224: ['Basal metabolic rate', 'Total energy expenditure', 'Energy intake assessment', 'Positive energy balance', 'Negative energy balance'],

  // Micronutrients
  2226: ['Fat-soluble vitamins', 'Water-soluble vitamins', 'Vitamin functions', 'Vitamin toxicity', 'Provitamins'],
  2227: ['Macrominerals', 'Microminerals', 'Mineral absorption', 'Mineral functions', 'Mineral interactions'],
  2228: ['Iron metabolism', 'Zinc functions', 'Selenium and antioxidants', 'Iodine and thyroid', 'Copper metabolism'],
  2229: ['Vitamin A deficiency', 'Iron deficiency anaemia', 'Iodine deficiency', 'Vitamin D deficiency', 'Scurvy'],

  // Nutritional biochemistry
  2231: ['Carbohydrate metabolism', 'Lipid metabolism', 'Protein catabolism', 'Metabolic integration', 'Fed and fasting states'],
  2232: ['Salivary enzymes', 'Gastric acid secretion', 'Pancreatic enzymes', 'Bile salts', 'Intestinal enzymes'],
  2233: ['Intestinal absorptive cells', 'Portal circulation', 'Lymphatic nutrient transport', 'Carrier proteins', 'Active nutrient uptake'],
  2234: ['Nutrigenomics', 'Nutrigenetics', 'Epigenetic nutrition', 'Diet-gene expression', 'Personalised nutrition'],

  // Nutritional requirements
  2236: ['Recommended dietary allowance', 'Tolerable upper limit', 'Adequate intake', 'Estimated average requirement', 'Reference nutrient intake'],
  2237: ['Infant nutrition', 'Adolescent nutrition', 'Pregnancy nutrition', 'Elderly nutrition', 'Lactation nutrition'],
  2238: ['Enteral nutrition', 'Parenteral nutrition', 'Nutritional assessment', 'Therapeutic diets', 'Nutritional support'],
  2239: ['Protein-energy malnutrition', 'Kwashiorkor', 'Marasmus', 'Micronutrient deficiency', 'Overnutrition'],
};

const addedNodes = [];
const collisions = [];
const skippedNodes = [];

for (const [parentIdStr, labels] of Object.entries(additions)) {
  const parentId = parseInt(parentIdStr);
  if (hasChildren(parentId)) {
    skippedNodes.push({ parentId, reason: 'already has L5 children' });
    continue;
  }
  for (const label of labels) {
    if (seenLabels.has(label.toLowerCase())) {
      collisions.push({ parentId, label });
      console.warn(`COLLISION: "${label}" (parent=${parentId}) conflicts with existing node`);
      continue;
    }
    const newNode = { id: nextId, label, level: 5 };
    data.nodes.push(newNode);
    data.edges.push({ source: parentId, target: nextId });
    seenLabels.add(label.toLowerCase());
    addedNodes.push({ id: nextId, parentId, label });
    nextId++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('knowledge_map.json updated.');
console.log(`New nodes added: ${addedNodes.length}`);
console.log(`Collisions skipped: ${collisions.length}`);
console.log(`Parents skipped (already had children): ${skippedNodes.length}`);

// Build additions log
const nodeById2 = {};
data.nodes.forEach(n => nodeById2[n.id] = n);
const lines = ['\n=== MEDICINE ==='];

// Group by L3 (grandparent)
const byParent = {};
addedNodes.forEach(a => {
  if (!byParent[a.parentId]) byParent[a.parentId] = [];
  byParent[a.parentId].push(a);
});

const parentIds = Object.keys(byParent).map(Number);
parentIds.forEach(pid => {
  const parentNode = nodeById2[pid];
  lines.push(`  [L4: ${pid}] ${parentNode ? parentNode.label : '?'}`);
  byParent[pid].forEach(a => lines.push(`    id=${a.id} "${a.label}"`));
});

fs.appendFileSync(path.join(__dirname, 'additions_log.txt'), lines.join('\n') + '\n');

// Build collisions log
if (collisions.length > 0) {
  const cLines = ['\n--- Medicine collisions ---'];
  collisions.forEach(c => {
    cLines.push(`SKIPPED: "${c.label}" (parent=${c.parentId}) — label already exists`);
  });
  fs.appendFileSync(path.join(__dirname, 'collisions_log.txt'), cLines.join('\n') + '\n');
}

console.log('additions_log.txt appended.');
