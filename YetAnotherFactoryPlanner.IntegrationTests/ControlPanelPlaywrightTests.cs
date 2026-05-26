using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Playwright integration tests covering Bug 4 and Bug 5.
///
/// Bug 4 — "Link copied!" tooltip never auto-dismisses.
///          It should disappear after ~2–3 seconds.
///
/// Bug 5 — "Reset ALL Factory Options" clears everything immediately with no confirmation.
///          A confirmation dialog should appear before the reset is applied.
///
/// Both tests assert the EXPECTED (fixed) behaviour and therefore fail against the
/// current implementation (TDD-style).
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
	/// Bug 4 — reproducer.
	/// Clicking "Save &amp; Share" shows a "Link copied!" tooltip. That tooltip should
	/// auto-dismiss after a few seconds. Currently it stays visible forever.
	/// </summary>
	[Fact]
	public async Task SaveAndShare_LinkCopiedTooltipDismissesAutomatically()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Add a production item so Save & Share is valid
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();
		await SelectItemAsync(page, "Iron Ingot");
		await SetAmountAsync(page, "30");

		// Click Save & Share to generate a link and trigger the tooltip
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Save & Share" }).ClickAsync();

		var tooltip = page.GetByText("Link copied!", new PageGetByTextOptions { Exact = true });
		await Expect(tooltip).ToBeVisibleAsync(new LocatorAssertionsToBeVisibleOptions { Timeout = 10_000 });

		// Assert
		// BUG 4: tooltip never dismisses — this assertion will fail until auto-dismiss is implemented.
		// Allow up to 5 s for the tooltip to disappear (it should auto-dismiss after 2–3 s).
		await Expect(tooltip).ToBeHiddenAsync(new LocatorAssertionsToBeHiddenOptions { Timeout = 5_000 });
	}

	/// <summary>
	/// Bug 5 — reproducer.
	/// Clicking "Reset ALL Factory Options" should prompt the user for confirmation
	/// before clearing all data. Currently it resets immediately with no dialog.
	/// </summary>
	[Fact]
	public async Task ResetAllFactoryOptions_ShowsConfirmationDialogBeforeResetting()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Add a production item so there is data to lose
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();
		await SelectItemAsync(page, "Iron Ingot");
		await SetAmountAsync(page, "30");

		// Verify the item row is present before the reset (check the Select input value)
		await Expect(page.GetByPlaceholder("Select an item").First).ToHaveValueAsync("Iron Ingot");

		// Act — click the reset button
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Reset ALL Factory Options" }).ClickAsync();

		// Assert
		// BUG 5: no confirmation dialog exists — this assertion will fail until one is added.
		// We look for a modal/dialog with a confirmation-style message.
		var confirmDialog = page.GetByRole(AriaRole.Dialog);
		await Expect(confirmDialog).ToBeVisibleAsync(new LocatorAssertionsToBeVisibleOptions { Timeout = 3_000 });

		// Data should NOT yet have been cleared — the user has not confirmed
		await Expect(page.GetByPlaceholder("Select an item").First).ToHaveValueAsync("Iron Ingot");
	}

	// ---------------------------------------------------------------------------
	// Page helpers
	// ---------------------------------------------------------------------------

	private async Task WaitForControlPanelAsync(IPage page)
	{
		// "Control Panel" heading is rendered only once game data has loaded
		await page.GetByRole(AriaRole.Heading, new PageGetByRoleOptions { Name = "Control Panel" })
			.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)AppReadyTimeout.TotalMilliseconds });
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
