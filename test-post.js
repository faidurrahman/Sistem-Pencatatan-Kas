const fetch = require('node-fetch');

async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbyC2XBMtO1XhIVqi_YrpjX2JRRofSBj1khxL_yqQltY3Wc7BDbCR9fySA4BNuZMCcMDIQ/exec';
  const body = JSON.stringify({
    action: 'create',
    data: {
      id: `TRX-${Date.now()}`,
      tanggal: '2026-06-23',
      tipe: 'Pemasukan',
      keterangan: 'Hello Test',
      pemasukan: 1000,
      pengeluaran: 0,
      isIncluded: true,
      catatan: '',
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      imageMimeType: 'image/png',
      imageFileName: 'test.png'
    }
  });

  const res = await fetch(url, {
    method: 'POST',
    body,
    redirect: 'follow'
  });

  const text = await res.text();
  console.log("RESPONSE:", text);
}
test();
