import assert from "node:assert/strict";

import {
  canonicalUrl,
  inferDimension,
  isBlockedIp,
  meaningfulTitle,
  taxonomyFor,
} from "./process-community-submissions.mjs";

assert.equal(canonicalUrl("https://www.example.ac.ir/research/?utm_source=x#top"),"https://example.ac.ir/research");
assert.equal(isBlockedIp("127.0.0.1"),true);
assert.equal(isBlockedIp("10.10.10.10"),true);
assert.equal(isBlockedIp("192.168.1.2"),true);
assert.equal(isBlockedIp("8.8.8.8"),false);
assert.equal(meaningfulTitle("سند پژوهشی"),false);
assert.equal(meaningfulTitle("آیین‌نامه حمایت از پژوهانه اعضای هیئت علمی"),true);
assert.equal(taxonomyFor("آیین نامه پژوهشی دانشگاه"),"regulation/bylaw");
assert.equal(taxonomyFor("فرم درخواست گرنت"),"form/template");
assert.equal(inferDimension("laboratories","آزمایشگاه مرکزی و تجهیزات آزمایشگاهی").dimension,"laboratories");
assert.equal(inferDimension("unknown","سامانه پژوهانه و خدمات گرنت پژوهشی").dimension,"systemsServices");

console.log("community submission policy tests passed");
