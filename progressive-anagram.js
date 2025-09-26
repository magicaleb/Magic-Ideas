// Progressive Anagram — optimized core (no UI)

const A = "a".charCodeAt(0);
const bit = i => 1 << i;

function normalizeWord(w) {
  return w.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g,"oe").replace(/æ/g,"ae").trim();
}

function preprocess(words) {
  return words
    .map(raw => {
      const norm = normalizeWord(raw);
      let m = 0;
      for (let i = 0; i < norm.length; i++) {
        const c = norm.charCodeAt(i) - A;
        if (c >= 0 && c < 26) m |= bit(c);
      }
      return { raw, norm, mask: m };
    })
    .filter(x => x.norm.length > 0);
}

function bestLetterIndex(items, usedMask, useEntropy = false) {
  const n = items.length;
  if (n <= 1) return -1;
  const counts = new Int16Array(26);
  for (const it of items) {
    let m = it.mask & ~usedMask;
    while (m) {
      const i = Math.clz32(m) ^ 31;
      counts[i]++;
      m &= m - 1;
    }
  }
  let best = -1, bestScore = Infinity, bestIG = -1;
  const H = p => (p <= 0 || p >= 1) ? 0 : -(p*Math.log2(p) + (1-p)*Math.log2(1-p));
  for (let i = 0; i < 26; i++) {
    if (usedMask & bit(i)) continue;
    const c = counts[i];
    if (c === 0 || c === n) continue;
    if (useEntropy) {
      const p = c / n;
      const ig = 1 - (p*H(p) + (1-p)*H(1-p));
      if (ig > bestIG) { bestIG = ig; best = i; }
    } else {
      const score = Math.abs(c - (n - c));
      if (score < bestScore) { bestScore = score; best = i; }
    }
  }
  return best;
}

export function buildTree(words, opts = {}) {
  const items = preprocess(words);
  const useEntropy = !!opts.entropy;
  function rec(arr, usedMask) {
    if (arr.length <= 1) return { type: "leaf", words: arr.map(x => x.raw) };
    const li = bestLetterIndex(arr, usedMask, useEntropy);
    if (li < 0) return { type: "leaf", words: arr.map(x => x.raw) };
    const Lmask = bit(li);
    const yes = [], no = [];
    for (const it of arr) (it.mask & Lmask ? yes : no).push(it);
    if (yes.length === arr.length || no.length === arr.length) {
      return { type: "leaf", words: arr.map(x => x.raw) };
    }
    const letter = String.fromCharCode(A + li);
    const nextUsed = usedMask | Lmask;
    return { type: "node", letter, yes: rec(yes, nextUsed), no: rec(no, nextUsed) };
  }
  return rec(items, 0);
}

export function createSession(root) {
  let cur = root;
  const trail = [];
  return {
    getQuestion() { return cur.type === "node" ? `Contains "${cur.letter}"?` : null; },
    answer(yes) {
      if (cur.type !== "node") return;
      trail.push(`${cur.letter}:${yes ? "Y" : "N"}`);
      cur = yes ? cur.yes : cur.no;
    },
    done() { return cur.type === "leaf"; },
    result() { return cur.type === "leaf" ? cur.words : []; },
    path() { return trail.slice(); }
  };
}

export function solve(words, answers, opts) {
  const root = buildTree(words, opts);
  let cur = root;
  while (cur.type === "node") {
    const a = answers[cur.letter.toUpperCase()] ?? answers[cur.letter];
    cur = a ? cur.yes : cur.no;
  }
  return cur.words;
}

// Example:
// const words = ["Mercury","Venus","Earth","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
// const tree = buildTree(words);
// const ses = createSession(tree);
// console.log(ses.getQuestion());
// ses.answer(true);
// while(!ses.done()) { ... }
// console.log(ses.result());
