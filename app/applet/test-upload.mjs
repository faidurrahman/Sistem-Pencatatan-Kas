import fetch from 'node-fetch';

async function test() {
  const url = 'https://script.google.com/macros/s/AKfycbyC2XBMtO1XhIVqi_YrpjX2JRRofSBj1khxL_yqQltY3Wc7BDbCR9fySA4BNuZMCcMDIQ/exec';
  const body = JSON.stringify({
    action: 'create',
    data: {
      id: `TRX-${Date.now()}`,
      tanggal: '2026-06-23',
      tipe: 'Pemasukan',
      keterangan: 'Test Upload Image',
      pemasukan: 1000,
      pengeluaran: 0,
      isIncluded: true,
      catatan: '',
      fileBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      fileMimeType: 'image/png',
      fileName: 'test.png'
    }
  });

  const res = await fetch(url, {
    method: 'POST',
    body,
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });

  const text = await res.text();
  console.log("RESPONSE 1:", text);

  // Test with base64 parameter name
  const body2 = JSON.stringify({
    action: 'create',
    data: {
      id: `TRX-${Date.now()+1}`,
      tanggal: '2026-06-23',
      tipe: 'Pemasukan',
      keterangan: 'Test Upload Image 2',
      pemasukan: 1000,
      pengeluaran: 0,
      isIncluded: true,
      catatan: '',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      mimeType: 'image/png',
      fileName: 'test2.png'
    }
  });

  const res2 = await fetch(url, {
    method: 'POST',
    body: body2,
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });

  const text2 = await res2.text();
  console.log("RESPONSE 2:", text2);
}
test();
