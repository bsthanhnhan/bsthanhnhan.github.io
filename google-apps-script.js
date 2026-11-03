/**
 * GOOGLE APPS SCRIPT — HỆ THỐNG THU THẬP LEAD & KẾT QUẢ 9 BỘ TRẮC NGHIỆM TÂM LÝ & THANG ĐO LÂM SÀNG
 * Dự án: BS. Phan Thị Thanh Nhàn (Bệnh viện Tâm thần Trung ương 2 - Bộ Y tế)
 * Hướng dẫn:
 *   1. Mở Google Sheet -> Tiện ích mở rộng (Extensions) -> Apps Script
 *   2. Dán toàn bộ mã này vào file Code.gs -> Lưu lại
 *   3. Nhấn Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment) -> Ứng dụng web (Web app)
 *   4. Quyền truy cập: "Bất kỳ ai" (Anyone) -> Sao chép URL Web App dán vào biến GOOGLE_APPS_SCRIPT_URL
 *   Web App URL đang kết nối: https://script.google.com/macros/s/AKfycbzvQNnNUhk_hvi8oX9njfRMQC0p61hPQ01L4cKMa7vy-M2O_9-2jqntZvMplaZHBZajRw/exec
 */

const SHEET_MASTER = "Leads_Tong_Hop_9_Test";
const NOTIFY_EMAIL = "nhanthi.bs@gmail.com";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = parsePayload_(e);

    const now = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    const recordCode = String(data.recordCode || "").trim();
    const source = String(data.source || "UNKNOWN").trim();
    const page = String(data.page || "").trim();
    const name = String(data.name || (recordCode ? "Mã ẩn danh: " + recordCode : "Ẩn danh")).trim();
    const phone = String(data.phone || "Chờ nhắn Zalo 0354548939").trim();
    const email = String(data.email || "").trim();
    const testSummary = String(data.testSummary || "").trim();
    const topic = String(data.topic || (recordCode ? "Mã ẩn danh: " + recordCode : "")).trim();
    const age = String(data.age || "").trim();
    const note = String(data.note || "").trim();

    const row = [now, source, page, name, "'" + phone, email, age, testSummary, topic, note];

    // 1. Ghi vào Sheet tổng hợp (có cột Gmail Khách Hàng)
    const masterSheet = getOrCreateSheet_(ss, SHEET_MASTER);
    masterSheet.appendRow(row);

    // 2. Gửi email thông báo tức thì về nhanthi.bs@gmail.com cho BS. Phan Thị Thanh Nhàn
    if (NOTIFY_EMAIL) {
      const codeBadge = recordCode ? "[" + recordCode + "] " : "";
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "🩺 " + codeBadge + "[KẾT QUẢ TEST TÂM LÝ] " + source + " — " + name + (email ? " (" + email + ")" : ""),
        htmlBody:
          "<h3>Kết quả bài trắc nghiệm ẩn danh & Thông tin tư vấn mới</h3>" +
          "<p>Khách hàng vừa hoàn thành bài test và nhận <b>Mã số ẩn danh</b>. Khách được hướng dẫn gửi mã này vào <b>Zalo 0354.54.89.39</b> để BS. Nhàn đọc kết quả và tư vấn.</p>" +
          "<table border='1' cellpadding='8' cellspacing='0' style='border-collapse:collapse;font-family:sans-serif;'>" +
          "<tr><td><b>Thời gian</b></td><td>" + now + "</td></tr>" +
          (recordCode ? "<tr><td><b>Mã số ẩn danh</b></td><td><b style='font-size:16px;color:#0f766e;'>" + recordCode + "</b></td></tr>" : "") +
          "<tr><td><b>Mã thang đo</b></td><td>" + source + " (" + page + ")</td></tr>" +
          "<tr><td><b>Người làm bài / Mã hồ sơ</b></td><td>" + name + "</td></tr>" +
          "<tr><td><b>Gmail khách hàng</b></td><td><b style='color:#0068ff;'>" + (email || "Chưa nhập") + "</b></td></tr>" +
          "<tr><td><b>Số điện thoại / Trạng thái Zalo</b></td><td>" + phone + "</td></tr>" +
          "<tr><td><b>Độ tuổi</b></td><td>" + (age || "Ẩn danh") + "</td></tr>" +
          "<tr><td><b>Kết quả bài test (Điểm & Phân độ)</b></td><td><b style='color:#be123c;'>" + testSummary + "</b></td></tr>" +
          "<tr><td><b>Chủ đề cần hỗ trợ</b></td><td>" + topic + "</td></tr>" +
          "<tr><td><b>Chi tiết câu trả lời / Ghi chú</b></td><td>" + (note || "(không có)") + "</td></tr>" +
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
  const headers = [
    "Thời gian",
    "Mã Thang Đo",
    "Trang Landing Page",
    "Họ và tên / Mã Ẩn Danh",
    "Số điện thoại / Zalo",
    "Gmail Khách Hàng",
    "Tuổi",
    "Kết quả Trắc nghiệm",
    "Chủ đề cần hỗ trợ",
    "Lời nhắn / Ghi chú"
  ];
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#E2EDE6");
    sheet.setFrozenRows(1);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (firstRow[5] !== "Gmail Khách Hàng") {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#E2EDE6");
    }
  }
  return sheet;
}
