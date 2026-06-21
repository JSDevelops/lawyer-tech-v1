const { execSync } = require('child_process');

// Determine build target from environment variable, default to 'frontend'
const target = process.env.BUILD_TARGET || 'frontend';
console.log(`[Monorepo Build] Starting build for target directory: "${target}"`);

try {
  // 1. Run npm install inside the target directory
  console.log(`[Monorepo Build] Running "npm install" inside "${target}"...`);
  execSync('npm install', { cwd: target, stdio: 'inherit' });

  // 2. Run npm run build inside the target directory
  console.log(`[Monorepo Build] Running "npm run build" inside "${target}"...`);
  execSync('npm run build', { cwd: target, stdio: 'inherit' });

  console.log(`[Monorepo Build] Build completed successfully for "${target}"!`);
} catch (error) {
  console.error(`[Monorepo Build] Error occurred during build for "${target}":`, error.message);
  process.exit(1);
}
