import { $ } from "./dom.js";

export function receipt(fname, meta, stampText, isError) {
  const div = document.createElement("div");
  div.className = "receipt";
  div.innerHTML =
    '<div class="fname"></div><div class="meta"></div>' +
    '<span class="tag rtag' +
    (isError ? " err" : "") +
    '"></span>';
  div.querySelector(".fname").textContent = fname;
  div.querySelector(".meta").textContent = meta;
  div.querySelector(".rtag").textContent = stampText;
  $("uploadResults").prepend(div);
  while ($("uploadResults").children.length > 6) {
    $("uploadResults").lastChild.remove();
  }
}
