const button = document.querySelector(".language-toggle");
const translatable = document.querySelectorAll("[data-en][data-zh]");

function setLanguage(language) {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = language === "zh"
    ? "Manuslate — 让 Markdown 回到写作本身"
    : "Manuslate — Markdown, as a native writing surface";
  document.querySelector('meta[name="description"]').content = language === "zh"
    ? "Manuslate 是一款开源免费、本地优先的桌面 Markdown 编辑器与文稿资料库。"
    : "Manuslate is an open-source, local-first Markdown editor and document library for desktop.";
  translatable.forEach((element) => {
    element.textContent = element.dataset[language];
  });
  button.textContent = language === "zh" ? "EN" : "中文";
  button.setAttribute("aria-label", language === "zh" ? "Switch to English" : "切换到中文");
  localStorage.setItem("manuslate-site-language", language);
}

let language = localStorage.getItem("manuslate-site-language") === "zh" ? "zh" : "en";
setLanguage(language);
button.addEventListener("click", () => {
  language = language === "en" ? "zh" : "en";
  setLanguage(language);
});
