(() => {
  // Multi-client compatibility: some mods may not expose the same globals.
  // Prefer the injected `vendetta` object, but fall back to `globalThis.vendetta` if needed.
  const vd = typeof vendetta !== "undefined" ? vendetta : globalThis.vendetta;

  const FALLBACK_REPO_BASE = "https://raw.githubusercontent.com/syntexdevlol-ai/vanitas-plugins/main/";

  function toast(message) {
    try {
      vd?.ui?.toasts?.showToast?.(String(message));
    } catch {
      // Last resort
      try {
        console.log(String(message));
      } catch {
        // ignore
      }
    }
  }

  // Resolve React and React Native without crashing plugin load if APIs differ.
  function getReact() {
    return (
      vd?.metro?.common?.React ??
      vd?.metro?.findByProps?.("createElement", "useEffect", "useState") ??
      vd?.metro?.findByProps?.("createElement", "Component") ??
      null
    );
  }

  function getReactNative() {
    return (
      vd?.metro?.common?.ReactNative ??
      vd?.metro?.findByProps?.("View", "Text", "ScrollView") ??
      null
    );
  }

  function normalizeBaseUrl(url) {
    if (typeof url !== "string" || !url.length) return "";
    return url.endsWith("/") ? url : `${url}/`;
  }

  // If installed from `.../plugins/<id>/`, this returns the repo root `.../`.
  function getRepoBaseUrl() {
    const pluginId = normalizeBaseUrl(vd?.plugin?.id);
    if (pluginId) {
      const marker = "/plugins/";
      const idx = pluginId.indexOf(marker);
      if (idx !== -1) return pluginId.slice(0, idx + 1);
    }

    return FALLBACK_REPO_BASE;
  }

  function getPluginBaseUrl(repoBaseUrl, pluginId) {
    const base = normalizeBaseUrl(repoBaseUrl);
    const id = String(pluginId ?? "").trim();
    if (!base || !id) return "";
    return `${base}plugins/${id}/`;
  }

  async function fetchJson(url) {
    const fetchFn = vd?.utils?.safeFetch ?? fetch;
    const res = await fetchFn(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`);
    return await res.json();
  }

  function Settings() {
    const React = getReact();
    const RN = getReactNative();

    if (!React || !RN) {
      // Keep the plugin enabled even if the UI APIs differ in this client.
      return null;
    }

    const h = React.createElement;
    const { useEffect, useMemo, useState } = React;
    const {
      ActivityIndicator,
      Pressable,
      ScrollView,
      Text,
      TouchableOpacity,
      View
    } = RN;

    const PressableLike = Pressable ?? TouchableOpacity;

    function PrimaryButton({ label, onPress, disabled }) {
      return h(
        PressableLike,
        {
          disabled,
          onPress,
          style: ({ pressed } = {}) => ({
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: disabled ? "#999" : "#111",
            opacity: pressed ? 0.7 : 1
          })
        },
        h(
          Text,
          {
            style: {
              color: "#fff",
              fontWeight: "700",
              textAlign: "center"
            }
          },
          label
        )
      );
    }

    function Card({ children }) {
      return h(
        View,
        {
          style: {
            padding: 12,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.06)",
            marginBottom: 12
          }
        },
        children
      );
    }

    const repoBaseUrl = useMemo(() => getRepoBaseUrl(), []);
    const listUrl = useMemo(() => `${normalizeBaseUrl(repoBaseUrl)}plugins.json`, [repoBaseUrl]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [plugins, setPlugins] = useState([]);
    const [_tick, setTick] = useState(0); // forces re-render after install/uninstall

    async function reload() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchJson(listUrl);
        const list = Array.isArray(data?.plugins) ? data.plugins : [];
        setPlugins(list);
      } catch (e) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listUrl]);

    const installedMap = vd?.plugins?.plugins ?? {};

    const header = h(
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

    const cards = plugins.map((p) => {
      const id = String(p?.id ?? "");
      const name = String(p?.name ?? id);
      const line1 = String(p?.line1 ?? p?.description ?? "");
      const line2 = String(p?.line2 ?? p?.details ?? "");

      const baseUrl = getPluginBaseUrl(repoBaseUrl, id);
      const isInstalled = Boolean(baseUrl && installedMap[baseUrl]);
      const isSelf = normalizeBaseUrl(vd?.plugin?.id) === baseUrl;

      const canInstall = typeof vd?.plugins?.installPlugin === "function";
      const canRemove = typeof vd?.plugins?.removePlugin === "function";

      const label = isInstalled ? (isSelf ? "Installed" : "Uninstall") : "Install";
      const disabled = !baseUrl || isSelf ? true : (isInstalled ? !canRemove : !canInstall);

      const onPress = async () => {
        try {
          if (isInstalled) {
            if (!canRemove) throw new Error("removePlugin API is not available");
            await vd.plugins.removePlugin(baseUrl);
            toast(`Uninstalled: ${name}`);
          } else {
            if (!canInstall) throw new Error("installPlugin API is not available");
            await vd.plugins.installPlugin(baseUrl, true);
            toast(`Installed: ${name}`);
          }
          setTick((t) => t + 1);
        } catch (e) {
          toast(e?.message ?? String(e));
        }
      };

      return h(
        Card,
        { key: id },
        h(Text, { style: { fontSize: 16, fontWeight: "800" } }, name),
        line1 ? h(Text, { style: { marginTop: 6, opacity: 0.85 } }, line1) : null,
        line2 ? h(Text, { style: { marginTop: 2, opacity: 0.85 } }, line2) : null,
        h(View, { style: { height: 10 } }),
        h(PrimaryButton, { label, onPress, disabled }),
        h(View, { style: { height: 8 } }),
        h(Text, { selectable: true, style: { opacity: 0.6, fontSize: 12 } }, baseUrl)
      );
    });

    // `_tick` is used only to force a re-render after install/uninstall.
    void _tick;

    return h(ScrollView, { style: { padding: 12 } }, header, ...cards);
  }

  if (!vd) {
    return {
      onLoad() {
        console.log("Vanitas Plugins loaded (vendetta API not found)");
      },
      onUnload() {},
      settings: () => null
    };
  }

  return {
    onLoad() {
      console.log("Vanitas Plugins loaded");
      toast("Vanitas Plugins loaded");
    },
    onUnload() {
      // no-op
    },
    settings: Settings
  };
})()
