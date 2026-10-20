// Re-run the deploy workflow and wait until it finishes.
import { execFileSync } from 'node:child_process';

function readToken() {
  const input = 'protocol=https\nhost=github.com\n\n';
  const out = execFileSync('git', ['credential', 'fill'], { input, encoding: 'utf8' });
  for (const line of out.split('\n')) {
    if (line.startsWith('password=')) return line.slice('password='.length).trim();
  }
  throw new Error('No token found in the credential store');
}

const token = readToken();
const repo = 'maestronix/godswar-pit';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

const dispatch = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ ref: 'main' }),
});
console.log('dispatch status:', dispatch.status);

let run = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 6000));
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, { headers });
  const json = await res.json();
  run = json.workflow_runs?.[0];
  if (!run) continue;
  console.log(`  ${run.status} / ${run.conclusion ?? ''}`);
  if (run.status === 'completed') break;
}

if (run) {
  console.log('run:', run.html_url);
  const jobs = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs`, { headers });
  const jobJson = await jobs.json();
  for (const job of jobJson.jobs ?? []) {
    console.log(`job ${job.name}: ${job.conclusion}`);
    for (const step of job.steps ?? []) {
      if (step.conclusion === 'failure') console.log(`   FAILED: ${step.name}`);
    }
  }
}
