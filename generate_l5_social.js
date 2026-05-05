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

const additions = {

  // ============================================================
  // PSYCHOLOGY (Biopsychology / Evolutionary Psychology)
  // ============================================================
  903: ['Neurons and synapses','Neurotransmitter systems','Brain regions and function','Neural circuits','Neuroplasticity'],
  904: ['Endocrine system overview','Hormone classes','Neuroendocrine interaction','Hormones and behaviour','Stress hormones'],
  905: ['Sensory receptors','Visual processing','Auditory processing','Somatosensory processing','Olfaction and gustation'],
  906: ['Arousal systems','Reticular activating system','Physiological indicators of arousal','Optimal arousal theory','Attention and arousal'],
  907: ['Sleep stages','Sleep regulation','Circadian rhythms','Sleep disorders','Functions of sleep'],
  909: ['Behavioural adaptations','Cognitive adaptations','Adaptive behaviour','Environmental pressures','Evolutionary fitness'],
  910: ['Mate choice','Intersexual selection','Intrasexual competition','Secondary sexual characteristics','Sexual conflict'],
  911: ["Hamilton's rule",'Inclusive fitness','Altruism and relatedness','Coefficient of relatedness','Nepotism'],
  912: ['Tit-for-tat strategies','Reciprocity mechanisms','Cheater detection','Evolution of cooperation','Social exchange theory'],
  913: ['Life history theory','Attachment theory','Childhood development adaptations','Parent-offspring conflict','Developmental environment sensitivity'],

  // ============================================================
  // SOCIOLOGY
  // ============================================================
  2074: ['Marx and conflict theory','Durkheim and functionalism','Weber and interpretive sociology','Simmel and formal sociology','Spencer and social evolution'],
  2075: ['Parsonian systems theory',"Merton's middle-range theory",'Symbolic interactionism','Exchange theory','Phenomenological sociology'],
  2076: ["Bourdieu's field theory",'Structuration theory','Communicative action theory',"Luhmann's systems theory",'Network theory in sociology'],
  2077: ['Frankfurt School critical theory','Critical race scholarship','Feminist social theory','Postcolonial theory','Queer theory'],
  2078: ['Social institutions','Manifest and latent functions','Social equilibrium','Role theory','Functional prerequisites'],
  2080: ['Class structure','Class consciousness','Middle class formation','Class reproduction','Class and life chances'],
  2081: ['Status attainment','Prestige hierarchies','Social honour','Occupational prestige',"Weber's status groups"],
  2082: ['Intergenerational mobility','Intragenerational mobility','Mobility measurement','Structural mobility','Contest and sponsored mobility'],
  2083: ['Distributional inequality','Relational inequality','Categorical inequality','Cumulative disadvantage','Inequality mechanisms'],
  2084: ['Axes of oppression','Matrix of domination','Interlocking systems of power','Standpoint theory','Structural intersectionality'],
  2086: ['Nuclear family','Extended family','Single-parent families','Blended families','Non-traditional family forms'],
  2087: ['Marriage forms','Kinship systems','Descent rules','Alliance theory','Incest taboos'],
  2088: ['Household composition','Division of domestic labour','Domestic power relations','Resource allocation in households','Residence patterns'],
  2089: ['Second demographic transition','Deinstitutionalisation of marriage','Fertility decline','Family diversification','Cohabitation trends'],
  2091: ['Socialisation','Cultural capital transmission','Habitus formation','Institutional reproduction','Symbolic reproduction'],
  2092: ['Dominant ideology','Hegemony','False consciousness','Ideological state apparatuses','Discourse and power'],
  2093: ['Social identity','Self-concept','Identity formation','Stigma','Identity negotiation'],
  2094: ['Crowd behaviour','Panic and rumour','Mob dynamics','Mass hysteria','Emergent norms theory'],
  2095: ['Resource mobilisation','Political opportunity structures','Framing processes','New social movements','Movement outcomes'],
  2097: ['Questionnaire design','Sampling theory','Survey administration','Response bias','Longitudinal surveys'],
  2098: ['Ethnographic fieldwork','Field notes and records','Key informant interviews','Access negotiation','Reflexivity in research'],
  2099: ['Cross-national comparison','Most similar systems design','Most different systems design','Qualitative comparative analysis','Boolean comparison'],
  2100: ['Process tracing','Historical causation','Macro-historical analysis','Event sequence analysis','Long-run social change'],
  2101: ['Sequential mixed designs','Concurrent mixed designs','Triangulation','Integration strategies','Pragmatist epistemology'],

  // ============================================================
  // ECONOMICS — Microeconomics
  // ============================================================
  926: ['Supply and demand analysis','Consumer surplus','Producer surplus','Market clearing','Price determination'],
  927: ['Walrasian equilibrium','Arrow-Debreu model','Existence theorems','Uniqueness and stability','Computable general equilibrium'],

  // ============================================================
  // ECONOMICS — Macroeconomics
  // ============================================================
  938: ['GDP measurement','GNP and GNI','Value added approach','Expenditure approach','Income approach'],
  965: ['Mundell-Fleming model','Exchange rate determination','Current account dynamics','Capital flows and openness','Purchasing power parity'],

  // ============================================================
  // ECONOMICS — Econometrics
  // ============================================================
  999: ['Kernel estimation','Local polynomial regression','Nonparametric hypothesis testing','Density estimation','Semiparametric methods'],
  1000: ['Identification strategy','Structural model estimation','Counterfactual analysis','Dynamic structural models','Calibration methods'],

  // ============================================================
  // ECONOMICS — Public Economics
  // ============================================================
  1017: ['Unemployment insurance','Pension systems','Health insurance theory','Disability insurance','Moral hazard in insurance'],
  1018: ['Optimal tax theory','Welfare transfers','Means testing','Universal basic income theory','Incidence of redistribution'],
  1019: ['Decentralisation theory','Intergovernmental transfers','Tax assignment','Local public goods','Tiebout model'],
  1020: ['Benefit measurement','Cost measurement','Discount rate selection','Distributional weights','Sensitivity analysis'],

  // ============================================================
  // ECONOMICS — International Economics
  // ============================================================
  1033: ['Labour migration','Capital mobility','Technology transfer','Factor price equalisation','Mobility barriers'],
  1034: ['Current account','Capital account','Financial account','Reserve changes','Balance of payments adjustment'],
  1041: ['Spillover effects','Contagion mechanisms','Business cycle synchronisation','Trade linkages','Financial linkages'],

  // ============================================================
  // ECONOMICS — Labour Economics
  // ============================================================
  1043: ['Work-leisure trade-off','Labour force participation','Hours of work decisions','Human capital investment','Household labour supply'],
  1044: ['Derived demand for labour','Elasticity of labour demand','Factor substitution','Marginal product of labour','Monopsony'],
  1060: ['Trade unions','Collective bargaining','Minimum wage theory','Employment protection','Wage-setting institutions'],
  1061: ['Geographic mobility','Occupational mobility','Migration costs','Job matching','Labour turnover'],

  // ============================================================
  // ECONOMICS — Industrial Organisation
  // ============================================================
  1075: ['Cartel theory','Tacit collusion','Price-fixing','Repeated game collusion','Cartel stability'],
  1076: ['Resale price maintenance','Exclusive dealing','Tying arrangements','Vertical integration theory','Foreclosure effects'],
  1077: ['R&D incentives','Patent races','Innovation and market structure','Incumbent vs entrant innovation','Knowledge spillovers'],
  1078: ['Rate-of-return regulation','Price-cap regulation','Entry regulation','Quality regulation','Regulatory capture'],

  // ============================================================
  // ECONOMICS — Behavioural Economics
  // ============================================================
  1080: ['Discount rate','Hyperbolic discounting','Consumption smoothing','Commitment devices','Present bias'],

  // ============================================================
  // ECONOMICS — Financial Economics
  // ============================================================
  1094: ['Credit rationing','Adverse selection in credit','Moral hazard in lending','Collateral','Relationship banking'],
  1095: ['Efficient market hypothesis','Weak-form efficiency','Semi-strong efficiency','Strong-form efficiency','Market anomalies'],
  1096: ['Yield curve','Expectations hypothesis','Liquidity preference theory','Market segmentation theory','Duration and convexity'],
  1097: ['Information asymmetry in finance','Agency costs','Balance sheet constraints','Financial accelerator','Credit cycles'],

  // ============================================================
  // ECONOMICS — New Institutional Economics
  // ============================================================
  1099: ['Coase theorem','Rights definition and enforcement','Common property','Open access regimes','Property rights and investment'],
  1100: ['Measurement costs','Enforcement costs','Asset specificity','Opportunism','Bounded rationality'],
  1105: ['Contract enforcement','Third-party enforcement','Self-enforcing agreements','Legal institutions and growth','Reputation mechanisms'],
  1106: ['Markets vs hierarchies','Hybrid governance forms','Firm boundary theory','Contractual governance','Relational contracting'],
  1107: ['Lock-in effects','Increasing returns','Critical junctures','Institutional persistence','QWERTY economics'],
  1108: ['Social norms as institutions','Conventions','Trust and social capital','Cultural constraints','Informal enforcement mechanisms'],

  // ============================================================
  // ECONOMICS — Development Economics
  // ============================================================
  1123: ['Collateral and creditworthiness','Credit market exclusion','Microfinance mechanisms','Financial inclusion barriers','Poverty traps via credit'],
  1124: ['Informal sector definition','Informal employment patterns','Dualistic labour markets','Formalisation barriers','Productivity in informal firms'],
  1125: ['Diffusion of innovations','Technology adoption barriers','Appropriate technology','Returns to adoption','Learning by doing'],
  1126: ['Poverty traps','Coordination failures','Multiple equilibria','Big push theory','Institutional traps'],

  // ============================================================
  // ANTHROPOLOGY — Cultural Anthropology
  // ============================================================
  1984: ['Descent systems','Lineage and clan','Kinship terminology','Marriage alliance','Corporate kin groups'],
  1985: ['Sacred and profane','Ritual theory','Belief systems','Religious specialists','Myth and cosmology'],
  1986: ['Substantivism','Formalism in economic anthropology','Gift economy','Reciprocity and redistribution','Moral economy'],
  1987: ['Political organisation','Chiefdoms','Stateless societies','Power and authority in anthropology','Resistance'],
  1988: ['Symbol systems','Ritual symbolism','Cultural semantics','Metaphor in culture','Semiotic anthropology'],
  1989: ['Diffusion','Acculturation','Syncretism','Cultural evolution','Globalisation and culture'],

  // ============================================================
  // ANTHROPOLOGY — Biological Anthropology
  // ============================================================
  1991: ['Hominid evolution','Bipedalism','Brain evolution','Tool use evolution','Out of Africa hypothesis'],
  1992: ['Primate social behaviour','Primate cognition','Great ape studies','Primate ecology','Comparative primatology'],
  1993: ['Population genetics in anthropology','Genetic variation','Ancestry and migration genetics','Genetic adaptation','Genomic anthropology'],
  1994: ['Skeletal anatomy','Bone ageing methods','Sex determination from bone','Skeletal pathology','Taphonomy'],
  1995: ['Fossil hominin record','Dating methods','Site excavation','Morphological analysis','Phylogenetic reconstruction'],
  1996: ['Morphological variation','Physiological variation','Adaptive variation','Clines and populations','Race as biological concept'],

  // ============================================================
  // ANTHROPOLOGY — Linguistic Anthropology
  // ============================================================
  1998: ['Linguistic relativity','Sapir-Whorf hypothesis','Language and thought','Language and social structure','Ethnolinguistics'],
  1999: ['Conversation analysis','Critical discourse analysis','Speech acts','Genre analysis','Text and context'],
  2000: ['Acquisition of communicative competence','Language and socialisation agents','Pragmatic development','Cultural transmission through language','Caregiver speech'],
  2001: ['Bilingualism','Code-switching','Language contact','Language maintenance','Language shift'],
  2002: ['Standard language ideology','Language prestige','Language attitudes','Language policy','Metalinguistic awareness'],
  2003: ['Life narrative','Narrative structure','Storytelling and self','Collective narrative','Counter-narratives'],

  // ============================================================
  // ANTHROPOLOGY — Methods
  // ============================================================
  1983: ['Ethnographic writing','Representation in ethnography','Multi-sited ethnography','Visual ethnography','Digital ethnography'],
  2005: ['Gaining access','Observer roles','Recording field observations','Covert observation','Ethical issues in fieldwork'],
  2006: ['Cross-cultural comparison','Human relations area files',"Galton's problem",'Controlled comparison','Comparative case studies'],

  // ============================================================
  // POLITICAL SCIENCE — Political Theory
  // ============================================================
  2008: ['Ancient Greek political thought','Roman political thought','Medieval political philosophy','Renaissance political thought','Natural law tradition'],
  2009: ['Social contract tradition','Rights-based liberalism','Classical conservatism','Democratic theory','Republican government theory'],
  2010: ['Rawlsian justice','Communitarianism','Deliberative democracy','Multiculturalism theory','Post-structuralist political theory'],
  2011: ['Foundations of political obligation','Legitimacy and authority','Justice theory','Rights theory','Democratic legitimacy'],
  2012: ['Conceptual analysis in politics','Formal axiomatic methods','Rational foundations of politics','Voting theory','Preference aggregation theory'],

  // ============================================================
  // POLITICAL SCIENCE — Comparative Politics
  // ============================================================
  2014: ['Presidential systems','Parliamentary systems','Semi-presidential systems','Federal systems','Unitary systems'],
  2015: ['Majoritarian systems','Proportional representation','Mixed electoral systems','Constituency design','Preferential voting'],
  2016: ['Party organisation','Party ideology','Party systems','Party competition','Party-voter linkages'],
  2017: ['Legislative institutions','Executive institutions','Judicial institutions','Bureaucratic institutions','Constitutional design'],
  2018: ['Democracy types','Authoritarian regimes','Hybrid regimes','Totalitarianism','Regime transitions'],
  2019: ['Public goods theory','Free-rider problem',"Olson's logic of collective action",'Selective incentives','Collective action solutions'],

  // ============================================================
  // POLITICAL SCIENCE — International Relations
  // ============================================================
  2021: ['Anarchy in international relations','Polarity and systemic structure','Balance of power','Hegemonic stability theory','Systemic change'],
  2022: ['National power','Security dilemma','Arms competition dynamics','Alliance formation','Offensive and defensive realism'],
  2023: ['Regime theory','International organisations','Institutionalism in IR','Compliance theory','Multilateralism'],
  2024: ['Decision-making models','Bureaucratic politics model','Groupthink in foreign policy','Leader characteristics','Domestic sources of foreign policy'],
  2025: ['Strategy and statecraft','Military-political relations','War causation theories','Security competition','Grand strategic theory'],

  // ============================================================
  // POLITICAL SCIENCE — Public Administration
  // ============================================================
  2027: ['Weberian bureaucracy','Bureaucratic behaviour','Street-level bureaucracy','Bureaucratic politics','Administrative capacity'],
  2028: ['Agency problems','Delegation and control','Information asymmetry in governance','Incentive design','Accountability mechanisms'],
  2029: ['Policy cycle','Problem definition','Policy alternatives','Policy evaluation','Implementation theory'],
  2030: ['New public management','Network governance','Multi-level governance','Good governance','Regulatory governance'],

  // ============================================================
  // POLITICAL SCIENCE — Political Economy
  // ============================================================
  2032: ['Rational voter theory','Median voter theorem','Rent-seeking','Government failure','Constitutional economics'],
  2033: ['Pork barrel politics','Targeted transfers','Coalition building','Legislative bargaining','Electoral geography'],
  2034: ['Varieties of capitalism','Production regimes','Labour-capital relations','Welfare state theory','Growth models'],
  2035: ['Market-correcting state','Developmental state','Regulatory state','State capacity','Industrial policy theory'],

  // ============================================================
  // POLITICAL SCIENCE — Methods
  // ============================================================
  2037: ['Case study design','Comparative case analysis','Interpretive methods in politics','Elite interviewing','Field research in politics'],
  2038: ['Regression analysis in politics','Survey research in politics','Event data analysis','Text analysis in politics','Experimental methods in politics'],
  2039: ['Game-theoretic models','Spatial models of voting','Signalling models','Bargaining models','Agent-based modelling in politics'],
  2040: ['Natural experiments','Instrumental variables','Regression discontinuity','Difference-in-differences','Matching methods'],

  // ============================================================
  // LAW — Jurisprudence
  // ============================================================
  1929: ["Hart's concept of law","Austin's command theory","Kelsen's pure theory",'Inclusive vs exclusive positivism','Social sources thesis'],
  1930: ['American legal realism','Scandinavian legal realism','Indeterminacy of law','Judicial behaviour','Law in action'],
  1931: ['Indeterminacy thesis','Law and ideology','Fundamental contradiction thesis','Deconstruction of doctrine','Critical race scholarship in law'],
  1932: ['Deontic logic','Normative consistency','Norm hierarchies','Legal reasoning validity','Inference in law'],
  1933: ['Textual interpretation','Intentionalism','Purposivism','Precedent interpretation','Constitutional interpretation'],
  1934: ["Law's purpose",'Instrumental view of law','Consequentialist jurisprudence','Social function of law','Law and social engineering'],

  // ============================================================
  // LAW — General Theory of Law
  // ============================================================
  1936: ['Capacity of natural persons','Capacity of legal persons','Mental incapacity','Minority and capacity','Capacity in contract'],
  1937: ['Hohfeldian analysis','Rights types','Correlative duties','Active and passive duties','Rights conflicts'],
  1938: ['Natural persons','Corporations as persons','State personhood','Animal legal personhood','Artificial entities and personhood'],
  1939: ['Locus standi','Standing in constitutional law','Third-party standing','Class action standing','Procedural standing requirements'],

  // ============================================================
  // LAW — Law of Obligations
  // ============================================================
  1941: ['Contractual obligation','Promissory obligation','Consent theory','Formation of agreement','Gratuitous obligations'],
  1942: ['Tortious obligation','Statutory obligations','Imposed duties','Restitutionary obligation','Public law obligations'],
  1943: ['Enrichment at expense of another','Absence of juristic reason','Restitutionary remedies','Unjust factors','Change of position defence'],
  1944: ['Types of breach','Damages','Specific performance','Injunction','Rescission'],

  // ============================================================
  // LAW — Property Law
  // ============================================================
  1946: ['Fee simple','Absolute ownership','Relative ownership','Ownership and possession','Restrictions on ownership'],
  1947: ['Physical possession','Legal possession','Adverse possession','Possession as root of title','Constructive possession'],
  1948: ['Sale of property','Gift','Inheritance of property','Formalities of transfer','Registration of title'],
  1949: ['Mortgage','Pledge','Charge','Lien','Priority of security interests'],
  1950: ['Testate succession','Intestate succession','Wills formalities','Forced heirship','Administration of estates'],

  // ============================================================
  // LAW — Criminal Law
  // ============================================================
  1952: ['Negligence','Trespass','Nuisance','Defamation','Strict liability torts'],
  1953: ['Offences against the person','Offences against property','Public order offences','White-collar crime','Inchoate offences'],
  1954: ['Mens rea','Intention in criminal law','Recklessness','Negligence in criminal law','Strict liability in crime'],
  1955: ['Justification defences','Excuse defences','Self-defence','Duress','Insanity defence'],
  1956: ['Retributivism','Deterrence in punishment','Rehabilitation','Incapacitation','Restorative justice'],

  // ============================================================
  // LAW — Procedural Law
  // ============================================================
  1958: ['Judicial decision-making','Judicial reasoning','Standards of review','Appellate review','Stare decisis'],
  1959: ['Burden of proof','Standard of proof','Admissibility of evidence','Hearsay rules','Expert evidence'],
  1960: ['Party control of proceedings','Judicial initiative','Truth-seeking models','Role of counsel','Procedural fairness'],
  1961: ['Arbitration','Mediation','Negotiation','Conciliation','Online dispute resolution'],

  // ============================================================
  // LAW — Constitutional and Public Law
  // ============================================================
  1963: ['Rule of law principle','Constitutionalism','Constitutional supremacy','Democratic principle','Proportionality doctrine'],
  1964: ['Legislative power','Executive power','Judicial power','Checks and balances','Non-delegation doctrine'],
  1965: ['Civil and political rights','Economic and social rights','Rights limitations','Rights adjudication','Rights enforcement'],
  1966: ['Ultra vires doctrine','Substantive review','Legitimate expectations','Natural justice','Administrative discretion'],
  1967: ['Grounds for judicial review','Standing for judicial review','Intensity of review','Remedies in judicial review','Constitutional review'],
  1968: ['Input legitimacy','Output legitimacy','Normative legitimacy','Democratic legitimacy theory','Procedural legitimacy'],

  // ============================================================
  // LAW — International Law
  // ============================================================
  1970: ['Treaty formation','Treaty interpretation','Treaty modification','Treaty termination','Reservations to treaties'],
  1971: ['State practice','Opinio juris','Formation of custom','Regional custom','Persistent objector rule'],
  1972: ['Internationally wrongful acts','Attribution of conduct','Circumstances precluding wrongfulness','Reparation','Countermeasures in international law'],
  1973: ['Diplomatic immunity','Consular relations','Inviolability of missions','Diplomatic agents','Special missions'],
  1974: ['Distinction principle','Proportionality in IHL','Military necessity','Treatment of prisoners','Weapons regulation'],

  // ============================================================
  // LAW — Comparative Law
  // ============================================================
  1976: ['Common law methodology','Precedent doctrine','Equity and common law','Common law reasoning','Common law jurisdictions'],
  1977: ['Codification','Civil law methodology','Role of doctrine in civil law','Civil law reasoning','Civil law jurisdictions'],
  1978: ['Sources of Islamic law','Usul al-fiqh','Schools of Islamic jurisprudence','Ijtihad','Islamic law in contemporary states'],
  1979: ['Custom as source of law','Customary law communities','Recognition of customary law','Custom and state law interaction','Customary courts'],
  1980: ['Mixed jurisdiction theory','Common law-civil law mixtures','Bijural systems','Legal pluralism','Mixed system evolution'],
  1981: ['Reception of foreign law','Transplant mechanisms','Transplant success factors','Resistance to legal transplants','Legal borrowing'],

  // ============================================================
  // MILITARY SCIENCE — Strategic Theory
  // ============================================================
  2042: ['National ends','Military means and strategy','Diplomatic instruments','Economic instruments of power','Integration of instruments of power'],
  2043: ['Classical deterrence','Extended deterrence','Credibility of deterrence','Resolve and capability','Deterrence failure'],
  2044: ['Strategic culture definition','National strategic traditions','Institutional military culture','Cultural constraints on strategy','Strategic identity'],
  2045: ['Victory conditions','Criteria for success','War aims','Political objectives','Military objectives'],
  2046: ['Coercive diplomacy','Compellence','Punishment strategy','Denial strategy','Coercive bargaining'],

  // ============================================================
  // MILITARY SCIENCE — Operational Theory
  // ============================================================
  2048: ['Centre of gravity concept','Critical capabilities','Critical requirements','Critical vulnerabilities','Targeting from centre of gravity'],
  2049: ['Operational design','Phasing','Decisive points','Lines of effort','End state definition'],
  2050: ['Physical lines of operation','Logical lines of operation','Convergence of operations','Operational synchronisation','Sequencing of operations'],
  2051: ['Sequential operations','Simultaneous operations','Operational tempo','Culmination point','Phase transitions'],

  // ============================================================
  // MILITARY SCIENCE — Tactical Theory
  // ============================================================
  2053: ['Indirect approach','Envelopment','Encirclement','Exploitation','Pursuit'],
  2054: ['Suppression','Destruction by fires','Attrition','Fire support integration','Fires and manoeuvre integration'],
  2055: ['Objective principle','Offensive principle','Mass and economy of force','Unity of command','Surprise and security'],
  2056: ['OODA loop','Decision under uncertainty','Mission command','Commander\'s intent','Cognitive load in command'],

  // ============================================================
  // MILITARY SCIENCE — Logistics Theory
  // ============================================================
  2058: ['Power projection capability','Strategic lift','Expeditionary operations','Basing strategy','Logistics for force projection'],
  2059: ['Sustainment principles','Supply chain theory','Maintenance theory','Personnel sustainment','Medical sustainment'],
  2060: ['Supply line vulnerability','Interdiction of supply','Logistic nodes','Supply chain resilience','Forward logistics'],
  2061: ['Range constraints on operations','Weight and volume constraints','Throughput constraints','Fuel logistics','Ammunition logistics'],

  // ============================================================
  // MILITARY SCIENCE — Intelligence and Information
  // ============================================================
  2063: ['Uncertainty in conflict','Friction in war','Intelligence failure','Situational awareness','Command under uncertainty'],
  2064: ['Direction','Collection','Processing and exploitation','Analysis','Dissemination'],
  2065: ['Strategic deception','Operational deception','Camouflage and concealment','Feints and demonstrations','Counterintelligence'],
  2066: ['Information superiority','Command and control warfare','Electronic warfare theory','Cyber operations theory','Psychological operations theory'],

  // ============================================================
  // MILITARY SCIENCE — Doctrine and Innovation
  // ============================================================
  2068: ['Doctrine writing process','Lessons learned integration','Concept development','Doctrine validation','Doctrine dissemination'],
  2069: ['RMA theory','Technology and military change','Military innovation','Disruption in warfare','Network-centric warfare'],
  2070: ['Arms integration','Combined arms synergy','Task organisation','Mutual support','Combined arms team'],
  2071: ['Joint doctrine','Interoperability','Joint command structures','Joint enablers','Jointness principles'],
};

