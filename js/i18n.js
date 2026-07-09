/* ============================================================
   Road to GM — tiny i18n layer (English + Urdu)
   Holds the current language and the shared piece names so every
   module (board, narrator, coach) speaks the same words.
   Urdu piece names use the familiar desi terms.
   ============================================================ */
(function () {
  'use strict';

  var PIECES = {
    en: { 1: 'Pawn', 2: 'Knight', 3: 'Bishop', 4: 'Rook', 5: 'Queen', 6: 'King' },
    ur: { 1: 'پیادہ', 2: 'گھوڑا', 3: 'اونٹ', 4: 'ہاتھی', 5: 'وزیر', 6: 'بادشاہ' }
  };
  // short movement description for each piece, per language
  var MOVE_RULE = {
    en: {
      1: 'one square straight forward, and captures one square diagonally',
      2: 'in an L-shape, and it can jump over other pieces',
      3: 'diagonally, as far as the path is clear',
      4: 'in straight lines up, down, or sideways',
      5: 'in any straight line or diagonal — the most powerful piece',
      6: 'one single square in any direction'
    },
    ur: {
      1: 'ایک خانہ سیدھا آگے چلتا ہے، اور ترچھا ایک خانہ مارتا ہے',
      2: 'انگریزی L کی شکل میں چلتا ہے، اور دوسرے مہروں کے اوپر سے کود سکتا ہے',
      3: 'ترچھا، جہاں تک راستہ کھلا ہو',
      4: 'سیدھی لائن میں اوپر، نیچے یا اطراف میں',
      5: 'کسی بھی سیدھی یا ترچھی لائن میں — سب سے طاقتور مہرہ',
      6: 'کسی بھی طرف صرف ایک خانہ'
    }
  };

  var lang = 'en';

  var API = {
    setLang: function (l) { lang = (l === 'ur') ? 'ur' : 'en'; },
    getLang: function () { return lang; },
    isUr: function () { return lang === 'ur'; },
    pieceName: function (code) { return PIECES[lang][code & 7]; },
    pieceNameEn: function (code) { return PIECES.en[code & 7]; },
    moveRule: function (code) { return MOVE_RULE[lang][code & 7]; },
    // "your" / "their" — Urdu piece names are all masculine, so کا works for all
    owner: function (isMine) { return lang === 'ur' ? (isMine ? 'آپ کا' : 'مخالف کا') : (isMine ? 'your' : 'their'); },
    Owner: function (isMine) { return lang === 'ur' ? (isMine ? 'آپ کا' : 'مخالف کا') : (isMine ? 'Your' : 'Their'); },
    // join a list of tokens with the language's "and"
    joinList: function (arr) {
      if (!arr.length) return '';
      if (arr.length === 1) return arr[0];
      var and = lang === 'ur' ? ' اور ' : ' and ';
      var sep = lang === 'ur' ? '، ' : ', ';
      if (arr.length === 2) return arr[0] + and + arr[1];
      return arr.slice(0, -1).join(sep) + and + arr[arr.length - 1];
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.I18N = API;
}());
