(function () {
  "use strict";

  var DATA = window.__PAGE_DATA__;
  if (!DATA) return;

  var STORAGE_RESP = "peaceflow_respondent_info";
  var STORAGE_HIST = "peaceflow_assessment_history_v1";
  // Google Apps Script Web App URL (có thể cập nhật sau khi deploy GAS)
  var GAS_WEB_APP_URL = window.GOOGLE_APPS_SCRIPT_URL || "";

  var CATEGORIES = {
    all: "Tất cả (47)",
    depression: "Trầm cảm",
    anxiety: "Lo âu",
    stress: "Căng thẳng / Cảm xúc",
    sleep: "Giấc ngủ",
    substance: "Rượu bia / Chất gây nghiện",
    behavior_addiction: "Hành vi / Nghiện",
    child_teen: "Trẻ em / Thanh thiếu niên",
    cognitive: "Nhận thức",
    personality: "Nhân cách",
    clinician: "Chuyên gia đánh giá"
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- 1. Respondent Info (Chuẩn PeaceFlow) ----------
  var respName = $("#respName");
  var respDob = $("#respDob");
  var respAge = $("#respAge");
  var respAgeMonths = $("#respAgeMonths");
  var respNote = $("#respNote");
  var rcToggle = $("#rcToggle");
  var rcSub = $("#rcSub");

  if (rcToggle && rcSub) {
    rcToggle.addEventListener("click", function () {
      rcSub.classList.toggle("open");
    });
  }

  function calcAgeFromDob(dobStr) {
    var d = new Date(dobStr);
    if (Number.isNaN(d.getTime())) return null;
    var now = new Date();
    var years = now.getFullYear() - d.getFullYear();
    var months = now.getMonth() - d.getMonth();
    if (now.getDate() < d.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return null;
    return { years: years, months: months };
  }

  function loadRespondent() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_RESP) || "null");
      if (saved) {
        if (respName) respName.value = saved.name || "";
        if (respDob) respDob.value = saved.dob || "";
        if (respAge) respAge.value = saved.age || "";
        if (respAgeMonths) respAgeMonths.value = saved.ageMonths || "";
        if (respNote) respNote.value = saved.note || "";
        var fName = $("#fName");
        if (fName && !fName.value && saved.name) fName.value = saved.name;
      }
    } catch (e) {}
  }

  function getRespondent() {
    return {
      name: String((respName && respName.value) || "").trim(),
      dob: String((respDob && respDob.value) || "").trim(),
      age: String((respAge && respAge.value) || "").trim(),
      ageMonths: String((respAgeMonths && respAgeMonths.value) || "").trim(),
      note: String((respNote && respNote.value) || "").trim()
    };
  }

  function saveRespondent() {
    try {
      var info = getRespondent();
      localStorage.setItem(STORAGE_RESP, JSON.stringify(info));
      var fName = $("#fName");
      if (fName && info.name && !fName.value) fName.value = info.name;
    } catch (e) {}
  }

  if (respDob) {
    respDob.addEventListener("input", function (e) {
      var res = calcAgeFromDob(e.target.value);
      if (res) {
        if (respAge) respAge.value = String(res.years);
        if (respAgeMonths) respAgeMonths.value = String(res.months);
      }
      saveRespondent();
    });
  }
  [respName, respAge, respAgeMonths, respNote].forEach(function (el) {
    if (el) el.addEventListener("input", saveRespondent);
  });
  loadRespondent();

  // ---------- 2. Emergency Crisis Overlay ----------
  var emergencyOverlay = $("#emergencyOverlay");
  var closeEmergencyBtn = $("#closeEmergencyBtn");
  function showEmergency() {
    if (emergencyOverlay) emergencyOverlay.classList.add("show");
  }
  function hideEmergency() {
    if (emergencyOverlay) emergencyOverlay.classList.remove("show");
  }
  if (closeEmergencyBtn) {
    closeEmergencyBtn.addEventListener("click", hideEmergency);
  }
  if (emergencyOverlay) {
    emergencyOverlay.addEventListener("click", function (e) {
      if (e.target === emergencyOverlay) hideEmergency();
    });
  }

  // ---------- 3. Exact Scoring Helpers from PeaceFlow Bundle ----------
  function parseTimeMinutes(str) {
    if (!str || typeof str !== "string" || str.indexOf(":") === -1) return null;
    var parts = str.split(":").map(Number);
    if (Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  }

  // Qe(e): Exact PSQI v1 7-component algorithm
  function scorePsqiV1(ans) {
    var num = function (v) { return Number(v) || 0; };
    var comp1 = num(ans[16]);
    var latRaw = (num(ans[1]) <= 15 ? 0 : num(ans[1]) <= 30 ? 1 : num(ans[1]) <= 60 ? 2 : 3) + num(ans[4]);
    var comp2 = latRaw === 0 ? 0 : latRaw <= 2 ? 1 : latRaw <= 4 ? 2 : 3;
    var hoursSleep = num(ans[3]);
    var comp3 = hoursSleep > 7 ? 0 : hoursSleep >= 6 ? 1 : hoursSleep >= 5 ? 2 : 3;
    var bedMin = parseTimeMinutes(ans[0]);
    var wakeMin = parseTimeMinutes(ans[2]);
    var hoursInBed = 0;
    if (bedMin !== null && wakeMin !== null) {
      var diff = wakeMin - bedMin;
      if (diff <= 0) diff += 1440;
      hoursInBed = diff / 60;
    }
    var eff = hoursInBed > 0 ? (hoursSleep / hoursInBed) * 100 : 100;
    var comp4 = eff > 85 ? 0 : eff >= 75 ? 1 : eff >= 65 ? 2 : 3;
    var distSum = [5, 6, 7, 8, 9, 10, 11, 12].reduce(function (acc, idx) {
      return acc + num(ans[idx]);
    }, 0);
    var comp5 = distSum === 0 ? 0 : distSum <= 9 ? 1 : distSum <= 18 ? 2 : 3;
    var comp6 = num(ans[13]);
    var dayRaw = num(ans[14]) + num(ans[15]);
    var comp7 = dayRaw === 0 ? 0 : dayRaw <= 2 ? 1 : dayRaw <= 4 ? 2 : 3;
    return comp1 + comp2 + comp3 + comp4 + comp5 + comp6 + comp7;
  }

  // $e(e, trueIndices, falseIndices): Exact EPI keyed algorithm
  function scoreEpiKeyed(ans, trueIndices, falseIndices) {
    var total = 0;
    (trueIndices || []).forEach(function (idx) {
      if (Number(ans[idx]) === 1) total += 1;
    });
    (falseIndices || []).forEach(function (idx) {
      if (Number(ans[idx]) === 0) total += 1;
    });
    return total;
  }

  // et(e, indices): Exact Vanderbilt count_threshold algorithm
  function scoreCountThreshold(ans, indices) {
    return (indices || []).filter(function (idx) {
      return Number(ans[idx]) >= 2;
    }).length;
  }

  function levelRank(cls) {
    return cls === "level-4" ? 4 : cls === "level-3" ? 3 : cls === "level-2" ? 2 : cls === "level-1" ? 1 : 0;
  }

  function loadHistoryMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HIST) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveHistoryEntry(testKey, entry) {
    try {
      var map = loadHistoryMap();
      if (!Array.isArray(map[testKey])) map[testKey] = [];
      map[testKey].unshift(entry);
      map[testKey] = map[testKey].slice(0, 10);
      localStorage.setItem(STORAGE_HIST, JSON.stringify(map));
    } catch (e) {}
  }

  function updateLeadFormWithResult(summaryText, detailText) {
    var fSum = $("#fTestSummary");
    if (fSum && summaryText) fSum.value = summaryText;
    var fMsg = $("#fMsg");
    if (fMsg && detailText && !fMsg.value.trim()) {
      fMsg.value = detailText;
    }
  }

  // ---------- 4. Mount Appropriate Assessment Mode ----------
  var mount = $("#interactiveMount");
  if (!mount) return;

  if (DATA.mode === "interactive" && DATA.scale) {
    mountInteractiveScale(mount, DATA.key, DATA.scale, DATA.meta);
  } else if (DATA.mode === "raven" && DATA.raven) {
    mountRavenScale(mount, DATA.raven, DATA.meta);
  } else {
    mountSpecialistScale(mount, DATA.meta, DATA.protocols || [], DATA.protocolGroups || {});
  }

  // ---------- 4A. Interactive 28 Scales Engine ----------
  function mountInteractiveScale(container, testKey, scale, meta) {
    var curQ = 0;
    var answers = new Array(scale.totalQ).fill(undefined);
    var inputVal = "";
    var crisisMap = { phq9: 8, bdi: 8, hdrs: 2, cdi: 26, epds: 9 };

    function renderQuestion() {
      var q = scale.questions[curQ];
      var opts = q.likertOptions || scale.likertOptions || [];
      var pct = Math.round((curQ / scale.totalQ) * 100);
      var hasAns = q.inputType
        ? String(answers[curQ] != null ? answers[curQ] : inputVal).trim() !== ""
        : answers[curQ] !== undefined;

      var inputHtml = "";
      if (q.inputType === "time") {
        var curTime = answers[curQ] != null ? String(answers[curQ]) : "22:30";
        inputHtml =
          '<div class="psqi-input-wrap">' +
          '<input type="time" id="psqiInput" class="psqi-input" value="' + esc(curTime) + '">' +
          '<span style="font-size:.88rem;color:var(--ink-soft);">Chọn giờ (24h) rồi nhấn Câu tiếp →</span>' +
          "</div>";
      } else if (q.inputType === "number") {
        var curNum = answers[curQ] != null ? String(answers[curQ]) : "";
        inputHtml =
          '<div class="psqi-input-wrap">' +
          '<input type="number" inputmode="decimal" id="psqiInput" class="psqi-input" min="0" max="' +
          (q.inputMax || 999) +
          '" step="' +
          (q.inputStep || 1) +
          '" value="' +
          esc(curNum) +
          '" placeholder="Nhập số...">' +
          (q.inputSuffix ? '<span style="font-weight:600;color:var(--ink-soft);">' + esc(q.inputSuffix) + "</span>" : "") +
          "</div>";
      } else {
        inputHtml =
          '<div class="opts">' +
          opts
            .map(function (o, idx) {
              var isSel = answers[curQ] === o.score;
              return (
                '<div class="opt' +
                (isSel ? " sel" : "") +
                '" data-score="' +
                o.score +
                '" data-idx="' +
                idx +
                '">' +
                '<span class="pip"></span>' +
                (o.emoji ? '<span class="emo">' + esc(o.emoji) + "</span>" : "") +
                '<span class="lbl">' +
                esc(o.label) +
                "</span>" +
                '<span class="score-tag">' +
                o.score +
                " điểm</span>" +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }

      container.innerHTML =
        '<div id="questionView">' +
        '  <div class="test-top">' +
        '    <div class="test-header-bar">' +
        '      <div class="th-left">' +
        '        <div class="th-icon">' + esc(scale.icon) + "</div>" +
        '        <div><div class="th-name">' + esc(scale.name) + '</div><div class="th-fullname">' + esc(scale.fullname) + "</div></div>" +
        "      </div>" +
        '      <div class="th-right">' +
        '        <button type="button" class="btn-emergency" id="trigEmergencyBtn">🆘 Khẩn cấp</button>' +
        "      </div>" +
        "    </div>" +
        '    <div class="progress-row"><span>Câu ' + (curQ + 1) + " / " + scale.totalQ + "</span><span>" + pct + "%</span></div>" +
        '    <div class="bar"><i style="width:' + pct + '%"></i></div>' +
        "  </div>" +
        '  <div class="q-body">' +
        '    <div class="q-meta-row">' +
        '      <span class="q-index">' + esc(q.catLabel || scale.name) + "</span>" +
        (scale.timeRef ? '<span class="q-timeref">Trong thời gian: ' + esc(scale.timeRef) + "</span>" : "") +
        "    </div>" +
        '    <div class="q-text">' + esc(q.text) + "</div>" +
        inputHtml +
        '    <div class="q-nav">' +
        '      <button type="button" class="lnk" id="prevQBtn"' + (curQ === 0 ? " disabled" : "") + ">← Câu trước</button>" +
        '      <span style="font-size:.82rem;color:var(--ink-soft);" id="qHintText">' +
        (hasAns ? "Đã chọn. Nhấn Câu tiếp →" : "Chọn một đáp án để tiếp tục") +
        "</span>" +
        '      <button type="button" class="btn btn-teal" style="padding:.5rem 1.1rem;font-size:.86rem;" id="nextQBtn">' +
        (curQ === scale.totalQ - 1 ? "Hoàn thành ✓" : "Câu tiếp →") +
        "</button>" +
        "    </div>" +
        "  </div>" +
        "</div>";

      var trigEmerg = $("#trigEmergencyBtn");
      if (trigEmerg) trigEmerg.addEventListener("click", showEmergency);

      var prevBtn = $("#prevQBtn");
      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          if (curQ > 0) {
            curQ -= 1;
            renderQuestion();
          }
        });
      }

      var psqiInput = $("#psqiInput");
      if (psqiInput) {
        psqiInput.focus();
        psqiInput.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            handleNextInput();
          }
        });
      }

      function handleNextInput() {
        if (q.inputType) {
          var raw = psqiInput ? String(psqiInput.value || "").trim() : "";
          if (!raw) {
            alert("Vui lòng nhập giá trị trước khi tiếp tục.");
            return;
          }
          answers[curQ] = q.inputType === "number" ? Number(raw) : raw;
        } else if (answers[curQ] === undefined) {
          alert("Vui lòng chọn một đáp án để tiếp tục.");
          return;
        }
        if (curQ < scale.totalQ - 1) {
          curQ += 1;
          renderQuestion();
        } else {
          renderResult();
        }
      }

      var nextBtn = $("#nextQBtn");
      if (nextBtn) {
        nextBtn.addEventListener("click", handleNextInput);
      }

      var optEls = container.querySelectorAll(".opt");
      optEls.forEach(function (el) {
        el.addEventListener("click", function () {
          var sc = Number(el.getAttribute("data-score"));
          answers[curQ] = sc;
          var crisisIdx = crisisMap[testKey];
          if (crisisIdx !== undefined && curQ === crisisIdx && sc > 0) {
            showEmergency();
          }
          renderQuestion();
          setTimeout(function () {
            if (curQ < scale.totalQ - 1) {
              curQ += 1;
              renderQuestion();
            } else {
              renderResult();
            }
          }, 260);
        });
      });
    }

    function renderResult() {
      var histMap = loadHistoryMap();
      var prevEntry = (histMap[testKey] && histMap[testKey][0]) || null;

      var resultsBySub = {};
      Object.keys(scale.scoring).forEach(function (subKey) {
        var cfg = scale.scoring[subKey];
        var val = 0;
        if (cfg.custom === "psqi_v1") {
          val = scorePsqiV1(answers);
        } else if (cfg.custom === "epi_keyed") {
          val = scoreEpiKeyed(answers, cfg.trueIndices, cfg.falseIndices);
        } else if (cfg.custom === "count_threshold") {
          val = scoreCountThreshold(answers, cfg.indices);
        } else {
          var s = 0;
          (cfg.indices || []).forEach(function (idx) {
            s += Number(answers[idx]) || 0;
          });
          val = Math.round(s * (cfg.multiplier || 1) * 100) / 100;
        }
        resultsBySub[subKey] = { score: val, config: cfg };
      });

      var subKeys = Object.keys(resultsBySub);
      var isWarning = false;
      var cards = [];
      var interpretations = [];

      subKeys.forEach(function (subKey) {
        var item = resultsBySub[subKey];
        var lv =
          item.config.levels.find(function (l) {
            return item.score <= l.max;
          }) || item.config.levels[item.config.levels.length - 1];
        var icon = "📊";
        if (lv.class === "level-0" || lv.class === "level-1") {
          icon = "✅";
        } else if (lv.class === "level-2") {
          icon = "⚠️";
        } else {
          icon = "🚨";
          if (subKey !== "somatic" && subKey !== "psychic") isWarning = true;
        }
        var qMatch = scale.questions.find(function (q) {
          return q.cat === subKey;
        });
        var displayLabel =
          lv.label === "Tâm lý" || lv.label === "Thể chất"
            ? lv.label
            : (qMatch && qMatch.catLabel) || (subKey === "total" ? "Tổng điểm" : subKey);

        var maxRef = item.config.levels[item.config.levels.length - 1].max;
        var barMax = maxRef > 100 ? scale.maxScore : maxRef;
        if (item.config.custom === "count_threshold") {
          barMax = (item.config.indices || []).length;
        }
        var pct = Math.min(100, Math.max(0, Math.round((item.score / (barMax || 1)) * 100)));

        cards.push({
          key: subKey,
          icon: icon,
          displayLabel: displayLabel,
          score: item.score,
          barMax: barMax,
          pct: pct,
          levelClass: lv.class,
          levelLabel: lv.label
        });

        var note = isWarning
          ? "Mức độ này có ảnh hưởng đáng kể tới chất lượng cuộc sống của bạn."
          : "Hãy tiếp tục giữ vững tâm lý theo nhịp độ này nhé.";
        interpretations.push({
          key: subKey,
          icon: icon,
          displayLabel: displayLabel,
          score: item.score,
          levelLabel: lv.label,
          note: note
        });
      });

      var dominant = cards
        .slice()
        .sort(function (a, b) {
          return levelRank(b.levelClass) - levelRank(a.levelClass);
        })[0];

      var now = new Date();
      var timeStr =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0") +
        " — " +
        now.toLocaleDateString("vi-VN");

      var resp = getRespondent();
      var bannerUrl =
        dominant && dominant.levelClass
          ? "https://peaceflow.vn/assessment-images/" + testKey + "/" + dominant.levelClass + ".png"
          : "";

      var compareHtml = "";
      if (prevEntry && prevEntry.scores) {
        var cmpRows = cards
          .map(function (c) {
            var prevSc = prevEntry.scores[c.key];
            if (prevSc === undefined) return "";
            var prevPct = Math.min(100, Math.max(0, Math.round((prevSc / (c.barMax || 1)) * 100)));
            return (
              '<div class="cmp-row">' +
              "  <div><strong>" + esc(c.displayLabel) + "</strong></div>" +
              '  <div class="cmp-bar-line"><span style="width:70px;">Hiện tại:</span><div class="cmp-track"><div class="cmp-fill" style="width:' +
              c.pct +
              '%;background:var(--teal);"></div></div><strong style="width:36px;text-align:right;">' +
              c.score +
              "</strong></div>" +
              '  <div class="cmp-bar-line"><span style="width:70px;color:var(--ink-soft);">Lần trước:</span><div class="cmp-track"><div class="cmp-fill" style="width:' +
              prevPct +
              '%;background:var(--clay);"></div></div><span style="width:36px;text-align:right;">' +
              prevSc +
              "</span></div>" +
              "</div>"
            );
          })
          .join("");
        if (cmpRows) {
          compareHtml =
            '<div class="compare-box"><h4>📈 So sánh với lần trước (' +
            esc(prevEntry.date || "") +
            ")</h4>" +
            cmpRows +
            "</div>";
        }
      } else {
        compareHtml =
          '<div class="compare-box"><h4>📈 So sánh với lần trước</h4><div style="color:var(--ink-soft);font-style:italic;">Bài kiểm tra lần đầu — Chưa có dữ liệu cơ sở để so sánh.</div></div>';
      }

      // Save current run to history
      var scoreMap = {};
      cards.forEach(function (c) {
        scoreMap[c.key] = c.score;
      });
      saveHistoryEntry(testKey, {
        date: timeStr,
        respondent: resp.name || "Chủ tài khoản",
        scores: scoreMap,
        overall: dominant ? dominant.levelLabel : ""
      });

      // Update Lead Form automatically
      var summaryForForm =
        scale.name +
        ": " +
        cards
          .map(function (c) {
            return c.displayLabel + " " + c.score + "đ (" + c.levelLabel + ")";
          })
          .join(" | ");
      updateLeadFormWithResult(summaryForForm, "Kết quả vừa làm: " + summaryForForm);

      container.innerHTML =
        '<div class="result-card show">' +
        '  <div class="res-top-actions">' +
        '    <button type="button" class="btn btn-ghost" id="retakeBtnTop">🔄 Làm lại bài này</button>' +
        '    <button type="button" class="btn btn-teal" id="printPdfBtn">📄 Xuất PDF / In kết quả</button>' +
        "  </div>" +
        (bannerUrl
          ? '<div class="res-banner-wrap"><img src="' +
            esc(bannerUrl) +
            '" alt="' +
            esc(scale.name) +
            '" onerror="this.parentNode.style.display=\'none\'"></div>'
          : "") +
        '  <div class="res-head">' +
        '    <span class="eyebrow" style="justify-content:center;">Kết quả ' + esc(scale.name) + " của bạn</span>" +
        "    <h3>" + esc(dominant ? dominant.levelLabel : "Đã hoàn thành") + "</h3>" +
        "    <p>Hoàn thành lúc " + esc(timeStr) + (resp.name ? " · Người làm bài: <strong>" + esc(resp.name) + "</strong>" : "") + "</p>" +
        "  </div>" +
        '  <div class="scales">' +
        cards
          .map(function (c) {
            var fillIdx = c.levelClass.replace("level-", "");
            return (
              '<div class="scale">' +
              '  <div class="scale-top"><b>' + esc(c.icon + " " + c.displayLabel) + '</b><span class="pill ' + esc(c.levelClass) + '">' + esc(c.levelLabel) + "</span></div>" +
              '  <div class="scale-track"><i class="fill-' + esc(fillIdx) + '" style="width:' + c.pct + '%"></i></div>' +
              '  <div class="scale-meta"><span>Điểm số: <strong>' + c.score + " / " + scale.maxScore + "</strong></span><span>Phân loại: " + esc(c.levelLabel) + "</span></div>" +
              "</div>"
            );
          })
          .join("") +
        "  </div>" +
        '  <div class="interpret">' +
        "    <h4>🔍 Diễn giải kết quả</h4>" +
        '    <ul class="ri-list">' +
        interpretations
          .map(function (it) {
            return (
              '<li class="ri-item">' +
              "  <span>" + esc(it.icon) + "</span>" +
              "  <div><strong>" + esc(it.displayLabel) + ":</strong> Mức điểm <strong>" + it.score + "</strong> — thuộc nhóm <strong>" + esc(it.levelLabel) + "</strong>. " + esc(it.note) + "</div>" +
              "</li>"
            );
          })
          .join("") +
        "    </ul>" +
        "  </div>" +
        compareHtml +
        '  <div class="res-cta">' +
        '    <a href="#lien-he" class="btn btn-primary">📅 Đặt lịch tư vấn kết quả cùng BS. Thanh Nhàn →</a>' +
        '    <button type="button" class="btn btn-ghost" id="retakeBtnBottom">🔄 Làm lại</button>' +
        "  </div>" +
        '  <p class="disc">⚠️ <strong>Tuyên bố miễn trách:</strong> Kết quả này chỉ mang tính tham khảo và <strong>không phải chẩn đoán y khoa</strong>. Chỉ bác sĩ hoặc chuyên gia tâm lý lâm sàng mới có thể đưa ra chẩn đoán chính thức. Nếu bạn lo lắng về sức khỏe tâm thần, hãy liên hệ BS. Phan Thị Thanh Nhàn (<strong>0354.54.89.39</strong>) hoặc gọi đường dây nóng <strong>0931773637</strong>.</p>' +
        "</div>";

      var rTop = $("#retakeBtnTop");
      var rBot = $("#retakeBtnBottom");
      var pBtn = $("#printPdfBtn");
      function doRetake() {
        curQ = 0;
        answers = new Array(scale.totalQ).fill(undefined);
        renderQuestion();
        var testSec = $("#test");
        if (testSec) testSec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (rTop) rTop.addEventListener("click", doRetake);
      if (rBot) rBot.addEventListener("click", doRetake);
      if (pBtn) pBtn.addEventListener("click", function () { window.print(); });
    }

    renderQuestion();
  }

  // ---------- 4B. Raven CPM 36-Item Non-Verbal IQ Matrix Engine ----------
  function mountRavenScale(container, raven, meta) {
    var items = raven.tD;
    var keyMap = raven.nD;
    var ageBrackets = raven.rD;
    var normTable = raven.iD;
    var iqBands = raven.aD;
    var curIdx = 0;
    var answers = new Array(items.length).fill(null);

    function parseRange(str) {
      if (!str || str === "-") return null;
      var p = str.split("-").map(function (s) { return Number(s.trim()); });
      return p.length === 1 ? [p[0], p[0]] : [p[0], p[1]];
    }

    function findAgeBracket(months) {
      var idx = ageBrackets.findIndex(function (b) {
        return months >= b.minM && months <= b.maxM;
      });
      if (idx >= 0) return idx;
      if (months < ageBrackets[0].minM) return -1;
      if (months > ageBrackets[ageBrackets.length - 1].maxM) return -2;
      return 0;
    }

    function scoreRaven(ansArr, ageYears, ageMonths) {
      var bySet = { A: 0, AB: 0, B: 0 };
      var rawTotal = 0;
      items.forEach(function (it, idx) {
        var setKey = it.key.replace(/\d+$/, "");
        var itemNo = Number(it.key.replace(/^\D+/, "")) - 1;
        var correct = keyMap[setKey][itemNo];
        if (ansArr[idx] === correct) {
          bySet[setKey] += 1;
          rawTotal += 1;
        }
      });
      var out = {
        rawTotal: rawTotal,
        bySet: bySet,
        standardScore: null,
        percentile: null,
        iqLabel: null,
        ageBracketNote: null
      };
      var yrs = Number(ageYears);
      if (!Number.isFinite(yrs) || yrs <= 0) {
        out.ageBracketNote = "Chưa có tuổi — chỉ tính được điểm thô, chưa quy đổi ra chỉ số IQ (điền Tuổi 4–11 ở mục Thông tin người làm test phía trên để tự động quy đổi IQ).";
        return out;
      }
      var mos = Number(ageMonths) || 0;
      var colIdx = findAgeBracket(Math.round(yrs * 12 + mos));
      if (colIdx === -1) {
        out.ageBracketNote = "Trẻ dưới 4 tuổi — ngoài phạm vi chuẩn hoá của Raven CPM, chỉ tính điểm thô.";
        return out;
      }
      if (colIdx === -2) {
        out.ageBracketNote = "Trên 11 tuổi — ngoài phạm vi chuẩn hoá của Raven CPM (48–143 tháng), chỉ tính điểm thô.";
        return out;
      }
      var matchedRow = null;
      for (var i = 0; i < normTable.length; i++) {
        var rng = parseRange(normTable[i].values[colIdx]);
        if (rng && rawTotal <= rng[1]) {
          matchedRow = normTable[i];
          break;
        }
      }
      if (!matchedRow) matchedRow = normTable[normTable.length - 1];
      out.standardScore = matchedRow.ss;
      out.percentile = matchedRow.pctl;
      var band =
        iqBands.find(function (b) { return matchedRow.ss <= b.max; }) ||
        iqBands[iqBands.length - 1];
      out.iqLabel = band.label;
      return out;
    }

    function renderRavenQ() {
      var it = items[curIdx];
      var pct = Math.round((curIdx / items.length) * 100);
      var localImg = "assets/raven/" + it.key + ".png";
      var remoteImg = "https://peaceflow.vn/assets/raven/" + it.key + ".png";

      var optsHtml = "";
      for (var choice = 1; choice <= 6; choice++) {
        var isSel = answers[curIdx] === choice;
        optsHtml +=
          '<div class="rv-opt' + (isSel ? " sel" : "") + '" data-choice="' + choice + '">Lựa chọn ' + choice + "</div>";
      }

      container.innerHTML =
        '<div id="questionView">' +
        '  <div class="test-top">' +
        '    <div class="test-header-bar">' +
        '      <div class="th-left">' +
        '        <div class="th-icon">🧩</div>' +
        '        <div><div class="th-name">Raven CPM — Câu ' + esc(it.key) + '</div><div class="th-fullname">Coloured Progressive Matrices (Bảng khoá điểm Raven màu 2008)</div></div>' +
        "      </div>" +
        '      <div class="th-right"><span class="meta-pill">36 câu ma trận</span></div>' +
        "    </div>" +
        '    <div class="progress-row"><span>Câu ' + (curIdx + 1) + " / " + items.length + " (" + esc(it.key) + ")</span><span>" + pct + "%</span></div>" +
        '    <div class="bar"><i style="width:' + pct + '%"></i></div>' +
        "  </div>" +
        '  <div class="q-body">' +
        '    <div class="rv-image-box">' +
        '      <img src="' + esc(localImg) + '" alt="Câu ' + esc(it.key) + '" onerror="this.onerror=null;this.src=\'' + esc(remoteImg) + '\';">' +
        "    </div>" +
        '    <div style="font-size:.88rem;color:var(--ink-soft);text-align:center;">Chọn mảnh ghép (1 – 6) phù hợp nhất để hoàn thiện quy luật của hình trên:</div>' +
        '    <div class="rv-options">' + optsHtml + "</div>" +
        (answers[curIdx] === "skip"
          ? '<div style="color:var(--ink-soft);font-style:italic;margin-top:8px;text-align:center;">Câu này đã được bỏ qua — không tính điểm.</div>'
          : "") +
        '    <div class="q-nav">' +
        '      <button type="button" class="lnk" id="rvPrevBtn"' + (curIdx === 0 ? " disabled" : "") + ">← Câu trước</button>" +
        '      <button type="button" class="btn btn-ghost" style="padding:.48rem 1rem;font-size:.84rem;" id="rvSkipBtn">Bỏ qua câu này</button>' +
        '      <button type="button" class="btn btn-teal" style="padding:.48rem 1.1rem;font-size:.86rem;" id="rvNextBtn"' +
        (answers[curIdx] === null ? " disabled" : "") +
        ">" +
        (curIdx === items.length - 1 ? "Hoàn thành ✓" : "Câu tiếp →") +
        "</button>" +
        "    </div>" +
        "  </div>" +
        "</div>";

      container.querySelectorAll(".rv-opt").forEach(function (el) {
        el.addEventListener("click", function () {
          var c = Number(el.getAttribute("data-choice"));
          answers[curIdx] = c;
          renderRavenQ();
          setTimeout(function () {
            if (curIdx < items.length - 1) {
              curIdx += 1;
              renderRavenQ();
            } else {
              renderRavenResult();
            }
          }, 220);
        });
      });

      var prevB = $("#rvPrevBtn");
      var skipB = $("#rvSkipBtn");
      var nextB = $("#rvNextBtn");
      if (prevB) {
        prevB.addEventListener("click", function () {
          if (curIdx > 0) {
            curIdx -= 1;
            renderRavenQ();
          }
        });
      }
      if (skipB) {
        skipB.addEventListener("click", function () {
          answers[curIdx] = "skip";
          if (curIdx === items.length - 1) renderRavenResult();
          else {
            curIdx += 1;
            renderRavenQ();
          }
        });
      }
      if (nextB) {
        nextB.addEventListener("click", function () {
          if (answers[curIdx] !== null) {
            if (curIdx === items.length - 1) renderRavenResult();
            else {
              curIdx += 1;
              renderRavenQ();
            }
          }
        });
      }
    }

    function renderRavenResult() {
      var resp = getRespondent();
      var res = scoreRaven(answers, resp.age, resp.ageMonths);
      var pct = Math.round((res.rawTotal / 36) * 100);
      var summary =
        "Raven CPM: Điểm thô " +
        res.rawTotal +
        "/36 (A:" +
        res.bySet.A +
        "/12, AB:" +
        res.bySet.AB +
        "/12, B:" +
        res.bySet.B +
        "/12)" +
        (res.standardScore !== null
          ? " · SS: " + res.standardScore + " (Percentile " + res.percentile + ") · " + res.iqLabel
          : "");
      updateLeadFormWithResult(summary, "Kết quả Raven CPM: " + summary);

      container.innerHTML =
        '<div class="result-card show">' +
        '  <div class="res-top-actions">' +
        '    <button type="button" class="btn btn-ghost" id="rvRetakeBtn">🔄 Làm lại Raven CPM</button>' +
        '    <button type="button" class="btn btn-teal" id="rvPrintBtn">📄 Xuất PDF / In kết quả</button>' +
        "  </div>" +
        '  <div class="res-head">' +
        '    <span class="eyebrow" style="justify-content:center;">Đã hoàn thành bài làm Raven CPM</span>' +
        "    <h3>" + esc(res.iqLabel || "Điểm thô " + res.rawTotal + " / 36") + "</h3>" +
        "    <p>Chấm theo Bảng khoá điểm Raven màu - Trẻ em - 2008</p>" +
        "  </div>" +
        '  <div class="scales">' +
        '    <div class="scale">' +
        '      <div class="scale-top"><b>🧩 Điểm thô: ' + res.rawTotal + " / 36</b><span class=\"pill level-0\">Tập A: " + res.bySet.A + "/12 · Tập AB: " + res.bySet.AB + "/12 · Tập B: " + res.bySet.B + "/12</span></div>" +
        '      <div class="scale-track"><i class="fill-0" style="width:' + pct + '%"></i></div>' +
        '      <div class="scale-meta"><span>Tỷ lệ đúng: ' + pct + '%</span><span>Tổng 36 ma trận</span></div>' +
        "    </div>" +
        (res.standardScore !== null
          ? '<div class="scale">' +
            '  <div class="scale-top"><b>📐 Chỉ số chuẩn hoá (Standard Score): ' + res.standardScore + '</b><span class="pill level-1">Percentile ' + res.percentile + "</span></div>" +
            '  <div class="scale-meta"><span>Xếp loại: <strong>' + esc(res.iqLabel) + "</strong></span><span>Độ tuổi quy chiếu: " + esc(resp.age) + " tuổi " + esc(resp.ageMonths || 0) + " tháng</span></div>" +
            "</div>"
          : '<div class="scale"><div style="color:var(--ink-soft);font-style:italic;">' +
            esc(res.ageBracketNote) +
            ' <button type="button" class="btn btn-ghost" id="recalcAgeBtn" style="padding:4px 10px;font-size:.78rem;margin-left:6px;">Tính lại sau khi nhập Tuổi</button></div></div>') +
        "  </div>" +
        '  <div class="res-cta">' +
        '    <a href="#lien-he" class="btn btn-primary">📅 Gửi kết quả để BS. Thanh Nhàn xác nhận & tư vấn →</a>' +
        "  </div>" +
        '  <p class="disc"><strong>Lưu ý:</strong> Đây là trắc nghiệm phi ngôn ngữ (Raven). Ứng dụng tự chấm điểm theo đáp án gốc và quy đổi ra chỉ số IQ (nếu có đủ tuổi, áp dụng cho trẻ 4-11 tuổi), nhưng kết quả chỉ mang tính <strong>sàng lọc tham khảo</strong> — hãy để <strong>chuyên gia</strong> xác nhận và đưa ra kết luận cuối cùng.</p>' +
        "</div>";

      var rt = $("#rvRetakeBtn");
      if (rt) {
        rt.addEventListener("click", function () {
          curIdx = 0;
          answers = new Array(items.length).fill(null);
          renderRavenQ();
        });
      }
      var pr = $("#rvPrintBtn");
      if (pr) pr.addEventListener("click", function () { window.print(); });
      var rc = $("#recalcAgeBtn");
      if (rc) rc.addEventListener("click", renderRavenResult);
    }

    renderRavenQ();
  }

  // ---------- 4C. Specialist Clinical Assessment & 25 MoH Protocols Engine ----------
  function mountSpecialistScale(container, meta, protocols, protocolGroups) {
    var activeGroup = "all";
    var selectedProt = protocols[0] || null;

    function renderSpec() {
      var filtered =
        activeGroup === "all"
          ? protocols
          : protocols.filter(function (p) { return p.group === activeGroup; });

      var tabsHtml = Object.keys(protocolGroups)
        .map(function (gk) {
          return (
            '<button type="button" class="prot-tab' +
            (activeGroup === gk ? " active" : "") +
            '" data-group="' +
            esc(gk) +
            '">' +
            esc(protocolGroups[gk]) +
            "</button>"
          );
        })
        .join("");

      var cardsHtml = filtered
        .map(function (p) {
          return (
            '<button type="button" class="prot-card" data-no="' +
            p.no +
            '">' +
            '<span class="p-no">' + esc(p.icon) + " Quy trình " + p.no + "</span>" +
            "<strong>" + esc(p.title) + "</strong>" +
            "<span>" + esc(p.summary) + "</span>" +
            "</button>"
          );
        })
        .join("");

      container.innerHTML =
        '<div class="specialist-box">' +
        '  <div class="test-header-bar">' +
        '    <div class="th-left">' +
        '      <div class="th-icon">' + esc(meta.icon) + "</div>" +
        '      <div><div class="th-name">' + esc(meta.name) + " — " + esc(meta.fullname) + '</div><div class="th-fullname">Danh mục: ' + esc(meta.categoryLabel) + " · Chế độ Chuyên gia thực hiện</div></div>" +
        "    </div>" +
        '    <div class="th-right"><span class="meta-pill">Không tự chấm</span></div>' +
        "  </div>" +
        '  <p style="font-size:1.02rem;color:var(--ink);margin-top:10px;"><strong>Mô tả lâm sàng:</strong> ' +
        esc(meta.apiDesc || meta.desc) +
        "</p>" +
        '  <div class="spec-notice">' +
        "    <strong>🩺 Cần chuyên gia thực hiện:</strong><br>" +
        "    " + esc(meta.specialistNote || "Cần chuyên gia thực hiện bằng bộ công cụ, bảng chuẩn và quy trình được cơ sở y tế phê duyệt.") +
        "  </div>" +
        '  <div style="display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 26px;">' +
        '    <a href="#lien-he" class="btn btn-primary">📅 Đặt lịch thực hiện ' + esc(meta.name) + " cùng BS. Thanh Nhàn →</a>" +
        '    <a href="https://zalo.me/0354548939" target="_blank" rel="noopener" class="btn btn-teal">💬 Nhắn Zalo BS. Nhàn (0354.54.89.39)</a>' +
        "  </div>" +
        '  <div style="border-top:1px solid var(--line);padding-top:20px;">' +
        '    <span class="eyebrow">Tài liệu hướng dẫn Bộ Y tế</span>' +
        '    <h3 style="margin-top:6px;font-size:1.3rem;">Danh mục 25 Quy trình Lâm sàng & Trị liệu Tâm lý (Quy trình 45 – 69)</h3>' +
        '    <p style="font-size:.86rem;color:var(--ink-soft);margin-top:4px;">Tra cứu toàn văn định nghĩa và hướng dẫn thực hiện theo tài liệu chuyên môn của Bộ Y tế:</p>' +
        '    <div class="protocol-filter-bar">' + tabsHtml + "</div>" +
        '    <div class="protocol-grid">' + cardsHtml + "</div>" +
        (selectedProt
          ? '<div class="prot-detail-box show" id="protDetailBox">' +
            '  <div style="font-size:.78rem;font-weight:700;color:var(--teal);text-transform:uppercase;">' +
            esc(selectedProt.icon) + " Quy trình " + selectedProt.no +
            "</div>" +
            '  <h4 style="font-family:\'Lora\',serif;font-size:1.25rem;margin:4px 0 8px;">' + esc(selectedProt.title) + "</h4>" +
            '  <div style="font-size:.85rem;font-weight:600;color:var(--ink);">Định nghĩa & Cơ chế theo Bộ Y tế:</div>' +
            "  <p>" + esc(selectedProt.definition) + "</p>" +
            '  <div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font-size:.83rem;color:var(--ink);"><strong>Hỗ trợ thực hiện:</strong> ' +
            esc(selectedProt.summary) +
            "</div>" +
            "</div>"
          : "") +
        "  </div>" +
        "</div>";

      container.querySelectorAll(".prot-tab").forEach(function (btn) {
        btn.addEventListener("click", function () {
          activeGroup = btn.getAttribute("data-group");
          renderSpec();
        });
      });

      container.querySelectorAll(".prot-card").forEach(function (card) {
        card.addEventListener("click", function () {
          var no = Number(card.getAttribute("data-no"));
          selectedProt =
            protocols.find(function (p) { return p.no === no; }) || null;
          renderSpec();
          var box = $("#protDetailBox");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    }

    renderSpec();
  }

  // ---------- 5. Render 47-Test Hub Navigator at Bottom ----------
  var hubCatsEl = $("#hubCats");
  var hubGridEl = $("#hubGrid47");
  var hubSearchEl = $("#hubSearch");
  var activeHubCat = "all";
  var searchQuery = "";

  function renderHub47() {
    if (!hubGridEl || !DATA.catalog) return;
    if (hubCatsEl) {
      hubCatsEl.innerHTML = Object.keys(CATEGORIES)
        .map(function (ck) {
          return (
            '<button type="button" class="hub-cat-btn' +
            (activeHubCat === ck ? " active" : "") +
            '" data-cat="' +
            esc(ck) +
            '">' +
            esc(CATEGORIES[ck]) +
            "</button>"
          );
        })
        .join("");
      hubCatsEl.querySelectorAll(".hub-cat-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          activeHubCat = btn.getAttribute("data-cat");
          renderHub47();
        });
      });
    }

    var q = searchQuery.trim().toLowerCase();
    var list = DATA.catalog.filter(function (c) {
      if (activeHubCat !== "all" && c.category !== activeHubCat) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().indexOf(q) !== -1 ||
        c.fullname.toLowerCase().indexOf(q) !== -1 ||
        c.categoryLabel.toLowerCase().indexOf(q) !== -1
      );
    });

    hubGridEl.innerHTML = list
      .map(function (c) {
        var isCur = c.key === DATA.key;
        var b0 = (c.badges && c.badges[0] && c.badges[0].label) || "";
        return (
          '<a href="' +
          esc(c.filename) +
          '" class="hub-card-47' +
          (isCur ? " current" : "") +
          '">' +
          "  <div>" +
          '    <div class="hc47-top">' +
          '      <span class="hc47-icon" style="border:1.5px solid ' + esc(c.primary) + ';">' + esc(c.icon) + "</span>" +
          '      <span class="hc47-no">#' + String(c.no).padStart(2, "0") + " · " + esc(c.categoryLabel) + "</span>" +
          "    </div>" +
          '    <div class="hc47-title">' + esc(c.name) + "</div>" +
          '    <div class="hc47-sub">' + esc(c.fullname) + " — " + esc(c.desc) + "</div>" +
          "  </div>" +
          '  <div class="hc47-foot">' +
          "    <span>" + esc(b0) + "</span>" +
          "    <span>" + (isCur ? "Đang xem ✓" : "Mở bài test →") + "</span>" +
          "  </div>" +
          "</a>"
        );
      })
      .join("");
  }

  if (hubSearchEl) {
    hubSearchEl.addEventListener("input", function (e) {
      searchQuery = e.target.value || "";
      renderHub47();
    });
  }
  renderHub47();

  // ---------- 6. Lead Form Submission (FormSubmit.co + Google Apps Script) ----------
  var submitBtn = $("#submitLead");
  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      var name = (($("#fName") || {}).value || "").trim();
      var phone = (($("#fPhone") || {}).value || "").trim();
      var summary = (($("#fTestSummary") || {}).value || "").trim();
      var topic = (($("#fTopic") || {}).value || "").trim();
      var msg = (($("#fMsg") || {}).value || "").trim();
      var ok = $("#formOk");

      if (!name || !phone) {
        if (ok) {
          ok.style.display = "block";
          ok.style.background = "rgba(224,115,80,.2)";
          ok.style.borderColor = "rgba(224,115,80,.5)";
          ok.textContent = "Vui lòng nhập Họ tên và Số điện thoại / Zalo để BS. Thanh Nhàn liên hệ lại với bạn nhé.";
        }
        return;
      }

      var resp = getRespondent();
      var fd = new FormData();
      fd.append("_subject", "🩺 ĐĂNG KÝ TƯ VẤN [" + DATA.meta.name + "] - " + name + " (" + phone + ")");
      fd.append("_template", "table");
      fd.append("Họ tên", name);
      fd.append("Số điện thoại / Zalo", phone);
      fd.append("Bài trắc nghiệm", summary || DATA.meta.name);
      fd.append("Chủ đề cần hỗ trợ", topic);
      fd.append("Tuổi / Ghi chú người làm", (resp.age ? resp.age + " tuổi" : "") + (resp.note ? " - " + resp.note : ""));
      fd.append("Lời nhắn", msg || "(không có)");

      fetch("https://formsubmit.co/ajax/nhanthi.bs@gmail.com", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd
      }).catch(function () {});

      if (GAS_WEB_APP_URL) {
        fetch(GAS_WEB_APP_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: DATA.meta.apiCode || DATA.meta.name,
            page: window.location.pathname.split("/").pop() || DATA.meta.filename,
            name: name,
            phone: phone,
            testSummary: summary,
            topic: topic,
            age: resp.age || "",
            note: msg || resp.note || "",
            timestamp: new Date().toISOString()
          })
        }).catch(function () {});
      }

      if (ok) {
        ok.style.display = "block";
        ok.style.background = "rgba(79,177,150,.2)";
        ok.style.borderColor = "rgba(79,177,150,.5)";
        ok.textContent =
          "✅ Cảm ơn " +
          name +
          "! Kết quả " +
          DATA.meta.name +
          " và thông tin của bạn đã được gửi tới BS. Phan Thị Thanh Nhàn (nhanthi.bs@gmail.com / Zalo 0354.54.89.39). Bác sĩ sẽ phản hồi sớm nhất.";
      }
    });
  }
})();
