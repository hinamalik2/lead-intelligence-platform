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
