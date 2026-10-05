/* Демо: характеристики Героя не рахуються. */
window.SKProgress = { snapshot: function () { return null; }, sync: function () { return Promise.resolve(false); } };
