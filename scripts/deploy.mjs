// Deploy script for GitHub Pages
// Pushes the out/ directory to the gh-pages branch
import { execSync } from 'child_process';
import { mkdtempSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const BRANCH = 'gh-pages';
const DIR = 'out';

try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const tmpDir = mkdtempSync(join(tmpdir(), 'gh-pages-'));

    console.log('📦 Copying build output...');
    cpSync(DIR, tmpDir, { recursive: true });

    console.log(`🚀 Deploying to ${BRANCH}...`);
    execSync(`git init`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git config user.email "deploy@cycletrack.app"`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git config user.name "CycleTrack Deploy"`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git checkout -b ${BRANCH}`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git add -A`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)"`, { cwd: tmpDir, stdio: 'inherit' });
    execSync(`git push ${remote} ${BRANCH} --force`, { cwd: tmpDir, stdio: 'inherit' });

    console.log('✅ Deployed successfully!');
    rmSync(tmpDir, { recursive: true, force: true });
} catch (err) {
    console.error('❌ Deploy failed:', err.message);
    process.exit(1);
}
