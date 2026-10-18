/**
 * GOOGLE APPS SCRIPT — HỆ THỐNG THU THẬP LEAD & KẾT QUẢ 47 BỘ TRẮC NGHIỆM TÂM LÝ & THANG ĐO LÂM SÀNG
 * Dự án: BS. Phan Thị Thanh Nhàn (Bệnh viện Tâm thần Trung ương 2 - Bộ Y tế)
 * Hướng dẫn:
 *   1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script
 *   2. Dán toàn bộ mã này vào file Code.gs -> Lưu lại
 *   3. Nhấn Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment) -> Ứng dụng web (Web app)
 *   4. Quyền truy cập: "Bất kỳ ai" (Anyone) -> Sao chép URL Web App dán vào biến GOOGLE_APPS_SCRIPT_URL
 */

const SHEET_MASTER = "Leads_Tong_Hop_47_Test";
const NOTIFY_EMAIL = "nhanthi.bs@gmail.com";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = parsePayload_(e);

    const now = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    const source = String(data.source || "UNKNOWN").trim();
    const page = String(data.page || "").trim();
    const name = String(data.name || "").trim();
    const phone = String(data.phone || "").trim();
    const testSummary = String(data.testSummary || "").trim();
    const topic = String(data.topic || "").trim();
    const age = String(data.age || "").trim();
    const note = String(data.note || "").trim();

    const row = [now, source, page, name, "'" + phone, age, testSummary, topic, note];

    // 1. Ghi vào Sheet tổng hợp
    const masterSheet = getOrCreateSheet_(ss, SHEET_MASTER);
    masterSheet.appendRow(row);

    // 2. Gửi email thông báo tức thì cho BS. Phan Thị Thanh Nhàn
    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "🩺 [47 TEST TÂM LÝ] " + source + " — " + name + " (" + phone + ")",
        htmlBody:
          "<h3>Thông tin đăng ký tư vấn & Kết quả sàng lọc mới</h3>" +
          "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;font-family:sans-serif;'>" +
          "<tr><td><b>Thời gian</b></td><td>" + now + "</td></tr>" +
          "<tr><td><b>Mã thang đo</b></td><td>" + source + " (" + page + ")</td></tr>" +
          "<tr><td><b>Họ và tên</b></td><td>" + name + "</td></tr>" +
          "<tr><td><b>Số điện thoại / Zalo</b></td><td>" + phone + "</td></tr>" +
          "<tr><td><b>Độ tuổi</b></td><td>" + (age || "Chưa nhập") + "</td></tr>" +
          "<tr><td><b>Kết quả bài test</b></td><td><b>" + testSummary + "</b></td></tr>" +
          "<tr><td><b>Chủ đề cần hỗ trợ</b></td><td>" + topic + "</td></tr>" +
          "<tr><td><b>Lời nhắn / Ghi chú</b></td><td>" + (note || "(không có)") + "</td></tr>" +
          "</table>"
      });
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", message: "Lead recorded successfully" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {}
  }
  return e.parameter || {};
}

function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      "Thời gian",
      "Mã Thang Đo",
      "Trang Landing Page",
      "Họ và tên",
      "Số điện thoại / Zalo",
      "Tuổi",
      "Kết quả Trắc nghiệm",
      "Chủ đề cần hỗ trợ",
      "Lời nhắn / Ghi chú"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#E2EDE6");
    sheet.setFrozenRows(1);
  }
  return sheet;
}
