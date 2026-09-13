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