// ============================================================
// RUN
// ============================================================
const addedNodes = [];
const collisions = [];
const skippedNodes = [];

for (const [parentIdStr, labels] of Object.entries(additions)) {
  const parentId = parseInt(parentIdStr);
  if (hasChildren(parentId)) {
    skippedNodes.push({ parentId });
    continue;
  }
  for (const label of labels) {
    if (seenLabels.has(label.toLowerCase())) {
      collisions.push({ parentId, label });
      console.warn(`COLLISION: "${label}" (parent=${parentId})`);
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

const nodeById2 = {};
data.nodes.forEach(n => nodeById2[n.id] = n);
const lines = ['\n=== SOCIAL SCIENCES ==='];
const byParent = {};
addedNodes.forEach(a => { if (!byParent[a.parentId]) byParent[a.parentId] = []; byParent[a.parentId].push(a); });
Object.keys(byParent).map(Number).forEach(pid => {
  lines.push(`  [L4: ${pid}] ${nodeById2[pid] ? nodeById2[pid].label : '?'}`);
  byParent[pid].forEach(a => lines.push(`    id=${a.id} "${a.label}"`));
});
fs.appendFileSync(path.join(__dirname, 'additions_log.txt'), lines.join('\n') + '\n');

if (collisions.length > 0) {
  const cLines = ['\n--- Social Sciences collisions ---'];
  collisions.forEach(c => cLines.push(`SKIPPED: "${c.label}" (parent=${c.parentId})`));
  fs.appendFileSync(path.join(__dirname, 'collisions_log.txt'), cLines.join('\n') + '\n');
}
console.log('Logs updated.');
