(() => {
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;
  const h = React.createElement;

  const { useEffect, useMemo, useState } = React;
  const {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View
  } = RN;

  function toast(message) {
    try {
      vendetta.ui.toasts.showToast(String(message));
    } catch {
      console.log(String(message));
    }
  }

  function getRepoBaseUrl() {
    // If installed from a raw GitHub folder URL, this resolves to the repo root.
    // Example: .../main/plugins/vanitas-plugins/ -> .../main/
    try {
      return new URL("../../", vendetta.plugin.id).toString();
    } catch {
      // Fallback for clients without vendetta.plugin.id
      return "https://raw.githubusercontent.com/syntexdevlol-ai/vanitas-plugins/main/";
    }
  }

  function getPluginBaseUrl(repoBaseUrl, pluginId) {
    const url = new URL(`plugins/${pluginId}/`, repoBaseUrl).toString();
    return url.endsWith("/") ? url : `${url}/`;
  }

  async function fetchJson(url) {
    const fetchFn = vendetta.utils?.safeFetch ?? fetch;
    const res = await fetchFn(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${url} (HTTP ${res.status})`);
    return await res.json();
  }

  function PrimaryButton({ label, onPress, disabled }) {
    return h(
      Pressable,
      {
        disabled,
        onPress,
        style: ({ pressed }) => ({
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

  function Settings() {
    // Re-render when plugin install state changes.
    try {
      vendetta.storage.useProxy(vendetta.plugins.plugins);
    } catch {
      // ignore
    }

    const repoBaseUrl = useMemo(() => getRepoBaseUrl(), []);
    const listUrl = useMemo(() => new URL("plugins.json", repoBaseUrl).toString(), [repoBaseUrl]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [plugins, setPlugins] = useState([]);

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

    const installedMap = vendetta.plugins?.plugins ?? {};

    const header = h(View, { style: { marginBottom: 12 } },
      h(Text, { style: { fontSize: 20, fontWeight: "800" } }, "Vanitas Plugins"),
      h(Text, { style: { marginTop: 4, opacity: 0.8 } }, "Install and manage plugins from your Vanitas repo."),
      h(View, { style: { height: 10 } }),
      h(PrimaryButton, { label: "Reload list", onPress: reload, disabled: loading })
    );

    if (loading) {
      return h(ScrollView, { style: { padding: 12 } },
        header,
        h(View, { style: { paddingVertical: 24 } }, h(ActivityIndicator, null))
      );
    }

    if (error) {
      return h(ScrollView, { style: { padding: 12 } },
        header,
        h(Card, null,
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
      const isInstalled = Boolean(installedMap[baseUrl]);

      const isSelf = String(vendetta?.plugin?.id ?? "") === baseUrl;
      const canInstall = typeof vendetta?.plugins?.installPlugin === "function";
      const canRemove = typeof vendetta?.plugins?.removePlugin === "function";

      const label = isInstalled ? (isSelf ? "Installed" : "Uninstall") : "Install";
      const disabled = isSelf ? true : (isInstalled ? !canRemove : !canInstall);

      const onPress = async () => {
        try {
          if (isInstalled) {
            if (!canRemove) throw new Error("removePlugin API is not available");
            await vendetta.plugins.removePlugin(baseUrl);
            toast(`Uninstalled: ${name}`);
          } else {
            if (!canInstall) throw new Error("installPlugin API is not available");
            await vendetta.plugins.installPlugin(baseUrl, true);
            toast(`Installed: ${name}`);
          }
        } catch (e) {
          toast(e?.message ?? String(e));
        }
      };

      return h(Card, { key: id },
        h(Text, { style: { fontSize: 16, fontWeight: "800" } }, name),
        line1 ? h(Text, { style: { marginTop: 6, opacity: 0.85 } }, line1) : null,
        line2 ? h(Text, { style: { marginTop: 2, opacity: 0.85 } }, line2) : null,
        h(View, { style: { height: 10 } }),
        h(PrimaryButton, { label, onPress, disabled }),
        h(View, { style: { height: 8 } }),
        h(Text, { selectable: true, style: { opacity: 0.6, fontSize: 12 } }, baseUrl)
      );
    });

    return h(ScrollView, { style: { padding: 12 } }, header, ...cards);
  }

  return {
    onLoad() {
      console.log("Vanitas Plugins loaded");
    },
    onUnload() {
      // no-op
    },
    settings: Settings
  };
})()
