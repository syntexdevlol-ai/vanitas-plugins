(() => {
  const { registerCommand } = vendetta.commands;
  const { findByProps } = vendetta.metro;
  const { sendBotMessage } = findByProps("sendBotMessage");

  let unregisterCommand;

  return {
    onLoad() {
      console.log("Test plugin loaded");

      unregisterCommand = registerCommand({
        name: "test",
        displayName: "test",
        displayDescription: "Checks whether the test plugin is loaded.",
        description: "Checks whether the test plugin is loaded.",
        options: [],
        execute: (_args, ctx) => {
          const content = "✅ Test plugin works!";

          // Post a visible confirmation in the current channel.
          sendBotMessage(ctx.channel.id, content);

          // Also return content for command handlers that read return values.
          return { content };
        },
        applicationId: "-1",
        inputType: 1,
        type: 1
      });
    },

    onUnload() {
      if (typeof unregisterCommand === "function") unregisterCommand();
      unregisterCommand = undefined;
    }
  };
})()
