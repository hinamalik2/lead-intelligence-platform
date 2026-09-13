(function (root) {
  var script = document.currentScript;
  var userConfig = root.HINA_TRACKER_CONFIG || {};

  function attr(name, fallback) {
    if (script && script.getAttribute(name)) {
      return script.getAttribute(name);
    }
    return fallback;
  }

  root.HinaTrackerConfig = {
    apiUrl: String(userConfig.apiUrl || attr("data-api-url", "http://localhost:8000")).replace(/\/$/, ""),
    siteId: userConfig.siteId || attr("data-site-id", "demo-site"),
    sessionTimeoutMs: userConfig.sessionTimeoutMs || 30 * 60 * 1000,
    debug: Boolean(userConfig.debug),
  };
})(typeof window !== "undefined" ? window : this);
