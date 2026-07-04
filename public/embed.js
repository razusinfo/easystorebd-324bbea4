(function () {
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : window.location.origin;
  var nodes = document.querySelectorAll("[data-reseller-product]:not([data-reseller-mounted])");
  nodes.forEach(function (el) {
    var id = el.getAttribute("data-reseller-product");
    if (!id) return;
    el.setAttribute("data-reseller-mounted", "1");
    var iframe = document.createElement("iframe");
    iframe.src = origin + "/r/" + encodeURIComponent(id);
    iframe.loading = "lazy";
    iframe.style.cssText = "border:0;width:100%;max-width:480px;height:620px";
    iframe.title = "Reseller product";
    el.appendChild(iframe);
  });
})();
