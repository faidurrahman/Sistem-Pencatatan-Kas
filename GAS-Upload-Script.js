// ==========================================
// KODE GOOGLE APPS SCRIPT (GAS) - COPY PASTE
// ==========================================
// Petunjuk Deployment (WAJIB DIIKUTI):
// 1. Copy seluruh kode ini ke script.google.com (Code.gs).
// 2. Isi 'SPREADSHEET_ID' dan 'FOLDER_ID' dengan URL ID yang benar.
// 3. Klik tombol 'Deploy' -> 'New deployment'.
// 4. Pilih tipe: 'Web app'.
// 5. Execute as: 'Me' (WAJIB).
// 6. Who has access: 'Anyone' atau 'Anyone, even anonymous' (WAJIB!!).
// 7. Simpan URL Web App dan letakkan di `API_URL` React (Frontend).

const SPREADSHEET_ID = "1lfdCirNf-OfdIdDQ87Z1qXLB9fx2G2V4AW0LUKBzrpQ"; 
const FOLDER_ID = "1nTx4A1l3FB_nHfLFPJ1MRiV18AAEy9wZ";

// Setup Header CORS Standar
function setupCORS(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// FUNGSI GET (MEMBACA DATA / LOAD AWAL)
// ==========================================
function doGet(e) {
  try {
    const sheetName = e.parameter.sheet || "Pengeluaran_Umum";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error("Sheet dengan nama " + (sheetName) + " tidak ditemukan!");
    }

    const dataSheet = sheet.getDataRange().getValues();
    const headers = dataSheet[0];
    const data = [];

    // Looping dari baris ke-2 sampai akhir
    for (let i = 1; i < dataSheet.length; i++) {
      const row = dataSheet[i];
      // Jika baris kosong (kolom ID kosong), skip.
      if (!row[0]) continue; 
      
      data.push({
        id: row[0].toString(),
        tanggal: row[1].toString(),
        tipe: row[2].toString(),
        keterangan: row[3].toString(),
        pemasukan: Number(row[4]) || 0,
        pengeluaran: Number(row[5]) || 0,
        isIncluded: row[6] === true || row[6] === "TRUE" || row[6] === "true",
        catatan: row[7] ? row[7].toString() : "",
        notaUrl: row[8] ? row[8].toString() : ""
      });
    }

    return setupCORS(ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      data: data 
    })));

  } catch (err) {
    return setupCORS(ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })));
  }
}

// ==========================================
// FUNGSI POST (ADD, EDIT, DELETE, UPLOAD FOTO)
// ==========================================
function doPost(e) {
  try {
    const defaultSheet = "Pengeluaran_Umum";
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const sheetName = e.parameter.sheet || defaultSheet;
    
    let ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
       throw new Error("Sheet dengan nama " + (sheetName) + " tidak ditemukan!");
    }

    // Aksi ADD atau EDIT
    if (action === "add" || action === "edit") {
      const data = requestData.data;
      let driveFileUrl = data.notaUrl || "";

      // PROSES 1: JIKA ADA GAMBAR BARU BASE64 DARI FRONTEND (DIUBAH KE FILE DRIVE)
      if (data.imageBase64 && data.imageMimeType) {
        let pureBase64 = data.imageBase64;
        
        // Hapus header MIME Type (misal: "data:image/jpeg;base64,") agar bisa didecode
        if (pureBase64.indexOf(",") > -1) {
          pureBase64 = pureBase64.split(",")[1];
        }

        // Decode Base64 murni dan jadikan bentuk Blob
        const decoded = Utilities.base64Decode(pureBase64);
        const getExt = data.imageMimeType.split("/")[1] || "jpeg";
        const fileName = `Bukti_TRX_${new Date().getTime()}.${getExt}`;
        
        const blob = Utilities.newBlob(decoded, data.imageMimeType, fileName);

        // Simpan Blob sebagai fisik file ke folder Google Drive kita
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const newFile = folder.createFile(blob);

        // Ubah permission file agar "Anyone with the link can view", supaya bisa dirender `<img src="">`
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // Ambil ID fike untuk generate URL yg gampang dibuka / di download
        // Secara default menggunakan format UC export (direct link view gambar)
        driveFileUrl = `https://drive.google.com/uc?export=view&id=${newFile.getId()}`; 
      }

      // PROSES 2: SIMPAN ATAU UPDATE KE GOOGLE SHEETS
      if (action === "add") {
         // ADD BARU: Append row di terakhir yang kosong. 
         // Hanya URL Google Drive (string) yang disimpan
         sheet.appendRow([
           data.id, 
           data.tanggal, 
           data.tipe, 
           data.keterangan, 
           data.pemasukan, 
           data.pengeluaran, 
           data.isIncluded, 
           data.catatan, 
           driveFileUrl 
         ]);
      } else if (action === "edit") {
         // EDIT LAMPUH: Cari baris mana berdasarkan ID yang cocok
         const dataSheet = sheet.getDataRange().getValues();
         let found = false;
         
         for (let i = 1; i < dataSheet.length; i++) {
           if (dataSheet[i][0] == data.id) {
             // Array adalah 0-indexed, tetapi getRange is 1-indexed. baris i berupakan i+1 cell pos.
             sheet.getRange(i + 1, 2).setValue(data.tanggal);
             sheet.getRange(i + 1, 3).setValue(data.tipe);
             sheet.getRange(i + 1, 4).setValue(data.keterangan);
             sheet.getRange(i + 1, 5).setValue(data.pemasukan);
             sheet.getRange(i + 1, 6).setValue(data.pengeluaran);
             sheet.getRange(i + 1, 7).setValue(data.isIncluded);
             sheet.getRange(i + 1, 8).setValue(data.catatan);
             sheet.getRange(i + 1, 9).setValue(driveFileUrl); // Save URL Drive HANYA ini yang di simpan
             found = true;
             break;
           }
         }
         
         if(!found) {
            throw new Error("Data ID Transaksi: " + data.id + " tidak ditemukan untuk di edit.");
         }
      }

      // Berikan response sukses ke Frontend
      return setupCORS(ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data sukses disave ke Sheets & Foto disave ke Drive.",
        notaUrl: driveFileUrl 
      })));

    } 
    
    // Aksi DELETE
    else if (action === "delete") {
       const dataId = requestData.id; // asumsikan FE mengirim { action: "delete", id: "trx-..." }
       const dataSheet = sheet.getDataRange().getValues();
       let isDeleted = false;
       for (let i = 1; i < dataSheet.length; i++) {
         if (dataSheet[i][0] == dataId) {
           sheet.deleteRow(i + 1);
           isDeleted = true;
           break;
         }
       }
       
       if (isDeleted) {
          return setupCORS(ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Transaksi berhasil dihapus"
          })));
       } else {
          return setupCORS(ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "Transaksi dengan ID tersebut tidak ditemukan."
          })));
       }
    }
    
    // Jika tidak ada action yang match 
    return setupCORS(ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Action (add, edit, delete) tidak dikenali."
    })));

  } catch (err) {
    // Jika error terjadi di GAS, pantulkan balik ke frontend JSON ini
    return setupCORS(ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })));
  }
}
