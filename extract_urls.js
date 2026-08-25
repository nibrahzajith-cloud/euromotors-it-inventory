async function test() {
  const htmlRes = await fetch('https://euromotors-it-inventory.vercel.app');
  const html = await htmlRes.text();
  const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const jsUrl = 'https://euromotors-it-inventory.vercel.app' + scriptMatch[1];
  const jsRes = await fetch(jsUrl);
  const jsCode = await jsRes.text();
  
  // Find everything resembling a URL
  const urls = jsCode.match(/https:\/\/[a-zA-Z0-9-]+\.onrender\.com[a-zA-Z0-9-/]*/g);
  console.log(Array.from(new Set(urls)));
}
test();
