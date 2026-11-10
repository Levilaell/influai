const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const [,, mode, outPath] = process.argv;
(async () => {
  const tl = JSON.parse(fs.readFileSync(__dirname + '/timeline.json'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/scene.html');
  await p.evaluate(tl => window.init(tl), tl);
  if (mode === 'preview') {
    const times = process.argv.slice(4).map(Number);
    for (const t of times) { await p.evaluate(t => window.render(t), t); await p.screenshot({ path: `${outPath}/f_${t}.jpg`, type: 'jpeg', quality: 80 }); }
  } else {
    const fps = 30, n = Math.ceil(tl.duration * fps);
    const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',outPath], { stdio: ['pipe','inherit','inherit'] });
    for (let i = 0; i < n; i++) {
      await p.evaluate(t => window.render(t), i / fps);
      const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log('frame', i, '/', n);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
