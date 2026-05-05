using Microsoft.Playwright;
using static Microsoft.Playwright.Assertions;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Playwright integration tests covering Bug 2 and Bug 3.
///
/// Bug 2 — Blank, unrecoverable error screen when the API returns an error on load.
///          There is no recovery action (e.g., "Start a new factory" button).
///
/// Bug 3 — Typo in the server error message: "occured" instead of "occurred".
///
/// Both tests are written TDD-style: they assert the EXPECTED (fixed) behaviour and
/// therefore fail against the current implementation.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class ErrorScreenPlaywrightTests(AppHostFixture appHost, BrowserFixture browser)
	: IClassFixture<BrowserFixture>, IAsyncLifetime
{
	private static readonly TimeSpan PageTimeout = TimeSpan.FromSeconds(30);

	private Uri _clientBaseUri = null!;

	public async Task InitializeAsync()
	{
		await appHost.WaitForClientAsync();
		_clientBaseUri = appHost.GetClientBaseUri();
	}

	public Task DisposeAsync() => Task.CompletedTask;

	/// <summary>
	/// Bug 3 — reproducer.
	/// The error message shown when the server returns an error should spell "occurred"
	/// correctly. The current message says "An error occured connecting to the server x_x".
	/// </summary>
	[Fact]
	public async Task ErrorScreen_SpellsOccurredCorrectly()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		// Act — navigate with a key that exists in the right format but was never saved;
		// the API will return a non-200 response and the client will show the error screen.
		await page.GotoAsync($"{_clientBaseUri}?factory=INVALID_KEY_123");

		var errorHeading = page.GetByText("An error", new PageGetByTextOptions { Exact = false });
		await errorHeading.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)PageTimeout.TotalMilliseconds });

		// Assert
		// BUG 3: current text is "An error occured connecting to the server x_x"
		// EXPECTED: "An error occurred connecting to the server x_x"
		var errorText = await errorHeading.TextContentAsync();
		Assert.NotNull(errorText);
		Assert.Contains("occurred", errorText, StringComparison.OrdinalIgnoreCase);
		Assert.DoesNotContain("occured", errorText, StringComparison.OrdinalIgnoreCase);
	}

	/// <summary>
	/// Bug 2 — reproducer.
	/// After the error screen is shown, the user should be able to navigate back to a
	/// working state. The current implementation renders no recovery action at all.
	/// </summary>
	[Fact]
	public async Task ErrorScreen_ShowsRecoveryButton()
	{
		// Arrange
		await using var context = await browser.Browser.NewContextAsync();
		var page = await context.NewPageAsync();

		// Act
		await page.GotoAsync($"{_clientBaseUri}?factory=INVALID_KEY_123");

		var errorHeading = page.GetByText("An error", new PageGetByTextOptions { Exact = false });
		await errorHeading.WaitForAsync(new LocatorWaitForOptions { Timeout = (float)PageTimeout.TotalMilliseconds });

		// Assert
		// BUG 2: no recovery button exists — test will fail until one is added
		var recoveryButton = page.GetByRole(AriaRole.Button, new PageGetByRoleOptions { Name = "Start a new factory" });
		await Expect(recoveryButton).ToBeVisibleAsync(new LocatorAssertionsToBeVisibleOptions
		{
			Timeout = 5_000,
		});
	}
}
