import { LearningEntry } from '../types';
import { getSettings } from './storage';

const GITHUB_API = 'https://api.github.com';

interface GitHubFile {
  sha?: string;
  content?: string;
}

export async function commitEntryToGitHub(entry: LearningEntry): Promise<boolean> {
  try {
    const settings = await getSettings();
    if (!settings.githubToken || !settings.githubRepo) return false;

    const { githubToken, githubRepo } = settings;
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Path: data/YYYY/MM/YYYY-MM-DD.json
    const [year, month] = entry.date.split('-');
    const filePath = `data/${year}/${month}/${entry.date}.json`;
    const apiUrl = `${GITHUB_API}/repos/${githubRepo}/contents/${filePath}`;

    // Check if file already exists (to get SHA for update)
    let existingSha: string | undefined;
    const checkRes = await fetch(apiUrl, { headers });
    if (checkRes.ok) {
      const existing: GitHubFile = await checkRes.json();
      existingSha = existing.sha;
    }

    const fileContent = JSON.stringify(entry, null, 2);
    const encoded = btoa(unescape(encodeURIComponent(fileContent)));

    const body: Record<string, unknown> = {
      message: `📚 Learning log: ${entry.date}`,
      content: encoded,
      branch: 'main',
    };
    if (existingSha) body.sha = existingSha;

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchEntriesFromGitHub(): Promise<LearningEntry[]> {
  try {
    const settings = await getSettings();
    if (!settings.githubToken || !settings.githubRepo) return [];

    const { githubToken, githubRepo } = settings;
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    };

    // Fetch all files in /data recursively
    const treeUrl = `${GITHUB_API}/repos/${githubRepo}/git/trees/main?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers });
    if (!treeRes.ok) return [];

    const treeData = await treeRes.json();
    const jsonFiles: { path: string }[] = treeData.tree.filter(
      (f: { path: string; type: string }) =>
        f.type === 'blob' && f.path.startsWith('data/') && f.path.endsWith('.json')
    );

    const entries: LearningEntry[] = [];
    for (const file of jsonFiles) {
      const res = await fetch(`${GITHUB_API}/repos/${githubRepo}/contents/${file.path}`, {
        headers,
      });
      if (!res.ok) continue;
      const data: GitHubFile = await res.json();
      if (!data.content) continue;
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      entries.push(JSON.parse(decoded));
    }
    return entries;
  } catch {
    return [];
  }
}

export async function testGitHubConnection(token: string, repo: string): Promise<boolean> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}
