(function () {
  // Bulk Guild Leaver
  // - Lets you select multiple guilds and leave them in one action.
  // - Includes confirmation + optional delay to reduce rate-limit risk.
  // - Nothing runs automatically; user must click the button.

  var vd = null;
  try {
    vd = vendetta;
  } catch (e) {
    vd = null;
  }

  function log(msg) {
    try {
      console.log(String(msg));
    } catch (e) {
      // ignore
    }
  }

  function toast(message) {
    try {
      if (vd && vd.ui && vd.ui.toasts && typeof vd.ui.toasts.showToast === "function") {
        vd.ui.toasts.showToast(String(message));
        return;
      }
    } catch (e) {
      // ignore
    }

    log(message);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function safeString(x) {
    try {
      return String(x);
    } catch (e) {
      return "";
    }
  }

  function getReact() {
    try {
      if (vd && vd.metro && vd.metro.common && vd.metro.common.React) return vd.metro.common.React;
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") {
        return vd.metro.findByProps("createElement", "useEffect", "useMemo", "useState");
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function getReactNative() {
    try {
      if (vd && vd.metro && vd.metro.common && vd.metro.common.ReactNative) return vd.metro.common.ReactNative;
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") {
        return vd.metro.findByProps("View", "Text", "ScrollView", "TextInput");
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function getGuildStore() {
    try {
      if (vd && vd.metro && typeof vd.metro.findByStoreName === "function") {
        var store = vd.metro.findByStoreName("GuildStore");
        if (store) return store;
      }
    } catch (e) {
      // ignore
    }

    try {
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") {
        // GuildStore usually has getGuilds.
        var maybe = vd.metro.findByProps("getGuilds");
        if (maybe && typeof maybe.getGuilds === "function") return maybe;
      }
    } catch (e2) {
      // ignore
    }

    return null;
  }

  function getGuildActions() {
    try {
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") {
        var actions = vd.metro.findByProps("leaveGuild");
        if (actions && typeof actions.leaveGuild === "function") return actions;
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  function getAllGuilds() {
    var store = getGuildStore();
    if (!store || typeof store.getGuilds !== "function") return [];

    var guildsObj = null;
    try {
      guildsObj = store.getGuilds();
    } catch (e) {
      guildsObj = null;
    }

    if (!guildsObj) return [];

    // Map-like
    try {
      if (typeof guildsObj.forEach === "function") {
        var out = [];
        guildsObj.forEach(function (v) {
          out.push(v);
        });
        return out;
      }
    } catch (e2) {
      // ignore
    }

    try {
      if (typeof guildsObj.values === "function") {
        if (typeof Array !== "undefined" && typeof Array.from === "function") {
          return Array.from(guildsObj.values());
        }
      }
    } catch (e2b) {
      // ignore
    }

    // Plain object
    var arr = [];
    try {
      for (var id in guildsObj) {
        if (Object.prototype.hasOwnProperty.call(guildsObj, id)) {
          arr.push(guildsObj[id]);
        }
      }
    } catch (e3) {
      // ignore
    }

    return arr;
  }

  function normalizeGuild(g) {
    var id = safeString(g && g.id);
    var name = safeString(g && g.name);
    return {
      id: id,
      name: name,
      raw: g,
    };
  }

  function sortGuildsByName(a, b) {
    var an = (a && a.name ? a.name : "").toLowerCase();
    var bn = (b && b.name ? b.name : "").toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }

  function Settings() {
    var React = getReact();
    var RN = getReactNative();
    if (!React || !RN) return null;

    var h = React.createElement;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useState = React.useState;

    var ActivityIndicator = RN.ActivityIndicator;
    var Pressable = RN.Pressable;
    var ScrollView = RN.ScrollView;
    var Text = RN.Text;
    var TextInput = RN.TextInput;
    var TouchableOpacity = RN.TouchableOpacity;
    var View = RN.View;

    var ButtonLike = Pressable || TouchableOpacity;

    var storage = null;
    try {
      storage = vd && vd.plugin && vd.plugin.storage ? vd.plugin.storage : null;
    } catch (e) {
      storage = null;
    }

    var initialSelected = {};
    var initialDelayMs = 900;

    try {
      if (storage && storage.selectedGuilds && typeof storage.selectedGuilds === "object") {
        initialSelected = storage.selectedGuilds;
      }
      if (storage && typeof storage.delayMs === "number") {
        initialDelayMs = storage.delayMs;
      }
    } catch (e2) {
      // ignore
    }

    var _a = useState(""),
      query = _a[0],
      setQuery = _a[1];

    var _b = useState(false),
      loading = _b[0],
      setLoading = _b[1];

    var _c = useState(""),
      error = _c[0],
      setError = _c[1];

    var _d = useState([]),
      guilds = _d[0],
      setGuilds = _d[1];

    var _e = useState(initialSelected),
      selected = _e[0],
      setSelected = _e[1];

    var _f = useState(String(initialDelayMs)),
      delayMsText = _f[0],
      setDelayMsText = _f[1];

    var _g = useState(false),
      armed = _g[0],
      setArmed = _g[1];

    var _h = useState(null),
      progress = _h[0],
      setProgress = _h[1];

    var useRef = React.useRef;
    var cancelRef = useRef ? useRef(false) : { current: false };

    var _i = useState(false),
      running = _i[0],
      setRunning = _i[1];

    function persistSelected(next) {
      try {
        if (storage) storage.selectedGuilds = next;
      } catch (e) {
        // ignore
      }
    }

    function persistDelay(ms) {
      try {
        if (storage) storage.delayMs = ms;
      } catch (e) {
        // ignore
      }
    }

    function refreshGuilds() {
      setLoading(true);
      setError("");

      try {
        var list = getAllGuilds().map(normalizeGuild).filter(function (g) {
          return g && g.id && g.name;
        });
        list.sort(sortGuildsByName);
        setGuilds(list);
      } catch (e) {
        setError((e && e.message) || String(e));
      } finally {
        setLoading(false);
      }
    }

    useEffect(function () {
      refreshGuilds();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If the settings screen unmounts, stop any in-progress leave loop.
    useEffect(function () {
      return function () {
        cancelRef.current = true;
      };
    }, []);

    var filtered = useMemo(function () {
      var q = (query || "").trim().toLowerCase();
      if (!q) return guilds;
      return guilds.filter(function (g) {
        return g && g.name && g.name.toLowerCase().indexOf(q) !== -1;
      });
    }, [guilds, query]);

    var selectedCount = useMemo(function () {
      var n = 0;
      try {
        for (var k in selected) {
          if (selected[k]) n += 1;
        }
      } catch (e) {
        // ignore
      }
      return n;
    }, [selected]);

    function toggleGuild(id) {
      if (running) return;
      if (!id) return;
      var next = {};
      for (var k in selected) next[k] = selected[k];
      next[id] = !next[id];
      setSelected(next);
      persistSelected(next);
    }

    function selectAllFiltered() {
      if (running) return;
      var next = {};
      for (var k in selected) next[k] = selected[k];
      for (var i = 0; i < filtered.length; i++) {
        next[filtered[i].id] = true;
      }
      setSelected(next);
      persistSelected(next);
    }

    function clearSelection() {
      if (running) return;
      var next = {};
      setSelected(next);
      persistSelected(next);
    }

    function parseDelayMs() {
      var n = parseInt(delayMsText, 10);
      if (!isFinite(n) || n < 0) n = 0;
      if (n > 10000) n = 10000;
      persistDelay(n);
      return n;
    }

    function confirmAndLeaveSelected() {
      if (running) {
        toast("Already running. Tap Stop to cancel.");
        return;
      }

      // Basic safety: require selection.
      if (selectedCount <= 0) {
        toast("Select at least 1 guild.");
        return;
      }

      // Prefer a confirmation alert if the client provides it.
      try {
        if (vd && vd.ui && vd.ui.alerts && typeof vd.ui.alerts.showConfirmationAlert === "function") {
          return vd.ui.alerts.showConfirmationAlert({
            title: "Leave selected guilds?",
            content: "This will leave " + selectedCount + " guild(s). You may need an invite to rejoin.",
            confirmText: "Leave",
            cancelText: "Cancel",
            onConfirm: function () {
              runLeaveSelected();
            },
          });
        }
      } catch (e) {
        // ignore
      }

      // Fallback: tap-to-arm then tap again.
      if (!armed) {
        setArmed(true);
        toast("Tap again to confirm leaving " + selectedCount + " guild(s)");
        setTimeout(function () {
          setArmed(false);
        }, 5000);
        return;
      }

      runLeaveSelected();
    }

    function stopLeaving() {
      if (!running) return;
      cancelRef.current = true;
      toast("Stopping after the current guild...");
    }

    function runLeaveSelected() {
      var actions = getGuildActions();
      if (!actions || typeof actions.leaveGuild !== "function") {
        toast("Could not find leaveGuild() API in this client.");
        return;
      }

      var delayMs = parseDelayMs();

      // Build stable list in UI order.
      var ids = [];
      var idToName = {};
      for (var i = 0; i < guilds.length; i++) {
        var g = guilds[i];
        if (g && g.id && g.name) idToName[g.id] = g.name;
        if (g && selected[g.id]) ids.push(g.id);
      }

      if (!ids.length) {
        toast("No guilds selected.");
        return;
      }

      cancelRef.current = false;
      setRunning(true);
      setArmed(false);
      setProgress({ total: ids.length, done: 0, failed: 0, current: "" });

      function finish(done, failed, cancelled) {
        setRunning(false);
        setProgress({ total: ids.length, done: done, failed: failed, current: "" });
        var left = done - failed;
        if (cancelled) toast("Stopped. Left " + left + "/" + done + " so far." + (failed ? " Failed: " + failed : ""));
        else toast("Done. Left " + left + "/" + done + "." + (failed ? " Failed: " + failed : ""));

        // Refresh list after leaving.
        setTimeout(function () {
          refreshGuilds();
        }, 1500);
      }

      function step(idx, failed) {
        if (cancelRef.current) {
          finish(idx, failed, true);
          return;
        }

        if (idx >= ids.length) {
          finish(ids.length, failed, false);
          return;
        }

        var id = ids[idx];
        var name = idToName[id] || id;

        // Show which guild we're attempting now.
        setProgress({ total: ids.length, done: idx, failed: failed, current: name });

        Promise.resolve()
          .then(function () {
            // Some builds return void, some return Promise.
            return actions.leaveGuild(id);
          })
          .then(
            function () {
              // success
              return { ok: true };
            },
            function () {
              // failure
              return { ok: false };
            }
          )
          .then(function (res) {
            var nextFailed = failed + (res && res.ok ? 0 : 1);

            // Update "done" immediately (useful during delay).
            setProgress({ total: ids.length, done: idx + 1, failed: nextFailed, current: "" });

            if (cancelRef.current) {
              finish(idx + 1, nextFailed, true);
              return;
            }

            // Delay to reduce rate-limit risk.
            if (delayMs > 0 && idx + 1 < ids.length) {
              return sleep(delayMs).then(function () {
                step(idx + 1, nextFailed);
              });
            }

            step(idx + 1, nextFailed);
          })
          .catch(function () {
            // Shouldn't happen, but keep going.
            step(idx + 1, failed + 1);
          });
      }

      step(0, 0);
    }

    function Row(props) {
      var label = props.label;
      var sub = props.sub;
      var onPress = props.onPress;
      var right = props.right;

      return h(
        View,
        { style: { paddingVertical: 8 } },
        h(
          ButtonLike,
          {
            onPress: onPress,
            style: { padding: 10, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },
          },
          h(View, { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } },
            h(View, { style: { flexShrink: 1, paddingRight: 12 } },
              h(Text, { style: { fontWeight: "800" } }, label),
              sub ? h(Text, { style: { opacity: 0.75, marginTop: 2 } }, sub) : null
            ),
            right ? h(View, null, right) : null
          )
        )
      );
    }

    function SmallButton(props) {
      var label = props.label;
      var onPress = props.onPress;
      var disabled = !!props.disabled;

      return h(
        ButtonLike,
        {
          disabled: disabled,
          onPress: onPress,
          style: {
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: disabled ? "#999" : "#111",
            marginRight: 8,
          },
        },
        h(Text, { style: { color: "#fff", fontWeight: "800" } }, label)
      );
    }

    var header = h(
      View,
      { style: { padding: 12 } },
      h(Text, { style: { fontSize: 20, fontWeight: "900" } }, "Bulk Guild Leaver"),
      h(Text, { style: { marginTop: 4, opacity: 0.8 } }, "Select servers and leave them in one click."),
      h(View, { style: { height: 10 } }),
      h(Text, { style: { fontWeight: "800", marginBottom: 6 } }, "Search"),
      h(TextInput, {
        value: query,
        onChangeText: setQuery,
        placeholder: "Type a guild name...",
        style: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.06)",
        },
      }),
      h(View, { style: { height: 10 } }),
      h(Text, { style: { fontWeight: "800", marginBottom: 6 } }, "Delay between leaves (ms)"),
      h(TextInput, {
        value: delayMsText,
        onChangeText: function (t) {
          setDelayMsText(t);
        },
        placeholder: "900",
        keyboardType: "numeric",
        style: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.06)",
        },
      }),
      h(View, { style: { height: 10 } }),
      h(View, { style: { flexDirection: "row", flexWrap: "wrap" } },
        h(SmallButton, { label: "Refresh", onPress: refreshGuilds }),
        h(SmallButton, { label: "Select filtered", onPress: selectAllFiltered, disabled: filtered.length === 0 }),
        h(SmallButton, { label: "Clear", onPress: clearSelection, disabled: selectedCount === 0 })
      ),
      h(View, { style: { height: 10 } }),
      h(Text, { style: { fontWeight: "800" } }, "Selected: " + selectedCount),
      h(View, { style: { height: 10 } }),
      h(
        ButtonLike,
        {
          onPress: confirmAndLeaveSelected,
          style: {
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: running ? "#999" : selectedCount ? "#b91c1c" : "#999",
            opacity: selectedCount ? 1 : 0.7,
          },
        },
        h(
          Text,
          { style: { color: "#fff", fontWeight: "900", textAlign: "center" } },
          running ? "Leaving..." : armed ? "Tap again to confirm" : "Leave Selected"
        )
      ),
      running ? h(View, { style: { height: 10 } }) : null,
      running
        ? h(
            ButtonLike,
            {
              onPress: stopLeaving,
              style: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#111" },
            },
            h(Text, { style: { color: "#fff", fontWeight: "900", textAlign: "center" } }, "Stop")
          )
        : null,
      progress
        ? h(
            View,
            { style: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" } },
            h(Text, { style: { fontWeight: "800" } }, "Progress"),
            h(Text, { style: { marginTop: 4, opacity: 0.85 } },
              "Done: " + progress.done + "/" + progress.total + (progress.failed ? " (failed: " + progress.failed + ")" : "")
            ),
            progress.current ? h(Text, { style: { marginTop: 2, opacity: 0.75 } }, "Current: " + progress.current) : null
          )
        : null,
      error ? h(View, { style: { marginTop: 10 } }, h(Text, { style: { color: "#b91c1c" } }, error)) : null
    );

    if (loading) {
      return h(ScrollView, { style: { padding: 12 } }, header, h(View, { style: { paddingVertical: 24 } }, h(ActivityIndicator, null)));
    }

    var rows = filtered.map(function (g) {
      var checked = !!selected[g.id];
      return h(Row, {
        key: g.id,
        label: g.name,
        sub: g.id,
        onPress: function () {
          toggleGuild(g.id);
        },
        right: h(Text, { style: { fontWeight: "900" } }, checked ? "[x]" : "[ ]"),
      });
    });

    return h(ScrollView, { style: { padding: 12 } }, header, rows);
  }

  return {
    onLoad: function () {
      log("Bulk Guild Leaver loaded");
    },
    onUnload: function () {
      // no-op
    },
    settings: Settings,
  };
})();
