// Enable GitHub Pages (build type "workflow") for the repository.
// The token is read from the Git credential store and never printed.
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

const res = await fetch(`https://api.github.com/repos/${repo}/pages`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ build_type: 'workflow' }),
});

const body = await res.text();
console.log('status:', res.status);
try {
  const json = JSON.parse(body);
  console.log('build_type:', json.build_type, '| url:', json.html_url ?? json.message);
} catch {
  console.log(body.slice(0, 300));
}
