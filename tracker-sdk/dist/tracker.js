/*! Hina Tracking SDK — visitor/session/event tracker */
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

(function (root) {
  var STORAGE_KEY = "hina_visitor_id";

  function randomId(prefix) {
    var bytes = new Uint8Array(8);
    if (root.crypto && root.crypto.getRandomValues) {
      root.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    var hex = Array.prototype.map
      .call(bytes, function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join("");
    return prefix + hex;
  }

  function getVisitorId() {
    try {
      var existing = root.localStorage.getItem(STORAGE_KEY);
      if (existing) {
        return existing;
      }
      var created = randomId("visitor_");
      root.localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (err) {
      return randomId("visitor_");
    }
  }

  root.HinaVisitor = {
    getId: getVisitorId,
    randomId: randomId,
  };
})(typeof window !== "undefined" ? window : this);

(function (root) {
  var SESSION_KEY = "hina_session_id";
  var ACTIVITY_KEY = "hina_session_activity";
  var COUNT_KEY = "hina_session_count";

  function now() {
    return Date.now();
  }

  function getTimeout() {
    return (root.HinaTrackerConfig && root.HinaTrackerConfig.sessionTimeoutMs) || 30 * 60 * 1000;
  }

  function readSession() {
    try {
      return root.sessionStorage.getItem(SESSION_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeSession(id) {
    try {
      root.sessionStorage.setItem(SESSION_KEY, id);
      root.sessionStorage.setItem(ACTIVITY_KEY, String(now()));
    } catch (err) {
      /* private mode / blocked storage */
    }
  }

  function lastActivity() {
    try {
      return Number(root.sessionStorage.getItem(ACTIVITY_KEY) || 0);
    } catch (err) {
      return 0;
    }
  }

  function bumpCount() {
    try {
      var count = Number(root.localStorage.getItem(COUNT_KEY) || 0) + 1;
      root.localStorage.setItem(COUNT_KEY, String(count));
      return count;
    } catch (err) {
      return 1;
    }
  }

  function getSessionCount() {
    try {
      return Number(root.localStorage.getItem(COUNT_KEY) || 0);
    } catch (err) {
      return 0;
    }
  }

  function getSessionId() {
    var existing = readSession();
    var stale = existing && now() - lastActivity() > getTimeout();
    if (existing && !stale) {
      writeSession(existing);
      return existing;
    }
    var created = root.HinaVisitor.randomId("session_");
    writeSession(created);
    bumpCount();
    return created;
  }

  function touch() {
    var id = readSession();
    if (id) {
      writeSession(id);
    }
  }

  function isReturningVisitor() {
    return getSessionCount() > 1;
  }

  root.HinaSession = {
    getId: getSessionId,
    touch: touch,
    isReturningVisitor: isReturningVisitor,
    getSessionCount: getSessionCount,
  };
})(typeof window !== "undefined" ? window : this);

(function (root) {
  function log() {
    if (root.HinaTrackerConfig && root.HinaTrackerConfig.debug) {
      console.log.apply(console, ["[HinaTracker]"].concat([].slice.call(arguments)));
    }
  }

  function browserInfo() {
    return {
      user_agent: root.navigator ? root.navigator.userAgent : "",
      language: root.navigator ? root.navigator.language : "",
      platform: root.navigator ? root.navigator.platform : "",
      screen_width: root.screen ? root.screen.width : null,
      screen_height: root.screen ? root.screen.height : null,
      viewport_width: root.innerWidth || null,
      viewport_height: root.innerHeight || null,
    };
  }

  function postJson(path, payload, keepalive) {
    var apiUrl = root.HinaTrackerConfig.apiUrl;
    var url = apiUrl + path;
    var body = JSON.stringify(payload);
    log("POST", path, payload);

    if (keepalive && root.navigator && typeof root.navigator.sendBeacon === "function") {
      try {
        var blob = new Blob([body], { type: "text/plain" });
        if (root.navigator.sendBeacon(url, blob)) {
          return Promise.resolve({ ok: true, beacon: true });
        }
      } catch (err) {
        log("sendBeacon failed", err);
      }
    }

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: Boolean(keepalive),
      mode: "cors",
    })
      .then(function (res) {
        if (!res.ok) {
          log("API error", res.status);
        }
        return res;
      })
      .catch(function (err) {
        log("API unavailable", err);
        return null;
      });
  }

  function sendEvent(partial) {
    var payload = Object.assign(
      {
        visitor_id: root.HinaVisitor.getId(),
        session_id: root.HinaSession.getId(),
        site_id: root.HinaTrackerConfig.siteId,
        page_url: root.location ? root.location.pathname + root.location.search : "",
        page_title: root.document ? root.document.title : "",
        timestamp: new Date().toISOString(),
        returning_visitor: root.HinaSession.isReturningVisitor(),
        browser: browserInfo(),
      },
      partial
    );
    root.HinaSession.touch();
    return postJson("/events", payload, payload.event_type === "page_exit");
  }

  function sendLead(lead) {
    var payload = Object.assign(
      {
        visitor_id: root.HinaVisitor.getId(),
        session_id: root.HinaSession.getId(),
        site_id: root.HinaTrackerConfig.siteId,
        page_url: root.location ? root.location.pathname + root.location.search : "",
        timestamp: new Date().toISOString(),
      },
      lead
    );
    return postJson("/leads", payload, false);
  }

  root.HinaEvents = {
    sendEvent: sendEvent,
    sendLead: sendLead,
    browserInfo: browserInfo,
  };
})(typeof window !== "undefined" ? window : this);

(function (root) {
  var SENSITIVE = /password|passwd|passcode|secret|token|card|cvv|cvc|ssn|credit/i;
  var startedForms = {};
  var sentScroll = {};
  var pageEnteredAt = Date.now();
  var initialized = false;
  var exited = false;

  function cssPath(el) {
    if (!el || !el.tagName) {
      return "";
    }
    if (el.id) {
      return el.tagName.toLowerCase() + "#" + el.id;
    }
    var label =
      el.getAttribute("aria-label") ||
      el.getAttribute("data-track") ||
      (el.innerText || "").trim().slice(0, 80);
    return (label || el.tagName.toLowerCase()).replace(/\s+/g, " ");
  }

  function scrollPercent() {
    var doc = root.document.documentElement;
    var body = root.document.body;
    var scrollTop = root.pageYOffset || doc.scrollTop || 0;
    var height = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0) - root.innerHeight;
    if (height <= 0) {
      return 100;
    }
    return Math.min(100, Math.round((scrollTop / height) * 100));
  }

  function trackScroll() {
    var percent = scrollPercent();
    var milestones = [25, 50, 75, 100];
    milestones.forEach(function (mark) {
      if (percent >= mark && !sentScroll[mark]) {
        sentScroll[mark] = true;
        root.HinaEvents.sendEvent({
          event_type: "scroll",
          scroll_percent: mark,
          element: mark + "%",
        });
      }
    });
  }

  function trackClick(event) {
    var el = event.target;
    if (!el) {
      return;
    }
    if (el.closest && el.closest("form")) {
      return;
    }
    var interesting =
      el.closest("a, button, [role='button'], .cta, [data-track]") || el;
    root.HinaEvents.sendEvent({
      event_type: "click",
      element: cssPath(interesting),
      tag_name: interesting.tagName ? interesting.tagName.toLowerCase() : "",
    });
  }

  function collectFields(form) {
    var data = {};
    var elements = form.querySelectorAll("input, select, textarea");
    Array.prototype.forEach.call(elements, function (field) {
      var name = field.name || field.id;
      if (!name || SENSITIVE.test(name) || SENSITIVE.test(field.type || "")) {
        return;
      }
      if (field.type === "password") {
        return;
      }
      data[name] = field.value;
    });
    return data;
  }

  function trackFormStart(event) {
    var form = event.target && event.target.form ? event.target.form : event.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== "form") {
      return;
    }
    var key = form.getAttribute("id") || form.getAttribute("action") || "form";
    if (startedForms[key]) {
      return;
    }
    startedForms[key] = true;
    root.HinaEvents.sendEvent({
      event_type: "form_start",
      element: key,
    });
  }

  function trackFormSubmit(event) {
    var form = event.target;
    var fields = collectFields(form);
    root.HinaEvents.sendEvent({
      event_type: "form_submit",
      element: form.getAttribute("id") || "lead-form",
      lead: {
        name: fields.name || fields.full_name || "",
        email: fields.email || "",
        company: fields.company || "",
      },
    });
    root.HinaEvents.sendLead({
      name: fields.name || fields.full_name || "",
      email: fields.email || "",
      company: fields.company || "",
      source_form: form.getAttribute("id") || "lead-form",
    });
  }

  function trackPageExit() {
    if (exited) {
      return;
    }
    exited = true;
    var seconds = Math.max(1, Math.round((Date.now() - pageEnteredAt) / 1000));
    root.HinaEvents.sendEvent({
      event_type: "page_exit",
      time_spent: seconds,
      page_entered: new Date(pageEnteredAt).toISOString(),
      page_exited: new Date().toISOString(),
    });
  }

  function init() {
    if (initialized) {
      return root.HinaTracker;
    }
    initialized = true;
    exited = false;
    pageEnteredAt = Date.now();
    sentScroll = {};

    var visitorId = root.HinaVisitor.getId();
    var sessionId = root.HinaSession.getId();

    root.HinaEvents.sendEvent({
      event_type: "page_view",
    });

    root.document.addEventListener("click", trackClick, true);
    root.document.addEventListener("scroll", trackScroll, { passive: true });
    root.document.addEventListener("focusin", trackFormStart, true);
    root.document.addEventListener("input", trackFormStart, true);
    root.document.addEventListener("submit", trackFormSubmit, true);
    root.addEventListener("pagehide", trackPageExit);
    root.addEventListener("beforeunload", trackPageExit);
    root.document.addEventListener("visibilitychange", function () {
      if (root.document.visibilityState === "hidden") {
        trackPageExit();
      }
    });

    if (root.HinaTrackerConfig.debug) {
      console.log("[HinaTracker] ready", { visitorId: visitorId, sessionId: sessionId });
    }

    return root.HinaTracker;
  }

  root.HinaTracker = {
    init: init,
    track: function (eventType, extra) {
      return root.HinaEvents.sendEvent(Object.assign({ event_type: eventType }, extra || {}));
    },
  };

  if (root.document && root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
