// ==========================================
// KODE GOOGLE APPS SCRIPT (GAS) - doPost 
// ==========================================
// Silakan copy kode ini ke text editor Google Apps Script Anda.
// Pastikan ID FOLDER DRIVE disesuaikan dengan folder yang Anda inginkan.

const FOLDER_ID = "MASUKKAN_ID_FOLDER_GOOGLE_DRIVE_ANDA_DISINI";

function doPost(e) {
  try {
    // 1. Ekstrak payload JSON dari frontend
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    // Untuk demo simulasi, asumsikan kita sedang menangani action "add" atau "edit"
    if (action === "add" || action === "edit") {
      const data = requestData.data;
      let driveFileUrl = "";

      // 2. Jika ada base64 image yang dikirim
      if (data.imageBase64 && data.imageMimeType) {
        
        // Hapus header data:image/jpeg;base64, dll jika masih ada 
        // (walaupun dari frontend Anda harusnya mengirimkan murni tanpa header `base64,` jika ingin pakai Utilities.newBlob)
        // Note: asumsikan base64 murni sedang diproses
        let pureBase64 = data.imageBase64;
        
        // Jika base64 masih berisi data:image/... , pisahkan
        if (pureBase64.indexOf(",") > -1) {
          pureBase64 = pureBase64.split(",")[1];
        }

        // 3. Konversi murni base64 ke blob dan setel nama file dengan timestamp
        const decoded = Utilities.base64Decode(pureBase64);
        const getExt = data.imageMimeType.split("/")[1] || "jpeg";
        const fileName = `Bukti_TRX_${new Date().getTime()}.${getExt}`;
        
        const blob = Utilities.newBlob(decoded, data.imageMimeType, fileName);

        // 4. Simpan ke Google Drive sesuai Folder ID
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const newFile = folder.createFile(blob);

        // 5. Ubah akses file agar bisa di view publik
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // 6. Ambil URL file Google Drive-nya.
        // Dapat menggunakan `getUrl` yang bentuknya: https://drive.google.com/file/d/ID_FILE/view
        driveFileUrl = newFile.getUrl(); 
        
        // --- LOGIC DATABASE ANDA BERADA DISINI ---
        // Contoh : spreadsheet.appendRow([data.tanggal, ..., driveFileUrl]);
      }

      // 7. Kembalikan response JSON ke Frontend dengan notaUrl baru
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data berhasil disimpan",
        // Berikan info notaUrl untuk dipakai di React
        notaUrl: driveFileUrl 
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
        // ... action lainnya (delete, read, dsb) ...
        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Action diproses tanpa ubah foto"
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Catatan:
// Jangan lupa menyertakan pengaturan SpreadSheet Anda. Script di atas khusus mencontohkan workflow bagian Upload dan Penggunaan base64 seperti yang di-request.
