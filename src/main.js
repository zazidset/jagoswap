import { connectWallet, balance, quote, executeSwap, POOLS, EXPLORER } from './exchange.js';

const $ = (id) => document.getElementById(id);
const sel = $('pool');
POOLS.forEach((p, i) => sel.add(new Option(p.label, i)));
sel.add(new Option('Custom Ammora pool…', 'custom'));
sel.onchange = () => { $('custom').hidden = sel.value !== 'custom'; scheduleQuote(); };

const status = (t, cls = '') => { $('status').textContent = t; $('status').className = cls; };
const params = () => {
  const amountEth = $('amount').value;
  if (sel.value === 'custom') return { model: $('customModel').value, pool: $('customPool').value.trim(), amountEth };
  const p = POOLS[sel.value];
  return { model: p.model, pool: p.pool, amountEth };
};

let timer, seq = 0;
function scheduleQuote() { clearTimeout(timer); timer = setTimeout(runQuote, 450); }
async function runQuote() {
  const p = params();
  if (!(Number(p.amountEth) > 0) || !/^0x[0-9a-fA-F]{40}$/.test(p.pool)) { $('out').value = ''; status(''); return; }
  const my = ++seq;
  status('Quoting via Ammora…');
  try {
    const q = await quote(p);
    if (my !== seq) return;
    $('out').value = Number(q.expected).toLocaleString(undefined, { maximumFractionDigits: 6 });
    $('outSym').textContent = q.symbol;
    $('rate').textContent = `1 ETH ≈ ${(Number(q.expected) / Number(p.amountEth)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${q.symbol}`;
    $('min').textContent = `${Number(q.minimum).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${q.symbol}`;
    $('blk').textContent = q.block;
    status('');
  } catch (e) { if (my === seq) status(e.shortMessage || e.message, 'err'); }
}
$('amount').oninput = scheduleQuote;
$('customPool').oninput = scheduleQuote;
$('customModel').onchange = scheduleQuote;
$('refresh').onclick = runQuote;

async function showBal() { const b = await balance(); if (b) $('bal').textContent = `Balance: ${Number(b).toFixed(5)} ETH`; }
$('max').onclick = async () => { const b = await balance(); if (b) { $('amount').value = Math.max(0, Number(b) - 0.0002).toFixed(6); scheduleQuote(); } };

$('connect').onclick = async () => {
  try {
    const a = await connectWallet();
    $('connect').textContent = a.slice(0, 6) + '…' + a.slice(-4);
    $('swap').textContent = 'Swap';
    await showBal(); runQuote();
  } catch (e) { status(e.shortMessage || e.message, 'err'); }
};

$('swap').onclick = async () => {
  try {
    if ($('swap').textContent !== 'Swap') return $('connect').click();
    $('swap').disabled = true;
    status('Confirm in your wallet…');
    const r = await executeSwap((s) => status(typeof s === 'string' ? s : (s.stage || s.status || 'Working…')));
    status('');
    const li = document.createElement('li');
    li.innerHTML = `Swapped ${$('amount').value} ETH → ${$('outSym').textContent} · <a target="_blank" href="${EXPLORER}/tx/${r.hash}">${r.hash.slice(0, 10)}…</a>`;
    $('history').prepend(li);
    await showBal(); runQuote();
  } catch (e) { status(e.shortMessage || e.message, 'err'); }
  finally { $('swap').disabled = false; }
};

runQuote();
