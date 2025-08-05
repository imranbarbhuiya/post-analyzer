# Prevent Submit

![Prevent Submit](https://raw.githubusercontent.com/imranbarbhuiya/post-analyzer/refs/heads/main/assets/icon.png)

A chrome extension that validates your tweet before submission, ensuring it meets the required criteria. If not, it'll prompt you to correct it before allowing submission.

## Demo

Check https://x.com/notparbez/status/1952438964725657814 for a video demo of the working of this extension.

## Installation

I don't have a published version yet, so here's how to install it manually:

1. Clone this repository:

   ```bash
    git clone https://github.com/imranbarbhuiya/post-analyzer
   ```

2. Build the extension:

   ```bash
    pnpm install
    pnpm dev # For development
    pnpm build # For production
   ```

3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable "Developer mode" at the top right.
5. Click on "Load unpacked" and select the `build/chrome-mv3-dev` or `build/chrome-mv3-prod` directory from the cloned repository.
6. The extension should now be installed and active.
