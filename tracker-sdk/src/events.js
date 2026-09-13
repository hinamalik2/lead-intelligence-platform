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
