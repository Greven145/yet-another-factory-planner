using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Playwright integration tests for the factory control panel.
///
/// Share — clicking "Share" copies a link and shows a "Link copied!" popover that
///         auto-dismisses after a couple of seconds (FactorySwitcher.onShare).
///
/// Reset — the "Reset to empty" item in the factory-actions (⋯) menu clears the
///         current factory's production items.
///
/// NOTE: the pre-multi-factory UI (removed in #148) had a "Control Panel" heading, a
/// "Save &amp; Share" button, and a "Reset ALL Factory Options" button with a
/// confirmation dialog. Those elements no longer exist; these tests target the current
/// FactorySwitcher UI. The share/factory-action controls live in the MAIN content
/// column, so the drawer is closed first (its backdrop otherwise intercepts the click).
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class ControlPanelPlaywrightTests(AppHostFixture appHost, BrowserFixture browser)
	: IClassFixture<BrowserFixture>, IAsyncLifetime
{
	private static readonly TimeSpan AppReadyTimeout = TimeSpan.FromSeconds(60);

	private Uri _clientBaseUri = null!;

	public async Task InitializeAsync()
	{
		await appHost.WaitForClientAsync();
		_clientBaseUri = appHost.GetClientBaseUri();
	}

	public Task DisposeAsync() => Task.CompletedTask;

	/// <summary>
	/// Clicking "Share" shows a "Link copied!" popover that auto-dismisses after ~2.5 s.
	/// </summary>
	[Fact]
	public async Task Share_LinkCopiedTooltipDismissesAutomatically()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Add a production item so Share is enabled (canShareFactory)
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();
		await SelectItemAsync(page, "Iron Ingot");
		await SetAmountAsync(page, "30");

		// Share lives in the main-content FactorySwitcher; close the drawer so its
		// backdrop no longer intercepts the click.
		await CloseDrawerAsync(page);
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Share" }).ClickAsync();

		var tooltip = page.GetByText("Link copied!", new PageGetByTextOptions { Exact = true });
		await Expect(tooltip).ToBeVisibleAsync(new LocatorAssertionsToBeVisibleOptions { Timeout = 10_000 });

		// Assert — the popover auto-dismisses (onShare clears `copied` after 2.5 s).
		await Expect(tooltip).ToBeHiddenAsync(new LocatorAssertionsToBeHiddenOptions { Timeout = 5_000 });
	}

	/// <summary>
	/// The factory-actions (⋯) menu's "Reset to empty" clears the current factory's
	/// production items.
	/// </summary>
	[Fact]
	public async Task ResetToEmpty_ClearsProductionItems()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Add a production item so there is data to clear
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();
		await SelectItemAsync(page, "Iron Ingot");
		await SetAmountAsync(page, "30");
		await Expect(page.GetByPlaceholder("Select an item").First).ToHaveValueAsync("Iron Ingot");

		// The factory-actions menu lives in the main-content FactorySwitcher; close the
		// drawer so its backdrop no longer intercepts the click.
		await CloseDrawerAsync(page);

		// Act — open the ⋯ menu and choose "Reset to empty"
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Factory actions" }).ClickAsync();
		await page.GetByRole(AriaRole.Menuitem, new PageGetByRoleOptions { Name = "Reset to empty" }).ClickAsync();

		// Assert — the production item is gone (the Select field no longer exists)
		await Expect(page.GetByPlaceholder("Select an item")).ToHaveCountAsync(0);
	}

	// ---------------------------------------------------------------------------
	// Page helpers
	// ---------------------------------------------------------------------------

	private async Task WaitForControlPanelAsync(IPage page)
	{
		// The "+ Add Product" button (in the default-open control panel's Production tab)
		// renders only once game data has loaded — a stable readiness signal. The old
		// "Control Panel" heading was removed by the multi-factory redesign (#148).
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" })
			.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)AppReadyTimeout.TotalMilliseconds });
	}

	private static async Task CloseDrawerAsync(IPage page)
	{
		// The drawer toggle is a text control that flips between "Close Control Panel"
		// (open) and "Open Control Panel" (closed).
		await page.GetByText("Close Control Panel").ClickAsync();
		await page.GetByText("Open Control Panel").WaitForAsync(
			new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 3_000 });
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
		var amountInput = page.GetByPlaceholder("Amount").First;
		await amountInput.ClickAsync();
		await amountInput.FillAsync(amount);
	}
}
