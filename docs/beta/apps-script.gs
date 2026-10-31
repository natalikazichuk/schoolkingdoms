/* ============================================================
   SchoolKingdoms — приймач анкети бета-тестування (Google Apps Script).

   Вставляється в Google Таблицю «SchoolKingdoms — бета-тестування (відповіді)»:
   Розширення → Apps Script → замінити весь код цим → Зберегти →
   Розгорнути → Нове розгортання → Веб-застосунок
     • Виконувати як: Я
     • Хто має доступ: Усі
   URL веб-застосунку (…/exec) вставити в sk-beta.js (SHEET_URL).
   Докладно — docs/beta/README.md.

   Кожна відповідь = новий рядок на аркуші «Відповіді».
   Колонки шукаються за назвою в 1-му рядку; якщо в анкеті з'явилось
   нове питання, колонка додасться в кінець сама.
   ============================================================ */

var SHEET_NAME = 'Відповіді';
var NOTIFY_EMAIL = '';   // напр. 'natalikazichuk@gmail.com' — лист про кожну нову анкету; '' — без листів
var MAX_BYTES = 60000;   // захист від сміття: анкета важить ~3–10 КБ

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (!raw || raw.length > MAX_BYTES) return out({ ok: false, error: 'size' });
    var data = JSON.parse(raw);
    if (!data || !/^T-[A-Z0-9]{4,10}$/.test(String(data['Тестувальник'] || ''))) {
      return out({ ok: false, error: 'format' });
    }

    lock.waitLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    var lastCol = Math.max(sh.getLastColumn(), 1);
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    if (!head[0]) { head = ['Час отримання']; sh.getRange(1, 1).setValue(head[0]); }

    // нові питання → нові колонки
    var added = [];
    Object.keys(data).forEach(function (k) {
      if (head.indexOf(k) < 0) { head.push(k); added.push(k); }
    });
    if (added.length) {
      if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
      sh.getRange(1, head.length - added.length + 1, 1, added.length).setValues([added]).setFontWeight('bold');
    }

    var row = head.map(function (h) {
      if (h === 'Час отримання') return new Date();
      var v = data[h];
      if (v === undefined || v === null) return '';
      v = String(v);
      return /^[=+\-@]/.test(v) ? "'" + v : v;   // не даємо вписати формулу
    });
    sh.appendRow(row);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL,
        'SchoolKingdoms: нова анкета бета-тесту (' + data['Тестувальник'] + ')',
        'Хто: ' + (data['Хто заповнює анкету?'] || '—') +
        '\nГерой: ' + (data['Герой'] || '—') +
        '\nДнів тестування: ' + (data['Днів тестування'] || '—') +
        '\nПорадить друзям (0–10): ' + (data['Наскільки ймовірно, що ви порадите сайт друзям? (0 — точно ні, 10 — точно так)'] || '—') +
        '\n\nУсі відповіді: ' + ss.getUrl());
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// перевірка в браузері: відкрити URL …/exec → {"ok":true,"hello":"SchoolKingdoms beta"}
function doGet() { return out({ ok: true, hello: 'SchoolKingdoms beta' }); }

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
