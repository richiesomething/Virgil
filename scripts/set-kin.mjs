// Sets `kin` on relationship states from a compact table.
// Usage: node scripts/set-kin.mjs <book> '<json table>'
// Table entries: [a, b, kin] applies to every state; [a, b, { "<from>": kin|null, ... }] per state
// (a missing chapter keeps the previous state's kin). Kin is how a is related to b.
import { readFileSync, writeFileSync } from 'node:fs'

const [book, table] = process.argv.slice(2)
const file = `data-src/${book}/relationships.json`
const rels = JSON.parse(readFileSync(file, 'utf8'))
const flip = { parent: 'child', child: 'parent', grandparent: 'grandchild', grandchild: 'grandparent' }
let missing = 0
for (const [a, b, spec] of JSON.parse(table)) {
  const r = rels.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
  if (!r) { console.error(`no relationship ${a}–${b}`); missing++; continue }
  const orient = (k) => (k && r.a !== a ? (flip[k] ?? k) : k)
  let current = null
  for (const s of r.states) {
    if (typeof spec === 'string') current = spec
    else if (String(s.from) in spec) current = spec[s.from]
    if (current) s.kin = orient(current)
    else delete s.kin
  }
}
writeFileSync(file, JSON.stringify(rels, null, 2) + '\n')
if (missing) process.exit(1)
console.log(`kin set for ${book}`)
