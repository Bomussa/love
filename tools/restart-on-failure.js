import { spawn } from 'node:child_process'

function run () {
  const p = spawn(process.execPath, ['dist_server/index.js'], { stdio: 'inherit' })
  p.on('exit', (code) => {
    if (code === 0) process.exit(0)
    // eslint-disable-next-line no-console
    console.error('[restart] server exited with code', code, '— retrying in 30s')
    setTimeout(run, 30000)
  })
}
run()
