const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'knowledge_map.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const seenLabels = new Set(data.nodes.map(n => n.label.toLowerCase()));
let nextId = Math.max(...data.nodes.map(n => n.id)) + 1;

const nodeById = {};
data.nodes.forEach(n => nodeById[n.id] = n);

// One replacement per parent (or two for 2189 and 2210 which lost two each)
const patches = [
  { parentId: 2109, label: 'Astrocytes' },
  { parentId: 2118, label: 'Voltage-gated channels' },
  { parentId: 2121, label: 'G1 checkpoint' },
  { parentId: 2159, label: 'Tumour progression' },
  { parentId: 2177, label: 'Antimicrobial resistance mechanisms' },
  { parentId: 2178, label: 'Viral replication cycle' },
  { parentId: 2189, label: 'Hardy-Weinberg law' },
  { parentId: 2189, label: 'Pedigree interpretation' },
  { parentId: 2192, label: 'Chromosomal banding' },
  { parentId: 2200, label: 'Counselling ethics' },
  { parentId: 2205, label: 'Causal reasoning' },
  { parentId: 2210, label: 'Null hypothesis testing' },
  { parentId: 2210, label: 'Interval estimation' },
];

const added = [];
const collisions = [];

for (const { parentId, label } of patches) {
  if (seenLabels.has(label.toLowerCase())) {
    collisions.push({ parentId, label });
    console.warn(`COLLISION: "${label}" (parent=${parentId}) already exists`);
    continue;
  }
  const newNode = { id: nextId, label, level: 5 };
  data.nodes.push(newNode);
  data.edges.push({ source: parentId, target: nextId });
  seenLabels.add(label.toLowerCase());
  added.push({ id: nextId, label, parentId, parentLabel: nodeById[parentId] ? nodeById[parentId].label : '?' });
  nextId++;
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`knowledge_map.json updated. Patch nodes added: ${added.length}`);

if (collisions.length > 0) {
  const cLines = ['\n--- Medicine patch collisions ---'];
  collisions.forEach(c => cLines.push(`SKIPPED: "${c.label}" under parent ${c.parentId} — label already exists`));
  fs.appendFileSync(path.join(__dirname, 'collisions_log.txt'), cLines.join('\n') + '\n');
}

const aLines = ['\n--- Medicine patch additions ---'];
added.forEach(a => aLines.push(`  id=${a.id} "${a.label}" under ${a.parentId} (${a.parentLabel})`));
fs.appendFileSync(path.join(__dirname, 'additions_log.txt'), aLines.join('\n') + '\n');
console.log('Logs updated.');
