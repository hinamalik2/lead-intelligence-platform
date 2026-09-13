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
