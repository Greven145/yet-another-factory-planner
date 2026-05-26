using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Playwright integration tests covering Bug 7.
///
/// Bug 7 — The production graph component (<c>GraphVisualizer</c> / Cytoscape.js) is
///          unmounted and fully remounted on every recalculation instead of being updated
///          in-place.
///
///          Root cause: <c>graphProps.key</c> was set to a new <c>nanoid()</c> on every
///          <c>useMemo</c> evaluation, which caused React to treat each recalculation
///          result as a completely new component.
///
///          Fix: use <c>useRef(nanoid()).current</c> for a stable key and add
///          <c>keepMounted</c> to the graph tab panel.
///
/// Written TDD-style: fails against the unfixed implementation.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class GraphPlaywrightTests(AppHostFixture appHost, BrowserFixture browser)
	: IClassFixture<BrowserFixture>, IAsyncLifetime
{
	private static readonly TimeSpan AppReadyTimeout = TimeSpan.FromSeconds(60);
	private static readonly TimeSpan GraphRenderTimeout = TimeSpan.FromSeconds(15);

	private Uri _clientBaseUri = null!;

	public async Task InitializeAsync()
	{
		await appHost.WaitForClientAsync();
		_clientBaseUri = appHost.GetClientBaseUri();
	}

	public Task DisposeAsync() => Task.CompletedTask;

	/// <summary>
	/// Bug 7 — reproducer.
	/// When the production plan is recalculated (e.g. the user changes an amount),
	/// the graph canvas element should remain the same DOM node — the Cytoscape instance
	/// is updated in-place rather than torn down and recreated. If the component
	/// remounts, <c>document.querySelector('canvas')</c> will return a different element
	/// than the one captured before the recalculation.
	/// </summary>
	[Fact]
	public async Task ProductionGraph_DoesNotRemountOnRecalculation()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Configure a production item (drawer is open by default)
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();
		await SelectItemAsync(page, "Iron Ingot");
		await SetAmountAsync(page, "30");

		// Close the drawer so its backdrop no longer intercepts clicks on the main content
		await CloseDrawerAsync(page);

		// Switch to the "Production Graph" tab to mount the graph for the first time
		await page.GetByRole(AriaRole.Tab, new PageGetByRoleOptions { Name = "Production Graph" }).ClickAsync();
		await WaitForGraphAsync(page);

		// Capture the identity of the canvas element after the first render
		await page.EvaluateAsync("() => { window.__firstCanvas = document.querySelector('canvas'); }");

		// Act — re-open the drawer to change the amount and trigger a recalculation
		await OpenDrawerAsync(page);
		await page.GetByRole(AriaRole.Tab, new PageGetByRoleOptions { Name = "Production", Exact = true }).ClickAsync();
		await SetAmountAsync(page, "60");

		// Close the drawer; we're still on the Production Graph tab
		await CloseDrawerAsync(page);

		// Wait for React to flush the recalculation and any resulting DOM mutations.
		// Poll until the canvas element reference stabilises (i.e. a canvas is present in the DOM).
		await page.WaitForFunctionAsync("() => document.querySelector('canvas') !== null");

		// Assert — the canvas element must be the same DOM node (no remount occurred)
		var isSameCanvas = await page.EvaluateAsync<bool>(
			"() => document.querySelector('canvas') === window.__firstCanvas"
		);

		// BUG 7: without the fix the graph remounts → a new canvas element is created →
		//         isSameCanvas is false.
		// EXPECTED: the graph is updated in place → isSameCanvas is true.
		Assert.True(isSameCanvas, "Bug 7: Graph canvas was remounted instead of updated in place");
	}

	// ---------------------------------------------------------------------------
	// Page helpers
	// ---------------------------------------------------------------------------

	private async Task WaitForControlPanelAsync(IPage page)
	{
		await page.GetByRole(AriaRole.Heading, new PageGetByRoleOptions { Name = "Control Panel" })
			.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)AppReadyTimeout.TotalMilliseconds });
	}

	private async Task WaitForGraphAsync(IPage page)
	{
		// The graph container (canvas element rendered by Cytoscape) appears once the
		// layout calculation is complete.
		await page.Locator("canvas")
			.First.WaitForAsync(new LocatorWaitForOptions
			{
				State = WaitForSelectorState.Visible,
				Timeout = (float)GraphRenderTimeout.TotalMilliseconds,
			});
	}

	private static async Task CloseDrawerAsync(IPage page)
	{
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Close Control Panel" }).ClickAsync();
		// Wait for the drawer animation to finish — the heading becomes hidden once fully closed
		await page.GetByRole(AriaRole.Heading, new PageGetByRoleOptions { Name = "Control Panel" })
			.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Hidden, Timeout = 3_000 });
	}

	private static async Task OpenDrawerAsync(IPage page)
	{
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Open Control Panel" }).ClickAsync();
		await page.GetByRole(AriaRole.Heading, new PageGetByRoleOptions { Name = "Control Panel" })
			.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 3_000 });
	}

	private static async Task SelectItemAsync(IPage page, string itemName)
	{
		var input = page.GetByPlaceholder("Select an item").First;
		await input.ClickAsync();
		await input.FillAsync(itemName);
		await page.GetByRole(AriaRole.Option, new PageGetByRoleOptions { Name = itemName, Exact = true })
			.First.ClickAsync();
	}

	private static async Task SetAmountAsync(IPage page, string amount)
	{
		var amountInput = page.GetByLabel("Amount").First;
		await amountInput.ClickAsync();
		await amountInput.FillAsync(amount);
	}
}
