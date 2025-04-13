import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.12.0";
import process from "node:process"; // Import process to access environment variables

/**
 * Parses the invalidation pattern from Ghost's x-cache-invalidate header.
 * Mimics the logic from the original Node.js webhook manager.
 *
 * @param {string} pattern - The pattern string (e.g., "/$/", "/post-slug", "/page/*").
 * @param {string | undefined} ghostPublicUrl - Optional base public URL from env.
 * @returns {{ urls: string[], purgeAll: boolean, pattern: string, timestamp: string }} - Parsed data.
 */
function parseInvalidationPattern(pattern, ghostPublicUrl) {
    const purgeAll = pattern === "/$/" || pattern === "/*";
    // Bunny purge API seems to handle /* directly for full purge
    const baseUrls = purgeAll
        ? [`${ghostPublicUrl || ""}/*`] // Use /* directly if purging all
        : pattern.split(",").map((url) => url.trim());

    // Prepend public URL only if it's configured and the path is not already absolute
    // Ensure /* remains as is if ghostPublicUrl is not set
    const urls = baseUrls.map((url) => {
        if (url === "/*") return ghostPublicUrl ? `${ghostPublicUrl}/*` : "/*";
        if (url.startsWith("http")) return url;
        return ghostPublicUrl ? `${ghostPublicUrl}${url}` : url; // Return relative if no public URL
    });

    return {
        urls,
        purgeAll, // Keep for potential future logic, though not directly used in API call format
        pattern,
        timestamp: new Date().toISOString(),
    };
}

/**
 * When a response is not served from the cache, inspects the origin response
 * for an 'x-cache-invalidate' header and triggers a cache purge via API call if found.
 * Uses the specific /purge?url=... format.
 *
 * @param {Context} context - The context of the middleware.
 * @param {Request} context.request - The current request done to the origin.
 * @param {Response} context.response - The HTTP response from the origin.
 */
async function onOriginResponse(context) {
    const invalidationHeader =
        context.response.headers.get("x-cache-invalidate");

    if (invalidationHeader) {
        console.log(
            `EdgeScript: Detected x-cache-invalidate header: ${invalidationHeader}`
        );

        // --- Configuration from Environment Variables ---
        // Use process.env as shown in the user's example
        const ghostPublicUrl = process.env.GHOST_PUBLIC_URL;
        const apiKey = process.env.BUNNY_API_KEY;
        // --- End Configuration ---

        if (!apiKey) {
            console.error(
                "EdgeScript: BUNNY_API_KEY environment variable is not set. Cannot trigger purge."
            );
            return context.response; // Return original response
        }

        try {
            const invalidationData = parseInvalidationPattern(
                invalidationHeader,
                ghostPublicUrl
            );
            console.log(
                `EdgeScript: Parsed invalidation URLs: ${JSON.stringify(
                    invalidationData.urls
                )}`
            );

            // Base URL for the purge API
            const basePurgeUrl = "https://api.bunny.net/purge";

            // Trigger purge for each URL individually
            for (const urlToPurge of invalidationData.urls) {
                // Construct the specific URL for the API call
                // Using async=false as per the example
                const apiUrl = `${basePurgeUrl}?url=${encodeURIComponent(
                    urlToPurge
                )}&async=false`;

                const options = {
                    method: "POST",
                    headers: {
                        AccessKey: apiKey, // Use the apiKey from process.env
                    },
                };

                console.log(
                    `EdgeScript: Sending purge request for: ${urlToPurge}`
                );
                console.log(`EdgeScript: API URL: ${apiUrl}`);

                try {
                    const purgeResponse = await fetch(apiUrl, options);

                    if (!purgeResponse.ok) {
                        const errorText = await purgeResponse.text();
                        console.error(
                            `EdgeScript: Purge API request failed for ${urlToPurge}: ${purgeResponse.status} ${purgeResponse.statusText} - ${errorText}`
                        );
                    } else {
                        // Attempt to read JSON, but handle cases where it might not be JSON
                        try {
                            const jsonResponse = await purgeResponse.json();
                            console.log(
                                `EdgeScript: Purge API request successful for ${urlToPurge}: ${purgeResponse.status}`,
                                jsonResponse
                            );
                        } catch (jsonError) {
                            console.log(
                                `EdgeScript: Purge API request successful for ${urlToPurge}: ${purgeResponse.status} (Non-JSON response)`
                            );
                        }
                    }
                } catch (fetchError) {
                    console.error(
                        `EdgeScript: Network error during purge request for ${urlToPurge}: ${fetchError.message}`
                    );
                }
            }
        } catch (error) {
            console.error(
                `EdgeScript: Error processing invalidation or calling purge API: ${error.message}`
            );
            // Log error but don't block the original response
        }
    }

    // Always return the original response from the origin
    return context.response;
}

// Register the event handlers
BunnySDK.net.http.servePullZone().onOriginResponse(onOriginResponse);
