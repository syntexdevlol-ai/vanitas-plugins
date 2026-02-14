(function () {
  // Keep this plugin very defensive: some clients differ in what globals / APIs exist.
  // Vendetta-style loaders evaluate plugins as: vendetta => { return <plugin code> }
  // So `vendetta` should exist here, but we still guard it.

  var vd = null;
  try {
    // If `vendetta` is not defined, this throws and we fall back.
    vd = vendetta;
  } catch (e) {
    vd = null;
  }

  // Hard fallback base URL (used only if we can't derive from vd.plugin.id)
  var FALLBACK_REPO_BASE = "https://raw.githubusercontent.com/syntexdevlol-ai/vanitas-plugins/main/";

  function toast(message) {
    try {
      if (vd && vd.ui && vd.ui.toasts && typeof vd.ui.toasts.showToast === "function") {
        vd.ui.toasts.showToast(String(message));
        return;
      }
    } catch (e) {
      // ignore
    }

    try {
      console.log(String(message));
    } catch (e2) {
      // ignore
    }
  }

  function normalizeBaseUrl(url) {
    if (typeof url !== "string" || !url.length) return "";
    return url.charAt(url.length - 1) === "/" ? url : url + "/";
  }

  // If installed from `.../plugins/<id>/`, this returns the repo root `.../`.
  function getRepoBaseUrl() {
    var pluginId = "";
    try {
      pluginId = vd && vd.plugin && vd.plugin.id ? String(vd.plugin.id) : "";
    } catch (e) {
      pluginId = "";
    }

    pluginId = normalizeBaseUrl(pluginId);
    if (pluginId) {
      var marker = "/plugins/";
      var idx = pluginId.indexOf(marker);
      if (idx !== -1) return pluginId.slice(0, idx + 1);
    }

    return FALLBACK_REPO_BASE;
  }

  function getPluginBaseUrl(repoBaseUrl, pluginId) {
    var base = normalizeBaseUrl(repoBaseUrl);
    var id = String(pluginId || "").trim();
    if (!base || !id) return "";
    return base + "plugins/" + id + "/";
  }

  function getReact() {
    try {
      if (vd && vd.metro && vd.metro.common && vd.metro.common.React) return vd.metro.common.React;
      if (vd && vd.metro && typeof vd.metro.findByProps === "function") {
        return vd.metro.findByProps("createElement", "useEffect", "useState");
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
        return vd.metro.findByProps("View", "Text", "ScrollView");
      }
    } catch (e) {
      // ignore
    }

    return null;
  }

  function fetchJson(url) {
    var fetchFn = null;
    try {
      fetchFn = vd && vd.utils && typeof vd.utils.safeFetch === "function" ? vd.utils.safeFetch : fetch;
    } catch (e) {
      fetchFn = fetch;
    }

    return fetchFn(url, { cache: "no-store" }).then(function (res) {
      if (!res || !res.ok) {
        var status = res && typeof res.status === "number" ? res.status : "?";
        throw new Error("Failed to fetch " + url + " (HTTP " + status + ")");
      }
      return res.json();
    });
  }

  // Inject a "Vanitas Plugins" entry into Kettu/Keetu settings so you don't need the plugin wrench.
  // This uses Kettu's internal `@ui/settings` registry if available, otherwise it silently does nothing.
  var SETTINGS_ROW_KEY = "VANITAS_PLUGINS_BROWSER";
  var uninjectSettingsEntry = null;

  function tryInjectSettingsEntry() {
    if (!vd || !vd.metro || typeof vd.metro.findByProps !== "function") return null;

    var settingsUi = null;
    try {
      // Kettu exposes { registeredSections, registerSection } via @ui/settings.
      settingsUi = vd.metro.findByProps("registeredSections", "registerSection");
    } catch (e) {
      settingsUi = null;
    }

    if (!settingsUi || !settingsUi.registeredSections) return null;

    var sections = settingsUi.registeredSections;
    if (!sections || typeof sections !== "object") return null;

    // Prefer the existing Kettu/Keetu section. Fall back to an empty compat section if needed.
    var sectionName = null;
    if (sections.Keetu && Array.isArray(sections.Keetu)) sectionName = "Keetu";
    else if (sections.Kettu && Array.isArray(sections.Kettu)) sectionName = "Kettu";
    else if (sections.Bunny && Array.isArray(sections.Bunny)) sectionName = "Bunny";
    else if (sections.Vendetta && Array.isArray(sections.Vendetta)) sectionName = "Vendetta";

    var icon = undefined;
    try {
      if (vd.ui && vd.ui.assets && typeof vd.ui.assets.getAssetIDByName === "function") {
        icon = vd.ui.assets.getAssetIDByName("DownloadIcon") || vd.ui.assets.getAssetIDByName("AppsIcon");
      }
    } catch (e2) {
      icon = undefined;
    }

    var row = {
      key: SETTINGS_ROW_KEY,
      title: function () {
        return "Vanitas Plugins";
      },
      icon: icon,
      // Kettu expects `render` to return a Promise that resolves to `{ default: Component }`.
      render: function () {
        return new Promise(function (resolve) {
          resolve({ default: Settings });
        });
      },
    };

    function removeRowFrom(name) {
      var arr = sections[name];
      if (!Array.isArray(arr)) return;
      for (var i = arr.length - 1; i >= 0; i--) {
        if (arr[i] && arr[i].key === SETTINGS_ROW_KEY) arr.splice(i, 1);
      }
    }

    // If we found a target section, append our row without clobbering existing items.
    if (sectionName) {
      var target = sections[sectionName];
      for (var j = 0; j < target.length; j++) {
        if (target[j] && target[j].key === SETTINGS_ROW_KEY) {
          return function () {
            // already injected
          };
        }
      }

      target.push(row);
      return function () {
        removeRowFrom(sectionName);
      };
    }

    // Fallback: create a new section if the registry exists but no known section was found.
    if (typeof settingsUi.registerSection === "function") {
      try {
        return settingsUi.registerSection({ name: "Vanitas", items: [row] });
      } catch (e3) {
        // ignore
      }
    }

    return null;
  }

  function Settings() {
    var React = getReact();
    var RN = getReactNative();

    // Don’t crash if a client can’t render our UI.
    if (!React || !RN) return null;

    var h = React.createElement;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useState = React.useState;

    var ActivityIndicator = RN.ActivityIndicator;
    var Pressable = RN.Pressable;
    var ScrollView = RN.ScrollView;
    var Text = RN.Text;
    var TouchableOpacity = RN.TouchableOpacity;
    var View = RN.View;

    var PressableLike = Pressable || TouchableOpacity;

    function PrimaryButton(props) {
      var label = props.label;
      var onPress = props.onPress;
      var disabled = !!props.disabled;

      if (!PressableLike) return null;

      return h(
        PressableLike,
        {
          disabled: disabled,
          onPress: onPress,
          style: function (state) {
            var pressed = state && state.pressed;
            return {
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: disabled ? "#999" : "#111",
              opacity: pressed ? 0.7 : 1,
            };
          },
        },
        h(
          Text,
          {
            style: {
              color: "#fff",
              fontWeight: "700",
              textAlign: "center",
            },
          },
          label
        )
      );
    }

    function Card(props) {
      return h(
        View,
        {
          style: {
            padding: 12,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.06)",
            marginBottom: 12,
          },
        },
        props.children
      );
    }

    var repoBaseUrl = useMemo(function () {
      return getRepoBaseUrl();
    }, []);

    var listUrl = useMemo(function () {
      return normalizeBaseUrl(repoBaseUrl) + "plugins.json";
    }, [repoBaseUrl]);

    var _a = useState(true),
      loading = _a[0],
      setLoading = _a[1];
    var _b = useState(null),
      error = _b[0],
      setError = _b[1];
    var _c = useState([]),
      plugins = _c[0],
      setPlugins = _c[1];
    var _d = useState(0),
      tick = _d[0],
      setTick = _d[1];

    function reload() {
      setLoading(true);
      setError(null);

      fetchJson(listUrl)
        .then(function (data) {
          var list = data && Array.isArray(data.plugins) ? data.plugins : [];
          setPlugins(list);
        })
        .catch(function (e) {
          setError((e && e.message) || String(e));
        })
        .finally(function () {
          setLoading(false);
        });
    }

    useEffect(function () {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listUrl]);

    var installedMap = (vd && vd.plugins && vd.plugins.plugins) ? vd.plugins.plugins : {};

    var header = h(
      View,
      { style: { marginBottom: 12 } },
      h(Text, { style: { fontSize: 20, fontWeight: "800" } }, "Vanitas Plugins"),
      h(Text, { style: { marginTop: 4, opacity: 0.8 } }, "Install and manage plugins from your Vanitas repo."),
      h(View, { style: { height: 10 } }),
      h(PrimaryButton, { label: "Reload list", onPress: reload, disabled: loading })
    );

    if (loading) {
      return h(
        ScrollView,
        { style: { padding: 12 } },
        header,
        h(View, { style: { paddingVertical: 24 } }, h(ActivityIndicator, null))
      );
    }

    if (error) {
      return h(
        ScrollView,
        { style: { padding: 12 } },
        header,
        h(
          Card,
          null,
          h(Text, { style: { fontWeight: "700", marginBottom: 6 } }, "Failed to load plugin list"),
          h(Text, { selectable: true }, String(error)),
          h(View, { style: { height: 10 } }),
          h(Text, { selectable: true, style: { opacity: 0.75 } }, listUrl)
        )
      );
    }

    var cards = plugins.map(function (p) {
      var id = String((p && p.id) || "");
      var name = String((p && p.name) || id);
      var line1 = String((p && (p.line1 || p.description)) || "");
      var line2 = String((p && (p.line2 || p.details)) || "");

      var baseUrl = getPluginBaseUrl(repoBaseUrl, id);
      var isInstalled = !!(baseUrl && installedMap[baseUrl]);
      var selfId = "";
      try {
        selfId = vd && vd.plugin && vd.plugin.id ? normalizeBaseUrl(String(vd.plugin.id)) : "";
      } catch (e) {
        selfId = "";
      }
      var isSelf = selfId && baseUrl && selfId === baseUrl;

      var canInstall = !!(vd && vd.plugins && typeof vd.plugins.installPlugin === "function");
      var canRemove = !!(vd && vd.plugins && typeof vd.plugins.removePlugin === "function");

      var label = isInstalled ? (isSelf ? "Installed" : "Uninstall") : "Install";
      var disabled = !baseUrl || isSelf ? true : (isInstalled ? !canRemove : !canInstall);

      function onPress() {
        if (!vd || !vd.plugins) return;

        var action;
        if (isInstalled) {
          if (!canRemove) {
            toast("removePlugin API is not available");
            return;
          }
          action = vd.plugins.removePlugin(baseUrl).then(function () {
            toast("Uninstalled: " + name);
          });
        } else {
          if (!canInstall) {
            toast("installPlugin API is not available");
            return;
          }
          action = vd.plugins.installPlugin(baseUrl, true).then(function () {
            toast("Installed: " + name);
          });
        }

        Promise.resolve(action)
          .then(function () {
            setTick(function (t) { return t + 1; });
          })
          .catch(function (e) {
            toast((e && e.message) || String(e));
          });
      }

      return h(
        Card,
        { key: id },
        h(Text, { style: { fontSize: 16, fontWeight: "800" } }, name),
        line1 ? h(Text, { style: { marginTop: 6, opacity: 0.85 } }, line1) : null,
        line2 ? h(Text, { style: { marginTop: 2, opacity: 0.85 } }, line2) : null,
        h(View, { style: { height: 10 } }),
        h(PrimaryButton, { label: label, onPress: onPress, disabled: disabled }),
        h(View, { style: { height: 8 } }),
        h(Text, { selectable: true, style: { opacity: 0.6, fontSize: 12 } }, baseUrl)
      );
    });

    // force re-render on install/uninstall
    void tick;

    return h.apply(null, [ScrollView, { style: { padding: 12 } }, header].concat(cards));
  }

  // Export plugin object.
  return {
    onLoad: function () {
      try {
        console.log("Vanitas Plugins loaded");
      } catch (e) {
        // ignore
      }
      toast("Vanitas Plugins loaded");

      try {
        // Inject settings entry on load.
        uninjectSettingsEntry = tryInjectSettingsEntry();
      } catch (e2) {
        uninjectSettingsEntry = null;
      }
    },
    onUnload: function () {
      try {
        if (typeof uninjectSettingsEntry === "function") uninjectSettingsEntry();
      } catch (e) {
        // ignore
      }
      uninjectSettingsEntry = null;
    },
    settings: Settings,
  };
})();
