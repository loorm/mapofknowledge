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
  // COMPUTER SCIENCE — Theory of Computation
  // ============================================================

  // Complexity classes, reductions, and circuit/randomised complexity
  // are 6 distinct intellectual traditions in the field
  1601: [
    'Complexity classes (P, NP, PSPACE, EXPTIME)',
    'NP-completeness',
    'Reducibility',
    'Randomised complexity',
    'Circuit complexity',
    'Approximation and parameterised complexity',
  ],

  // The Chomsky hierarchy has exactly 4 levels — no more, no less
  1602: [
    'Regular languages',
    'Context-free languages',
    'Context-sensitive languages',
    'Recursively enumerable languages',
  ],

  1603: [
    'Propositional logic and SAT',
    'First-order logic',
    'Temporal logic and model checking',
    'Hoare logic and program verification',
    'Type-theoretic foundations',
  ],

  1605: [
    'Asymptotic notation',
    'Recurrence relations',
    'Amortised analysis',
    'Probabilistic analysis',
    'Lower bound techniques',
  ],

  // Network flow is a distinct paradigm alongside the standard five
  1606: [
    'Divide and conquer',
    'Dynamic programming',
    'Greedy algorithms',
    'Backtracking and branch-and-bound',
    'Network flow methods',
    'Randomised algorithm design',
  ],

  1607: [
    'Arrays and linked lists',
    'Trees',
    'Heaps and priority queues',
    'Hash tables',
    'Graph representations',
    'Advanced trees (B-trees, tries, skip lists)',
  ],

  1608: [
    'Convex hull algorithms',
    'Voronoi diagrams and Delaunay triangulation',
    'Point location',
    'Geometric intersection',
    'Range searching',
  ],

  1609: [
    'Monte Carlo algorithms',
    'Las Vegas algorithms',
    'Probabilistic data structures',
    'Randomised graph algorithms',
    'Derandomisation',
  ],

  1611: [
    'Simply typed lambda calculus',
    'Polymorphic type systems',
    'Dependent types',
    'Linear and affine types',
    'Type inference algorithms',
  ],

  1612: [
    'Operational semantics',
    'Denotational semantics',
    'Axiomatic semantics',
    'Game semantics',
    'Categorical semantics',
  ],

  // Matches the five canonical phases of a compiler
  1613: [
    'Lexical analysis',
    'Parsing',
    'Semantic analysis',
    'Intermediate representation',
    'Code generation and optimisation',
  ],

  1614: [
    'Process algebra',
    'Petri nets',
    'Mutual exclusion and synchronisation',
    'Deadlock theory',
    'Memory consistency models',
  ],

  // ============================================================
  // COMPUTER SCIENCE — Computer Architecture
  // ============================================================

  1616: [
    'RISC vs CISC design philosophies',
    'Addressing modes',
    'Instruction encoding',
    'Register file design',
    'ISA compatibility and evolution',
  ],

  // Follows the five canonical levels of the memory hierarchy
  1617: [
    'Registers',
    'Cache memory',
    'Main memory',
    'Virtual memory',
    'Secondary storage',
  ],

  1618: [
    'Shared-memory multiprocessors',
    'Distributed-memory systems',
    'SIMD architectures',
    'GPU computing architectures',
    'Interconnect networks',
  ],

  1619: [
    'Coherence protocols (MESI, MOESI)',
    'Cache invalidation strategies',
    'Write-through and write-back policies',
    'False sharing',
    'Coherence in many-core systems',
  ],

  1620: [
    'Pipeline design',
    'Superscalar execution',
    'Out-of-order execution',
    'Branch prediction',
    'Processor-memory interface',
  ],

  1621: [
    'Hazard handling',
    'Forwarding and bypassing',
    'Dynamic scheduling (Tomasulo algorithm)',
    'Reorder buffer',
    'Speculative execution',
  ],

  // ============================================================
  // COMPUTER SCIENCE — Operating Systems
  // ============================================================

  1623: [
    'Process model',
    'Scheduling algorithms',
    'Context switching',
    'Inter-process communication',
    'Synchronisation primitives',
  ],

  1624: [
    'Paging',
    'Segmentation',
    'Page replacement algorithms',
    'Memory allocation strategies',
    'Garbage collection',
  ],

  1625: [
    'File system structure',
    'Directory organisation',
    'File allocation methods',
    'Journaling and crash consistency',
    'File system security',
  ],

  1626: [
    'Uniprocessor scheduling',
    'Real-time scheduling',
    'Multiprocessor scheduling',
    'Fair-share scheduling',
    'Energy-aware scheduling',
  ],

  1627: [
    'Full virtualisation',
    'Paravirtualisation',
    'Hardware-assisted virtualisation',
    'Container-based virtualisation',
    'Storage and network virtualisation',
  ],

  // ============================================================
  // COMPUTER SCIENCE — Distributed Systems
  // ============================================================

  1629: [
    'Sequential consistency',
    'Linearisability',
    'Causal consistency',
    'Eventual consistency',
    'Release consistency',
  ],

  1630: [
    'Paxos',
    'Raft',
    'Byzantine fault-tolerant consensus',
    'Leader election',
    'Distributed commitment protocols',
  ],

  1631: [
    'Physical clock synchronisation',
    'Logical clocks',
    'Vector clocks',
    'Global snapshot algorithms',
    'Causality and happens-before relation',
  ],

  1632: [
    'Replication strategies',
    'Checkpointing and recovery',
    'Failure models',
    'Error detection and correction',
    'Self-healing systems',
  ],

  // ============================================================
  // COMPUTER SCIENCE — Databases
  // ============================================================

  1634: [
    'Selection',
    'Projection',
    'Join operations',
    'Set operations in relational algebra',
    'Division operation',
  ],

  // Follows the natural progression of normal forms
  1635: [
    'First normal form',
    'Second normal form',
    'Third normal form',
    'Boyce-Codd normal form',
    'Higher normal forms (4NF, 5NF)',
  ],

  1636: [
    'Query rewriting',
    'Index selection',
    'Join ordering',
    'Cost estimation',
    'Execution plan generation',
  ],

  1637: [
    'ACID properties',
    'Serializability',
    'Isolation levels',
    'Locking and concurrency control',
    'Recovery mechanisms',
  ],

  // ============================================================
  // AGRONOMY — Soil Science
  // ============================================================

  1639: [
    'Soil texture and structure',
    'Soil water dynamics',
    'Soil air and aeration',
    'Soil temperature',
    'Soil compaction and tillage effects',
  ],

  1640: [
    'Soil pH and acidity',
    'Cation exchange capacity',
    'Soil organic matter chemistry',
    'Nutrient availability',
    'Soil buffering capacity',
  ],

  1641: [
    'Soil microbiome',
    'Soil fauna',
    'Mycorrhizal associations',
    'Biological nitrogen fixation',
    'Decomposition processes',
  ],

  1642: [
    'Macronutrient supply',
    'Micronutrient supply',
    'Fertiliser application',
    'Nutrient cycling in soil',
    'Soil organic carbon management',
  ],

  // ============================================================
  // AGRONOMY — Crop Science
  // ============================================================

  1644: [
    'Photosynthesis in crops',
    'Crop respiration',
    'Transpiration and water relations',
    'Crop growth and development stages',
    'Dry matter accumulation and partitioning',
  ],

  1645: [
    'Crop-environment interactions',
    'Intraspecific competition',
    'Crop rotation effects',
    'Intercropping systems',
    'Agroecological principles',
  ],

  1646: [
    'Nitrogen nutrition',
    'Phosphorus nutrition',
    'Potassium nutrition',
    'Micronutrient nutrition',
    'Nutrient uptake mechanisms',
  ],

  1647: [
    'Economic damage thresholds',
    'Pesticide application principles',
    'Resistance mechanisms in crops',
    'Resistance management strategies',
    'Environmental impact of crop protection',
  ],

  1648: [
    'Yield components',
    'Harvest index',
    'Yield gap analysis',
    'Yield stability',
    'Crop yield modelling',
  ],

  // ============================================================
  // AGRONOMY — Irrigation and Water Management
  // ============================================================

  1650: [
    'Evapotranspiration',
    'Reference evapotranspiration',
    'Crop coefficient',
    'Water stress effects on yield',
    'Crop water demand modelling',
  ],

  // Five distinct irrigation delivery methods
  1651: [
    'Surface irrigation',
    'Sprinkler irrigation',
    'Drip irrigation',
    'Subsurface irrigation',
    'Deficit irrigation strategies',
  ],

  1652: [
    'Surface drainage design',
    'Subsurface drainage',
    'Tile drainage systems',
    'Waterlogging effects on crops',
    'Drainage and water table management',
  ],

  1653: [
    'Water productivity metrics',
    'Rainwater harvesting',
    'Soil moisture conservation',
    'Deficit irrigation for efficiency',
    'Crop choice and water efficiency',
  ],

  1654: [
    'Salt-affected soil types',
    'Leaching requirement',
    'Salt-tolerant crops',
    'Saline water irrigation management',
    'Sodicity management',
  ],

  // ============================================================
  // AGRONOMY — Crop Protection
  // ============================================================

  1656: [
    'Agricultural pest identification',
    'Insect life cycles',
    'Chemical insecticides',
    'Biological insect control',
    'Insect resistance management',
  ],

  1657: [
    'Weed ecology',
    'Herbicide mechanisms of action',
    'Herbicide resistance',
    'Mechanical weeding',
    'Cultural weed control',
  ],

  1658: [
    'Fungal plant diseases',
    'Bacterial plant diseases',
    'Viral plant diseases',
    'Disease epidemiology in crops',
    'Plant immune mechanisms',
  ],

  1659: [
    'Predator-prey relationships in biocontrol',
    'Parasitoids',
    'Microbial biocontrol agents',
    'Conservation biological control',
    'Classical biological control',
  ],

  // ============================================================
  // AGRONOMY — Plant Breeding
  // ============================================================

  // Five canonical selection methods in plant breeding
  1661: [
    'Mass selection',
    'Pedigree selection',
    'Recurrent selection',
    'Marker-assisted selection',
    'Genomic selection',
  ],

  1662: [
    'Hybrid vigour and heterosis',
    'F1 hybrid production',
    'Crossing and hybridisation techniques',
    'Hybrid seed production systems',
    'Hybrid performance and stability',
  ],

  1663: [
    'Induced mutagenesis',
    'Chemical mutagens',
    'Radiation mutagenesis',
    'Mutation screening',
    'TILLING',
  ],

  1664: [
    'Variety trials',
    'Release procedures',
    'Plant variety protection',
    'Variety registration',
    'Variety maintenance',
  ],

  1665: [
    'Seed quality assessment',
    'Seed dormancy',
    'Seed priming',
    'Seed treatment',
    'Seed storage',
  ],

  // ============================================================
  // AGRONOMY — Farming Systems
  // ============================================================

  // Five distinct cropping system types
  1667: [
    'Monoculture',
    'Polyculture',
    'Relay cropping',
    'Sequential cropping',
    'Agroforestry',
  ],

  1668: [
    'Crop-livestock integration',
    'Manure management',
    'Fodder crops',
    'Mixed farm planning',
    'Nutrient cycling in mixed farms',
  ],

  1669: [
    'Food self-sufficiency principles',
    'Traditional crop varieties',
    'Low-input agriculture',
    'Household food security',
    'Smallholder farming systems',
  ],

  1670: [
    'GPS guidance in farming',
    'Variable rate technology',
    'Remote sensing in agriculture',
    'Yield mapping',
    'Precision irrigation management',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Structure
  // ============================================================

  1672: [
    'Unit cell and lattice parameters',
    'Bravais lattices',
    'Miller indices',
    'Crystal symmetry and space groups',
    'X-ray crystallography',
  ],

  1673: [
    'Grain structure',
    'Phase distribution',
    'Precipitate identification',
    'Sample preparation and etching',
    'Microstructural quantification',
  ],

  // Five fundamental bonding types in materials
  1674: [
    'Ionic bonding',
    'Covalent bonding',
    'Metallic bonding',
    'Van der Waals interactions',
    'Hydrogen bonding in materials',
  ],

  // Four geometric classes of defects plus their interactions
  1675: [
    'Point defects',
    'Line defects (dislocations)',
    'Planar defects',
    'Volume defects',
    'Defect interactions',
  ],

  1676: [
    'Glass network structure',
    'Short-range order',
    'Glass transition temperature',
    'Amorphous metals',
    'Network formers and modifiers',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Phase Behaviour
  // ============================================================

  1678: [
    'Binary phase diagrams',
    'Eutectic systems',
    'Ternary phase diagrams',
    'Lever rule',
    'Phase diagram reading and interpretation',
  ],

  1679: [
    'Martensitic transformation',
    'Diffusional phase transformation',
    'Spinodal decomposition',
    'Precipitation hardening',
    'Solidification',
  ],

  1680: [
    'Gibbs free energy of phases',
    'Chemical potential',
    'Phase rule',
    'Thermodynamic activity and fugacity',
    'Equilibrium and driving force',
  ],

  1681: [
    'Homogeneous nucleation',
    'Heterogeneous nucleation',
    'Critical nucleus size',
    'Nucleation rate',
    'Nucleation barriers',
  ],

  1682: [
    'Dendritic growth',
    'Eutectic solidification',
    'Segregation during solidification',
    'Directional solidification',
    'Rapid solidification',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Defects
  // ============================================================

  // Five canonical point defect types
  1684: [
    'Vacancies',
    'Interstitial defects',
    'Substitutional atoms',
    'Frenkel defects',
    'Schottky defects',
  ],

  1685: [
    'Edge dislocations',
    'Screw dislocations',
    'Dislocation motion and slip',
    'Dislocation interactions',
    'Dislocation density and strengthening',
  ],

  1686: [
    'Low-angle grain boundaries',
    'High-angle grain boundaries',
    'Special boundaries (CSL)',
    'Grain boundary segregation',
    'Grain boundary diffusion',
  ],

  1687: [
    'Free surfaces',
    'Stacking faults',
    'Twin boundaries',
    'Anti-phase boundaries',
    'Surface energy',
  ],

  1688: [
    'Diffusion mechanisms',
    'Dislocation glide and climb',
    'Recovery',
    'Recrystallisation',
    'Grain growth',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Mechanical Properties
  // ============================================================

  1690: [
    'Stress and strain tensors',
    'Elastic moduli',
    'Anisotropic elasticity',
    'Elastic energy',
    'Thermoelastic effects',
  ],

  1691: [
    'Yield criteria',
    'Slip systems',
    'Work hardening',
    'Plastic flow',
    'Crystal plasticity',
  ],

  1692: [
    'Stress intensity factor',
    'Fracture toughness',
    'Linear elastic fracture mechanics',
    'Elastic-plastic fracture mechanics',
    'Fatigue crack growth',
  ],

  1693: [
    'S-N curves',
    'Fatigue crack initiation',
    'Fatigue crack propagation',
    'Fatigue life prediction',
    'High-cycle and low-cycle fatigue',
  ],

  1694: [
    'Creep mechanisms',
    'Creep deformation stages',
    'Creep rupture',
    'High-temperature alloy behaviour',
    'Creep-fatigue interaction',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Physical Properties
  // ============================================================

  // Five distinct electrical regimes in materials
  1696: [
    'Electrical conductivity in metals',
    'Semiconductor behaviour',
    'Dielectric and insulating behaviour',
    'Superconductivity',
    'Ionic conductivity',
  ],

  // Five fundamental magnetic orderings
  1697: [
    'Ferromagnetism',
    'Paramagnetism',
    'Diamagnetism',
    'Antiferromagnetism',
    'Ferrimagnetism',
  ],

  1698: [
    'Optical absorption and transmission',
    'Reflection and refraction in materials',
    'Luminescence',
    'Photonic and optical fibre applications',
    'Nonlinear optical behaviour',
  ],

  1699: [
    'Thermal conductivity',
    'Specific heat capacity',
    'Thermal expansion',
    'Thermal shock resistance',
    'Thermoelectric effects',
  ],

  // ============================================================
  // MATERIALS SCIENCE — Characterisation
  // ============================================================

  // Five main microscopy families
  1701: [
    'Optical microscopy',
    'Scanning electron microscopy',
    'Transmission electron microscopy',
    'Scanning probe microscopy',
    'Atom probe tomography',
  ],

  1702: [
    'X-ray diffraction',
    'Neutron diffraction',
    'Electron diffraction',
    'Rietveld refinement',
    'Small-angle scattering',
  ],

  1703: [
    'X-ray spectroscopy',
    'Electron spectroscopy',
    'Infrared spectroscopy',
    'Raman spectroscopy',
    'Auger electron spectroscopy',
  ],

  1704: [
    'Differential scanning calorimetry',
    'Thermogravimetric analysis',
    'Differential thermal analysis',
    'Dilatometry',
    'Dynamic mechanical analysis',
  ],

  // Five standard mechanical test types
  1705: [
    'Tensile testing',
    'Hardness testing',
    'Impact testing',
    'Fatigue testing',
    'Creep testing',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Structural Engineering
  // ============================================================

  // Six genuinely distinct approaches to structural analysis
  1708: [
    'Statics of determinate structures',
    'Indeterminate structure analysis',
    'Matrix structural analysis',
    'Finite element analysis',
    'Dynamic structural analysis',
    'Plastic analysis',
  ],

  // Design methods keyed to the main structural materials
  1709: [
    'Reinforced concrete design',
    'Steel structure design',
    'Timber design',
    'Masonry design',
    'Limit state design principles',
  ],

  // Six distinct load categories recognised in structural codes
  1710: [
    'Dead loads',
    'Live loads',
    'Wind loads',
    'Seismic loads',
    'Snow and thermal loads',
    'Load combinations and partial factors',
  ],

  1711: [
    'Yielding and plasticity',
    'Brittle fracture',
    'Buckling',
    'Fatigue failure',
    'Progressive collapse',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Geotechnical Engineering
  // ============================================================

  1713: [
    'Soil classification and description',
    'Effective stress principle',
    'Consolidation theory',
    'Shear strength of soils',
    'Seepage and pore pressure',
  ],

  // Shallow and deep foundations are the two fundamental types,
  // each supported by bearing capacity, settlement, and difficult-ground design
  1714: [
    'Shallow foundations',
    'Deep foundations',
    'Bearing capacity',
    'Settlement analysis',
    'Foundations in difficult ground',
  ],

  1715: [
    'Rock classification',
    'Rock strength and failure criteria',
    'Discontinuity characterisation',
    'Underground excavation mechanics',
    'Rock slope behaviour',
  ],

  1716: [
    'Slope failure mechanisms',
    'Limit equilibrium methods',
    'Slope stability analysis',
    'Slope remediation',
    'Landslide monitoring',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Transportation Engineering
  // ============================================================

  1718: [
    'Road geometric design',
    'Pavement design',
    'Pavement materials',
    'Highway drainage',
    'Road safety engineering',
  ],

  1719: [
    'Macroscopic traffic flow models',
    'Microscopic traffic simulation',
    'Traffic queuing theory',
    'Capacity and level of service',
    'Traffic signal control theory',
  ],

  1720: [
    'Track geometry and alignment',
    'Track components and materials',
    'Vehicle-track dynamics',
    'Railway signalling principles',
    'Railway structures',
  ],

  1721: [
    'Runway and taxiway design',
    'Airport pavement design',
    'Airside capacity and geometry',
    'Landside infrastructure',
    'Airport drainage and utilities',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Water Resources Engineering
  // ============================================================

  1723: [
    'Open channel flow',
    'Pressurised pipe flow',
    'Hydraulic structures',
    'Unsteady flow analysis',
    'Computational hydraulics',
  ],

  1724: [
    'Rainfall-runoff modelling',
    'Flood frequency analysis',
    'Drought assessment',
    'Catchment water balance',
    'Hydrological data analysis',
  ],

  1725: [
    'Water source development',
    'Water treatment processes',
    'Distribution network design',
    'Pumping systems',
    'Water quality management',
  ],

  // Follows the wastewater treatment train
  1726: [
    'Wastewater collection systems',
    'Primary treatment',
    'Secondary biological treatment',
    'Tertiary treatment',
    'Sludge handling and disposal',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Construction Engineering and Management
  // ============================================================

  1728: [
    'Concrete and cement',
    'Structural steel',
    'Masonry materials',
    'Timber in construction',
    'Geosynthetics and polymers',
  ],

  1729: [
    'Earthworks and excavation',
    'Formwork and falsework',
    'Prefabrication and modular construction',
    'Lifting and crane operations',
    'Specialist construction techniques',
  ],

  1730: [
    'Critical path method',
    'PERT and programme planning',
    'Resource levelling',
    'Earned value management',
    'Schedule risk analysis',
  ],

  1731: [
    'Quantity surveying',
    'Unit rate estimating',
    'Parametric estimating',
    'Contingency and risk allowances',
    'Whole life costing',
  ],

  // ============================================================
  // CIVIL ENGINEERING — Environmental Engineering
  // ============================================================

  1733: [
    'Air pollutant types and sources',
    'Atmospheric dispersion modelling',
    'Emission control technologies',
    'Air quality monitoring and standards',
    'Indoor air quality',
  ],

  1734: [
    'Waste characterisation',
    'Landfill design and engineering',
    'Mechanical and biological treatment',
    'Thermal treatment of waste',
    'Hazardous waste management',
  ],

  1735: [
    'Site investigation and characterisation',
    'In situ remediation techniques',
    'Ex situ remediation techniques',
    'Monitored natural attenuation',
    'Remediation performance monitoring',
  ],

  1736: [
    'Noise source characterisation',
    'Noise propagation modelling',
    'Noise measurement and assessment',
    'Noise barriers and control',
    'Vibration engineering',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Mechanics of Materials
  // ============================================================

  1739: [
    'Stress components and notation',
    'Equilibrium equations',
    'Principal stresses and Mohr\'s circle',
    'Stress concentration factors',
    'Thermal and residual stresses',
  ],

  1740: [
    'Strain components',
    'Principal strains',
    'Compatibility equations',
    'Strain measurement techniques',
    'Strain energy',
  ],

  1741: [
    'Elastic deformation',
    'Plastic deformation',
    'Viscoelastic deformation',
    'Large deformation theory',
    'Deformation at elevated temperature',
  ],

  // Four classical failure criteria: maximum stress, Tresca, von Mises,
  // fracture mechanics — plus fatigue as a fifth distinct mode
  1742: [
    'Maximum normal stress criterion',
    'Maximum shear stress (Tresca) criterion',
    'Von Mises criterion',
    'Fracture mechanics-based criteria',
    'Fatigue failure criteria',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Thermodynamics and Heat Transfer
  // ============================================================

  // Five fundamental thermodynamic cycles (Carnot is the ideal reference;
  // Rankine, Brayton, Otto, Diesel are the four practical cycles)
  1744: [
    'Carnot cycle',
    'Rankine cycle',
    'Brayton cycle',
    'Otto cycle',
    'Diesel cycle',
  ],

  1745: [
    'Vapour compression cycle',
    'Absorption refrigeration',
    'Refrigerants and working fluids',
    'Heat pumps',
    'Cryogenic refrigeration',
  ],

  // Three modes of heat transfer plus heat exchangers and phase change
  1746: [
    'Conduction',
    'Convection',
    'Thermal radiation',
    'Heat exchanger design',
    'Phase change heat transfer',
  ],

  1747: [
    'Combustion thermodynamics',
    'Flame theory',
    'Combustion kinetics',
    'Pollutant formation in combustion',
    'Combustion in engines and furnaces',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Fluid Mechanics
  // ============================================================

  1749: [
    'Laminar pipe flow',
    'Turbulent pipe flow',
    'Head losses (major and minor)',
    'Pipe network analysis',
    'Compressible pipe flow',
  ],

  1750: [
    'Boundary layer theory',
    'Lift and drag fundamentals',
    'Aerofoil aerodynamics',
    'Flow separation and wakes',
    'Compressibility effects on flow',
  ],

  1751: [
    'Centrifugal pumps and compressors',
    'Axial-flow machines',
    'Turbines',
    'Machine characteristics and performance curves',
    'Cavitation',
  ],

  1752: [
    'Discretisation methods',
    'Mesh generation',
    'Turbulence modelling',
    'Pressure-velocity coupling',
    'Validation and verification in CFD',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Machine Design
  // ============================================================

  1754: [
    'Mechanisms and linkages',
    'Velocity analysis',
    'Acceleration analysis',
    'Gear trains',
    'Cam mechanisms',
  ],

  1755: [
    'Equations of motion for machines',
    'Balancing of rotating machinery',
    'Vibration in machines',
    'Critical speeds',
    'Rotor dynamics',
  ],

  // Friction, wear, and lubrication are the three core pillars of tribology;
  // bearing design and surface engineering are the main applications
  1756: [
    'Friction',
    'Wear',
    'Lubrication',
    'Bearing design',
    'Surface engineering',
  ],

  1757: [
    'Fatigue life assessment',
    'Stress concentration in design',
    'Fatigue loading spectra',
    'Surface treatment for fatigue resistance',
    'Damage tolerance design',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Manufacturing Processes
  // ============================================================

  1759: [
    'Cutting theory',
    'Cutting tools and tool wear',
    'Turning and milling',
    'Drilling and grinding',
    'Machining parameters and optimisation',
  ],

  // Five canonical forming process families
  1760: [
    'Forging',
    'Rolling',
    'Drawing',
    'Extrusion',
    'Sheet metal forming',
  ],

  1761: [
    'Welding',
    'Brazing and soldering',
    'Mechanical fastening',
    'Adhesive bonding',
    'Additive manufacturing',
  ],

  1762: [
    'Dimensional measurement',
    'Surface texture measurement',
    'Geometric dimensioning and tolerancing',
    'Measurement uncertainty',
    'Coordinate measuring machines',
  ],

  // ============================================================
  // MECHANICAL ENGINEERING — Control Systems
  // ============================================================

  1764: [
    'Transfer functions',
    'Root locus method',
    'Frequency response methods',
    'PID control',
    'Classical stability criteria',
  ],

  1765: [
    'State space representation',
    'Controllability and observability',
    'State feedback design',
    'Observer and estimator design',
    'Optimal control',
  ],

  1766: [
    'Sampling and discretisation',
    'Z-transform methods',
    'Digital controller design',
    'Discrete-time stability analysis',
    'Implementation and quantisation effects',
  ],

  1767: [
    'Feedback principles',
    'Sensitivity and robustness',
    'Stability margins',
    'Loop shaping',
    'Disturbance rejection',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Circuit Theory
  // ============================================================

  1770: [
    'Kirchhoff\'s voltage and current laws',
    'DC network theorems',
    'DC power analysis',
    'Resistive network analysis',
    'DC transient response',
  ],

  1771: [
    'Phasors and complex impedance',
    'AC power and power factor',
    'Resonance in AC circuits',
    'Three-phase systems',
    'AC steady-state analysis',
  ],

  1772: [
    'Graph theory for networks',
    'Node and mesh analysis',
    'Two-port networks',
    'Network functions and transfer functions',
    'Signal flow graphs',
  ],

  1773: [
    'Superposition principle',
    'Thevenin and Norton equivalents',
    'Maximum power transfer',
    'Source transformation',
    'Star-delta transformation',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Electromagnetics
  // ============================================================

  1775: [
    'Electrostatics',
    'Magnetostatics',
    'Electromagnetic induction',
    'Maxwell\'s equations',
    'Boundary conditions',
  ],

  1776: [
    'Plane wave propagation',
    'Transmission lines',
    'Waveguides',
    'Polarisation',
    'Reflection and refraction of waves',
  ],

  1777: [
    'Antenna parameters and figures of merit',
    'Dipole and monopole antennas',
    'Array antennas',
    'Aperture antennas',
    'Antenna matching and feeding',
  ],

  1778: [
    'Microwave network analysis',
    'Microwave passive devices',
    'Microwave filters',
    'Microwave amplifiers',
    'Microwave measurements',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Electronics
  // ============================================================

  // Five canonical semiconductor device families
  1780: [
    'p-n junction diodes',
    'Bipolar junction transistors',
    'MOSFETs',
    'Power semiconductor devices',
    'Optoelectronic devices',
  ],

  1781: [
    'Operational amplifiers',
    'Amplifier design and biasing',
    'Oscillators',
    'Active filters',
    'Analogue signal processing circuits',
  ],

  1782: [
    'Logic gates and Boolean algebra',
    'Combinational logic design',
    'Sequential logic design',
    'Memory elements and registers',
    'Programmable logic devices',
  ],

  1783: [
    'Rectifiers and AC-DC conversion',
    'DC-DC converters',
    'Inverters and DC-AC conversion',
    'Power electronic drives',
    'Power quality and filtering',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Signal Processing
  // ============================================================

  // Five forms of Fourier analysis progressing from continuous to discrete
  1785: [
    'Fourier series',
    'Continuous Fourier transform',
    'Discrete Fourier transform',
    'Fast Fourier transform',
    'Short-time Fourier transform',
  ],

  1786: [
    'Filter specifications and types',
    'FIR filter design',
    'IIR filter design',
    'Adaptive filtering',
    'Multirate signal processing',
  ],

  1787: [
    'Discrete-time signals and systems',
    'Sampling theorem',
    'Z-transform',
    'DSP algorithms and architectures',
    'DSP applications',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Power Systems
  // ============================================================

  // Four generation types plus generator theory
  1789: [
    'Thermal power generation',
    'Hydroelectric generation',
    'Nuclear power generation',
    'Renewable generation',
    'Synchronous generator theory',
  ],

  1790: [
    'Overhead transmission lines',
    'Underground power cables',
    'High-voltage AC transmission',
    'HVDC transmission',
    'Transmission system losses',
  ],

  1791: [
    'Distribution system design',
    'Distribution transformers',
    'Distribution protection',
    'Power quality',
    'Smart grid and distribution automation',
  ],

  // Five stability phenomena in power systems
  1792: [
    'Steady-state stability',
    'Transient stability',
    'Voltage stability',
    'Frequency stability',
    'Small-signal stability',
  ],

  // ============================================================
  // ELECTRICAL ENGINEERING — Communications Engineering
  // ============================================================

  1794: [
    'Amplitude modulation',
    'Frequency and phase modulation',
    'Digital modulation schemes',
    'Spread spectrum techniques',
    'OFDM',
  ],

  1795: [
    'Source coding',
    'Error detection codes',
    'Error correction codes',
    'Turbo and LDPC codes',
    'Shannon channel capacity',
  ],

  1796: [
    'Radio wave propagation',
    'Multiple access schemes',
    'MIMO systems',
    'Cellular network design',
    'Wireless communication standards',
  ],

  1797: [
    'Optical fibre propagation',
    'Optical transmitters and sources',
    'Optical receivers and detectors',
    'Wavelength division multiplexing',
    'Optical network design',
  ],

  // ============================================================
  // CHEMICAL ENGINEERING — Transport Phenomena
  // ============================================================

  1800: [
    'Molecular diffusion',
    'Convective mass transfer',
    'Mass transfer coefficients',
    'Interphase mass transfer',
    'Mass transfer with chemical reaction',
  ],

  1801: [
    'Viscous flow theory',
    'Boundary layer in fluid flow',
    'Turbulent momentum transport',
    'Non-Newtonian fluid behaviour',
    'Multiphase flow',
  ],

  1802: [
    'Simultaneous heat and mass transfer',
    'Momentum and heat transfer analogy',
    'Multicomponent diffusion',
    'Stefan-Maxwell equations',
    'Transport in porous media',
  ],

  // ============================================================
  // CHEMICAL ENGINEERING — Reaction Engineering
  // ============================================================

  // Four fundamental reactor types plus non-ideal flow
  1804: [
    'Batch reactor design',
    'Continuous stirred tank reactor',
    'Plug flow reactor',
    'Non-ideal reactor flow models',
    'Reactor sizing and comparison',
  ],

  1805: [
    'Rate laws',
    'Activation energy and Arrhenius equation',
    'Reaction mechanism and elementary steps',
    'Catalytic reaction kinetics',
    'Enzyme kinetics',
  ],

  1806: [
    'Catalyst characterisation',
    'Heterogeneous catalysis',
    'Homogeneous catalysis',
    'Catalyst deactivation',
    'Catalytic reactor design',
  ],

  1807: [
    'Heat of reaction',
    'Thermodynamic equilibrium in reactions',
    'Gibbs energy and equilibrium constant',
    'Effect of temperature on equilibrium',
    'Effect of pressure on equilibrium',
  ],

  // ============================================================
  // CHEMICAL ENGINEERING — Separation Processes
  // ============================================================

  1809: [
    'Binary distillation',
    'Multicomponent distillation',
    'Distillation column design',
    'Reflux ratio and operating conditions',
    'Azeotropic and extractive distillation',
  ],

  1810: [
    'Gas-liquid equilibrium',
    'Absorption column design',
    'Stripping',
    'Solvent selection',
    'Reactive absorption',
  ],

  1811: [
    'Liquid-liquid equilibrium',
    'Liquid-liquid extraction equipment',
    'Supercritical fluid extraction',
    'Leaching',
    'Extraction cascade design',
  ],

  // Five distinct membrane separation types
  1812: [
    'Reverse osmosis',
    'Ultrafiltration and nanofiltration',
    'Gas separation membranes',
    'Pervaporation',
    'Membrane characterisation and fouling',
  ],

  // ============================================================
  // CHEMICAL ENGINEERING — Process Engineering
  // ============================================================

  1814: [
    'Process flow diagrams',
    'Mass and energy balances',
    'Equipment selection and sizing',
    'Process integration and heat recovery',
    'Debottlenecking and retrofitting',
  ],

  1815: [
    'Process dynamics',
    'PID control for processes',
    'Control loop tuning',
    'Advanced process control',
    'Process instrumentation',
  ],

  1816: [
    'Linear programming in process optimisation',
    'Nonlinear optimisation',
    'Mixed integer programming',
    'Heuristic optimisation methods',
    'Real-time optimisation',
  ],

  1817: [
    'Hazard identification (HAZOP)',
    'Quantitative risk assessment',
    'Relief system design',
    'Safety instrumented systems',
    'Process safety management systems',
  ],

  // ============================================================
  // CHEMICAL ENGINEERING — Thermodynamics
  // ============================================================

  1819: [
    'Vapour-liquid equilibrium',
    'Liquid-liquid equilibrium',
    'Solid-liquid equilibrium',
    'Activity coefficient models',
    'Equations of state for phase equilibria',
  ],

  1820: [
    'Equilibrium constant',
    'Le Chatelier\'s principle',
    'Simultaneous chemical reactions',
    'Electrochemical equilibrium',
    'Equilibrium in solution',
  ],

  // Four main equation of state families
  1821: [
    'Ideal gas law',
    'Van der Waals equation',
    'Cubic equations of state (Peng-Robinson, SRK)',
    'Virial equation of state',
    'Statistical mechanical equations of state',
  ],

  1822: [
    'Activity and fugacity',
    'Excess thermodynamic properties',
    'Regular solution theory',
    'Local composition models (NRTL, UNIQUAC)',
    'Mixing rules',
  ],

  // ============================================================
  // AEROSPACE ENGINEERING — Aerodynamics (Detailed regimes)
  // ============================================================

  1824: [
    'Potential flow theory',
    'Thin aerofoil theory',
    'Finite wing theory',
    'Boundary layer in subsonic flow',
    'Subsonic drag polar',
  ],

  1825: [
    'Transonic flow characteristics',
    'Shock-boundary layer interaction',
    'Supercritical aerofoils',
    'Wave drag',
    'Transonic flutter and buffet',
  ],

  1826: [
    'Oblique shock wave theory',
    'Expansion waves (Prandtl-Meyer)',
    'Supersonic aerofoil theory',
    'Supersonic inlet design',
    'Sonic boom',
  ],

  1827: [
    'Newtonian impact theory',
    'High-temperature gas dynamics',
    'Viscous interaction effects',
    'Blunt body aerodynamics',
    'Hypersonic vehicle aerothermodynamics',
  ],

  // ============================================================
  // AEROSPACE ENGINEERING — Flight Mechanics and Propulsion
  // ============================================================

  1829: [
    'Range and endurance',
    'Climb and descent performance',
    'Take-off and landing performance',
    'Manoeuvre envelope',
    'Aircraft efficiency metrics',
  ],

  1830: [
    'Longitudinal stability and control',
    'Lateral-directional stability and control',
    'Fly-by-wire systems',
    'Flight control law design',
    'Autopilot and flight management',
  ],

  1831: [
    'Aircraft equations of motion',
    'Trajectory optimisation',
    'Ballistic and powered trajectories',
    'Atmospheric entry trajectory',
    'Guidance and navigation',
  ],

  1833: [
    'Turbojet thermodynamic cycle',
    'Turbofan cycle and bypass ratio',
    'Turboprop and turboshaft',
    'Inlet and nozzle design',
    'Combustor design',
  ],

  1834: [
    'Chemical rocket propulsion principles',
    'Solid propellants',
    'Liquid propellants',
    'Rocket nozzle theory',
    'Specific impulse and performance metrics',
  ],

  // Propeller theory has four natural intellectual divisions
  1835: [
    'Momentum (actuator disk) theory',
    'Blade element theory',
    'Propeller aerodynamic design',
    'Propeller performance characteristics',
  ],

  // Ramjet theory has four core aspects; scramjet is a natural extension
  1836: [
    'Ramjet inlet compression',
    'Subsonic combustion in ramjets',
    'Ramjet nozzle and performance analysis',
    'Scramjet principles',
  ],

  // ============================================================
  // AEROSPACE ENGINEERING — Aerospace Structures
  // ============================================================

  1838: [
    'Static aeroelasticity',
    'Flutter',
    'Gust response',
    'Aeroelastic tailoring',
    'Limit cycle oscillations',
  ],

  1839: [
    'Composite materials in aerospace',
    'Classical laminate theory',
    'Failure modes of composites',
    'Joining and repair of composites',
    'Manufacturing of aerospace composites',
  ],

  1840: [
    'Fatigue loading in aircraft',
    'Damage tolerance design',
    'Inspection interval determination',
    'Safe life vs damage tolerance philosophy',
    'Aerospace fatigue testing',
  ],

  1841: [
    'Free vibration and natural frequencies',
    'Forced vibration response',
    'Modal analysis',
    'Random vibration',
    'Structural damping',
  ],

  // ============================================================
  // AEROSPACE ENGINEERING — Space Systems
  // ============================================================

  1843: [
    "Kepler's laws",
    'Orbital elements',
    'Orbital manoeuvres',
    'Orbit perturbations',
    'Interplanetary trajectory design',
  ],

  1844: [
    'Attitude representation',
    'Attitude dynamics',
    'Attitude control systems',
    'Momentum management',
    'Flexible spacecraft dynamics',
  ],

  1845: [
    'Re-entry trajectory mechanics',
    'Aerodynamic heating',
    'Thermal protection systems',
    'Deceleration mechanisms',
    'Landing systems',
  ],

  1846: [
    'Mission requirements definition',
    'Orbital design and launch windows',
    'Launch vehicle selection',
    'Delta-V budget',
    'Systems engineering for space missions',
  ],

  // ============================================================
  // NUCLEAR ENGINEERING — Reactor Physics
  // ============================================================

  1849: [
    'Neutron cross sections',
    'Neutron moderation',
    'Neutron energy spectrum',
    'Neutron transport theory',
    'Neutron activation analysis',
  ],

  1850: [
    'Point kinetics model',
    'Delayed neutrons',
    'Reactor period',
    'Reactivity coefficients',
    'Kinetics with thermal feedback',
  ],

  1851: [
    'One-group diffusion theory',
    'Multi-group diffusion theory',
    'Critical geometry and mass',
    'Reactivity control methods',
    'Criticality safety',
  ],

  // ============================================================
  // NUCLEAR ENGINEERING — Radiation Science
  // ============================================================

  // Five canonical radiation types
  1853: [
    'Alpha radiation',
    'Beta radiation',
    'Gamma radiation',
    'Neutron radiation',
    'X-ray radiation',
  ],

  // Five interaction mechanisms
  1854: [
    'Photoelectric effect',
    'Compton scattering',
    'Pair production',
    'Neutron interaction mechanisms',
    'Charged particle stopping',
  ],

  1855: [
    'Shielding materials',
    'Attenuation coefficients',
    'Buildup factors',
    'Shielding design principles',
    'Neutron shielding',
  ],

  // Five dosimetry quantities progressing from physical to protection quantities
  1856: [
    'Absorbed dose',
    'Equivalent dose',
    'Effective dose',
    'Dosimetry instruments and methods',
    'Dose limits and constraints',
  ],

  // ============================================================
  // NUCLEAR ENGINEERING — Nuclear Fuel Cycle
  // ============================================================

  1858: [
    'Uranium dioxide fuel',
    'Mixed oxide fuel',
    'Fuel pellet fabrication',
    'Fuel rod and assembly design',
    'Fuel burnup and irradiation behaviour',
  ],

  1859: [
    'Zirconium alloy cladding',
    'Stainless steel cladding',
    'Cladding corrosion mechanisms',
    'Cladding mechanical behaviour under irradiation',
    'Fuel-cladding interaction',
  ],

  1860: [
    'Displacement damage',
    'Radiation-induced swelling',
    'Radiation embrittlement',
    'Helium embrittlement',
    'Radiation-induced segregation and precipitation',
  ],

  1861: [
    'High-level radioactive waste',
    'Intermediate-level waste',
    'Low-level waste',
    'Waste conditioning and immobilisation',
    'Deep geological disposal',
  ],

  // ============================================================
  // NUCLEAR ENGINEERING — Reactor Thermal Hydraulics
  // ============================================================

  1863: [
    'Single-phase coolant flow',
    'Two-phase flow in reactors',
    'Natural circulation',
    'Flow instability',
    'Coolant chemistry',
  ],

  1864: [
    'Core heat generation distribution',
    'Decay heat removal',
    'Emergency core cooling systems',
    'Passive safety systems',
    'Reactor heat exchangers',
  ],

  1865: [
    'Nucleate boiling',
    'Film boiling',
    'Critical heat flux',
    'Departure from nucleate boiling',
    'Boiling instability',
  ],

  1866: [
    'Design basis accidents',
    'Probabilistic risk assessment',
    'Loss of coolant accident analysis',
    'Defence in depth',
    'Safety systems design',
  ],

  // ============================================================
  // NUCLEAR ENGINEERING — Fuel Cycle Engineering
  // ============================================================

  1868: [
    'Natural and enriched uranium',
    'Gaseous diffusion enrichment',
    'Gas centrifuge enrichment',
    'Laser enrichment',
    'Enrichment monitoring and safeguards',
  ],

  1869: [
    'Powder processing',
    'Pellet sintering',
    'Fuel rod assembly',
    'Quality control in fuel fabrication',
    'Fuel specifications and standards',
  ],

  1870: [
    'Wet storage of spent fuel',
    'Dry cask storage',
    'Spent fuel transport',
    'Cooling requirements for spent fuel',
    'Spent fuel characterisation',
  ],

  1871: [
    'PUREX process',
    'Plutonium separation and management',
    'Uranium recovery and recycling',
    'Reprocessing plant design',
    'Non-proliferation aspects of reprocessing',
  ],
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
const lines = ['\n=== APPLIED SCIENCES ==='];
const byParent = {};
addedNodes.forEach(a => { if (!byParent[a.parentId]) byParent[a.parentId] = []; byParent[a.parentId].push(a); });
Object.keys(byParent).map(Number).forEach(pid => {
  lines.push(`  [L4: ${pid}] ${nodeById2[pid] ? nodeById2[pid].label : '?'}`);
  byParent[pid].forEach(a => lines.push(`    id=${a.id} "${a.label}"`));
});
fs.appendFileSync(path.join(__dirname, 'additions_log.txt'), lines.join('\n') + '\n');

if (collisions.length > 0) {
  const cLines = ['\n--- Applied Sciences collisions ---'];
  collisions.forEach(c => cLines.push(`SKIPPED: "${c.label}" (parent=${c.parentId})`));
  fs.appendFileSync(path.join(__dirname, 'collisions_log.txt'), cLines.join('\n') + '\n');
}
console.log('Logs updated.');
