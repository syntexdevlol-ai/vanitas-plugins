(() => {
  // Bulk Guild Leaver
  // Select multiple servers (guilds) and leave them in one action.

  let vd;
  try {
    vd = vendetta;
  } catch (e) {
    vd = null;
  }

  const log = (msg) => {
    try {
      console.log(String(msg));
    } catch (e) {
      // ignore
    }
  };

  const toast = (msg) => {
    try {
      if (vd && vd.ui && vd.ui.toasts && typeof vd.ui.toasts.showToast === "function") {
        vd.ui.toasts.showToast(String(msg));
        return;
      }
    } catch (e) {
      // ignore
    }
    log(msg);
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Minimal "compat" helpers so this runs on Bunny / Revenge / Vendetta / Keetu builds.
  const findByPropsSafe = (...props) => {
    try {
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") return vd.metro.findByProps(...props);
    } catch (e) {
      // ignore
    }
    return null;
  };

  const findByStoreNameSafe = (name) => {
    try {
      if (vd && vd.metro && typeof vd.metro.findByStoreName === "function") return vd.metro.findByStoreName(name);
    } catch (e) {
      // ignore
    }
    return null;
  };

  const getReact = () => {
    try {
      if (vd && vd.metro && vd.metro.common && vd.metro.common.React) return vd.metro.common.React;
    } catch (e) {
      // ignore
    }
    return findByPropsSafe("createElement", "useState", "useEffect", "useMemo", "useRef", "useCallback");
  };

  const getRN = () => {
    try {
      if (vd && vd.metro && vd.metro.common && vd.metro.common.ReactNative) return vd.metro.common.ReactNative;
    } catch (e) {
      // ignore
    }
    return findByPropsSafe("View", "Text", "ScrollView", "TextInput");
  };

  const getGuildStore = () => {
    const store = findByStoreNameSafe("GuildStore");
    if (store && typeof store.getGuilds === "function") return store;

    const maybe = findByPropsSafe("getGuilds");
    if (maybe && typeof maybe.getGuilds === "function") return maybe;

    return null;
  };

  const getGuildActions = () => {
    const actions = findByPropsSafe("leaveGuild");
    if (actions && typeof actions.leaveGuild === "function") return actions;
    return null;
  };

  const loadGuilds = () => {
    const store = getGuildStore();
    if (!store || typeof store.getGuilds !== "function") return [];

    let map;
    try {
      map = store.getGuilds();
    } catch (e) {
      map = null;
    }

    const arr = [];
    if (map && typeof map.forEach === "function") {
      map.forEach((g) => arr.push(g));
    } else if (map) {
      for (const id in map) arr.push(map[id]);
    }

    return arr
      .filter((g) => g && g.id && g.name)
      .map((g) => ({ id: String(g.id), name: String(g.name) }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  };

  const Settings = () => {
    const React = getReact();
    const RN = getRN();
    if (!React || !RN) {
      toast("Bulk Guild Leaver: could not find React / ReactNative in this client.");
      return null;
    }

    const h = React.createElement;
    const Pressable = RN.Pressable || RN.TouchableOpacity;

    const [guilds, setGuilds] = React.useState([]);
    const [query, setQuery] = React.useState("");
    const [delayText, setDelayText] = React.useState("900");
    const [selected, setSelected] = React.useState({});
    const [running, setRunning] = React.useState(false);
    const [armed, setArmed] = React.useState(false);
    const [progress, setProgress] = React.useState(null);

    const cancelRef = React.useRef(false);

    const refresh = React.useCallback(() => {
      setGuilds(loadGuilds());
    }, []);

    React.useEffect(() => {
      refresh();
      return () => {
        cancelRef.current = true;
      };
    }, [refresh]);

    const delayMs = React.useMemo(() => {
      const n = parseInt(delayText, 10);
      if (!isFinite(n) || n < 0) return 0;
      return Math.min(n, 10000);
    }, [delayText]);

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return guilds;
      return guilds.filter((g) => g.name.toLowerCase().indexOf(q) !== -1);
    }, [guilds, query]);

    const selectedIds = React.useMemo(() => {
      const ids = [];
      for (let i = 0; i < guilds.length; i++) {
        const g = guilds[i];
        if (g && selected[g.id]) ids.push(g.id);
      }
      return ids;
    }, [guilds, selected]);

    const selectedCount = selectedIds.length;

    const toggleGuild = (id) => {
      if (running) return;
      setSelected((prev) => {
        const next = Object.assign({}, prev);
        next[id] = !prev[id];
        return next;
      });
    };

    const selectFiltered = () => {
      if (running) return;
      setSelected((prev) => {
        const next = Object.assign({}, prev);
        for (let i = 0; i < filtered.length; i++) next[filtered[i].id] = true;
        return next;
      });
    };

    const clearSelection = () => {
      if (running) return;
      setSelected({});
    };

    const stopLeaving = () => {
      if (!running) return;
      cancelRef.current = true;
      toast("Stopping after the current guild...");
    };

    const startLeaving = async () => {
      const actions = getGuildActions();
      if (!actions || typeof actions.leaveGuild !== "function") {
        toast("leaveGuild() not found in this client.");
        return;
      }

      if (!selectedIds.length) {
        toast("No guilds selected.");
        return;
      }

      const idToName = {};
      for (let i = 0; i < guilds.length; i++) idToName[guilds[i].id] = guilds[i].name;

      cancelRef.current = false;
      setRunning(true);
      setArmed(false);

      let done = 0;
      let failed = 0;
      setProgress({ total: selectedIds.length, done: 0, failed: 0, current: "" });

      for (let i = 0; i < selectedIds.length; i++) {
        if (cancelRef.current) break;

        const id = selectedIds[i];
        setProgress({ total: selectedIds.length, done: i, failed, current: idToName[id] || id });

        try {
          await Promise.resolve(actions.leaveGuild(id));
        } catch (e) {
          failed++;
        }

        done = i + 1;
        setProgress({ total: selectedIds.length, done, failed, current: "" });

        if (cancelRef.current) break;
        if (delayMs > 0 && i + 1 < selectedIds.length) await sleep(delayMs);
      }

      setRunning(false);
      setProgress({ total: selectedIds.length, done, failed, current: "" });

      const left = done - failed;
      toast(cancelRef.current ? "Stopped. Left " + left + "/" + done + " so far." : "Done. Left " + left + "/" + done + ".");

      setTimeout(refresh, 1500);
    };

    const confirmLeave = () => {
      if (running) return toast("Already running. Tap Stop to cancel.");
      if (!selectedCount) return toast("Select at least 1 guild.");

      if (vd.ui && vd.ui.alerts && typeof vd.ui.alerts.showConfirmationAlert === "function") {
        return vd.ui.alerts.showConfirmationAlert({
          title: "Leave selected guilds?",
          content: "This will leave " + selectedCount + " guild(s). You may need an invite to re-join.",
          confirmText: "Leave",
          cancelText: "Cancel",
          onConfirm: startLeaving,
        });
      }

      // Fallback: tap again within 5 seconds.
      if (!armed) {
        setArmed(true);
        toast("Tap again to confirm leaving " + selectedCount + " guild(s)");
        setTimeout(() => setArmed(false), 5000);
        return;
      }

      startLeaving();
    };

    const Button = (label, onPress, disabled, danger) =>
      h(
        Pressable,
        {
          disabled: !!disabled,
          onPress,
          style: {
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: disabled ? "#999" : danger ? "#b91c1c" : "#111",
            marginRight: 8,
            marginBottom: 8,
            opacity: disabled ? 0.7 : 1,
          },
        },
        h(RN.Text, { style: { color: "#fff", fontWeight: "900" } }, label)
      );

    const GuildRow = (g) =>
      h(
        Pressable,
        {
          key: g.id,
          disabled: running,
          onPress: () => toggleGuild(g.id),
          style: {
            padding: 10,
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.06)",
            marginBottom: 8,
            opacity: running ? 0.6 : 1,
          },
        },
        h(
          RN.View,
          { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } },
          h(
            RN.View,
            { style: { flexShrink: 1, paddingRight: 10 } },
            h(RN.Text, { style: { fontWeight: "900" } }, g.name),
            h(RN.Text, { style: { opacity: 0.7, marginTop: 2 } }, g.id)
          ),
          h(RN.Text, { style: { fontWeight: "900" } }, selected[g.id] ? "[x]" : "[ ]")
        )
      );

    return h(
      RN.ScrollView,
      { style: { padding: 12 } },
      h(RN.Text, { style: { fontSize: 20, fontWeight: "900" } }, "Bulk Guild Leaver"),
      h(RN.Text, { style: { marginTop: 4, opacity: 0.8 } }, "Select servers and leave them in one click."),
      h(RN.View, { style: { height: 12 } }),

      h(RN.Text, { style: { fontWeight: "800", marginBottom: 6 } }, "Search"),
      h(RN.TextInput, {
        value: query,
        onChangeText: setQuery,
        placeholder: "Type a server name...",
        style: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },
      }),
      h(RN.View, { style: { height: 12 } }),

      h(RN.Text, { style: { fontWeight: "800", marginBottom: 6 } }, "Delay between leaves (ms)"),
      h(RN.TextInput, {
        value: delayText,
        onChangeText: setDelayText,
        placeholder: "900",
        keyboardType: "numeric",
        style: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },
      }),
      h(RN.View, { style: { height: 12 } }),

      h(RN.View, { style: { flexDirection: "row", flexWrap: "wrap" } }, [
        Button("Refresh", refresh, running, false),
        Button("Select filtered", selectFiltered, running || !filtered.length, false),
        Button("Clear", clearSelection, running || !selectedCount, false),
      ]),

      h(RN.Text, { style: { fontWeight: "800", marginBottom: 8 } }, "Selected: " + selectedCount),
      Button(running ? "Leaving..." : armed ? "Tap again to confirm" : "Leave Selected", confirmLeave, running || !selectedCount, true),
      running ? Button("Stop", stopLeaving, false, false) : null,

      progress
        ? h(
            RN.View,
            { style: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" } },
            h(RN.Text, { style: { fontWeight: "800" } }, "Progress"),
            h(
              RN.Text,
              { style: { marginTop: 4, opacity: 0.85 } },
              "Done: " +
                progress.done +
                "/" +
                progress.total +
                (progress.failed ? " (failed: " + progress.failed + ")" : "")
            ),
            progress.current ? h(RN.Text, { style: { marginTop: 2, opacity: 0.75 } }, "Current: " + progress.current) : null
          )
        : null,

      h(RN.View, { style: { height: 12 } }),
      filtered.map(GuildRow)
    );
  };

    return {
      onLoad() {
      log("Bulk Guild Leaver loaded");
    },
    onUnload() {},
    settings: Settings,
  };
})();
