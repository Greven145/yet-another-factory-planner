using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Playwright integration tests covering Bug 8.
///
/// Bug 8 — Item search field appends text instead of replacing the selected value.
///          When an item is already selected and the user clicks the field and types,
///          the new text is appended to the existing label instead of replacing it.
///
/// Written TDD-style: fails against the current implementation.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class ProductionTabPlaywrightTests(AppHostFixture appHost, BrowserFixture browser)
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
	/// Bug 8 — reproducer.
	/// After selecting "Iron Ingot", clicking the item field and typing "Computer"
	/// should replace the search text, not append to it.
	/// Currently the field ends up showing "Iron IngotComputer".
	/// </summary>
	[Fact]
	public async Task ItemField_TypingAfterSelectionReplacesExistingText()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		// Add a production item row
		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();

		var itemInput = page.GetByPlaceholder("Select an item").First;

		// Select "Iron Ingot" from the dropdown
		await itemInput.ClickAsync();
		await itemInput.FillAsync("Iron Ingot");
		await page.GetByRole(AriaRole.Option, new PageGetByRoleOptions { Name = "Iron Ingot", Exact = true })
			.First.ClickAsync();

		// Verify Iron Ingot is now displayed in the field
		await Expect(itemInput).ToHaveValueAsync("Iron Ingot");

		// Act — click the field again and type a new search term WITHOUT explicitly clearing
		await itemInput.ClickAsync();
		await page.Keyboard.TypeAsync("Computer");

		// Assert
		// BUG 8: currently the field shows "Iron IngotComputer" because the old text was
		// not selected/cleared on re-focus.
		// EXPECTED: the field shows only "Computer" (existing text was replaced on click).
		var fieldValue = await itemInput.InputValueAsync();
		Assert.Equal("Computer", fieldValue);
	}

	/// <summary>
	/// Complementary check: once a value is selected, click-then-select-all-then-type
	/// should also replace cleanly (verifies the programmatic workaround works too).
	/// </summary>
	[Fact]
	public async Task ItemField_SelectAllThenTypingReplacesText()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		await page.GotoAsync(_clientBaseUri.ToString());
		await WaitForControlPanelAsync(page);

		await page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "+ Add Product" }).ClickAsync();

		var itemInput = page.GetByPlaceholder("Select an item").First;

		await itemInput.ClickAsync();
		await itemInput.FillAsync("Iron Ingot");
		await page.GetByRole(AriaRole.Option, new PageGetByRoleOptions { Name = "Iron Ingot", Exact = true })
			.First.ClickAsync();

		// Act — click, select-all, then type
		await itemInput.ClickAsync();
		await page.Keyboard.PressAsync("Control+a");
		await page.Keyboard.TypeAsync("Computer");

		var fieldValue = await itemInput.InputValueAsync();
		Assert.Equal("Computer", fieldValue);
	}

	// ---------------------------------------------------------------------------
	// Page helpers
	// ---------------------------------------------------------------------------

	private async Task WaitForControlPanelAsync(IPage page)
	{
		await page.GetByRole(AriaRole.Heading, new PageGetByRoleOptions { Name = "Control Panel" })
			.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)AppReadyTimeout.TotalMilliseconds });
	}
}
