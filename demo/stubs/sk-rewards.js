/* Демо: нагород немає — героя, інвентарю й монет у демо-версії не існує.
   sk-prize.js отримує {skipped} і показує просте «Молодець!». */
window.SKREWARD = {
  claim: function () { return Promise.resolve({ skipped: true, reason: 'demo' }); },
  claimed: function () { return Promise.resolve(false); }
};
