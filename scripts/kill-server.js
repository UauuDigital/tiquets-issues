// Mata qualsevol procés "node server.js" penjat, en Windows o en Unix.
// Substitueix l'antic script de `killzombie` (bash amb pkill/sleep), que no
// funcionava en PowerShell/Windows.
const { execSync } = require('child_process');

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' });
  } catch (_err) {
    // No hi havia cap procés a matar, o la comanda no existeix: ignorem.
  }
}

if (process.platform === 'win32') {
  run(
    'wmic process where "CommandLine like \'%node%server.js%\' and not CommandLine like \'%kill-server.js%\'" call terminate'
  );
} else {
  run("pkill -f 'node server.js'");
  execSync('sleep 1', { stdio: 'ignore' });
  run("pkill -9 -f 'node server.js'");
}

console.log('OK');
