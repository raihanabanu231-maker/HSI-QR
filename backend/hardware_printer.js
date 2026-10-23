const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

/**
 * Direct Thermal Printing for HPRT HT330 - ZPL via Windows System.Drawing.Printing.
 * Bypasses Chrome print dialog completely. Zero headers, zero footers, 100x30mm sticker output.
 */
function printLabelImageDirect(imageBufferOrBase64, printerName = 'HPRT HT330 - ZPL') {
  return new Promise((resolve, reject) => {
    try {
      let buffer;
      if (Buffer.isBuffer(imageBufferOrBase64)) {
        buffer = imageBufferOrBase64;
      } else if (typeof imageBufferOrBase64 === 'string') {
        const base64Data = imageBufferOrBase64.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        return reject(new Error('Invalid image data for thermal printing'));
      }

      const tempDir = os.tmpdir();
      const tempImgPath = path.join(tempDir, `hsi_lbl_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`);
      fs.writeFileSync(tempImgPath, buffer);

      // 100mm = 3.937 in = 394 hundredths of an inch
      // 30mm = 1.181 in = 118 hundredths of an inch
      const psScript = `
Add-Type -AssemblyName System.Drawing
$printer = "${printerName.replace(/"/g, '`"')}"
$imgPath = "${tempImgPath.replace(/\\/g, '\\\\')}"

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printer

if (-not $doc.PrinterSettings.IsValid) {
    Write-Error "Printer '$printer' not found or invalid."
    exit 2
}

$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$customSize = New-Object System.Drawing.Printing.PaperSize("Label100x30", 394, 118)
$doc.DefaultPageSettings.PaperSize = $customSize
$doc.OriginAtMargins = $false

$doc.add_PrintPage({
    param($sender, $e)
    try {
        $img = [System.Drawing.Image]::FromFile($imgPath)
        $rect = New-Object System.Drawing.Rectangle(0, 0, 394, 118)
        $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $e.Graphics.DrawImage($img, $rect)
        $img.Dispose()
        $e.HasMorePages = $false
    } catch {
        Write-Error $_.Exception.Message
    }
})

$doc.Print()
$doc.Dispose()
Write-Output "PRINT_SUCCESS"
`;

      const psScriptPath = path.join(tempDir, `print_${Date.now()}.ps1`);
      fs.writeFileSync(psScriptPath, psScript, 'utf8');

      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath], (err, stdout, stderr) => {
        // Clean up temp files
        try { if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath); } catch (e) {}
        try { if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath); } catch (e) {}

        if (err) {
          return reject(new Error(`Hardware print failed: ${stderr || err.message}`));
        }
        if (stdout && stdout.includes('PRINT_SUCCESS')) {
          return resolve({ success: true, printer: printerName, message: `Successfully printed to ${printerName}` });
        }
        resolve({ success: true, printer: printerName, rawOutput: stdout });
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  printLabelImageDirect,
};
