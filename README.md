# Ghost CMS Cache Invalidator for BunnyCDN Edge Scripts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automatically purge your BunnyCDN cache for Ghost CMS content updates using BunnyCDN Edge Scripts and Ghost's native `x-cache-invalidate` header.

## Overview

When you update content (posts, pages, settings) in Ghost CMS, it sends an `x-cache-invalidate` header along with the response to indicate which paths should be refreshed in any downstream caches.

This BunnyCDN Edge Script intercepts responses coming from your Ghost origin server. If it detects the `x-cache-invalidate` header, it parses the path(s) provided and uses the BunnyCDN Purge API to selectively clear the cache for those specific URLs or the entire zone. This ensures your readers always see the latest content without manual intervention or excessive full cache purges.

## Features

* **Automatic Purging:** No more manual cache clearing after publishing or updating content in Ghost.
* **Targeted Invalidation:** Purges only the necessary URLs based on Ghost's headers.
* **Full Zone Purge Support:** Handles Ghost's full site invalidation patterns (`/$` or `/*`) correctly.
* **Environment Variable Configuration:** Securely configure your BunnyCDN API Key and optional Ghost public URL via Edge Script environment variables.
* **Resilient:** Designed to log errors without blocking the original user response if the purge API call fails.
* **Easy Deployment:** Simple copy-paste deployment into the BunnyCDN Edge Rules interface.

## Prerequisites

* A Ghost CMS instance accessible to BunnyCDN.
* A BunnyCDN account with a Pull Zone configured to use your Ghost instance as the origin.
* Access to the BunnyCDN Edge Scripts feature.
* A BunnyCDN API Key.

## Installation & Setup

1.  **Get your BunnyCDN API Key:**
    * Log in to your BunnyCDN Dashboard.
    * Navigate to **Account** > **API** (from the user menu in the top right).
    * If you don't have one, enable API Access and copy the **API Key**. **Keep this key secure!**

2.  **Paste the Edge Script Code:**
    * Copy the entire content of the `middleware-script.js` file (the code you provided in the prompt) from this repository.
    * Paste the code into the Code Editor of the middleware script.

3.  **Configure Environment Variables:**
    * While editing the Edge Rule, navigate to the **Environment Variables** section (often a separate tab or section within the rule editor).
    * Add the following variables:
        * **`BUNNY_API_KEY`**: Paste your BunnyCDN API Key obtained in Step 1. Mark this as **Secret** if the option is available.
        * **`GHOST_PUBLIC_URL`** (Optional, but Recommended): Enter the full public URL of your Ghost site (e.g., `https://yourblog.com`).
            * **Why?** Ghost might send relative paths (like `/my-post/`) in the `x-cache-invalidate` header. This script uses `GHOST_PUBLIC_URL` to construct the full URL (e.g., `https://yourblog.com/my-post/`) needed by the BunnyCDN Purge API.
            * If Ghost sends absolute URLs, or if you omit this variable, the script will attempt to use the paths directly. Using the public URL ensures correctness, especially for full site purges (`/*`).

4.  **Save the Script and Link it to the Pull Zone:**
    * Click the **Save** button, and link the script to the appropriate Pull Zone.

## How it Works

1.  A user requests a page from your site via BunnyCDN.
2.  If the page isn't in the BunnyCDN cache (or the cache is stale), BunnyCDN requests it from your Ghost origin server.
3.  Ghost generates the response. If content relevant to the request was recently updated, Ghost includes the `x-cache-invalidate` header (e.g., `x-cache-invalidate: /updated-post-slug/`).
4.  The response travels back to the BunnyCDN edge server.
5.  The `Origin Response` trigger fires the Edge Script.
6.  The script checks if the `x-cache-invalidate` header exists.
7.  If found, it parses the header value(s):
    * It splits comma-separated paths.
    * It prepends the `GHOST_PUBLIC_URL` (if configured) to relative paths.
    * It handles `/$` and `/*` as full zone purge requests (formatted as `https://yourblog.com/*` or just `/*` if no public URL is set).
8.  For each resulting URL, the script makes a `POST` request to the BunnyCDN Purge API (`https://api.bunny.net/purge?url=...&async=false`).
9.  The request includes your `BUNNY_API_KEY` in the `AccessKey` header for authentication.
10. The script logs the actions and any success/error messages to the Edge Rule logs.
11. The original response from Ghost is passed back through BunnyCDN (potentially cached now) and served to the user.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details (or state the license directly if you don't have a separate file).