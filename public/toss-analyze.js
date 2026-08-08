"use strict";
(() => {
  // node_modules/@orrery/core/dist/chunk-TW4ADZCX.js
  function isKoreanDaylightTime(year, month, day) {
    if (year === 1987) {
      if (month > 5 && month < 10) return true;
      if (month === 5 && day >= 10) return true;
      if (month === 10 && day <= 11) return true;
    }
    if (year === 1988) {
      if (month > 5 && month < 10) return true;
      if (month === 5 && day >= 8) return true;
      if (month === 10 && day <= 9) return true;
    }
    return false;
  }
  function adjustKdtToKst(year, month, day, hour, minute) {
    if (!isKoreanDaylightTime(year, month, day)) {
      return { year, month, day, hour, minute };
    }
    hour -= 1;
    if (hour < 0) {
      hour += 24;
      const d = new Date(year, month - 1, day - 1);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
    return { year, month, day, hour, minute };
  }

  // node_modules/@orrery/core/dist/chunk-EXYPMSUR.js
  var SKY = "\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678";
  var EARTH = "\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5";
  var SKY_KR = "\uAC11\uC744\uBCD1\uC815\uBB34\uAE30\uACBD\uC2E0\uC784\uACC4";
  var EARTH_KR = "\uC790\uCD95\uC778\uBB18\uC9C4\uC0AC\uC624\uBBF8\uC2E0\uC720\uC220\uD574";
  var YANGGAN = ["\u7532", "\u4E19", "\u620A", "\u5E9A", "\u58EC"];
  var RELATIONS = [
    { hanja: "\u6BD4\u80A9", hangul: "\uBE44\uACAC" },
    { hanja: "\u52AB\u8CA1", hangul: "\uAC81\uC7AC" },
    { hanja: "\u98DF\u795E", hangul: "\uC2DD\uC2E0" },
    { hanja: "\u50B7\u5B98", hangul: "\uC0C1\uAD00" },
    { hanja: "\u504F\u8CA1", hangul: "\uD3B8\uC7AC" },
    { hanja: "\u6B63\u8CA1", hangul: "\uC815\uC7AC" },
    { hanja: "\u504F\u5B98", hangul: "\uD3B8\uAD00" },
    { hanja: "\u6B63\u5B98", hangul: "\uC815\uAD00" },
    { hanja: "\u504F\u5370", hangul: "\uD3B8\uC778" },
    { hanja: "\u6B63\u5370", hangul: "\uC815\uC778" }
  ];
  var METEORS_12 = [
    { hanja: "\u9577\u751F", hangul: "\uC7A5\uC0DD" },
    { hanja: "\u6C90\u6D74", hangul: "\uBAA9\uC695" },
    { hanja: "\u51A0\u5E36", hangul: "\uAD00\uB300" },
    { hanja: "\u4E7E\u797F", hangul: "\uAC74\uB85D" },
    { hanja: "\u5E1D\u65FA", hangul: "\uC81C\uC655" },
    { hanja: "\u8870", hangul: "\uC1E0" },
    { hanja: "\u75C5", hangul: "\uBCD1" },
    { hanja: "\u6B7B", hangul: "\uC0AC" },
    { hanja: "\u5893", hangul: "\uBB18" },
    { hanja: "\u7D76", hangul: "\uC808" },
    { hanja: "\u80CE", hangul: "\uD0DC" },
    { hanja: "\u990A", hangul: "\uC591" }
  ];
  var SPIRITS_12 = [
    { hanja: "\u52AB\u6BBA", hangul: "\uAC81\uC0B4" },
    { hanja: "\u707D\u6BBA", hangul: "\uC7AC\uC0B4" },
    { hanja: "\u5929\u6BBA", hangul: "\uCC9C\uC0B4" },
    { hanja: "\u5730\u6BBA", hangul: "\uC9C0\uC0B4" },
    { hanja: "\u5E74\u6BBA", hangul: "\uC5F0\uC0B4" },
    { hanja: "\u6708\u6BBA", hangul: "\uC6D4\uC0B4" },
    { hanja: "\u4EA1\u8EAB", hangul: "\uB9DD\uC2E0" },
    { hanja: "\u5C07\u661F", hangul: "\uC7A5\uC131" },
    { hanja: "\u6500\u978D", hangul: "\uBC18\uC548" },
    { hanja: "\u9A5B\u99AC", hangul: "\uC5ED\uB9C8" },
    { hanja: "\u516D\u5BB3", hangul: "\uC721\uD574" },
    { hanja: "\u83EF\u84CB", hangul: "\uD654\uAC1C" }
  ];
  var STEM_INFO = {
    "\u7532": { yinyang: "+", element: "tree" },
    "\u4E59": { yinyang: "-", element: "tree" },
    "\u4E19": { yinyang: "+", element: "fire" },
    "\u4E01": { yinyang: "-", element: "fire" },
    "\u620A": { yinyang: "+", element: "earth" },
    "\u5DF1": { yinyang: "-", element: "earth" },
    "\u5E9A": { yinyang: "+", element: "metal" },
    "\u8F9B": { yinyang: "-", element: "metal" },
    "\u58EC": { yinyang: "+", element: "water" },
    "\u7678": { yinyang: "-", element: "water" }
  };
  var TRIPLE_COMPOSES = [
    ["\u5BC5", "\u5348", "\u620C"],
    // 火局
    ["\u5DF3", "\u9149", "\u4E11"],
    // 金局
    ["\u7533", "\u5B50", "\u8FB0"],
    // 水局
    ["\u4EA5", "\u536F", "\u672A"]
    // 木局
  ];
  var TRIPLE_COMPOSE_ELEMENTS = {
    "\u5BC5,\u5348,\u620C": "fire",
    "\u5DF3,\u9149,\u4E11": "metal",
    "\u7533,\u5B50,\u8FB0": "water",
    "\u4EA5,\u536F,\u672A": "tree"
  };
  var HALF_COMPOSES = {
    "\u5BC5,\u5348": ["\u534A\u5408", "fire"],
    "\u5348,\u620C": ["\u534A\u5408", "fire"],
    "\u5DF3,\u9149": ["\u534A\u5408", "metal"],
    "\u9149,\u4E11": ["\u534A\u5408", "metal"],
    "\u7533,\u5B50": ["\u534A\u5408", "water"],
    "\u5B50,\u8FB0": ["\u534A\u5408", "water"],
    "\u4EA5,\u536F": ["\u534A\u5408", "tree"],
    "\u536F,\u672A": ["\u534A\u5408", "tree"]
  };
  var DIRECTIONAL_COMPOSES = [
    ["\u5BC5", "\u536F", "\u8FB0"],
    // 東方木
    ["\u5DF3", "\u5348", "\u672A"],
    // 南方火
    ["\u7533", "\u9149", "\u620C"],
    // 西方金
    ["\u4EA5", "\u5B50", "\u4E11"]
    // 北方水
  ];
  var DIRECTIONAL_COMPOSE_ELEMENTS = {
    "\u5BC5,\u536F,\u8FB0": "tree",
    "\u5DF3,\u5348,\u672A": "fire",
    "\u7533,\u9149,\u620C": "metal",
    "\u4EA5,\u5B50,\u4E11": "water"
  };
  var STEM_COMBINES = {
    "\u7532,\u5DF1": ["\u5408", "earth"],
    "\u4E59,\u5E9A": ["\u5408", "metal"],
    "\u4E19,\u8F9B": ["\u5408", "water"],
    "\u4E01,\u58EC": ["\u5408", "tree"],
    "\u620A,\u7678": ["\u5408", "fire"]
  };
  var STEM_CLASHES = {
    "\u7532,\u5E9A": "\u6C96",
    "\u4E59,\u8F9B": "\u6C96",
    "\u4E19,\u58EC": "\u6C96",
    "\u4E01,\u7678": "\u6C96"
  };
  var BRANCH_COMBINES_6 = {
    "\u5B50,\u4E11": ["\u5408", "earth"],
    "\u5BC5,\u4EA5": ["\u5408", "tree"],
    "\u536F,\u620C": ["\u5408", "fire"],
    "\u8FB0,\u9149": ["\u5408", "metal"],
    "\u5DF3,\u7533": ["\u5408", "water"],
    "\u5348,\u672A": ["\u5408", "fire"]
  };
  var BRANCH_CLASHES = {
    "\u5B50,\u5348": "\u6C96",
    "\u4E11,\u672A": "\u6C96",
    "\u5BC5,\u7533": "\u6C96",
    "\u536F,\u9149": "\u6C96",
    "\u8FB0,\u620C": "\u6C96",
    "\u5DF3,\u4EA5": "\u6C96"
  };
  var BRANCH_BREAKS = {
    "\u5B50,\u9149": "\u7834",
    "\u4E11,\u8FB0": "\u7834",
    "\u5BC5,\u4EA5": "\u7834",
    "\u536F,\u5348": "\u7834",
    "\u5DF3,\u7533": "\u7834",
    "\u672A,\u620C": "\u7834"
  };
  var BRANCH_HARMS = {
    "\u5B50,\u672A": "\u5BB3",
    "\u4E11,\u5348": "\u5BB3",
    "\u5BC5,\u5DF3": "\u5BB3",
    "\u536F,\u8FB0": "\u5BB3",
    "\u7533,\u4EA5": "\u5BB3",
    "\u9149,\u620C": "\u5BB3"
  };
  var BRANCH_PUNISHMENTS = {
    "\u5BC5,\u5DF3": ["\u5211", "\u7121\u6069"],
    "\u5DF3,\u7533": ["\u5211", "\u7121\u6069"],
    "\u7533,\u5BC5": ["\u5211", "\u7121\u6069"],
    "\u4E11,\u620C": ["\u5211", "\u7121\u79AE"],
    "\u620C,\u672A": ["\u5211", "\u7121\u79AE"],
    "\u672A,\u4E11": ["\u5211", "\u7121\u79AE"],
    "\u5B50,\u536F": ["\u5211", "\u76F8\u5211"],
    "\u536F,\u5B50": ["\u5211", "\u76F8\u5211"]
  };
  var BRANCH_SELF_PUNISHMENTS = /* @__PURE__ */ new Set(["\u8FB0", "\u5348", "\u9149", "\u4EA5"]);
  var BRANCH_WONJIN = {
    "\u5B50,\u672A": "\u6028\u55D4",
    "\u4E11,\u5348": "\u6028\u55D4",
    "\u5BC5,\u9149": "\u6028\u55D4",
    "\u536F,\u7533": "\u6028\u55D4",
    "\u8FB0,\u4EA5": "\u6028\u55D4",
    "\u5DF3,\u620C": "\u6028\u55D4"
  };
  var BRANCH_GWIMUN = {
    "\u5B50,\u9149": "\u9B3C\u9580",
    "\u4E11,\u5348": "\u9B3C\u9580",
    "\u5BC5,\u672A": "\u9B3C\u9580",
    "\u536F,\u7533": "\u9B3C\u9580",
    "\u8FB0,\u4EA5": "\u9B3C\u9580",
    "\u5DF3,\u620C": "\u9B3C\u9580"
  };
  var YANGIN_MAP = {
    "\u7532": "\u536F",
    "\u4E19": "\u5348",
    "\u620A": "\u5348",
    "\u5E9A": "\u9149",
    "\u58EC": "\u5B50"
  };
  var BAEKHO_PILLARS = /* @__PURE__ */ new Set(["\u7532\u8FB0", "\u4E59\u672A", "\u4E19\u620C", "\u4E01\u4E11", "\u620A\u8FB0", "\u58EC\u620C", "\u7678\u4E11"]);
  var GOEGANG_PILLARS = /* @__PURE__ */ new Set(["\u5E9A\u8FB0", "\u5E9A\u620C", "\u58EC\u8FB0", "\u620A\u620C"]);
  var DOHWA_MAP = {
    "\u5BC5": "\u536F",
    "\u5348": "\u536F",
    "\u620C": "\u536F",
    "\u7533": "\u9149",
    "\u5B50": "\u9149",
    "\u8FB0": "\u9149",
    "\u5DF3": "\u5348",
    "\u9149": "\u5348",
    "\u4E11": "\u5348",
    "\u4EA5": "\u5B50",
    "\u536F": "\u5B50",
    "\u672A": "\u5B50"
  };
  var CHEONUL_MAP = {
    "\u7532": ["\u4E11", "\u672A"],
    "\u620A": ["\u4E11", "\u672A"],
    "\u5E9A": ["\u4E11", "\u672A"],
    "\u4E59": ["\u5B50", "\u7533"],
    "\u5DF1": ["\u5B50", "\u7533"],
    "\u4E19": ["\u4EA5", "\u9149"],
    "\u4E01": ["\u4EA5", "\u9149"],
    "\u8F9B": ["\u5348", "\u5BC5"],
    "\u58EC": ["\u5DF3", "\u536F"],
    "\u7678": ["\u5DF3", "\u536F"]
  };
  var CHEONDUK_MAP = {
    "\u5BC5": "\u4E01",
    "\u536F": "\u7533",
    "\u8FB0": "\u58EC",
    "\u5DF3": "\u8F9B",
    "\u5348": "\u4EA5",
    "\u672A": "\u7532",
    "\u7533": "\u7678",
    "\u9149": "\u5BC5",
    "\u620C": "\u4E19",
    "\u4EA5": "\u4E59",
    "\u5B50": "\u5DF3",
    "\u4E11": "\u5E9A"
  };
  var WOLDUK_MAP = {
    "\u5BC5": "\u4E19",
    "\u5348": "\u4E19",
    "\u620C": "\u4E19",
    "\u7533": "\u58EC",
    "\u5B50": "\u58EC",
    "\u8FB0": "\u58EC",
    "\u5DF3": "\u5E9A",
    "\u9149": "\u5E9A",
    "\u4E11": "\u5E9A",
    "\u4EA5": "\u7532",
    "\u536F": "\u7532",
    "\u672A": "\u7532"
  };
  var MUNCHANG_MAP = {
    "\u7532": "\u5DF3",
    "\u4E59": "\u5348",
    "\u4E19": "\u7533",
    "\u4E01": "\u9149",
    "\u620A": "\u7533",
    "\u5DF1": "\u9149",
    "\u5E9A": "\u4EA5",
    "\u8F9B": "\u5B50",
    "\u58EC": "\u5BC5",
    "\u7678": "\u536F"
  };
  var HONGYEOM_PILLARS = /* @__PURE__ */ new Set(["\u7532\u5348", "\u4E19\u5BC5", "\u4E01\u672A", "\u620A\u8FB0", "\u5E9A\u620C", "\u8F9B\u9149", "\u58EC\u5B50"]);
  var GEUMYEO_MAP = {
    "\u7532": "\u8FB0",
    "\u4E59": "\u5DF3",
    "\u4E19": "\u672A",
    "\u4E01": "\u7533",
    "\u620A": "\u672A",
    "\u5DF1": "\u7533",
    "\u5E9A": "\u620C",
    "\u8F9B": "\u4EA5",
    "\u58EC": "\u4E11",
    "\u7678": "\u5BC5"
  };
  var METEOR_LOOKUP = {
    "\uAC11\uD574": 0,
    "\uC744\uC624": 0,
    "\uBCD1\uC778": 0,
    "\uC815\uC720": 0,
    "\uBB34\uC778": 0,
    "\uAE30\uC720": 0,
    "\uACBD\uC0AC": 0,
    "\uC2E0\uC790": 0,
    "\uC784\uC2E0": 0,
    "\uACC4\uBB18": 0,
    "\uAC11\uC790": 1,
    "\uC744\uC0AC": 1,
    "\uBCD1\uBB18": 1,
    "\uC815\uC2E0": 1,
    "\uBB34\uBB18": 1,
    "\uAE30\uC2E0": 1,
    "\uACBD\uC624": 1,
    "\uC2E0\uD574": 1,
    "\uC784\uC720": 1,
    "\uACC4\uC778": 1,
    "\uAC11\uCD95": 2,
    "\uC744\uC9C4": 2,
    "\uBCD1\uC9C4": 2,
    "\uC815\uBBF8": 2,
    "\uBB34\uC9C4": 2,
    "\uAE30\uBBF8": 2,
    "\uACBD\uBBF8": 2,
    "\uC2E0\uC220": 2,
    "\uC784\uC220": 2,
    "\uACC4\uCD95": 2,
    "\uAC11\uC778": 3,
    "\uC744\uBB18": 3,
    "\uBCD1\uC0AC": 3,
    "\uC815\uC624": 3,
    "\uBB34\uC0AC": 3,
    "\uAE30\uC624": 3,
    "\uACBD\uC2E0": 3,
    "\uC2E0\uC720": 3,
    "\uC784\uD574": 3,
    "\uACC4\uC790": 3,
    "\uAC11\uBB18": 4,
    "\uC744\uC778": 4,
    "\uBCD1\uC624": 4,
    "\uC815\uC0AC": 4,
    "\uBB34\uC624": 4,
    "\uAE30\uC0AC": 4,
    "\uACBD\uC720": 4,
    "\uC2E0\uC2E0": 4,
    "\uC784\uC790": 4,
    "\uACC4\uD574": 4,
    "\uAC11\uC9C4": 5,
    "\uC744\uCD95": 5,
    "\uBCD1\uBBF8": 5,
    "\uC815\uC9C4": 5,
    "\uBB34\uBBF8": 5,
    "\uAE30\uC9C4": 5,
    "\uACBD\uC220": 5,
    "\uC2E0\uBBF8": 5,
    "\uC784\uCD95": 5,
    "\uACC4\uC220": 5,
    "\uAC11\uC0AC": 6,
    "\uC744\uC790": 6,
    "\uBCD1\uC2E0": 6,
    "\uC815\uBB18": 6,
    "\uBB34\uC2E0": 6,
    "\uAE30\uBB18": 6,
    "\uACBD\uD574": 6,
    "\uC2E0\uC624": 6,
    "\uC784\uC778": 6,
    "\uACC4\uC720": 6,
    "\uAC11\uC624": 7,
    "\uC744\uD574": 7,
    "\uBCD1\uC720": 7,
    "\uC815\uC778": 7,
    "\uBB34\uC720": 7,
    "\uAE30\uC778": 7,
    "\uACBD\uC790": 7,
    "\uC2E0\uC0AC": 7,
    "\uC784\uBB18": 7,
    "\uACC4\uC2E0": 7,
    "\uAC11\uBBF8": 8,
    "\uC744\uC220": 8,
    "\uBCD1\uC220": 8,
    "\uC815\uCD95": 8,
    "\uBB34\uC220": 8,
    "\uAE30\uCD95": 8,
    "\uACBD\uCD95": 8,
    "\uC2E0\uC9C4": 8,
    "\uC784\uC9C4": 8,
    "\uACC4\uBBF8": 8,
    "\uAC11\uC2E0": 9,
    "\uC744\uC720": 9,
    "\uBCD1\uD574": 9,
    "\uC815\uC790": 9,
    "\uBB34\uD574": 9,
    "\uAE30\uC790": 9,
    "\uACBD\uC778": 9,
    "\uC2E0\uBB18": 9,
    "\uC784\uC0AC": 9,
    "\uACC4\uC624": 9,
    "\uAC11\uC720": 10,
    "\uC744\uC2E0": 10,
    "\uBCD1\uC790": 10,
    "\uC815\uD574": 10,
    "\uBB34\uC790": 10,
    "\uAE30\uD574": 10,
    "\uACBD\uBB18": 10,
    "\uC2E0\uC778": 10,
    "\uC784\uC624": 10,
    "\uACC4\uC0AC": 10,
    "\uAC11\uC220": 11,
    "\uC744\uBBF8": 11,
    "\uBCD1\uCD95": 11,
    "\uC815\uC220": 11,
    "\uBB34\uCD95": 11,
    "\uAE30\uC220": 11,
    "\uACBD\uC9C4": 11,
    "\uC2E0\uCD95": 11,
    "\uC784\uBBF8": 11,
    "\uACC4\uC9C4": 11
  };
  var JIJANGGAN = {
    "\u5BC5": "\u620A\u4E19\u7532",
    "\u536F": "\u7532 \u4E59",
    "\u8FB0": "\u4E59\u7678\u620A",
    "\u5DF3": "\u620A\u5E9A\u4E19",
    "\u5348": "\u4E19\u5DF1\u4E01",
    "\u672A": "\u4E01\u4E59\u5DF1",
    "\u7533": "\u620A\u58EC\u5E9A",
    "\u9149": "\u5E9A \u8F9B",
    "\u620C": "\u8F9B\u4E01\u620A",
    "\u4EA5": "\u620A\u7532\u58EC",
    "\u5B50": "\u58EC \u7678",
    "\u4E11": "\u7678\u8F9B\u5DF1"
  };
  var GONGMANG_TABLE = [
    ["\u620C", "\u4EA5"],
    // 甲子旬 (0-9)
    ["\u7533", "\u9149"],
    // 甲戌旬 (10-19)
    ["\u5348", "\u672A"],
    // 甲申旬 (20-29)
    ["\u8FB0", "\u5DF3"],
    // 甲午旬 (30-39)
    ["\u5BC5", "\u536F"],
    // 甲辰旬 (40-49)
    ["\u5B50", "\u4E11"]
    // 甲寅旬 (50-59)
  ];
  var HGANJI = [
    "\u7532\u5B50",
    "\u4E59\u4E11",
    "\u4E19\u5BC5",
    "\u4E01\u536F",
    "\u620A\u8FB0",
    "\u5DF1\u5DF3",
    "\u5E9A\u5348",
    "\u8F9B\u672A",
    "\u58EC\u7533",
    "\u7678\u9149",
    "\u7532\u620C",
    "\u4E59\u4EA5",
    "\u4E19\u5B50",
    "\u4E01\u4E11",
    "\u620A\u5BC5",
    "\u5DF1\u536F",
    "\u5E9A\u8FB0",
    "\u8F9B\u5DF3",
    "\u58EC\u5348",
    "\u7678\u672A",
    "\u7532\u7533",
    "\u4E59\u9149",
    "\u4E19\u620C",
    "\u4E01\u4EA5",
    "\u620A\u5B50",
    "\u5DF1\u4E11",
    "\u5E9A\u5BC5",
    "\u8F9B\u536F",
    "\u58EC\u8FB0",
    "\u7678\u5DF3",
    "\u7532\u5348",
    "\u4E59\u672A",
    "\u4E19\u7533",
    "\u4E01\u9149",
    "\u620A\u620C",
    "\u5DF1\u4EA5",
    "\u5E9A\u5B50",
    "\u8F9B\u4E11",
    "\u58EC\u5BC5",
    "\u7678\u536F",
    "\u7532\u8FB0",
    "\u4E59\u5DF3",
    "\u4E19\u5348",
    "\u4E01\u672A",
    "\u620A\u7533",
    "\u5DF1\u9149",
    "\u5E9A\u620C",
    "\u8F9B\u4EA5",
    "\u58EC\u5B50",
    "\u7678\u4E11",
    "\u7532\u5BC5",
    "\u4E59\u536F",
    "\u4E19\u8FB0",
    "\u4E01\u5DF3",
    "\u620A\u5348",
    "\u5DF1\u672A",
    "\u5E9A\u7533",
    "\u8F9B\u9149",
    "\u58EC\u620C",
    "\u7678\u4EA5"
  ];

  // node_modules/@orrery/core/dist/chunk-JLKMDX3R.js
  function div(a, b) {
    return Math.trunc(a / b);
  }
  var MONTH = [
    0,
    21355,
    42843,
    64498,
    86335,
    108366,
    130578,
    152958,
    175471,
    198077,
    220728,
    243370,
    265955,
    288432,
    310767,
    332928,
    354903,
    376685,
    398290,
    419736,
    441060,
    462295,
    483493,
    504693,
    525949
  ];
  var UNIT = {
    year: 1996,
    month: 2,
    day: 4,
    hour: 22,
    min: 8,
    // 세차
    ygan: 2,
    yji: 0,
    // 월건
    mgan: 6,
    mji: 2,
    msu: 26,
    // 일진
    dgan: 7,
    dji: 7,
    dsu: 7,
    // 시주
    hgan: 5,
    hji: 11,
    hsu: 35
  };
  function dayOfYear(year, month, day) {
    let e = 0;
    for (let i = 1; i < month; i++) {
      e += 31;
      if (i === 2 || i === 4 || i === 6 || i === 9 || i === 11) {
        e -= 1;
      }
      if (i === 2) {
        e -= 2;
        if (year % 4 === 0) e += 1;
        if (year % 100 === 0) e -= 1;
        if (year % 400 === 0) e += 1;
        if (year % 4e3 === 0) e -= 1;
      }
    }
    e += day;
    return e;
  }
  function daysBetween(y1, m1, d1, y2, m2, d2) {
    let p1, p1n, p2;
    let pp1, pp2, pr;
    if (y2 > y1) {
      p1 = dayOfYear(y1, m1, d1);
      p1n = dayOfYear(y1, 12, 31);
      p2 = dayOfYear(y2, m2, d2);
      pp1 = y1;
      pp2 = y2;
      pr = -1;
    } else {
      p1 = dayOfYear(y2, m2, d2);
      p1n = dayOfYear(y2, 12, 31);
      p2 = dayOfYear(y1, m1, d1);
      pp1 = y2;
      pp2 = y1;
      pr = 1;
    }
    let dis;
    if (y2 === y1) {
      dis = p2 - p1;
    } else {
      dis = p1n - p1;
      let k = pp1 + 1;
      const ppp2 = pp2 - 1;
      while (k <= ppp2) {
        if (k === -2e3 && ppp2 > 1990) {
          dis += 1457682;
          k = 1991;
        } else if (k === -1750 && ppp2 > 1990) {
          dis += 1366371;
          k = 1991;
        } else if (k === -1500 && ppp2 > 1990) {
          dis += 1275060;
          k = 1991;
        } else if (k === -1250 && ppp2 > 1990) {
          dis += 1183750;
          k = 1991;
        } else if (k === -1e3 && ppp2 > 1990) {
          dis += 1092439;
          k = 1991;
        } else if (k === -750 && ppp2 > 1990) {
          dis += 1001128;
          k = 1991;
        } else if (k === -500 && ppp2 > 1990) {
          dis += 909818;
          k = 1991;
        } else if (k === -250 && ppp2 > 1990) {
          dis += 818507;
          k = 1991;
        } else if (k === 0 && ppp2 > 1990) {
          dis += 727197;
          k = 1991;
        } else if (k === 250 && ppp2 > 1990) {
          dis += 635887;
          k = 1991;
        } else if (k === 500 && ppp2 > 1990) {
          dis += 544576;
          k = 1991;
        } else if (k === 750 && ppp2 > 1990) {
          dis += 453266;
          k = 1991;
        } else if (k === 1e3 && ppp2 > 1990) {
          dis += 361955;
          k = 1991;
        } else if (k === 1250 && ppp2 > 1990) {
          dis += 270644;
          k = 1991;
        } else if (k === 1500 && ppp2 > 1990) {
          dis += 179334;
          k = 1991;
        } else if (k === 1750 && ppp2 > 1990) {
          dis += 88023;
          k = 1991;
        }
        dis += dayOfYear(k, 12, 31);
        k += 1;
      }
      dis += p2;
      dis *= pr;
    }
    return dis;
  }
  function minutesBetween(uy, umm, ud, uh, umin, y1, mo1, d1, h1, mm1) {
    const dispday = daysBetween(uy, umm, ud, y1, mo1, d1);
    return dispday * 24 * 60 + (uh - h1) * 60 + (umin - mm1);
  }
  function dateFromMinutes(tmin, uyear, umonth, uday, uhour, umin) {
    let y1, mo1, d1, h1, mi1;
    let t;
    y1 = uyear - div(tmin, 525949);
    if (tmin > 0) {
      y1 += 2;
      while (true) {
        y1 -= 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, 1, 1, 0, 0);
        if (t >= tmin) break;
      }
      mo1 = 13;
      while (true) {
        mo1 -= 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, 1, 0, 0);
        if (t >= tmin) break;
      }
      d1 = 32;
      while (true) {
        d1 -= 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, 0, 0);
        if (t >= tmin) break;
      }
      h1 = 24;
      while (true) {
        h1 -= 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, h1, 0);
        if (t >= tmin) break;
      }
      t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, h1, 0);
      mi1 = t - tmin;
    } else {
      y1 -= 2;
      while (true) {
        y1 += 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, 1, 1, 0, 0);
        if (t < tmin) break;
      }
      y1 -= 1;
      mo1 = 0;
      while (true) {
        mo1 += 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, 1, 0, 0);
        if (t < tmin) break;
      }
      mo1 -= 1;
      d1 = 0;
      while (true) {
        d1 += 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, 0, 0);
        if (t < tmin) break;
      }
      d1 -= 1;
      h1 = -1;
      while (true) {
        h1 += 1;
        t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, h1, 0);
        if (t < tmin) break;
      }
      h1 -= 1;
      t = minutesBetween(uyear, umonth, uday, uhour, umin, y1, mo1, d1, h1, 0);
      mi1 = t - tmin;
    }
    return [y1, mo1, d1, h1, mi1];
  }
  function calcPillarIndices(year, month, day, hour, min, jasiMethod) {
    const displ2min = minutesBetween(
      UNIT.year,
      UNIT.month,
      UNIT.day,
      UNIT.hour,
      UNIT.min,
      year,
      month,
      day,
      hour,
      min
    );
    const displ2day = daysBetween(
      UNIT.year,
      UNIT.month,
      UNIT.day,
      year,
      month,
      day
    );
    let so24 = div(displ2min, 525949);
    if (displ2min >= 0) so24 += 1;
    let so24year = so24 % 60 * -1 + 12;
    if (so24year < 0) so24year += 60;
    else if (so24year > 59) so24year -= 60;
    let monthmin100 = displ2min % 525949;
    monthmin100 = 525949 - monthmin100;
    if (monthmin100 < 0) monthmin100 += 525949;
    else if (monthmin100 >= 525949) monthmin100 -= 525949;
    let so24monthIdx = 0;
    for (let i2 = 0; i2 < 12; i2++) {
      const j = i2 * 2;
      if (MONTH[j] <= monthmin100 && monthmin100 < MONTH[j + 2]) {
        so24monthIdx = i2;
      }
    }
    let t = so24year % 10;
    t = t % 5;
    t = t * 12 + 2 + so24monthIdx;
    let so24month = t;
    if (so24month > 59) so24month -= 60;
    let so24day = displ2day % 60;
    so24day = so24day * -1 + 7;
    if (so24day < 0) so24day += 60;
    else if (so24day > 59) so24day -= 60;
    let i;
    if (hour === 0 || hour === 1 && min < 30) {
      i = 0;
    } else if (hour === 1 && min >= 30 || hour === 2 || hour === 3 && min < 30) {
      i = 1;
    } else if (hour === 3 && min >= 30 || hour === 4 || hour === 5 && min < 30) {
      i = 2;
    } else if (hour === 5 && min >= 30 || hour === 6 || hour === 7 && min < 30) {
      i = 3;
    } else if (hour === 7 && min >= 30 || hour === 8 || hour === 9 && min < 30) {
      i = 4;
    } else if (hour === 9 && min >= 30 || hour === 10 || hour === 11 && min < 30) {
      i = 5;
    } else if (hour === 11 && min >= 30 || hour === 12 || hour === 13 && min < 30) {
      i = 6;
    } else if (hour === 13 && min >= 30 || hour === 14 || hour === 15 && min < 30) {
      i = 7;
    } else if (hour === 15 && min >= 30 || hour === 16 || hour === 17 && min < 30) {
      i = 8;
    } else if (hour === 17 && min >= 30 || hour === 18 || hour === 19 && min < 30) {
      i = 9;
    } else if (hour === 19 && min >= 30 || hour === 20 || hour === 21 && min < 30) {
      i = 10;
    } else if (hour === 21 && min >= 30 || hour === 22 || hour === 23 && min < 30) {
      i = 11;
    } else {
      i = 0;
      const method = jasiMethod ?? "unified";
      if (method === "unified") {
        so24day += 1;
        if (so24day === 60) so24day = 0;
      }
    }
    const isYajasi = i === 0 && hour === 23 && jasiMethod === "split";
    const dayForHour = isYajasi ? (so24day + 1) % 60 : so24day;
    t = dayForHour % 10;
    t = t % 5;
    t = t * 12 + i;
    const so24hour = t;
    return [so24, so24year, so24month, so24day, so24hour];
  }
  function calcSolarTerms(year, month, day, hour, min) {
    const [, , so24month] = calcPillarIndices(year, month, day, hour, min);
    const displ2min = minutesBetween(
      UNIT.year,
      UNIT.month,
      UNIT.day,
      UNIT.hour,
      UNIT.min,
      year,
      month,
      day,
      hour,
      min
    );
    let monthmin100 = displ2min % 525949 * -1;
    if (monthmin100 < 0) monthmin100 += 525949;
    else if (monthmin100 >= 525949) monthmin100 -= 525949;
    let ii = so24month % 12 - 2;
    if (ii === -2) ii = 10;
    else if (ii === -1) ii = 11;
    const ingiName = ii * 2;
    const midName = ii * 2 + 1;
    const outgiName = ii * 2 + 2;
    const j = ii * 2;
    let tmin = displ2min + (monthmin100 - MONTH[j]);
    const [ingiYear, ingiMonth, ingiDay, ingiHour, ingiMin] = dateFromMinutes(
      tmin,
      UNIT.year,
      UNIT.month,
      UNIT.day,
      UNIT.hour,
      UNIT.min
    );
    tmin = displ2min + (monthmin100 - MONTH[j + 1]);
    const [midYear, midMonth, midDay, midHour, midMin] = dateFromMinutes(
      tmin,
      UNIT.year,
      UNIT.month,
      UNIT.day,
      UNIT.hour,
      UNIT.min
    );
    tmin = displ2min + (monthmin100 - MONTH[j + 2]);
    const [outgiYear, outgiMonth, outgiDay, outgiHour, outgiMin] = dateFromMinutes(
      tmin,
      UNIT.year,
      UNIT.month,
      UNIT.day,
      UNIT.hour,
      UNIT.min
    );
    return {
      ingiName,
      ingiYear,
      ingiMonth,
      ingiDay,
      ingiHour,
      ingiMin,
      midName,
      midYear,
      midMonth,
      midDay,
      midHour,
      midMin,
      outgiName,
      outgiYear,
      outgiMonth,
      outgiDay,
      outgiHour,
      outgiMin
    };
  }
  function getFourPillars(year, month, day, hour, minute, jasiMethod) {
    const [, y, m, d, h] = calcPillarIndices(year, month, day, hour, minute, jasiMethod);
    return [HGANJI[y], HGANJI[m], HGANJI[d], HGANJI[h]];
  }
  function getDaewoon(isMale, year, month, day, hour, minute, jasiMethod) {
    const [, sy, sm] = calcPillarIndices(year, month, day, hour, minute, jasiMethod);
    const yearStem = HGANJI[sy][0];
    const isYangGan = YANGGAN.includes(yearStem);
    const order = isMale && isYangGan || !isMale && !isYangGan;
    const terms = calcSolarTerms(year, month, day, hour, minute);
    const d0 = order ? new Date(terms.outgiYear, terms.outgiMonth - 1, terms.outgiDay, terms.outgiHour, terms.outgiMin) : new Date(terms.ingiYear, terms.ingiMonth - 1, terms.ingiDay, terms.ingiHour, terms.ingiMin);
    const birth = new Date(year, month - 1, day, hour, minute);
    const diff = birth.getTime() - d0.getTime();
    const secondsToFirst = Math.abs(diff / 1e3 * 365.242196 / 3);
    let nextDate = new Date(birth.getTime() + secondsToFirst * 1e3);
    nextDate.setMilliseconds(0);
    const flow = order ? 1 : -1;
    let mIdx = sm;
    const ret = [];
    for (let i = 0; i < 10; i++) {
      mIdx = mIdx + flow;
      if (mIdx >= HGANJI.length) mIdx = 0;
      if (mIdx < 0) mIdx = HGANJI.length - 1;
      ret.push({ ganzi: HGANJI[mIdx], startDate: new Date(nextDate) });
      nextDate = new Date(nextDate);
      nextDate.setFullYear(nextDate.getFullYear() + 10);
    }
    return ret;
  }
  function getInteraction(e0, e1) {
    if (e0 === e1) return "same";
    if (e0 === "water" && e1 === "tree" || e0 === "tree" && e1 === "fire" || e0 === "fire" && e1 === "earth" || e0 === "earth" && e1 === "metal" || e0 === "metal" && e1 === "water") return "output";
    if (e0 === "water" && e1 === "metal" || e0 === "tree" && e1 === "water" || e0 === "fire" && e1 === "tree" || e0 === "earth" && e1 === "fire" || e0 === "metal" && e1 === "earth") return "input";
    if (e0 === "water" && e1 === "earth" || e0 === "tree" && e1 === "metal" || e0 === "fire" && e1 === "water" || e0 === "earth" && e1 === "tree" || e0 === "metal" && e1 === "fire") return "shield";
    if (e0 === "water" && e1 === "fire" || e0 === "tree" && e1 === "earth" || e0 === "fire" && e1 === "metal" || e0 === "earth" && e1 === "water" || e0 === "metal" && e1 === "tree") return "sword";
    return null;
  }
  function getRelation(dayStem, targetStem) {
    const day = STEM_INFO[dayStem];
    const target = STEM_INFO[targetStem];
    if (!day || !target) return null;
    const interaction = getInteraction(day.element, target.element);
    if (!interaction) return null;
    const sameYY = day.yinyang === target.yinyang;
    switch (interaction) {
      case "same":
        return sameYY ? RELATIONS[0] : RELATIONS[1];
      case "output":
        return sameYY ? RELATIONS[2] : RELATIONS[3];
      case "sword":
        return sameYY ? RELATIONS[4] : RELATIONS[5];
      case "shield":
        return sameYY ? RELATIONS[6] : RELATIONS[7];
      case "input":
        return sameYY ? RELATIONS[8] : RELATIONS[9];
    }
  }
  function getHiddenStems(branch) {
    return JIJANGGAN[branch] || "";
  }
  function getJeonggi(branch) {
    const jijang = getHiddenStems(branch);
    return jijang.replace(/ /g, "").slice(-1);
  }
  function toHangul(hanja) {
    const skyIdx = SKY.indexOf(hanja);
    if (skyIdx >= 0) return SKY_KR[skyIdx];
    const earthIdx = EARTH.indexOf(hanja);
    if (earthIdx >= 0) return EARTH_KR[earthIdx];
    return hanja;
  }
  function getTwelveMeteor(stem, branch) {
    const stemKr = toHangul(stem);
    const branchKr = toHangul(branch);
    const key = stemKr + branchKr;
    const idx = METEOR_LOOKUP[key];
    if (idx !== void 0) return METEORS_12[idx].hanja;
    return "?";
  }
  var SPIRIT_START = {
    "\u5BC5": 11,
    "\u5348": 11,
    "\u620C": 11,
    // 亥
    "\u5DF3": 2,
    "\u9149": 2,
    "\u4E11": 2,
    // 寅
    "\u7533": 5,
    "\u5B50": 5,
    "\u8FB0": 5,
    // 巳
    "\u4EA5": 8,
    "\u536F": 8,
    "\u672A": 8
    // 申
  };
  function getTwelveSpirit(yearBranch, targetBranch) {
    const start = SPIRIT_START[yearBranch];
    if (start === void 0) return "?";
    const targetIdx = EARTH.indexOf(targetBranch);
    if (targetIdx < 0) return "?";
    const offset = ((targetIdx - start) % 12 + 12) % 12;
    return SPIRITS_12[offset].hanja;
  }
  var YANG_STEM_OF = {
    tree: "\u7532",
    fire: "\u4E19",
    earth: "\u620A",
    metal: "\u5E9A",
    water: "\u58EC"
  };
  var SIPSIN_CATEGORIES = [
    { name: "\u6BD4\u52AB", interactions: ["same"] },
    { name: "\u98DF\u50B7", interactions: ["output"] },
    { name: "\u8CA1\u661F", interactions: ["sword"] },
    { name: "\u5B98\u661F", interactions: ["shield"] },
    { name: "\u5370\u661F", interactions: ["input"] }
  ];
  function calculateJwabeop(dayStem, branches, dayBranch) {
    return branches.map((branch) => {
      const hidden = getHiddenStems(branch).replace(/ /g, "");
      return [...hidden].map((stem) => {
        const rel = getRelation(dayStem, stem);
        const sipsin = rel ? rel.hanja : "?";
        const unseong = getTwelveMeteor(stem, dayBranch);
        return { stem, sipsin, unseong };
      });
    });
  }
  function calculateInjongbeop(dayStem, dayBranch) {
    const dayInfo = STEM_INFO[dayStem];
    if (!dayInfo) return [];
    const hidden = getHiddenStems(dayBranch).replace(/ /g, "");
    const presentInteractions = /* @__PURE__ */ new Set();
    for (const stem of hidden) {
      const info = STEM_INFO[stem];
      if (!info) continue;
      const interaction = getInteraction(dayInfo.element, info.element);
      if (interaction) presentInteractions.add(interaction);
    }
    const result = [];
    for (const cat of SIPSIN_CATEGORIES) {
      const missing = cat.interactions.every((i) => !presentInteractions.has(i));
      if (!missing) continue;
      let targetElement = null;
      for (const [el, info] of Object.entries(STEM_INFO)) {
        if (info.yinyang !== "+") continue;
        const inter = getInteraction(dayInfo.element, info.element);
        if (inter && cat.interactions.includes(inter)) {
          targetElement = info.element;
          break;
        }
      }
      if (!targetElement) continue;
      const yangStem = YANG_STEM_OF[targetElement];
      const unseong = getTwelveMeteor(yangStem, dayBranch);
      result.push({ category: cat.name, yangStem, unseong });
    }
    return result;
  }
  function lookupPair(table, a, b) {
    return table[`${a},${b}`] ?? table[`${b},${a}`];
  }
  function getStemRelation(stem1, stem2) {
    const results = [];
    const combine = lookupPair(STEM_COMBINES, stem1, stem2);
    if (combine) results.push({ type: combine[0], detail: combine[1] });
    const clash = lookupPair(STEM_CLASHES, stem1, stem2);
    if (clash) results.push({ type: clash, detail: null });
    return results;
  }
  function getBranchRelation(branch1, branch2) {
    const results = [];
    const combine = lookupPair(BRANCH_COMBINES_6, branch1, branch2);
    if (combine) results.push({ type: combine[0], detail: combine[1] });
    const half = lookupPair(HALF_COMPOSES, branch1, branch2);
    if (half) results.push({ type: half[0], detail: half[1] });
    const clash = lookupPair(BRANCH_CLASHES, branch1, branch2);
    if (clash) results.push({ type: clash, detail: null });
    const brk = lookupPair(BRANCH_BREAKS, branch1, branch2);
    if (brk) results.push({ type: brk, detail: null });
    const harm = lookupPair(BRANCH_HARMS, branch1, branch2);
    if (harm) results.push({ type: harm, detail: null });
    const pKey1 = `${branch1},${branch2}`;
    const pKey2 = `${branch2},${branch1}`;
    if (BRANCH_PUNISHMENTS[pKey1]) {
      const [t, d] = BRANCH_PUNISHMENTS[pKey1];
      results.push({ type: t, detail: d });
    } else if (BRANCH_PUNISHMENTS[pKey2]) {
      const [t, d] = BRANCH_PUNISHMENTS[pKey2];
      results.push({ type: t, detail: d });
    }
    if (branch1 === branch2 && BRANCH_SELF_PUNISHMENTS.has(branch1)) {
      results.push({ type: "\u5211", detail: "\u81EA\u5211" });
    }
    const wonjin = lookupPair(BRANCH_WONJIN, branch1, branch2);
    if (wonjin) results.push({ type: wonjin, detail: null });
    const gwimun = lookupPair(BRANCH_GWIMUN, branch1, branch2);
    if (gwimun) results.push({ type: gwimun, detail: null });
    return results;
  }
  function analyzePillarRelations(pillar1, pillar2) {
    return {
      stem: getStemRelation(pillar1[0], pillar2[0]),
      branch: getBranchRelation(pillar1[1], pillar2[1])
    };
  }
  function checkTripleCompose(branches) {
    const results = [];
    const branchSet = new Set(branches);
    for (const triple of TRIPLE_COMPOSES) {
      if (triple.every((b) => branchSet.has(b))) {
        const key = triple.join(",");
        results.push({ type: "\u4E09\u5408", detail: TRIPLE_COMPOSE_ELEMENTS[key] });
      }
    }
    return results;
  }
  function checkDirectionalCompose(branches) {
    const results = [];
    const branchSet = new Set(branches);
    for (const dir of DIRECTIONAL_COMPOSES) {
      if (dir.every((b) => branchSet.has(b))) {
        const key = dir.join(",");
        results.push({ type: "\u65B9\u5408", detail: DIRECTIONAL_COMPOSE_ELEMENTS[key] });
      }
    }
    return results;
  }
  function analyzeAllRelations(pillars) {
    const pairs = /* @__PURE__ */ new Map();
    for (let i = 0; i < pillars.length; i++) {
      for (let j = i + 1; j < pillars.length; j++) {
        const rel = analyzePillarRelations(pillars[i], pillars[j]);
        if (rel.stem.length > 0 || rel.branch.length > 0) {
          pairs.set(`${i},${j}`, rel);
        }
      }
    }
    const branches = pillars.map((p) => p[1]);
    return {
      pairs,
      triple: checkTripleCompose(branches),
      directional: checkDirectionalCompose(branches)
    };
  }
  function getSpecialSals(stems, branches, dayPillar) {
    const dayStem = stems[1];
    const dayBranch = branches[1];
    const monthBranch = branches[2];
    const yanginBranch = YANGIN_MAP[dayStem];
    const yangin = yanginBranch ? branches.reduce((acc, b, i) => {
      if (b === yanginBranch) acc.push(i);
      return acc;
    }, []) : [];
    const dohwaBranch = DOHWA_MAP[dayBranch];
    const dohwa = dohwaBranch ? branches.reduce((acc, b, i) => {
      if (i !== 1 && b === dohwaBranch) acc.push(i);
      return acc;
    }, []) : [];
    const cheonulBranches = CHEONUL_MAP[dayStem] ?? [];
    const cheonul = branches.reduce((acc, b, i) => {
      if (cheonulBranches.includes(b)) acc.push(i);
      return acc;
    }, []);
    const cheondukChar = CHEONDUK_MAP[monthBranch];
    const cheonduk = cheondukChar ? [...stems, ...branches].reduce((acc, ch, i) => {
      if (ch === cheondukChar) acc.push(i % 4);
      return acc;
    }, []).filter((v, i, a) => a.indexOf(v) === i) : [];
    const woldukChar = WOLDUK_MAP[monthBranch];
    const wolduk = woldukChar ? stems.reduce((acc, s, i) => {
      if (s === woldukChar) acc.push(i);
      return acc;
    }, []) : [];
    const munchangBranch = MUNCHANG_MAP[dayStem];
    const munchang = munchangBranch ? branches.reduce((acc, b, i) => {
      if (b === munchangBranch) acc.push(i);
      return acc;
    }, []) : [];
    const geumyeoBranch = GEUMYEO_MAP[dayStem];
    const geumyeo = geumyeoBranch ? branches.reduce((acc, b, i) => {
      if (b === geumyeoBranch) acc.push(i);
      return acc;
    }, []) : [];
    return {
      yangin,
      baekho: BAEKHO_PILLARS.has(dayPillar),
      goegang: GOEGANG_PILLARS.has(dayPillar),
      dohwa,
      cheonul,
      cheonduk,
      wolduk,
      munchang,
      hongyeom: HONGYEOM_PILLARS.has(dayPillar),
      geumyeo
    };
  }
  function getGongmang(dayGanzi) {
    const idx = HGANJI.indexOf(dayGanzi);
    if (idx < 0) return ["", ""];
    return GONGMANG_TABLE[Math.trunc(idx / 10)];
  }

  // node_modules/@orrery/core/dist/chunk-6PLRETU5.js
  function getSipsin(dayStem, targetStem) {
    const rel = getRelation(dayStem, targetStem);
    return rel ? rel.hanja : "?";
  }
  function calculateSaju(input) {
    const kst = adjustKdtToKst(input.year, input.month, input.day, input.hour, input.minute);
    const { year, month, day, hour, minute } = kst;
    const { gender } = input;
    const isMale = gender === "M";
    const [yp, mp, dp, hp] = getFourPillars(year, month, day, hour, minute, input.jasiMethod);
    const dayStem = dp[0];
    const stems = [hp[0], dp[0], mp[0], yp[0]];
    const branches = [hp[1], dp[1], mp[1], yp[1]];
    const ganzis = [hp, dp, mp, yp];
    const pillars = ganzis.map((ganzi, i) => {
      const stem = stems[i];
      const branch = branches[i];
      let stemSipsin = getSipsin(dayStem, stem);
      if (i === 1) stemSipsin = "\u672C\u5143";
      const jeonggi = getJeonggi(branch);
      const branchSipsin = getSipsin(dayStem, jeonggi);
      const unseong = getTwelveMeteor(dayStem, branch);
      const sinsal = getTwelveSpirit(yp[1], branch);
      const jigang = getHiddenStems(branch);
      const pillar = { ganzi, stem, branch };
      return {
        pillar,
        stemSipsin,
        branchSipsin,
        unseong,
        sinsal,
        jigang
      };
    });
    const dwHour = input.unknownTime ? 12 : hour;
    const dwMinute = input.unknownTime ? 0 : minute;
    const rawDaewoon = getDaewoon(isMale, year, month, day, dwHour, dwMinute, input.jasiMethod);
    const yearBranch = yp[1];
    const gmBranches = getGongmang(dp);
    const gmSet = new Set(gmBranches);
    const gongmang = {
      branches: gmBranches,
      pillarIndices: branches.reduce((acc, b, i) => {
        if (i !== 1 && gmSet.has(b)) acc.push(i);
        return acc;
      }, [])
    };
    const daewoon = rawDaewoon.map((dw, i) => {
      const age = dw.startDate.getFullYear() - year;
      const dwStem = dw.ganzi[0];
      const dwBranch = dw.ganzi[1];
      const dwStemSipsin = getSipsin(dayStem, dwStem);
      const dwBranchJeonggi = getJeonggi(dwBranch);
      const dwBranchSipsin = getSipsin(dayStem, dwBranchJeonggi);
      const unseong = getTwelveMeteor(dayStem, dwBranch);
      const sinsal = getTwelveSpirit(yearBranch, dwBranch);
      return {
        index: i + 1,
        ganzi: dw.ganzi,
        startDate: dw.startDate,
        age,
        stemSipsin: dwStemSipsin,
        branchSipsin: dwBranchSipsin,
        unseong,
        sinsal,
        isGongmang: gmSet.has(dwBranch)
      };
    });
    const relations = analyzeAllRelations(ganzis);
    const specialSals = getSpecialSals(stems, branches, dp);
    const dayBranch = dp[1];
    const jwabeop = calculateJwabeop(dayStem, branches, dayBranch);
    const injongbeop = calculateInjongbeop(dayStem, dayBranch);
    return {
      input,
      pillars,
      daewoon,
      relations,
      specialSals,
      gongmang,
      jwabeop,
      injongbeop
    };
  }

  // core/pillar-calc/korean-calendar-engine.ts
  var STEMS = ["\uAC11", "\uC744", "\uBCD1", "\uC815", "\uBB34", "\uAE30", "\uACBD", "\uC2E0", "\uC784", "\uACC4"];
  var BRANCHES = ["\uC790", "\uCD95", "\uC778", "\uBB18", "\uC9C4", "\uC0AC", "\uC624", "\uBBF8", "\uC2E0", "\uC720", "\uC220", "\uD574"];
  var STEM_ELEM = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  var BRANCH_ELEM = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var ELEM_NAMES = ["\uBAA9", "\uD654", "\uD1A0", "\uAE08", "\uC218"];
  var ELEM_NAMES_H = ["\u6728", "\u706B", "\u571F", "\u91D1", "\u6C34"];

  // core/pillar-calc/five-phase-breakdown.ts
  function calcOhaeng(pillars) {
    const counts = [0, 0, 0, 0, 0];
    for (const p of pillars) {
      if (p) {
        counts[STEM_ELEM[p.s]]++;
        counts[BRANCH_ELEM[p.b]]++;
      }
    }
    const strongest = counts.indexOf(Math.max(...counts));
    const weakest = counts.indexOf(Math.min(...counts));
    return { counts, strongest, weakest, detail: buildDetail(counts, strongest, weakest) };
  }
  function buildDetail(counts, strong, weak) {
    const strongDescs = [
      "\uCC3D\uC758\uC801 \uC5D0\uB108\uC9C0\uC640 \uC131\uC7A5 \uC695\uAD6C\uAC00 \uAC15\uD558\uAC8C \uBC1C\uD604\uB429\uB2C8\uB2E4.",
      "\uC5F4\uC815\uACFC \uD45C\uD604 \uC695\uAD6C\uAC00 \uD65C\uBC1C\uD558\uAC8C \uC791\uC6A9\uD569\uB2C8\uB2E4.",
      "\uC548\uC815\uC744 \uCD94\uAD6C\uD558\uACE0 \uD604\uC2E4\uC801\uC73C\uB85C \uD589\uB3D9\uD558\uB294 \uACBD\uD5A5\uC774 \uAC15\uD569\uB2C8\uB2E4.",
      "\uC6D0\uCE59\uACFC \uC815\uC758\uB97C \uC911\uC2DC\uD558\uBA70 \uC644\uBCBD\uC744 \uCD94\uAD6C\uD558\uB294 \uC131\uD5A5\uC774 \uAC15\uD569\uB2C8\uB2E4.",
      "\uC9C0\uD61C\uC640 \uC720\uC5F0\uD55C \uC0AC\uACE0\uB85C \uC0C1\uD669\uC744 \uAE4A\uC774 \uBD84\uC11D\uD558\uB294 \uACBD\uD5A5\uC774 \uAC15\uD569\uB2C8\uB2E4."
    ];
    const weakAdvice = [
      "\uBAA9(\u6728) \uAE30\uC6B4\uC744 \uBCF4\uC644\uD558\uB824\uBA74 \uCD08\uB85D\uC0C9 \uC2DD\uBB3C\uC744 \uACC1\uC5D0 \uB450\uAC70\uB098 \uC232\uC18D \uC0B0\uCC45\uC744 \uC990\uACA8\uBCF4\uC138\uC694.",
      "\uD654(\u706B) \uAE30\uC6B4\uC744 \uBCF4\uC644\uD558\uB824\uBA74 \uB530\uB73B\uD55C \uC0C9\uC0C1\uC758 \uC870\uBA85\uC774\uB098 \uCD1B\uBD88\uC744 \uD65C\uC6A9\uD574\uBCF4\uC138\uC694.",
      "\uD1A0(\u571F) \uAE30\uC6B4\uC744 \uBCF4\uC644\uD558\uB824\uBA74 \uB3C4\uC790\uAE30 \uC18C\uD488\uC774\uB098 \uB178\uB780\uC0C9\xB7\uD669\uD1A0\uC0C9 \uACC4\uC5F4\uC744 \uC0DD\uD65C\uC5D0 \uB354\uD558\uC138\uC694.",
      "\uAE08(\u91D1) \uAE30\uC6B4\uC744 \uBCF4\uC644\uD558\uB824\uBA74 \uAE08\uC18D \uC18C\uD488\uC774\uB098 \uD770\uC0C9 \uACC4\uC5F4\uC758 \uC778\uD14C\uB9AC\uC5B4\uB97C \uB354\uD574\uBCF4\uC138\uC694.",
      "\uC218(\u6C34) \uAE30\uC6B4\uC744 \uBCF4\uC644\uD558\uB824\uBA74 \uC791\uC740 \uC218\uC870\uB098 \uBD84\uC218, \uD30C\uB780\uC0C9 \uACC4\uC5F4 \uC18C\uD488\uC744 \uD65C\uC6A9\uD574\uBCF4\uC138\uC694."
    ];
    return `${ELEM_NAMES[strong]}(${ELEM_NAMES_H[strong]}) \uAE30\uC6B4\uC774 \uAC00\uC7A5 \uAC15\uD558\uAC8C \uC791\uC6A9\uD569\uB2C8\uB2E4. ${strongDescs[strong]} \uBC18\uBA74 ${ELEM_NAMES[weak]}(${ELEM_NAMES_H[weak]}) \uAE30\uC6B4\uC740 \uC0C1\uB300\uC801\uC73C\uB85C \uBD80\uC871\uD569\uB2C8\uB2E4. ${weakAdvice[weak]}`;
  }

  // core/pillar-calc/celestial-relations.ts
  var DOHA = [0, 6, 3, 9];
  var YEOKMA = [2, 8, 5, 11];
  var HWAGAE = [4, 10, 1, 7];
  var CHEONEUL = [
    [1, 7],
    // 甲 丑未
    [0, 8],
    // 乙 子申
    [11, 9],
    // 丙 亥酉
    [11, 9],
    // 丁 亥酉
    [1, 7],
    // 戊 丑未
    [0, 8],
    // 己 子申
    [1, 7],
    // 庚 丑未
    [2, 6],
    // 辛 寅午
    [3, 5],
    // 壬 卯巳
    [3, 5]
    // 癸 卯巳
  ];
  var MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
  function checkShinsal(pillars, dayStem) {
    const dayBranch = pillars[2]?.b ?? 0;
    const allBranches = pillars.filter(Boolean).map((p) => p.b);
    const result = [];
    if (DOHA.includes(dayBranch))
      result.push({
        name: "\uB3C4\uD654\uC0B4 (\u6843\u82B1\u6BBA)",
        icon: "\u{1F338}",
        desc: "\uB9E4\uB825\uACFC \uC778\uAE30\uAC00 \uB118\uCE58\uB294 \uAE30\uC6B4\uC785\uB2C8\uB2E4. \uC774\uC131\uC5D0\uAC8C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD638\uAC10\uC744 \uC8FC\uB294 \uD0C0\uACE0\uB09C \uB9E4\uB825\uC774 \uC788\uC5B4 \uC778\uAC04\uAD00\uACC4\uAC00 \uD48D\uBD80\uD569\uB2C8\uB2E4. \uC5F0\uC608\xB7\uBC29\uC1A1\xB7\uC11C\uBE44\uC2A4\uC5C5\uC5D0\uC11C \uAC15\uC810\uC744 \uBCF4\uC774\uBA70, \uC774\uC131 \uAD00\uACC4\uC5D0\uC11C\uC758 \uBCF5\uC7A1\uD55C \uC0C1\uD669\uC5D0 \uC8FC\uC758\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."
      });
    if (YEOKMA.includes(dayBranch))
      result.push({
        name: "\uC5ED\uB9C8\uC0B4 (\u9A5B\u99AC\u6BBA)",
        icon: "\u{1F40E}",
        desc: "\uC774\uB3D9\uACFC \uBCC0\uD654\uB97C \uC990\uAE30\uB294 \uD65C\uB3D9\uC801 \uAE30\uC9C8\uC785\uB2C8\uB2E4. \uD574\uC678 \uC778\uC5F0\uC774\uB098 \uD0C0\uC9C0 \uD65C\uB3D9\uC774 \uB9CE\uC744 \uC218 \uC788\uC73C\uBA70, \uB2E4\uC591\uD55C \uACBD\uD5D8\uC744 \uD1B5\uD574 \uC131\uC7A5\uD569\uB2C8\uB2E4. \uBB34\uC5ED\xB7\uC678\uAD50\xB7\uC5EC\uD589 \uBD84\uC57C\uC5D0\uC11C \uB450\uAC01\uC744 \uB098\uD0C0\uB0C5\uB2C8\uB2E4."
      });
    if (HWAGAE.includes(dayBranch))
      result.push({
        name: "\uD654\uAC1C\uC0B4 (\u83EF\u84CB\u6BBA)",
        icon: "\u{1F3A8}",
        desc: "\uC608\uC220\xB7\uC885\uAD50\xB7\uCCA0\uD559\uC5D0 \uB300\uD55C \uAE4A\uC740 \uAD00\uC2EC\uACFC \uD0C1\uC6D4\uD55C \uC7AC\uB2A5\uC744 \uAC00\uC9C0\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uB3C5\uCC3D\uC801\uC778 \uAC1C\uC131\uC73C\uB85C \uC8FC\uBAA9\uBC1B\uC73C\uBA70, \uACE0\uB3C5\uD55C \uC2DC\uAC04 \uC18D\uC5D0\uC11C \uC608\uC220\uC801 \uC601\uAC10\uC744 \uC5BB\uC2B5\uB2C8\uB2E4."
      });
    const ce = CHEONEUL[dayStem];
    if (allBranches.some((b) => ce.includes(b)))
      result.push({
        name: "\uCC9C\uC744\uADC0\uC778 (\u5929\u4E59\u8CB4\u4EBA)",
        icon: "\u2B50",
        desc: "\uD558\uB298\uC774 \uB0B4\uB9B0 \uADC0\uC778\uC758 \uAE30\uC6B4\uC744 \uAC00\uC9C0\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC704\uAE30\uC758 \uC21C\uAC04\uB9C8\uB2E4 \uADC0\uC778\uC774 \uB098\uD0C0\uB098 \uB3C4\uC6C0\uC744 \uC8FC\uBA70, \uD3C9\uC0DD \uADC0\uC778\uBCF5\uC774 \uAC15\uD558\uACE0 \uC0AC\uB78C\uB4E4\uC5D0\uAC8C \uC2E0\uB8B0\uB97C \uBC1B\uB294 \uD0C0\uC785\uC785\uB2C8\uB2E4."
      });
    const mc = MUNCHANG[dayStem];
    if (allBranches.includes(mc))
      result.push({
        name: "\uBB38\uCC3D\uADC0\uC778 (\u6587\u660C\u8CB4\u4EBA)",
        icon: "\u{1F4DA}",
        desc: "\uD559\uBB38\uACFC \uBB38\uC608\uC5D0 \uB6F0\uC5B4\uB09C \uC7AC\uB2A5\uC744 \uAC00\uC9C0\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uCD1D\uBA85\uD558\uACE0 \uD559\uC2B5 \uB2A5\uB825\uC774 \uB6F0\uC5B4\uB098 \uC790\uACA9\uC99D\xB7\uC2DC\uD5D8 \uC6B4\uC774 \uAC15\uD558\uACE0 \uAE00\uACFC \uB9D0\uB85C \uB450\uAC01\uC744 \uB098\uD0C0\uB0C5\uB2C8\uB2E4."
      });
    return result;
  }

  // core/pillar-calc/main-calculator.ts
  function stemIdx(ch) {
    return SKY.indexOf(ch);
  }
  function branchIdx(ch) {
    return EARTH.indexOf(ch);
  }
  function ganziToPillar(ganzi) {
    return { s: stemIdx(ganzi[0]), b: branchIdx(ganzi[1]) };
  }
  function mapDaewoon(items, gender, yearStem) {
    const pillars = items.slice(0, 8).map((d) => ganziToPillar(d.ganzi));
    const startAge = items[0]?.age ?? 3;
    const yang = yearStem % 2 === 0;
    const male = gender === "\uB0A8";
    const forward = yang && male || !yang && !male;
    return { pillars, startAge, forward };
  }
  function calculate(input) {
    const { year, month, day, hourTotalMin, gender } = input;
    const unknownTime = hourTotalMin < 0;
    const hour = unknownTime ? 12 : Math.floor(hourTotalMin / 60);
    const minute = unknownTime ? 0 : hourTotalMin % 60;
    const res = calculateSaju({
      year,
      month,
      day,
      hour,
      minute,
      gender: gender === "\uB0A8" ? "M" : "F",
      unknownTime,
      jasiMethod: "split"
    });
    const [si, il, wol, nyun] = res.pillars;
    const ordered = [nyun, wol, il, unknownTime ? null : si];
    const pillars = ordered.map(
      (p) => p ? ganziToPillar(p.pillar.ganzi) : null
    );
    const ohaeng = calcOhaeng(pillars);
    const daeun = mapDaewoon(res.daewoon, gender, pillars[0]?.s ?? 0);
    const shinsal = checkShinsal(pillars, pillars[2]?.s ?? 0);
    return {
      pillars,
      ohaeng,
      daeun,
      shinsal,
      input,
      sipsin: ordered.map((p) => p?.stemSipsin ?? ""),
      unseong: ordered.map((p) => p?.unseong ?? ""),
      jigang: ordered.map((p) => p?.jigang ?? "")
    };
  }

  // lib/toss-form-read.ts
  function readSajuFormFromDom(root = document) {
    const card = root.querySelector(".form-card");
    if (!card) return null;
    const yearEl = card.querySelector('input[type="number"]');
    const monthEl = card.querySelector('select[aria-label="\uC6D4"]');
    const dayEl = card.querySelector('select[aria-label="\uC77C"]');
    const hourEl = card.querySelectorAll(".form-grid select");
    const hourSelect = hourEl[hourEl.length - 1] ?? null;
    const nameEl = card.querySelector('input:not([type="number"]):not([type="checkbox"])');
    const genderBtns = [...card.querySelectorAll(".form-grid button")].filter(
      (b) => /^(남|여)/.test((b.textContent || "").replace(/\s/g, ""))
    );
    const activeGender = genderBtns.find((b) => {
      const s = b.getAttribute("style") || "";
      return s.includes("var(--purple)") || s.includes("139,111,198") || /purple/i.test(s);
    });
    const gender = (activeGender?.textContent || "").includes("\uC5EC") ? "\uC5EC" : "\uB0A8";
    const calBtns = [...card.querySelectorAll("button")].filter((b) => {
      const t = (b.textContent || "").replace(/\s/g, "");
      return t === "\uC591\uB825" || t === "\uC74C\uB825";
    });
    const lunar = calBtns.some((b) => {
      const s = b.getAttribute("style") || "";
      return (b.textContent || "").includes("\uC74C\uB825") && (s.includes("var(--purple)") || s.includes("139,111,198") || /purple/i.test(s));
    });
    const leapEl = card.querySelector('input[type="checkbox"]');
    return {
      year: yearEl?.value ?? "",
      month: monthEl?.value ?? "",
      day: dayEl?.value ?? "",
      hour: hourSelect?.value ?? "-1",
      name: nameEl?.value ?? "",
      gender,
      lunar,
      leapM: leapEl?.checked ?? false
    };
  }

  // lib/toss-standalone-analyze.ts
  var THIS_YEAR = (/* @__PURE__ */ new Date()).getFullYear();
  var PENDING_KEY = "saju_pending_result";
  var PENDING_FORM_KEY = "saju_pending_form";
  function pillarLabel(p) {
    if (!p) return "\u2014";
    return `${STEMS[p.s]}${BRANCHES[p.b]}`;
  }
  function showFormErrorDom(msg) {
    const wait = document.getElementById("saju-js-wait");
    if (wait) {
      wait.textContent = msg;
      wait.style.display = "block";
      return;
    }
    let err = document.getElementById("saju-form-error-fallback");
    if (!err) {
      err = document.createElement("p");
      err.id = "saju-form-error-fallback";
      err.style.cssText = "margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(224,85,85,.15);border:1px solid rgba(224,85,85,.4);color:#ff8a8a;font-size:.88rem;font-weight:600";
      document.querySelector("[data-saju-analyze]")?.parentElement?.appendChild(err);
    }
    err.textContent = msg;
  }
  function showFallbackPanel(result, error) {
    let el = document.getElementById("saju-fallback-results");
    if (!el) {
      el = document.createElement("section");
      el.id = "saju-fallback-results";
      el.style.cssText = "margin:24px 16px;padding:20px;border-radius:16px;background:var(--card);border:1px solid var(--border)";
      const btn = document.querySelector("[data-saju-analyze]");
      btn?.closest(".form-card")?.parentElement?.appendChild(el);
    }
    if (error) {
      el.innerHTML = `<p style="color:#ff8a8a;font-weight:600">${error}</p>`;
      return;
    }
    const [y, m, d, h] = result.pillars;
    const ohaeng = result.ohaeng.counts.map((c, i) => `${ELEM_NAMES[i]} ${c}`).join(" \xB7 ");
    el.innerHTML = `
    <p style="font-size:.9rem;font-weight:700;color:var(--gold);margin-bottom:8px">\u2726 \uC0AC\uC8FC\uD314\uC790 \uC815\uBC00 \uBD84\uC11D \uC644\uB8CC</p>
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:16px">
      ${result.input.year}\uB144 ${result.input.month}\uC6D4 ${result.input.day}\uC77C \xB7 \uC544\uB798\uB85C \uC2A4\uD06C\uB864\uD558\uBA74 \uC0C1\uC138 \uD0ED\xB7AI \uD480\uC774\uB97C \uBCFC \uC218 \uC788\uC5B4\uC694.
    </p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:14px">
      ${["\uB144\uC8FC", "\uC6D4\uC8FC", "\uC77C\uC8FC", "\uC2DC\uC8FC"].map((label, i) => {
      const p = [y, m, d, h][i];
      return `<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,.05)">
            <div style="font-size:.7rem;color:var(--muted)">${label}</div>
            <div style="font-size:1.1rem;font-weight:800;margin-top:4px">${pillarLabel(p)}</div>
          </div>`;
    }).join("")}
    </div>
    <p style="font-size:.82rem;color:rgba(248,246,255,.9);line-height:1.6">\uC624\uD589: ${ohaeng}</p>`;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function consumePendingForm() {
    try {
      const raw = sessionStorage.getItem(PENDING_FORM_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function runStandaloneAnalyze() {
    const form = readSajuFormFromDom();
    if (!form) {
      const err = "\uC785\uB825 \uD3FC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
      showFormErrorDom(err);
      return { ok: false, error: err };
    }
    const y = parseInt(form.year, 10);
    const m = parseInt(form.month, 10);
    const d = parseInt(form.day, 10);
    if (!y || !m || !d) {
      const err = "\uC0DD\uB144\uC6D4\uC77C\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694.";
      showFormErrorDom(err);
      return { ok: false, error: err };
    }
    if (y < 1900 || y > THIS_YEAR) {
      const err = `\uB144\uB3C4\uB294 1900~${THIS_YEAR} \uC0AC\uC774\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694.`;
      showFormErrorDom(err);
      return { ok: false, error: err };
    }
    try {
      const result = calculate({
        year: y,
        month: m,
        day: d,
        hourTotalMin: parseInt(form.hour, 10),
        gender: form.gender
      });
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(result));
        sessionStorage.setItem(PENDING_FORM_KEY, JSON.stringify(form));
      } catch {
      }
      showFallbackPanel(result);
      window.dispatchEvent(new CustomEvent("saju:pending-result"));
      return { ok: true, result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "\uC0AC\uC8FC \uACC4\uC0B0 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.";
      showFormErrorDom(msg);
      showFallbackPanel(null, msg);
      return { ok: false, error: msg };
    }
  }
  function consumePendingResult() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_KEY);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof window !== "undefined") {
    window.__SAJU_STANDALONE_ANALYZE__ = runStandaloneAnalyze;
  }
})();
