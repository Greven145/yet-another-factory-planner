using Microsoft.Playwright;

namespace YetAnotherFactoryPlanner.IntegrationTests;

/// <summary>
/// Class-level fixture that creates a single <see cref="IBrowser"/> instance shared
/// across all tests in a test class. Use <c>: IClassFixture&lt;BrowserFixture&gt;</c> on
/// each Playwright test class to wire it up.
/// Each test should create its own <see cref="IBrowserContext"/> for isolation.
/// </summary>
public sealed class BrowserFixture : IAsyncLifetime
{
	private IPlaywright? _playwright;
	private IBrowser? _browser;

	public IBrowser Browser => _browser ?? throw new InvalidOperationException("Browser has not been initialised.");

	public async Task InitializeAsync()
	{
		_playwright = await Playwright.CreateAsync();
		_browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
		{
			Headless = true,
			Args = ["--no-sandbox", "--disable-dev-shm-usage"],
		});
	}

	public async Task DisposeAsync()
	{
		if (_browser is not null)
			await _browser.DisposeAsync();
		_playwright?.Dispose();
	}
}
