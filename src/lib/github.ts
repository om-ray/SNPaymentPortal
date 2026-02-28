/**
 * Trigger GitHub Actions workflow to refresh TradingView session
 */
export async function triggerSessionRefresh(customerId?: string): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"

  if (!githubToken || !githubRepo) {
    console.error("GitHub token or repo not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "refresh-session",
          client_payload: {
            customer_id: customerId || "",
            triggered_at: new Date().toISOString(),
          },
        }),
      }
    );

    if (response.status === 204) {
      console.log(
        `Triggered session refresh workflow${customerId ? ` for customer ${customerId}` : ""}`
      );
      return true;
    } else {
      console.error(
        `Failed to trigger workflow: ${response.status} ${response.statusText}`
      );
      return false;
    }
  } catch (error) {
    console.error("Error triggering session refresh:", error);
    return false;
  }
}
