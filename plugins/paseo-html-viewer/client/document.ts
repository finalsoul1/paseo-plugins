export const MESSAGE_SOURCE = "paseo-html-find";

export type FrameRequest =
  | { type: "search"; query: string; index?: number }
  | { type: "step"; delta: 1 | -1 }
  | { type: "clear" };

export type FrameEvent =
  | { type: "ready" }
  | { type: "result"; total: number; current: number }
  | { type: "open-find" };

// 내장 HTML 뷰어(FileHtmlPreview)와 같은 정책이다. 문서가 네트워크로 나가거나 다른 문서를 띄우지 못하게 막는다.
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "object-src 'none'",
].join("; ");

const HIGHLIGHT_STYLE = [
  "::highlight(paseo-find){background-color:#fde047;color:#000}",
  "::highlight(paseo-find-current){background-color:#fb923c;color:#000}",
].join("");

// iframe 안에서 실행된다. 플러그인은 DOM lib 없이 타입체크하므로 문자열로 둔다.
// 일치 표시는 CSS Custom Highlight API로 한다. 문서 DOM을 고치지 않아서 문서의 스크립트와 부딪히지 않는다.
const FIND_SCRIPT = `(function () {
  var SOURCE = ${JSON.stringify(MESSAGE_SOURCE)};
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1 };
  var ranges = [];
  var current = -1;

  function post(message) {
    message.source = SOURCE;
    parent.postMessage(message, "*");
  }

  function lower(text) {
    // 글자에 따라 toLowerCase가 길이를 바꾼다(İ 등). 위치가 어긋나지 않게 한 글자씩 바꾼다.
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      var l = c.toLowerCase();
      out += l.length === 1 ? l : c;
    }
    return out;
  }

  function visible(element, cache) {
    var hit = cache.get(element);
    if (hit !== undefined) return hit;
    var shown = element.checkVisibility ? element.checkVisibility({ visibilityProperty: true }) : true;
    cache.set(element, shown);
    return shown;
  }

  // 같은 블록 안의 글자만 이어서 찾는다. 인라인 요소(<b> 등)를 넘는 일치는 찾고, 문단을 넘는 일치는 찾지 않는다.
  function blockOf(element, cache) {
    var hit = cache.get(element);
    if (hit !== undefined) return hit;
    var display = getComputedStyle(element).display;
    var block = display === "inline" || display === "contents" ? (element.parentElement ? blockOf(element.parentElement, cache) : element) : element;
    cache.set(element, block);
    return block;
  }

  function collect() {
    var root = document.body || document.documentElement;
    if (!root) return [];
    var visibleCache = new Map();
    var blockCache = new Map();
    var segments = [];
    var segment = null;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var element = node.parentElement;
      if (!element || !node.data || SKIP[element.tagName] || !visible(element, visibleCache)) continue;
      var block = blockOf(element, blockCache);
      if (!segment || segment.block !== block) {
        segment = { block: block, text: "", nodes: [], starts: [] };
        segments.push(segment);
      }
      segment.starts.push(segment.text.length);
      segment.nodes.push(node);
      segment.text += node.data;
    }
    return segments;
  }

  // offset이 노드 경계에 걸리면 end는 앞 노드의 끝, start는 뒤 노드의 처음으로 잡는다.
  function locate(segment, offset, isEnd) {
    var starts = segment.starts;
    var lo = 0;
    var hi = starts.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (isEnd ? starts[mid] < offset : starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { node: segment.nodes[lo], offset: offset - starts[lo] };
  }

  function find(query) {
    var found = [];
    var needle = lower(query);
    var segments = collect();
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s];
      var haystack = lower(segment.text);
      var at = haystack.indexOf(needle);
      while (at !== -1) {
        var start = locate(segment, at, false);
        var end = locate(segment, at + needle.length, true);
        var range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        found.push(range);
        at = haystack.indexOf(needle, at + needle.length);
      }
    }
    return found;
  }

  function paint() {
    if (!window.CSS || !CSS.highlights || typeof Highlight !== "function") return;
    // 일치가 수만 개면 생성자 인자로 펼칠 때 인자 수 한도를 넘는다. 하나씩 넣는다.
    var all = new Highlight();
    for (var i = 0; i < ranges.length; i++) all.add(ranges[i]);
    CSS.highlights.set("paseo-find", all);
    if (current >= 0) {
      var active = new Highlight(ranges[current]);
      active.priority = 1;
      CSS.highlights.set("paseo-find-current", active);
    } else {
      CSS.highlights.delete("paseo-find-current");
    }
  }

  function inView(range) {
    var rect = range.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth;
  }

  function reveal(range) {
    if (inView(range)) return;
    var element = range.startContainer.parentElement;
    if (element) element.scrollIntoView({ block: "center", inline: "nearest" });
    // 긴 문단이나 <pre>는 요소를 가운데 둬도 일치한 줄이 화면 밖에 있을 수 있다.
    if (!inView(range)) {
      var rect = range.getBoundingClientRect();
      scrollBy(0, rect.top - innerHeight / 2);
    }
  }

  // 검색어를 입력할 때는 지금 보이는 위치에서 가장 가까운 다음 일치부터 보여 준다.
  function firstFromViewport() {
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].getBoundingClientRect().bottom >= 0) return i;
    }
    return 0;
  }

  function report() {
    post({ type: "result", total: ranges.length, current: current });
  }

  function search(query, index) {
    ranges = query ? find(query) : [];
    if (!ranges.length) current = -1;
    else if (typeof index === "number" && index >= 0) current = Math.min(index, ranges.length - 1);
    else current = firstFromViewport();
    paint();
    if (current >= 0) reveal(ranges[current]);
    report();
  }

  function step(delta) {
    if (!ranges.length) return;
    current = (current + delta + ranges.length) % ranges.length;
    paint();
    reveal(ranges[current]);
    report();
  }

  function clear() {
    ranges = [];
    current = -1;
    if (window.CSS && CSS.highlights) {
      CSS.highlights.delete("paseo-find");
      CSS.highlights.delete("paseo-find-current");
    }
  }

  addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== parent || !data || data.source !== SOURCE) return;
    if (data.type === "search") search(String(data.query || ""), data.index);
    else if (data.type === "step") step(data.delta === -1 ? -1 : 1);
    else if (data.type === "clear") clear();
  });

  // iframe에 포커스가 있으면 키 입력이 바깥 문서로 가지 않는다. 찾기 단축키만 바깥으로 넘긴다.
  addEventListener("keydown", function (event) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    if (event.key !== "f" && event.key !== "F") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    post({ type: "open-find" });
  }, true);

  // 문서 스크립트가 load 전에 그리는 내용까지 찾도록 load 뒤에 알린다.
  if (document.readyState === "complete") post({ type: "ready" });
  else addEventListener("load", function () { post({ type: "ready" }); });
})();`;

export function buildDocument(html: string): string {
  // 문서의 <!doctype>·<html>·<head>는 이 앞부분 뒤에 와도 브라우저가 무시하거나 합친다. 내장 뷰어도 같은 방식이다.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>${HIGHLIGHT_STYLE}</style><script>${FIND_SCRIPT}</script>${html}`;
}

export function isFrameEvent(data: unknown): data is FrameEvent & { source: string } {
  if (!data || typeof data !== "object") return false;
  const { source, type } = data as { source?: unknown; type?: unknown };
  return source === MESSAGE_SOURCE && (type === "ready" || type === "result" || type === "open-find");
}
