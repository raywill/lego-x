const host = 'bricks.reactshare.cn';
const key = '7b31544a0ffbbef43d1435d2ec91ae35';
const urlList = [
  `https://${host}/`,
  `https://${host}/start`,
  `https://${host}/plaza`,
  `https://${host}/privacy.html`,
];

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  }),
});

if (!response.ok) {
  throw new Error(`IndexNow submission failed: ${response.status} ${await response.text()}`);
}

console.info(`IndexNow accepted ${urlList.length} URLs (${response.status}).`);
